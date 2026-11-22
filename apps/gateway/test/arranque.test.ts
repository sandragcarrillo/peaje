// Arranque sin preguntas: al registrarse Peaje revisa el sitio y deja tareas sin
// esperar la corrida diaria; al empezar Pro siembra las preguntas a medir con las
// del radar gratis y sigue aunque el modelo no conteste. Store en memoria; el
// sitio y los servicios externos son un fetch falso.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
delete process.env.GEMINI_API_KEY
delete process.env.PERPLEXITY_API_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-arranque-0123456789abcdef0123456789abcdef',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const fetchReal = globalThis.fetch
let pedidos: string[] = []
globalThis.fetch = (async (entrada: string | URL | Request) => {
  pedidos.push(String(entrada instanceof Request ? entrada.url : entrada))
  return new Response('', { status: 404 })
}) as typeof fetch
process.on('exit', () => {
  globalThis.fetch = fetchReal
})

const { store } = await import('../src/store.js')
const { arranqueGratis, arranquePro, planPorDefecto, preguntasDelRadar, sembrarPreguntas } = await import('../src/tareas/arranque.js')
const { rutasRouter } = await import('../src/rutas.js')

let n = 0
async function negocio(o: { pro?: boolean; dominio?: string } = {}) {
  n += 1
  const t = await store.createTenant({ slug: `arranque-${n}`, name: `Arranque ${n}`, originUrl: `https://${o.dominio ?? `sitio${n}.ejemplo.co`}`, embedSecret: 'x' })
  if (o.pro) await store.setTenantPlan(t.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
  return (await store.getTenantById(t.id))!
}

async function radar(dominio: string, locale: string, preguntas: string[]) {
  const ahora = new Date().toISOString()
  const c = await store.claimRadarCitas({ domain: dominio, locale, at: ahora, dayStart: ahora.slice(0, 10) + 'T00:00:00.000Z', maxPerDay: 100, staleBefore: ahora })
  assert.ok('id' in c || 'run' in c, JSON.stringify(c))
  const id = 'id' in c ? (c as { id: string }).id : (c as unknown as { run: { id: string } }).run.id
  await store.finishRadarCitas(id, { result: { domain: dominio, measuredAt: ahora, questions: preguntas.map((text) => ({ text, engines: {} })), coverage: {}, citedInstead: [], engines: [] }, partial: false })
}

test('al registrarse: la primera revisión y las tareas salen ya, y no se repiten', async () => {
  const t = await negocio()
  assert.equal(await store.lastVerification(t.id), null)
  assert.deepEqual(await arranqueGratis(t), { reviso: true })
  const v = await store.lastVerification(t.id)
  assert.ok(v)
  // El sitio no tiene nada puesto: quedan arreglos listos para el dueño, con su prioridad.
  const tareas = await store.listTasks(t.id, { statuses: ['open'] })
  assert.ok(tareas.some((x) => x.kind === 'fix' && x.priority?.impact === 'high'))
  pedidos = []
  assert.deepEqual(await arranqueGratis(t), { reviso: false })
  assert.equal(pedidos.length, 0)
})

test('el registro del dashboard (describe) dispara la revisión en segundo plano', async () => {
  const t = await negocio()
  const r = await rutasRouter.request(`/${t.slug}/describe`, { method: 'POST', headers: { authorization: 'Bearer interno' } })
  assert.equal(r.status, 200)
  for (let i = 0; i < 100 && !(await store.lastVerification(t.id)); i++) await new Promise((ok) => setTimeout(ok, 20))
  assert.ok(await store.lastVerification(t.id))
})

test('las preguntas a medir salen del radar que el dueño ya vio, sin duplicar y sin pisar las que tenga', async () => {
  const t = await negocio({ pro: true, dominio: 'www.cafe.ejemplo.co' })
  await radar('cafe.ejemplo.co', 'es', ['¿Dónde compro café de especialidad en Bogotá?', '¿Qué tostadores envían a todo el país?'])
  await radar('cafe.ejemplo.co', 'en', ['Where can I buy specialty coffee in Bogotá?'])
  assert.deepEqual(await preguntasDelRadar(t), ['¿Dónde compro café de especialidad en Bogotá?', '¿Qué tostadores envían a todo el país?', 'Where can I buy specialty coffee in Bogotá?'])
  assert.equal(await sembrarPreguntas(t), 3)
  assert.deepEqual((await store.listCitationPrompts(t.id)).map((p) => p.text).sort(), ['Where can I buy specialty coffee in Bogotá?', '¿Dónde compro café de especialidad en Bogotá?', '¿Qué tostadores envían a todo el país?'])
  assert.equal(await sembrarPreguntas(t), 0)
  assert.equal((await store.listCitationPrompts(t.id)).length, 3)
})

test('arranque de Pro: sigue aunque el modelo no conteste, y sin Pro no hace nada', async () => {
  const gratis = await negocio()
  assert.deepEqual(await arranquePro(gratis, 'es'), { omitido: 'sin Pro' })
  assert.equal(await store.lastVerification(gratis.id), null)

  const t = await negocio({ pro: true, dominio: 'pan.ejemplo.co' })
  await radar('pan.ejemplo.co', 'es', ['¿Qué panadería hace pan de masa madre en Medellín?'])
  const r = await arranquePro(t, 'es')
  // Sin clave del modelo no hay plan; la revisión, las preguntas y las tareas quedan igual.
  assert.deepEqual({ ...r, tareas: undefined }, { preguntas: 1, plan: false, tareas: undefined })
  assert.ok(await store.lastVerification(t.id))
  assert.equal((await store.listCitationPrompts(t.id)).length, 1)
  assert.ok((await store.listTasks(t.id, { statuses: ['open'] })).length > 0)
})

test('el plan por defecto: que la IA lo recomiende, cada semana, en el idioma del dueño', () => {
  assert.deepEqual(planPorDefecto('es'), { goal: 'recommendations', goalDetail: '', capacity: ['content', 'code', 'config'], cadence: 'weekly', language: 'es' })
})
