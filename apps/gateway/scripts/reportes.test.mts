/**
 * Prueba de punta a punta de los reportes programados, con el store en
 * memoria y Telegram en modo prueba (nada sale: queda en la bandeja).
 *   cd apps/gateway && npx tsx scripts/reportes.test.mts
 */
import assert from 'node:assert/strict'

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TELEGRAM_BOT_TOKEN', 'ANTHROPIC_API_KEY']) delete process.env[k]
process.env.MPP_SECRET_KEY ??= 'x'.repeat(64)
process.env.TREASURY_ADDRESS ??= '0x' + '1'.repeat(40)
process.env.TREASURY_PRIVATE_KEY ??= '0x' + '1'.repeat(64)
process.env.INTERNAL_API_SECRET = 'secreto-de-prueba'
process.env.DASHBOARD_PUBLIC_URL = 'https://usepeaje.com'

const { store } = await import('../src/store.ts')
const { bandeja } = await import('../src/telegram/api.ts')
const { monitorRouter } = await import('../src/monitor/index.ts')
const { reportesRouter } = await import('../src/reportes/router.ts')
const { probarHerramienta } = await import('../src/tareas/agente.ts')

const auth = { authorization: 'Bearer secreto-de-prueba', 'content-type': 'application/json' }
const correr = async (now: string) => (await (await monitorRouter.request(`/schedules?now=${encodeURIComponent(now)}`, { method: 'POST', headers: auth })).json()) as any

const tenant = await store.createTenant({ slug: 'cafe', name: 'Café Prueba', originUrl: 'https://cafe.example', embedSecret: 's' })
const CHAT = 777
await store.linkTelegram({ chatId: CHAT, tenantId: tenant.id, username: 'dueno', language: 'es' })

// Visitas: 20-23 oct caen en la semana anterior (4); 24 oct 15:00Z ya cae en esta (12 en total, 2 pagadas).
const v = (at: string, kind: any, path: string, paid = false) => ({ tenantId: tenant.id, at, path, method: 'GET', userAgent: null, agentKind: kind, paid, network: paid ? 'tempo' : null, amount: paid ? '0.05' : null, paymentId: null, status: paid ? 200 : 200, routeId: null, priceUsd: paid ? '0.05' : null, attempted: paid })
await store.recordVisits([
  ...Array.from({ length: 5 }, (_, i) => v(`2026-10-2${i}T15:00:00Z`, 'googlebot', '/menu')),
  v('2026-10-25T10:00:00Z', 'openai-searchbot', '/menu'),
  v('2026-10-25T11:00:00Z', 'openai-searchbot', '/menu'),
  v('2026-10-26T11:00:00Z', 'openai-searchbot', '/precios'),
  v('2026-10-26T12:00:00Z', 'perplexitybot', '/menu'),
  v('2026-10-27T12:00:00Z', 'claudebot', '/llms.txt'),
  v('2026-10-28T12:00:00Z', 'gptbot', '/llms.txt'),
  v('2026-10-28T13:00:00Z', 'googlebot', '/'),
  v('2026-10-29T13:00:00Z', 'other', '/wp-admin'),
  v('2026-10-29T14:00:00Z', 'other', '/'),
  v('2026-10-30T14:00:00Z', 'x402-client', '/api/precios', true),
  v('2026-10-30T15:00:00Z', 'mpp-client', '/api/precios', true),
])

// 1. El agente en Telegram programa "cada lunes a las 8" para este chat.
const set = (await probarHerramienta('schedule_report', { action: 'set', kind: 'agent_visits', frequency: 'weekly', hour: 8, weekday: 1 }, { tenant, idioma: 'es', destino: { canal: 'telegram', id: String(CHAT) } })) as any
assert.equal(set.saved.destination, 'Telegram @dueno')
assert.equal(set.saved.here, true)
console.log('set (telegram):', set.saved.next_run_local)

// Desde el dashboard: sin chat, la herramienta ofrece los destinos.
const sinChat = (await probarHerramienta('schedule_report', { action: 'set', frequency: 'daily', hour: 9 }, { tenant, idioma: 'es' })) as any
assert.equal(sinChat.error, 'no-chat')
assert.equal(sinChat.destinations[0].target, String(CHAT))
// Y en una corrida programada no se programa nada.
const enCorrida = (await probarHerramienta('schedule_report', { action: 'set', frequency: 'daily', hour: 9 }, { tenant, idioma: 'es', destino: { canal: 'telegram', id: String(CHAT) }, programado: true })) as any
assert.match(enCorrida.error, /scheduled run/)

// Un custom por el dashboard (PUT), con su pedido.
const put = await reportesRouter.request('/_internal/cafe/schedules', { method: 'PUT', headers: auth, body: JSON.stringify({ channel: 'telegram', target: String(CHAT), kind: 'custom', prompt: '¿Qué se movió y qué hacemos?', frequency: 'weekly', hour: 8, weekday: 1, timezone: 'America/Bogota' }) })
assert.equal(put.status, 200)
const putOtro = await reportesRouter.request('/_internal/cafe/schedules', { method: 'PUT', headers: auth, body: JSON.stringify({ channel: 'telegram', target: '999', frequency: 'daily', hour: 8 }) })
assert.equal(putOtro.status, 400, 'un chat que no es del negocio no se acepta')
const get = (await (await reportesRouter.request('/_internal/cafe/schedules', { headers: auth })).json()) as any
assert.equal(get.schedules.length, 2)
assert.equal(get.destinations.length, 1)
const sinAuth = await reportesRouter.request('/_internal/cafe/schedules', {})
assert.equal(sinAuth.status, 401)

// Para la prueba: primera corrida el lunes 2 nov a las 8 Bogotá, con last_run_at hace una semana.
const visitas = (await store.listReportSchedules(tenant.id)).find((s) => s.kind === 'agent_visits')!
assert.equal(visitas.nextRunAt, '2026-10-26T13:00:00.000Z') // hoy es 24 oct en el reloj real
await store.upsertReportSchedule({ ...visitas, nextRunAt: '2026-10-31T13:00:00.000Z' })
await store.markReportScheduleSent(visitas.id, { previousNextRunAt: '2026-10-31T13:00:00.000Z', sentAt: '2026-10-24T13:00:00.000Z', nextRunAt: '2026-10-31T13:00:00.000Z' })

// 2. El cron corre dos veces seguidas: un solo envío.
bandeja.length = 0
const r1 = await correr('2026-10-31T13:05:00Z')
const r2 = await correr('2026-10-31T13:06:00Z')
console.log('corrida 1:', JSON.stringify(r1))
assert.equal(r1.results.find((x: any) => x.kind === 'agent_visits').result, 'sent')
assert.equal(r1.results.find((x: any) => x.kind === 'agent_visits').nextRunAt, '2026-11-02T13:00:00.000Z')
assert.equal(r2.due, 0)
const reporte = bandeja.filter((b) => b.metodo === 'sendMessage')
assert.equal(reporte.length, 1)
console.log('\n--- mensaje ---\n' + String(reporte[0]!.cuerpo.text) + '\n' + JSON.stringify(reporte[0]!.cuerpo.reply_markup))
const texto = String(reporte[0]!.cuerpo.text)
assert.match(texto, /En los últimos 7 días: 12 visitas, 8 más que la semana anterior \(\+200%\)/)
assert.match(texto, /Agentes que pagan: 2/)
assert.match(texto, /Pagos: 2 pedidos pagados, US\$0\.10/)
assert.doesNotMatch(texto, /—/)

// 3. Una semana sin visitas: lo dice y da una cosa para hacer.
bandeja.length = 0
const s2 = (await store.listReportSchedules(tenant.id)).find((s) => s.kind === 'agent_visits')!
await store.upsertReportSchedule({ ...s2, nextRunAt: '2026-11-30T13:00:00.000Z' })
await store.markReportScheduleSent(s2.id, { previousNextRunAt: '2026-11-30T13:00:00.000Z', sentAt: '2026-11-23T13:00:00.000Z', nextRunAt: '2026-11-30T13:00:00.000Z' })
// el custom también está vencido a esta altura: sin ANTHROPIC_API_KEY queda en error, sin mandar nada
const r3 = await correr('2026-11-30T13:01:00Z')
console.log('corrida 3:', JSON.stringify(r3.results.map((x: any) => [x.kind, x.result, x.error])))
assert.equal(r3.results.find((x: any) => x.kind === 'custom').result, 'error')
const cero = bandeja.filter((b) => b.metodo === 'sendMessage')
assert.equal(cero.length, 1)
console.log('\n--- mensaje sin visitas ---\n' + String(cero[0]!.cuerpo.text))
assert.match(String(cero[0]!.cuerpo.text), /No hubo visitas de agentes en los últimos 7 días/)

// 3b. Lo que manda Telegram para un custom: el pedido y la respuesta del agente con sus botones.
const { canalReportes } = await import('../src/reportes/entregar.ts')
bandeja.length = 0
const custom = (await store.listReportSchedules(tenant.id)).find((s) => s.kind === 'custom')!
const respuesta = { id: 'm1', tenantId: tenant.id, role: 'assistant' as const, text: 'Esta semana subieron las visitas de ChatGPT.', actions: [], options: ['Arma la página', 'Otra cosa'], channel: 'telegram', createdAt: new Date().toISOString() }
await canalReportes('telegram')!.enviar(custom, tenant, { tipo: 'agente', pedido: custom.prompt!, mensaje: respuesta as any }, 'es')
const enviados = bandeja.filter((b) => b.metodo === 'sendMessage')
assert.equal(enviados.length, 2)
assert.equal(enviados[0]!.cuerpo.text, '› ¿Qué se movió y qué hacemos?')
assert.equal((enviados[1]!.cuerpo.reply_markup as any).inline_keyboard.length, 2)
console.log('custom en telegram:', JSON.stringify(enviados.map((e) => e.cuerpo.text)))

// 4. /stop o desconectar borra lo programado del chat.
await (await import('../src/telegram/router.ts')).telegramRouter.request('/_internal/cafe/telegram', { method: 'DELETE', headers: auth })
assert.equal((await store.listReportSchedules(tenant.id)).length, 0)

console.log('\nreportes: todo bien')
process.exit(0)
