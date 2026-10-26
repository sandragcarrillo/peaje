// Créditos del agente y filtro de tema. Conversar es gratis; cada respuesta
// paga al terminar por lo que hizo (COSTOS_CREDITOS). Lo que no es del
// negocio lo contesta el modelo barato sin llamar al grande. Store en memoria
// y un Anthropic falso con guion: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.TELEGRAM_BOT_TOKEN
delete process.env.AGENT_MODEL
delete process.env.TOPIC_MODEL
const llave = generatePrivateKey()
Object.assign(process.env, {
  ANTHROPIC_API_KEY: 'sk-ant-prueba',
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  MPP_SECRET_KEY: 'prueba-creditos-0123456789abcdef0123456789abcdef',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
  TOPIC_TIMEOUT_MS: '200',
  AGENT_JOBS_TICK_MS: '50',
})

// ---------------------------------------------------------------- Anthropic falso

type Bloque = Record<string, unknown>
type Pedido = { model: string; system: string; body: Record<string, unknown> }
let pedidos: Pedido[] = []
/** Una entrada por llamada al modelo del chat. `corte: true` responde como si se acabara max_tokens. */
let guion: { bloques: Bloque[]; corte?: boolean }[] = []
let tema: { topic: string; reply: string } | 'falla' | 'lento' = { topic: 'business', reply: '' }

let k = 0
const herramienta = (name: string, input: Record<string, unknown> = {}): Bloque => ({ type: 'tool_use', id: `toolu_${++k}`, name, input })
const texto = (t: string): Bloque => ({ type: 'text', text: t })

const respuesta = (content: Bloque[], stop: string) =>
  new Response(JSON.stringify({ id: `msg_${++k}`, type: 'message', role: 'assistant', model: 'x', content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://api.anthropic.com/')) {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    const system = Array.isArray(body.system) ? (body.system as { text: string }[]).map((b) => b.text).join('\n') : String(body.system ?? '')
    pedidos.push({ model: String(body.model), system, body })
    if (/You route messages/.test(system)) {
      if (tema === 'falla') return new Response('{"type":"error","error":{"type":"api_error","message":"boom"}}', { status: 500 })
      if (tema === 'lento') {
        await new Promise((listo, falla) => {
          const t = setTimeout(listo, 2_000)
          init?.signal?.addEventListener('abort', () => (clearTimeout(t), falla(new DOMException('aborted', 'AbortError'))))
        })
      }
      return respuesta([texto(JSON.stringify(tema))], 'end_turn')
    }
    const paso = guion.shift() ?? { bloques: [texto('Listo.')] }
    const usaHerramientas = paso.bloques.some((b) => b.type === 'tool_use')
    return respuesta(paso.bloques, paso.corte ? 'max_tokens' : usaHerramientas ? 'tool_use' : 'end_turn')
  }
  // Nada sale a la red: los sitios de prueba no existen.
  if (/\.example(\/|$)/.test(url)) return new Response('', { status: 404 })
  return fetchReal(input, init)
}) as typeof fetch

const { store } = await import('../src/store.js')
const { conversar, cargoDeRespuesta } = await import('../src/tareas/agente.js')
const { iniciarTrabajos, esperarTrabajo } = await import('../src/tareas/trabajos.js')
const { billingRouter } = await import('../src/billing/router.js')
const { COSTOS_CREDITOS, CREDITOS_MENSUALES, periodoCreditos } = await import('@peaje/db')

const AGENTE = 'claude-sonnet-5'
const chat = () => pedidos.filter((p) => p.model === AGENTE)
const filtro = () => pedidos.filter((p) => /You route messages/.test(p.system))

beforeEach(() => {
  pedidos = []
  guion = []
  tema = { topic: 'business', reply: '' }
})

let n = 0
async function negocio() {
  const slug = `tienda-${++n}`
  const t = await store.createTenant({ slug, name: `Tienda ${n}`, originUrl: `https://${slug}.example`, embedSecret: 'x' })
  await store.setTenantPlan(t.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
  return (await store.getTenantById(t.id))!
}
const usados = (tenantId: string) => store.creditsUsedSince(tenantId, periodoCreditos().desde)
const mes = (idioma: 'es' | 'en') => new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(periodoCreditos().renueva))

// ---------------------------------------------------------------- filtro de tema

test('fuera de tema: contesta el modelo barato en una línea, no llama al del chat y no cobra', async () => {
  const t = await negocio()
  tema = { topic: 'off_topic', reply: 'Eso no lo hago yo — si quieres, volvemos a tu sitio.' }
  const m = await conversar(t, '¿Cómo hago arepas de queso?', { idioma: 'es', canal: 'telegram' })
  assert.equal(chat().length, 0)
  assert.equal(filtro().length, 1)
  assert.equal(m.text, 'Eso no lo hago yo, si quieres, volvemos a tu sitio.')
  const guardados = await store.listMessages(t.id, 10)
  assert.deepEqual(guardados.map((x) => x.role), ['user', 'assistant'])
  assert.equal(await usados(t.id), 0)
})

test('un "sí" que responde a la pregunta del agente pasa: el filtro ve la conversación y sigue el modelo del chat', async () => {
  const t = await negocio()
  await store.addMessage({ tenantId: t.id, role: 'assistant', text: '¿Quieres que revise si ChatGPT te cita?', options: ['Sí, revisa', 'Ahora no'], channel: 'telegram' })
  guion = [{ bloques: [texto('Reviso ahora.')] }]
  await conversar(t, 'sí', { idioma: 'es', canal: 'telegram' })
  const contexto = String((filtro()[0]!.body.messages as { content: string }[])[0]!.content)
  assert.match(contexto, /Agent: ¿Quieres que revise si ChatGPT te cita\? \[choices offered: Sí, revisa \| Ahora no\]/)
  assert.match(contexto, /Last owner message:\nsí/)
  assert.equal(chat().length, 1)
})

test('si el filtro falla o tarda, la conversación sigue con el modelo del chat', async () => {
  const t = await negocio()
  tema = 'falla'
  guion = [{ bloques: [texto('Hola, aquí estoy.')] }]
  assert.equal((await conversar(t, 'hola', { idioma: 'es' })).text, 'Hola, aquí estoy.')
  tema = 'lento'
  guion = [{ bloques: [texto('Sigo aquí.')] }]
  assert.equal((await conversar(t, 'hola otra vez', { idioma: 'es' })).text, 'Sigo aquí.')
  assert.equal(chat().length, 2)
})

test('charla sin datos: la primera vuelta va con max_tokens bajo y, si no alcanza, se repite con el tope normal', async () => {
  const t = await negocio()
  tema = { topic: 'chat', reply: '' }
  guion = [{ bloques: [texto('Hola')], corte: true }, { bloques: [texto('Hola, soy tu agente.')] }]
  const m = await conversar(t, 'hola', { idioma: 'es' })
  assert.deepEqual(chat().map((p) => p.body.max_tokens), [600, 8000])
  assert.equal(m.text, 'Hola, soy tu agente.')
  // Del negocio: tope normal desde el principio.
  pedidos = []
  tema = { topic: 'business', reply: '' }
  await conversar(t, '¿cómo voy?', { idioma: 'es' })
  assert.deepEqual(chat().map((p) => p.body.max_tokens), [8000])
})

test('botones y reportes programados no pasan por el filtro', async () => {
  const t = await negocio()
  await conversar(t, '¿Cómo voy?', { idioma: 'es', boton: true })
  await conversar(t, 'Qué se movió esta semana', { idioma: 'es', programado: true })
  assert.equal(filtro().length, 0)
  assert.equal(chat().length, 2)
})

// ---------------------------------------------------------------- créditos por acción

test('conversar sin herramientas y solo ofrecer opciones no cuestan nada', async () => {
  const t = await negocio()
  guion = [{ bloques: [texto('Hola, ¿qué quieres mirar?')] }]
  await conversar(t, 'hola', { idioma: 'es' })
  guion = [{ bloques: [texto('¿Qué prefieres?'), herramienta('offer_choices', { choices: ['Mis visitas', 'Mi plan'] })] }, { bloques: [] }]
  const m = await conversar(t, 'ayúdame', { idioma: 'es' })
  assert.deepEqual(m.options, ['Mis visitas', 'Mi plan'])
  assert.equal(await usados(t.id), 0)
})

test('consultar datos cobra una vez por respuesta, aunque use varias herramientas', async () => {
  const t = await negocio()
  guion = [{ bloques: [herramienta('get_citations')] }, { bloques: [texto('Todavía no medimos.')] }]
  await conversar(t, '¿me citan?', { idioma: 'es' })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.consulta)
  guion = [{ bloques: [herramienta('get_citations'), herramienta('list_tasks')] }, { bloques: [herramienta('get_plan')] }, { bloques: [texto('Esto es lo que hay.')] }]
  await conversar(t, '¿cómo voy?', { idioma: 'es' })
  assert.equal(await usados(t.id), 2 * COSTOS_CREDITOS.consulta)
})

test('preguntar por los créditos es gratis y devuelve saldo, renovación y precios', async () => {
  const t = await negocio()
  guion = [{ bloques: [herramienta('get_credits')] }, { bloques: [texto('Te quedan todos.')] }]
  await conversar(t, '¿cuántos créditos me quedan?', { idioma: 'es' })
  assert.equal(await usados(t.id), 0)
  const resultado = (chat()[1]!.body.messages as { role: string; content: unknown }[]).at(-1)!.content as { content: string }[]
  const uso = JSON.parse(resultado[0]!.content)
  assert.deepEqual(uso, { credits: CREDITOS_MENSUALES, used: 0, remaining: CREDITOS_MENSUALES, renewsAt: periodoCreditos().renueva, costs: COSTOS_CREDITOS })
})

test('una tarea nueva cobra su precio y absorbe las consultas de esa respuesta', async () => {
  const t = await negocio()
  guion = [
    { bloques: [herramienta('list_tasks')] },
    { bloques: [herramienta('create_task', { kind: 'fix', title: 'Arreglar el robots.txt', summary: 'Bloquea a ChatGPT.', prompt: '# Fix\nPermite OAI-SearchBot.' })] },
    { bloques: [texto('Te dejé la tarea.')] },
  ]
  await conversar(t, 'arréglame el robots', { idioma: 'es' })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.tarea)
  assert.equal((await store.listTasks(t.id)).length, 1)
})

test('una página y una serie cobran su precio al pedirse; el trabajo lleva lo pagado para devolverlo si falla', async () => {
  const t = await negocio()
  guion = [{ bloques: [herramienta('draft_page', { question: '¿Dónde comprar café de origen?', why: 'Lo preguntan.' })] }, { bloques: [texto('Estoy escribiendo la página.')] }]
  await conversar(t, 'escribe la página', { idioma: 'es' })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.pagina)
  guion = [{ bloques: [herramienta('draft_page_series', { topic: 'café de origen' })] }, { bloques: [texto('Estoy armando la serie.')] }]
  await conversar(t, 'arma una serie', { idioma: 'es' })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.pagina + COSTOS_CREDITOS.serie)
  const trabajos = await store.listJobs(t.id, 10)
  assert.deepEqual(trabajos.map((j) => [j.kind, j.input.creditos]).sort(), [['draft_page', COSTOS_CREDITOS.pagina], ['page_series', COSTOS_CREDITOS.serie]])
})

test('un trabajo que falla devuelve sus créditos', async () => {
  const t = await negocio()
  guion = [{ bloques: [herramienta('draft_page', { question: '¿Cuánto cuesta el envío?', why: 'Lo preguntan.' })] }, { bloques: [texto('Estoy escribiendo la página.')] }]
  await conversar(t, 'escribe la página del envío', { idioma: 'es' })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.pagina)
  const [job] = await store.listJobs(t.id, 1)
  const apagar = iniciarTrabajos()
  try {
    // El sitio de prueba no responde: no hay con qué escribir la página y el trabajo falla.
    const fin = await esperarTrabajo(job!.id, 10_000, 25)
    assert.equal(fin?.status, 'failed')
  } finally {
    apagar()
  }
  assert.equal(await usados(t.id), 0)
})

test('informes a pedido y comprador misterioso: el cargo sale de la tabla', () => {
  const base = { consulto: true, consultasGratis: false }
  assert.equal(cargoDeRespuesta({ ...base, entregas: [{ accion: 'informe', herramienta: 'run_citation_check' }] }), COSTOS_CREDITOS.informe)
  assert.equal(cargoDeRespuesta({ ...base, entregas: [{ accion: 'comprador', herramienta: 'run_mystery_shopper' }] }), COSTOS_CREDITOS.comprador)
  assert.equal(cargoDeRespuesta({ ...base, entregas: [] }), COSTOS_CREDITOS.consulta)
  assert.equal(cargoDeRespuesta({ ...base, consultasGratis: true, entregas: [] }), 0)
})

test('sin saldo para una tarea: no se crea, el agente sigue y una línea dice cuánto cuesta y cuándo se renueva', async () => {
  const t = await negocio()
  await store.addCreditCharge({ tenantId: t.id, credits: CREDITOS_MENSUALES - (COSTOS_CREDITOS.tarea - 1), reason: 'prueba' })
  guion = [
    { bloques: [herramienta('create_task', { kind: 'fix', title: 'Arreglar algo', summary: 'Algo.', prompt: '# Fix' })] },
    { bloques: [texto('Por ahora no puedo dejarte la tarea.')] },
  ]
  const m = await conversar(t, 'déjame la tarea', { idioma: 'es' })
  assert.equal((await store.listTasks(t.id)).length, 0)
  const resultado = (chat()[1]!.body.messages as { content: unknown }[]).at(-1)!.content as { content: string; is_error?: boolean }[]
  assert.equal(resultado[0]!.is_error, true)
  assert.match(resultado[0]!.content, /not-enough-credits/)
  assert.equal(
    m.text,
    `Por ahora no puedo dejarte la tarea.\n\nEso cuesta ${COSTOS_CREDITOS.tarea} créditos y te quedan ${COSTOS_CREDITOS.tarea - 1} este mes. Tus créditos se renuevan el ${mes('es')}; mientras tanto podemos seguir conversando.`,
  )
  assert.equal(await usados(t.id), CREDITOS_MENSUALES - (COSTOS_CREDITOS.tarea - 1))
  // Conversar sigue igual, sin línea y sin cobrar.
  guion = [{ bloques: [texto('Claro, te explico.')] }]
  assert.equal((await conversar(t, '¿qué es el robots.txt?', { idioma: 'es' })).text, 'Claro, te explico.')
})

test('desde el 80 % usado, la respuesta que cobra trae una línea con lo que queda', async () => {
  const t = await negocio()
  const umbral = Math.ceil(CREDITOS_MENSUALES * 0.8)
  await store.addCreditCharge({ tenantId: t.id, credits: umbral - 2 * COSTOS_CREDITOS.consulta, reason: 'prueba' })
  guion = [{ bloques: [herramienta('get_plan')] }, { bloques: [texto('Sin plan todavía.')] }]
  assert.equal((await conversar(t, '¿tengo plan?', { idioma: 'en' })).text, 'Sin plan todavía.')
  guion = [{ bloques: [herramienta('get_plan')] }, { bloques: [texto('No plan yet.')] }]
  const m = await conversar(t, 'do I have a plan?', { idioma: 'en' })
  const quedan = CREDITOS_MENSUALES - umbral
  assert.equal(m.text, `No plan yet.\n\nYou have ${quedan} of ${CREDITOS_MENSUALES} credits left this month. They renew on ${mes('en')}.`)
})

test('un reporte programado no paga sus consultas', async () => {
  const t = await negocio()
  guion = [{ bloques: [herramienta('get_agent_traffic', { days: 7 })] }, { bloques: [texto('Esta semana no vino nadie.')] }]
  await conversar(t, 'Qué agentes vinieron esta semana', { idioma: 'es', programado: true, canal: 'telegram' })
  assert.equal(await usados(t.id), 0)
})

test('GET /_internal/:slug/billing trae el saldo y la tabla de costos', async () => {
  const t = await negocio()
  await store.addCreditCharge({ tenantId: t.id, credits: COSTOS_CREDITOS.pagina, reason: 'prueba' })
  const res = await billingRouter.request(`/_internal/${t.slug}/billing`, { headers: { authorization: 'Bearer interno' } })
  assert.equal(res.status, 200)
  const j = (await res.json()) as { usage: unknown; access: { limites: { creditos: number } } }
  assert.deepEqual(j.usage, {
    credits: CREDITOS_MENSUALES,
    used: COSTOS_CREDITOS.pagina,
    remaining: CREDITOS_MENSUALES - COSTOS_CREDITOS.pagina,
    renewsAt: periodoCreditos().renueva,
    costs: COSTOS_CREDITOS,
  })
  assert.equal(j.access.limites.creditos, CREDITOS_MENSUALES)
})
