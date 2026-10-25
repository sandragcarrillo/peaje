/**
 * Prueba de Slack con el store en memoria y Slack en modo prueba (nada sale:
 * queda en la bandeja). No llama a Slack ni a Anthropic.
 *   cd apps/gateway && npx tsx scripts/slack.test.mts
 */
import assert from 'node:assert/strict'

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_TOKEN_KEY', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN']) delete process.env[k]
process.env.MPP_SECRET_KEY ??= 'x'.repeat(64)
process.env.TREASURY_ADDRESS ??= '0x' + '1'.repeat(40)
process.env.TREASURY_PRIVATE_KEY ??= '0x' + '1'.repeat(64)
process.env.INTERNAL_API_SECRET = 'secreto-de-prueba'
process.env.GATEWAY_PUBLIC_URL = 'https://api.usepeaje.com'
// Con signing secret las rutas exigen la firma aunque el resto esté en modo prueba.
const SECRETO = 'secreto-de-firma'
process.env.SLACK_SIGNING_SECRET = SECRETO

const { store } = await import('../src/store.ts')
const api = await import('../src/slack/api.ts')
const { slackRouter, esperarFilas } = await import('../src/slack/router.ts')
const { bloquesBotones, limpiarMencion } = await import('../src/slack/bot.ts')
const { canalReportes } = await import('../src/reportes/entregar.ts')

// ---- 1. firma: el ejemplo de la documentación de Slack ----
const cuerpoDoc =
  'token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&team_domain=testteamnow&channel_id=G8PSS9T3V&channel_name=foobar&user_id=U2CERLKJA&user_name=roadrunner&command=%2Fwebhook-collect&text=&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FT1DC2JH3J%2F397700885554%2F96rGlfmibIGlgcZRskXaIFfN&trigger_id=398738663015.47445629121.803a0bc887a14d10d2c447fce8b6703c'
const firmaDoc = 'v0=a2114d57b48eac39b9ad189dd8316235a7b4a8d21a10bd27519666489c69b503'
assert.equal(api.firmar('8f742231b10e8888abcd99yyyzzz85a5', '1531420618', cuerpoDoc), firmaDoc)
assert.equal(api.verificarFirma('8f742231b10e8888abcd99yyyzzz85a5', '1531420618', cuerpoDoc, firmaDoc, 1531420618_000 + 60_000), true)
// Fuera de la ventana de 5 minutos, cuerpo alterado o firma de otro largo: no.
assert.equal(api.verificarFirma('8f742231b10e8888abcd99yyyzzz85a5', '1531420618', cuerpoDoc, firmaDoc, 1531420618_000 + 301_000), false)
assert.equal(api.verificarFirma('8f742231b10e8888abcd99yyyzzz85a5', '1531420618', cuerpoDoc + 'x', firmaDoc, 1531420618_000), false)
assert.equal(api.verificarFirma('8f742231b10e8888abcd99yyyzzz85a5', '1531420618', cuerpoDoc, 'v0=abc', 1531420618_000), false)
console.log('firma: ok (ejemplo de la documentación)')

// ---- 2. cifrado del token ----
const cifrado = api.cifrar('xoxb-123')
assert.notEqual(cifrado, 'xoxb-123')
assert.equal(api.descifrar(cifrado), 'xoxb-123')
console.log('token cifrado: ok')

// ---- 3. mrkdwn ----
assert.equal(api.aMrkdwn('**Hola** & <tú>'), '*Hola* &amp; &lt;tú&gt;')
assert.equal(api.aMrkdwn('- uno\n- dos'), '• uno\n• dos')
assert.equal(api.aMrkdwn('ver [la página](https://a.com/x?a=1&b=2)'), 'ver <https://a.com/x?a=1&amp;b=2|la página>')
assert.equal(api.aMrkdwn('`**no**` y *ital*'), '`**no**` y _ital_')
assert.equal(api.aMrkdwn('## Título'), '*Título*')
const largo = Array.from({ length: 30 }, (_, i) => `Párrafo ${i} ${'x'.repeat(200)}`).join('\n\n')
const partes = api.partir(largo, 2_700)
assert.ok(partes.length > 1 && partes.every((p) => p.length <= 2_700))
assert.ok(api.partir('y'.repeat(7_000), 2_900).every((p) => p.length <= 2_900))
assert.equal(limpiarMencion('<@UBOT> ¿cómo voy?', 'UBOT'), '¿cómo voy?')
console.log('mrkdwn y partir: ok')

// ---- helpers HTTP firmados ----
const ahora = () => String(Math.floor(Date.now() / 1000))
async function evento(body: unknown, extra: Record<string, string> = {}) {
  const raw = JSON.stringify(body)
  const ts = ahora()
  return slackRouter.request('/slack/events', { method: 'POST', headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': ts, 'x-slack-signature': api.firmar(SECRETO, ts, raw), ...extra }, body: raw })
}
async function clic(payload: unknown) {
  const raw = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
  const ts = ahora()
  return slackRouter.request('/slack/interactions', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': ts, 'x-slack-signature': api.firmar(SECRETO, ts, raw) }, body: raw })
}
const auth = { authorization: 'Bearer secreto-de-prueba', 'content-type': 'application/json' }
const enviado = () => api.bandeja.splice(0)
const textos = (b: { metodo: string; cuerpo: Record<string, unknown> }[]) => b.map((x) => JSON.stringify(x.cuerpo)).join('\n')

// ---- 4. url_verification y firma en la ruta ----
const sinFirma = await slackRouter.request('/slack/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'url_verification', challenge: 'abc' }) })
assert.equal(sinFirma.status, 401)
const verif = await evento({ token: 'x', type: 'url_verification', challenge: '3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P' })
assert.equal(verif.status, 200)
assert.deepEqual(await verif.json(), { challenge: '3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P' })
console.log('url_verification: ok')

// ---- 5. instalación: link del dashboard → install → callback ----
const tenant = await store.createTenant({ slug: 'cafe', name: 'Café Prueba', originUrl: 'https://cafe.example', embedSecret: 's' })
const link = (await (await slackRouter.request('/_internal/cafe/slack/link', { method: 'POST', headers: auth, body: JSON.stringify({ language: 'es' }) })).json()) as { url: string }
assert.match(link.url, /^https:\/\/api\.usepeaje\.com\/slack\/install\?code=/)
const codigo = new URL(link.url).searchParams.get('code')!
const inst = await slackRouter.request(`/slack/install?code=${codigo}`)
assert.equal(inst.status, 302)
const autorizar = new URL(inst.headers.get('location')!)
assert.equal(autorizar.origin + autorizar.pathname, 'https://slack.com/oauth/v2/authorize')
assert.equal(autorizar.searchParams.get('scope'), 'app_mentions:read,chat:write,im:history')
assert.equal(autorizar.searchParams.get('redirect_uri'), 'https://api.usepeaje.com/slack/oauth/callback')
assert.equal(autorizar.searchParams.get('state'), codigo)
const cookie = inst.headers.get('set-cookie')!.split(';')[0]!
// Sin la cookie del navegador que empezó el OAuth: no.
assert.equal((await slackRouter.request(`/slack/oauth/callback?code=abc&state=${codigo}`)).status, 400)
const cb = await slackRouter.request(`/slack/oauth/callback?code=abc&state=${codigo}`, { headers: { cookie } })
assert.equal(cb.status, 200)
assert.match(await cb.text(), /Peaje está en tu Slack/)
const install = await store.getSlackInstall('TPRUEBA')
assert.ok(install && install.installerUserId === 'UINSTALA' && install.botUserId === 'UBOTPRUEBA')
assert.ok(!install.botTokenEnc.includes('xoxb'), 'el token se guarda cifrado')
console.log('OAuth: ok')

// ---- 6. mención en un canal sin conectar, de alguien que no instaló ----
const CANAL = 'C0CANAL'
let r = await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev1', event: { type: 'app_mention', user: 'UOTRO', text: '<@UBOTPRUEBA> hola', ts: '1.1', channel: CANAL } })
assert.equal(r.status, 200)
await esperarFilas()
let b = enviado()
assert.match(textos(b), /todavía no está conectado/)
assert.equal(b[0]!.cuerpo.thread_ts, '1.1', 'responde en el hilo de la mención')
assert.equal(await store.getSlackLink('TPRUEBA', CANAL), null)

// La primera mención de quien instaló conecta el canal.
await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev2', event: { type: 'app_mention', user: 'UINSTALA', text: '<@UBOTPRUEBA> hola', ts: '1.2', channel: CANAL } })
await esperarFilas()
b = enviado()
assert.match(textos(b), /quedó conectado a Café Prueba/)
assert.equal((await store.getSlackLink('TPRUEBA', CANAL))?.tenantId, tenant.id)
console.log('conectar canal: ok')

// Reintento de Slack con el mismo event_id: no se procesa dos veces.
await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev2', event: { type: 'app_mention', user: 'UINSTALA', text: '<@UBOTPRUEBA> hola', ts: '1.2', channel: CANAL } }, { 'x-slack-retry-num': '1', 'x-slack-retry-reason': 'http_timeout' })
await esperarFilas()
assert.equal(enviado().length, 0)
console.log('dedupe de reintentos: ok')

// ---- 7. pregunta de cualquiera en el canal conectado ----
// Sin ANTHROPIC_API_KEY, conversar falla: el flujo igual pone el provisorio y lo reemplaza por el error.
await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev3', event: { type: 'app_mention', user: 'UOTRO', text: '<@UBOTPRUEBA> ¿cómo voy?', ts: '1.3', channel: CANAL } })
await esperarFilas()
b = enviado()
assert.equal(b[0]!.metodo, 'chat.postMessage')
assert.match(String(b[0]!.cuerpo.text), /Un momento/)
assert.equal(b[1]!.metodo, 'chat.update')
assert.match(String(b[1]!.cuerpo.text), /No pude responder/)
// Mensajes de bots (incluido el propio) se ignoran.
await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev4', event: { type: 'message', channel_type: 'im', bot_id: 'B1', text: 'eco', ts: '1.4', channel: 'D1' } })
await esperarFilas()
assert.equal(enviado().length, 0)
console.log('pregunta abierta y bots ignorados: ok')

// ---- 8. propuesta con botones: solo quien instaló aprueba ----
const msj = await store.addMessage({
  tenantId: tenant.id,
  role: 'assistant',
  text: 'Te propongo **subir** el precio.',
  options: ['¿Y si bajo?'],
  links: [{ label: 'Ver reporte', url: 'https://usepeaje.com/t/cafe' }],
  actions: [{ id: 'act-12345678-abcd', type: 'route.create', summary: 'Publish GET /api/menu at $0.05', params: { method: 'GET', path: '/api/menu', priceUsd: '0.050000', description: null }, status: 'pending' }],
  channel: 'slack',
})
const bloques = bloquesBotones(tenant.id, msj, 'es')
const acciones = bloques.find((x) => x.block_id === 'peaje_prop_act-1234') as { elements: { action_id: string; value: string; text: { text: string } }[] }
assert.ok(acciones, 'bloque de aprobar/descartar')
assert.equal(acciones.elements[0]!.text.text, 'Aplicar')
const enlaces = bloques.find((x) => x.block_id === 'peaje_links') as { elements: { url: string }[] }
assert.equal(enlaces.elements[0]!.url, 'https://usepeaje.com/t/cafe')
const aprobar = acciones.elements[0]!
const base = { type: 'block_actions', team: { id: 'TPRUEBA' }, channel: { id: CANAL }, container: { message_ts: '2.0', channel_id: CANAL }, message: { ts: '2.0', thread_ts: '1.3', text: 'x', blocks: bloques } }

r = await clic({ ...base, user: { id: 'UOTRO', team_id: 'TPRUEBA' }, actions: [{ action_id: aprobar.action_id, value: aprobar.value }] })
assert.equal(r.status, 200)
await esperarFilas()
b = enviado()
assert.match(textos(b), /Solo quien instaló Peaje en este Slack puede aprobar cambios de precio o de rutas/)
assert.equal(b[0]!.cuerpo.thread_ts, '1.3')
assert.equal((await store.listRoutes(tenant.id)).length, 0, 'no se aplicó nada')

await clic({ ...base, user: { id: 'UINSTALA', team_id: 'TPRUEBA' }, actions: [{ action_id: aprobar.action_id, value: aprobar.value }] })
await esperarFilas()
b = enviado()
assert.match(textos(b), /Aplicado por <@UINSTALA>/)
assert.ok(b.some((x) => x.metodo === 'chat.update'), 'saca los botones del mensaje original')
const rutas = await store.listRoutes(tenant.id)
assert.equal(rutas.length, 1)
assert.equal(rutas[0]!.pathPattern, '/api/menu')
// Segundo clic: ya resuelta.
await clic({ ...base, user: { id: 'UINSTALA', team_id: 'TPRUEBA' }, actions: [{ action_id: aprobar.action_id, value: aprobar.value }] })
await esperarFilas()
assert.match(textos(enviado()), /ya se resolvió/)
console.log('aprobación solo del instalador: ok')

// ---- 9. reportes programados y dashboard ----
const canal = canalReportes('slack')!
assert.ok(canal, 'canal slack registrado')
const destinos = await canal.destinos(tenant.id)
assert.equal(destinos[0]!.target, `TPRUEBA:${CANAL}`)
await canal.enviar({ target: `TPRUEBA:${CANAL}` } as never, tenant, { tipo: 'reporte', texto: '**Semana**\n- 12 visitas', botones: [{ text: 'Abrir', url: 'https://usepeaje.com' }] }, 'es')
b = enviado()
assert.match(textos(b), /\*Semana\*/)
const estado = (await (await slackRouter.request('/_internal/cafe/slack', { headers: auth })).json()) as { configured: boolean; links: { channelId: string; teamName: string }[] }
assert.equal(estado.configured, false)
assert.equal(estado.links[0]!.channelId, CANAL)
assert.equal(estado.links[0]!.teamName, 'Equipo de prueba')
await slackRouter.request(`/_internal/cafe/slack?team=TPRUEBA&channel=${CANAL}`, { method: 'DELETE', headers: auth })
assert.equal((await store.listSlackLinks(tenant.id)).length, 0)
console.log('reportes y dashboard: ok')

// ---- 10. app desinstalada ----
await evento({ type: 'event_callback', team_id: 'TPRUEBA', event_id: 'Ev9', event: { type: 'app_uninstalled' } })
await esperarFilas()
assert.equal(await store.getSlackInstall('TPRUEBA'), null)
console.log('app_uninstalled: ok')

console.log('\nslack: todo ok')
process.exit(0)
