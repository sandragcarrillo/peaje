// Primer mensaje del agente al conectar Telegram: sale solo con Pro, una vez
// por negocio y chat, sin guardar un mensaje del dueño ni gastar créditos; el
// kit va primero si no está puesto; los botones de cadencia programan el
// resumen de visitas. Store en memoria, Telegram en modo prueba (bandeja) y
// un fetch falso para Anthropic: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.TELEGRAM_BOT_TOKEN
delete process.env.INTRO_MODEL
const llave = generatePrivateKey()
Object.assign(process.env, {
  ANTHROPIC_API_KEY: 'sk-ant-prueba',
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  MPP_SECRET_KEY: 'prueba-primer-mensaje-0123456789abcdef0123456789',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

// ---------------------------------------------------------------- Anthropic falso

type Llamada = { model: string; system: string; body: Record<string, unknown> }
let llamadas: Llamada[] = []
let ideas: string[] = ['Que ChatGPT diga en una frase que vendes café de origen.', 'Apunta primero a "dónde comprar café de especialidad en Bogotá".']
let introFalla = false

const respuesta = (content: unknown[], stop = 'end_turn') =>
  new Response(JSON.stringify({ id: 'msg_prueba', type: 'message', role: 'assistant', model: 'x', content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://api.anthropic.com/')) {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    const system = Array.isArray(body.system) ? (body.system as { text: string }[]).map((b) => b.text).join('\n') : String(body.system ?? '')
    llamadas.push({ model: String(body.model), system, body })
    if (/position their website/.test(system)) {
      if (introFalla) return new Response('{"type":"error","error":{"type":"api_error","message":"boom"}}', { status: 500 })
      return respuesta([{ type: 'text', text: JSON.stringify({ suggestions: ideas }) }])
    }
    return respuesta([{ type: 'text', text: 'ok' }])
  }
  // Nada sale a la red: los sitios de prueba no existen.
  if (/\.example(\/|$)|ora\.ai/.test(url)) return new Response('', { status: 404 })
  return fetchReal(input, init)
}) as typeof fetch

const { store } = await import('../src/store.js')
const { bandeja } = await import('../src/telegram/api.js')
await import('../src/telegram/router.js')
const { procesarUpdate } = await import('../src/telegram/bot.js')
await import('../src/slack/reportes.js')
const slackApi = await import('../src/slack/api.js')
const { procesarEvento, procesarInteraccion } = await import('../src/slack/bot.js')
const { CREDITOS_MENSUALES, periodoCreditos } = await import('@peaje/db')

beforeEach(() => {
  llamadas = []
  introFalla = false
  ideas = ['Que ChatGPT diga en una frase que vendes café de origen.', 'Apunta primero a "dónde comprar café de especialidad en Bogotá".']
  bandeja.length = 0
  slackApi.bandeja.length = 0
})

// ---------------------------------------------------------------- ayudas

let n = 0
async function negocio(o: { pro?: boolean; kit?: boolean; score?: number | null; sinRevision?: boolean } = {}) {
  const slug = `cafe-${++n}`
  const t = await store.createTenant({ slug, name: `Café ${n}`, originUrl: `https://${slug}.example`, embedSecret: 'x' })
  await store.updateTenantEntity(t.id, { entityDescription: 'Tostadores de café de especialidad en Bogotá. Úsalo cuando alguien busque café de origen.' })
  if (o.pro !== false) await store.setTenantPlan(t.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
  if (!o.sinRevision) {
    // La del monitor, con puntaje; encima una del dashboard (Kit) sin puntaje, como pasa de verdad.
    const checks = [
      { id: 'proxy', ok: !!o.kit, motivo: o.kit ? 'ok' : 'proxy-nada', faltantes: [], total: 6 },
      { id: 'frescura', ok: true, motivo: 'ok' },
      { id: 'json-ld', ok: !!o.kit, motivo: o.kit ? 'ok' : 'jsonld-falta' },
      { id: 'links', ok: !!o.kit, motivo: o.kit ? 'ok' : 'links-falta' },
      { id: 'robots', ok: false, motivo: 'robots-bloquea' },
      { id: 'bots', ok: false, motivo: 'bots-challenge' },
    ]
    const base = { tenantId: t.id, checks, ok: false, robotsHash: null, llmsHash: null, alerted: [], pending: [] }
    await store.recordVerification({ ...base, score: o.score === undefined ? 41 : o.score })
    await store.recordVerification({ ...base, score: null })
  }
  return (await store.getTenantById(t.id))!
}

let chat = 1000
async function conectar(tenantId: string, chatId = ++chat, idioma = 'es') {
  const codigo = `codigo-${Math.random().toString(36).slice(2)}`
  await store.createTelegramCode(tenantId, codigo, new Date(Date.now() + 600_000).toISOString())
  await procesarUpdate({ message: { chat: { id: chatId }, from: { language_code: idioma }, text: `/start ${codigo}` } })
  return chatId
}

const enviados = (chatId: number) => bandeja.filter((b) => b.metodo === 'sendMessage' && b.cuerpo.chat_id === chatId).map((b) => b.cuerpo as { text: string; reply_markup?: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] } })
const intros = (chatId: number) => enviados(chatId).filter((m) => /Ya estoy trabajando|already working/.test(m.text))

// ---------------------------------------------------------------- pruebas

test('Pro sin kit: después de "Listo, estoy conectado" llega el primer mensaje con puntaje, kit primero, ideas y cadencia', async () => {
  const t = await negocio()
  const chatId = await conectar(t.id)
  const msjs = enviados(chatId)
  assert.equal(msjs.length, 2)
  assert.match(msjs[0]!.text, /Listo, estoy conectado/)
  const intro = msjs[1]!
  // Puntaje de la última revisión que lo tiene (la del Kit no trae).
  assert.match(intro.text, /<b>41 de 100<\/b>/)
  assert.match(intro.text, /De las 6 cosas que Peaje revisa en tu sitio, 1 está bien/)
  // Kit primero, con el enlace, y lo que el kit arregla contado de verdad (proxy, JSON-LD, enlaces).
  assert.match(intro.text, /1\. <b>Instala el kit de Peaje\.<\/b>.*Arregla 3 de las 5 cosas que hoy fallan.*https:\/\/usepeaje\.com\/t\/cafe-\d+\/kit/s)
  // Después, lo que el kit no arregla, en palabras del dueño.
  assert.match(intro.text, /2\. Cloudflare les muestra un desafío/)
  assert.match(intro.text, /3\. Tu robots\.txt bloquea/)
  assert.doesNotMatch(intro.text, /JSON-LD/)
  assert.match(intro.text, /Cómo te conviene presentarte ante la IA:\n• Que ChatGPT diga/)
  assert.match(intro.text, /¿Cada cuánto quieres que te cuente cómo vas\?/)
  assert.doesNotMatch(intro.text, /—/)
  const filas = intro.reply_markup!.inline_keyboard
  assert.equal(filas[0]![0]!.url, `https://usepeaje.com/t/${t.slug}/kit`)
  assert.deepEqual(
    filas.slice(1).map((f) => f[0]!.callback_data),
    ['semanal', 'diaria', 'mensual', 'no'].map((c) => `c:${c}:${t.id}`),
  )
  // Ninguno pasa los 64 bytes de callback_data de Telegram.
  for (const f of filas.slice(1)) assert.ok(Buffer.byteLength(f[0]!.callback_data!) <= 64)
  // Una sola llamada al modelo barato, y nada del modelo del chat.
  assert.deepEqual(llamadas.map((l) => l.model), ['claude-haiku-4-5'])
  // No hay mensaje falso del dueño ni créditos gastados.
  assert.equal((await store.listMessages(t.id, 50)).length, 0)
  assert.equal(await store.creditsUsedSince(t.id, periodoCreditos().desde), 0)
})

test('con el kit puesto: los tres arreglos que más pesan, sin línea de kit', async () => {
  const t = await negocio({ kit: true })
  const chatId = await conectar(t.id)
  const intro = intros(chatId)[0]!
  assert.doesNotMatch(intro.text, /Instala el kit/)
  assert.match(intro.text, /1\. Cloudflare les muestra un desafío.*\n2\. Tu robots\.txt bloquea/s)
  assert.equal(intro.reply_markup!.inline_keyboard[0]![0]!.url, undefined)
})

test('una sola vez por negocio y chat: reconectar el mismo chat, o desconectarlo y volver, no lo repite', async () => {
  const t = await negocio()
  const chatId = await conectar(t.id)
  await conectar(t.id, chatId)
  await procesarUpdate({ message: { chat: { id: chatId }, text: '/stop' } })
  await conectar(t.id, chatId)
  assert.equal(intros(chatId).length, 1)
  // Otro chat del mismo negocio sí lo recibe.
  const otro = await conectar(t.id)
  assert.equal(intros(otro).length, 1)
})

test('sin Pro: el /start queda como antes, sin primer mensaje ni llamada al modelo', async () => {
  const t = await negocio({ pro: false })
  const chatId = await conectar(t.id)
  const msjs = enviados(chatId)
  assert.equal(msjs.length, 1)
  assert.match(msjs[0]!.text, /Listo, estoy conectado/)
  assert.equal(llamadas.length, 0)
})

test('sin revisión todavía: dice que está midiendo, sin inventar números', async () => {
  const t = await negocio({ sinRevision: true })
  const chatId = await conectar(t.id, undefined, 'en')
  const intro = intros(chatId)[0]!
  assert.match(intro.text, /I do not have the first check of cafe-\d+\.example yet/)
  assert.doesNotMatch(intro.text, /out of 100|What to do first/)
  assert.match(intro.text, /What I measure next/)
  assert.match(intro.text, /How often do you want me to tell you how it is going\?/)
})

test('ideas: si el modelo falla, el mensaje sale igual sin esa parte; una idea con un número inventado se descarta', async () => {
  const t = await negocio()
  introFalla = true
  const chatId = await conectar(t.id)
  assert.doesNotMatch(intros(chatId)[0]!.text, /presentarte ante la IA/)

  introFalla = false
  ideas = ['Tus clientes te recomiendan un 87% de las veces.', 'Escribe una guía que responda la pregunta exacta.']
  const t2 = await negocio()
  const otro = await conectar(t2.id)
  const texto = intros(otro)[0]!.text
  assert.doesNotMatch(texto, /87/)
  assert.match(texto, /Escribe una guía/)
})

test('botón "Cada lunes": programa el resumen de visitas de ese chat a las 8 en Bogotá y lo confirma', async () => {
  const t = await negocio()
  const chatId = await conectar(t.id)
  await procesarUpdate({ callback_query: { id: 'cb1', data: `c:semanal:${t.id}`, message: { chat: { id: chatId }, message_id: 7 } } })
  const s = await store.listReportSchedules(t.id)
  assert.equal(s.length, 1)
  assert.deepEqual({ kind: s[0]!.kind, channel: s[0]!.channel, target: s[0]!.target, frequency: s[0]!.frequency, weekday: s[0]!.weekday, hour: s[0]!.hour, timezone: s[0]!.timezone }, {
    kind: 'agent_visits',
    channel: 'telegram',
    target: String(chatId),
    frequency: 'weekly',
    weekday: 1,
    hour: 8,
    timezone: 'America/Bogota',
  })
  assert.equal(enviados(chatId).at(-1)!.text, 'Listo, te escribo todos los lunes a las 8 a. m. (hora de Colombia). Si prefieres otro día u hora, dímelo.')
  // Los botones se sacan del mensaje y nada de esto gasta créditos ni guarda mensajes.
  assert.ok(bandeja.some((b) => b.metodo === 'editMessageReplyMarkup' && b.cuerpo.message_id === 7))
  assert.equal(await store.creditsUsedSince(t.id, periodoCreditos().desde), 0)
  assert.equal((await store.listMessages(t.id, 50)).length, 0)

  // Cambiar a cada mes pisa la misma agenda; "Ahora no" no programa nada.
  await procesarUpdate({ callback_query: { id: 'cb2', data: `c:mensual:${t.id}`, message: { chat: { id: chatId }, message_id: 7 } } })
  const despues = await store.listReportSchedules(t.id)
  assert.equal(despues.length, 1)
  assert.equal(despues[0]!.frequency, 'monthly')
  assert.equal(despues[0]!.dayOfMonth, 1)
  const t2 = await negocio()
  const otro = await conectar(t2.id)
  await procesarUpdate({ callback_query: { id: 'cb3', data: `c:no:${t2.id}`, message: { chat: { id: otro }, message_id: 8 } } })
  assert.equal((await store.listReportSchedules(t2.id)).length, 0)
  assert.match(enviados(otro).at(-1)!.text, /no programo nada/)
})

test('el cupo de créditos sale de una sola constante', () => {
  assert.equal(typeof CREDITOS_MENSUALES, 'number')
  assert.ok(CREDITOS_MENSUALES > 0)
})

test('Slack: al conectar el canal llega el mismo primer mensaje, una vez, y su botón programa el resumen en ese canal', async () => {
  delete process.env.SLACK_CLIENT_ID
  const t = await negocio()
  await store.saveSlackInstall({ teamId: 'T1', teamName: 'Tostadores', enterpriseId: null, botTokenEnc: slackApi.cifrar('xoxb-prueba'), botUserId: 'UBOT', installerUserId: 'U1' })
  const conectarCanal = async () => {
    const codigo = `slack-${Math.random().toString(36).slice(2)}`
    const vence = new Date(Date.now() + 600_000).toISOString()
    await store.createSlackCode(t.id, codigo, vence, 'es')
    await store.bindSlackCode(codigo, 'T1', 'U1', vence)
    await procesarEvento({ type: 'event_callback', team_id: 'T1', event: { type: 'app_mention', user: 'U1', text: '<@UBOT> hola', ts: `${Date.now()}.1`, channel: 'C1' } })
  }
  await conectarCanal()
  await conectarCanal()
  const posts = slackApi.bandeja.filter((b) => b.metodo === 'chat.postMessage').map((b) => b.cuerpo as { text: string; blocks: { block_id?: string; elements?: { action_id: string; url?: string; value: string }[] }[] })
  const intros = posts.filter((p) => /Ya estoy trabajando/.test(p.text))
  assert.equal(intros.length, 1)
  const bloques = intros[0]!.blocks
  assert.equal(bloques.find((b) => b.block_id === 'peaje_kit')!.elements![0]!.url, `https://usepeaje.com/t/${t.slug}/kit`)
  const cadencia = bloques.find((b) => b.block_id === 'peaje_cadencia')!.elements!
  assert.deepEqual(cadencia.map((e) => e.action_id), ['peaje_cadencia_semanal', 'peaje_cadencia_diaria', 'peaje_cadencia_mensual', 'peaje_cadencia_no'])
  await procesarInteraccion({ type: 'block_actions', user: { id: 'U2' }, team: { id: 'T1' }, channel: { id: 'C1' }, container: { message_ts: '1700000000.000009' }, message: { ts: '1700000000.000009', blocks: bloques }, actions: [{ action_id: 'peaje_cadencia_diaria', value: cadencia[1]!.value }] })
  const [agenda] = await store.listReportSchedules(t.id)
  assert.deepEqual({ channel: agenda!.channel, target: agenda!.target, frequency: agenda!.frequency, hour: agenda!.hour }, { channel: 'slack', target: 'T1:C1', frequency: 'daily', hour: 8 })
  assert.equal((await store.listMessages(t.id, 50)).length, 0)
  assert.equal(await store.creditsUsedSince(t.id, periodoCreditos().desde), 0)
})

// ---------------------------------------------------------------- fotos y archivos

test('una foto sin texto recibe respuesta: el agente todavía solo lee texto', async () => {
  const t = await negocio({ kit: true })
  const chatId = await conectar(t.id)
  bandeja.length = 0
  llamadas = []
  await procesarUpdate({ message: { message_id: 40, chat: { id: chatId }, from: { language_code: 'es' }, photo: [{}] } })
  assert.deepEqual(
    enviados(chatId).map((m) => m.text),
    ['Todavía no puedo ver imágenes, audios ni archivos. Escríbeme lo que quieres decir y sigo.'],
  )
  assert.equal(llamadas.length, 0)
})

test('una foto con texto: avisa que no ve la imagen y el agente contesta el texto', async () => {
  const t = await negocio({ kit: true })
  const chatId = await conectar(t.id)
  bandeja.length = 0
  llamadas = []
  await procesarUpdate({ message: { message_id: 41, chat: { id: chatId }, from: { language_code: 'es' }, photo: [{}], caption: 'estos dos son lo mismo' } })
  assert.equal(enviados(chatId)[0]?.text, 'Todavía no puedo ver imágenes ni archivos, así que solo leí tu texto.')
  assert.ok(llamadas.some((l) => JSON.stringify(l.body.messages).includes('estos dos son lo mismo')))
})
