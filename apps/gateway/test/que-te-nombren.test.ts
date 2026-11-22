// Preguntas de compra antes que guías del blog: una página informativa que
// Google muestra pesa menos que la página o la mención que falta para una
// pregunta donde la IA no cita al negocio. Y "que te nombren" como tarea: a
// qué páginas de terceros pedirles que lo incluyan y qué mandar. Store en
// memoria; el sitio es un fetch falso.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY
delete process.env.TELEGRAM_BOT_TOKEN
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-que-te-nombren-0123456789abcdef0123456789',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { oportunidades } = await import('../src/google/oportunidades.js')
const { esDeCompra, lasDeLaSemana, ordenar, prioridadBloqueo, prioridadBusqueda, prioridadDe, prioridadMencion, prioridadPagina } = await import('../src/tareas/prioridad.js')
const { claveDeMencion, esDeCobros, generarTareas, MAX_MENCIONES } = await import('../src/tareas/generar.js')
const { completarTarea, SIN_CRITERIOS } = await import('../src/tareas/verificar.js')
const { preguntasSinCita } = await import('../src/citacion/competidores.js')

const fila = (keys: string[], clicks: number, impressions: number, position: number) => ({ keys, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position })
const S = 'https://www.nomina.co'

// Una guía del blog que se lleva casi todo lo que Google muestra, y la página de precios lejos del primer puesto.
const PAGINAS = [fila([`${S}/blog/que-es-la-nomina`], 0, 300, 34), fila([`${S}/precios`], 0, 60, 22), fila([`${S}/blog/historia`], 0, 40, 8)]
const PARES = [fila(['que es la nomina', `${S}/blog/que-es-la-nomina`], 0, 200, 33), fila(['software de nomina precios', `${S}/precios`], 0, 40, 21)]

test('una guía del blog es informativa; precios, comparaciones y alternativas son de compra', () => {
  assert.equal(esDeCompra({ ruta: '/blog/que-es-la-nomina', consultas: [{ texto: 'que es la nomina', impresiones: 1, posicion: 1 }] }), false)
  assert.equal(esDeCompra({ ruta: '/blog/como-mejorar-tu-nomina', consultas: [] }), false)
  assert.equal(esDeCompra({ ruta: '/precios', consultas: [] }), true)
  assert.equal(esDeCompra({ ruta: '/', consultas: [] }), true)
  assert.equal(esDeCompra({ ruta: '/blog/nomina-co-vs-otra', consultas: [] }), true)
  assert.equal(esDeCompra({ ruta: '/blog/guia', consultas: [{ texto: 'alternativas a otra nomina', impresiones: 1, posicion: 1 }] }), true)
  assert.equal(esDeCompra({ ruta: '/blog/guia', consultas: [{ texto: 'mejor software de nomina', impresiones: 1, posicion: 1 }] }), true)
})

test('el orden: la mención y la página de una pregunta sin cita van antes que retocar una guía del blog', () => {
  const [guia, precios, historia] = ['/blog/que-es-la-nomina', '/precios', '/blog/historia'].map((r) => oportunidades(PAGINAS, PARES).find((o) => o.ruta === r)!)
  // Lo que Google midió no cambia; cambia cuánto pesa una página informativa.
  assert.equal(guia!.puntaje, 75)
  assert.equal(prioridadBusqueda(guia!).score, 60)
  assert.equal(prioridadBusqueda(guia!).impact, 'high')
  assert.equal(prioridadBusqueda(historia!).score, 53)
  // Una página de compra conserva su puntaje entero.
  assert.equal(prioridadBusqueda(precios!).score, precios!.puntaje)

  const pregunta = '¿Cuál es el mejor software de nómina para pymes en Colombia?'
  const pagina = prioridadPagina({ pregunta, porQue: 'La IA cita listas y tu sitio no tiene una.' }, false, true)
  assert.equal(pagina.score, 70)
  assert.equal(pagina.impact, 'high')
  // Sin la medición de citas detrás, una pregunta de decisión ("el mejor") igual sube, menos que con la medición.
  assert.equal(prioridadPagina({ pregunta, porQue: 'x' }, false).score, 65)
  // Una informativa sin la medición queda donde estaba.
  assert.equal(prioridadPagina({ pregunta: '¿Qué es la nómina electrónica?', porQue: 'x' }, false).score, 50)
  const mencion = prioridadMencion({ pregunta, sitios: ['capterra.co', 'reddit.com'], citas: 3 })
  assert.equal(mencion.score, 75)

  const t = (key: string, priority: ReturnType<typeof prioridadPagina> | null, kind: 'content' | 'fix' = 'content') => ({ key, kind, title: key, summary: '', priority, createdAt: '2026-11-22T00:00:00.000Z' })
  const cola = ordenar([
    t('content:improve:/blog/que-es-la-nomina', prioridadBusqueda(guia!)),
    t('content:snippet:/blog/historia', prioridadBusqueda(historia!)),
    t('content:improve:/precios', prioridadBusqueda(precios!)),
    t('content:mejor-software', pagina),
    t(claveDeMencion(pregunta), mencion),
    t('fix:robots:OAI-SearchBot', prioridadBloqueo({ bot: 'OAI-SearchBot', producto: 'ChatGPT', por: 'robots' }), 'fix'),
  ])
  assert.deepEqual(cola.map((x) => x.key), [
    'fix:robots:OAI-SearchBot',
    claveDeMencion(pregunta),
    'content:mejor-software',
    'content:improve:/blog/que-es-la-nomina',
    'content:improve:/precios',
    'content:snippet:/blog/historia',
  ])
  // Una de mención guardada sin prioridad igual entra arriba de las guías.
  assert.equal(prioridadDe({ key: claveDeMencion(pregunta), kind: 'content', title: 'x', summary: '', priority: null }).score, 72)
  for (const texto of [mencion.label.es, mencion.why.es, mencion.label.en, mencion.why.en]) assert.doesNotMatch(texto, /—|–|vas a|you will|garantiz|guarantee/)
  assert.match(mencion.why.es, /capterra\.co, reddit\.com/)
})

// ---- la tarea ----

const tenant = await store.createTenant({ slug: 'nomina-prueba', name: 'Nómina Co', originUrl: S, embedSecret: 'x' })
type P = { domain: string; url: string | null; title: string | null; format: 'guide' | 'roundup' | 'forum' | 'product' | null }
const corrida = (promptText: string, engine: string, cited: boolean, pages: P[]) => ({
  tenantId: tenant.id,
  roundId: 'ronda-1',
  promptId: null,
  promptText,
  engine,
  cited,
  mentioned: cited,
  domains: [...new Set(pages.map((p) => p.domain))],
  pages,
  answerExcerpt: null,
  error: null,
})
const capterra: P = { domain: 'www.capterra.co', url: 'https://www.capterra.co/directory/nomina', title: 'Software de nómina en Colombia', format: 'roundup' }
const reddit: P = { domain: 'reddit.com', url: 'https://reddit.com/r/Colombia/comments/1/nomina', title: 'Qué software de nómina usan', format: 'forum' }
const lista: P = { domain: 'pymes-digital.co', url: 'https://pymes-digital.co/mejores-software-nomina', title: 'Los 7 mejores software de nómina', format: 'roundup' }
const rival: P = { domain: 'otranomina.co', url: 'https://otranomina.co/', title: 'Otra Nómina', format: 'product' }
const propia: P = { domain: 'www.nomina.co', url: `${S}/precios`, title: 'Precios', format: 'product' }
const Q1 = 'mejor software de nómina para pymes en Colombia'
const Q2 = 'alternativas a Otra Nómina'
const Q3 = 'software de nómina electrónica barato'
const Q4 = 'cuánto cuesta un software de nómina'
await store.recordCitationRuns([
  corrida(Q1, 'openai', false, [capterra, reddit, rival]),
  corrida(Q1, 'anthropic', false, [capterra, lista]),
  corrida(Q2, 'openai', false, [lista, rival]),
  corrida(Q2, 'anthropic', false, [reddit]),
  corrida(Q3, 'openai', false, [capterra]),
  // Acá sí lo citan (aunque no todos): no hay nada que pedir.
  corrida(Q4, 'openai', true, [propia, capterra]),
  corrida(Q4, 'anthropic', false, [capterra, reddit, lista]),
  // Solo un competidor: no hay página de terceros donde pedir lugar.
  corrida('nómina para restaurantes', 'openai', false, [rival]),
])

const pedidos: string[] = []
const fetchReal = globalThis.fetch
globalThis.fetch = (async (entrada: string | URL | Request) => {
  pedidos.push(String(entrada instanceof Request ? entrada.url : entrada))
  return new Response('', { status: 404 })
}) as typeof fetch
process.on('exit', () => {
  globalThis.fetch = fetchReal
})

test('preguntasSinCita: solo preguntas donde nadie citó al negocio, con los sitios de terceros y sus páginas', async () => {
  const r = await preguntasSinCita(tenant)
  assert.deepEqual(r.map((m) => [m.question, m.publisherCitations]), [[Q1, 4], [Q2, 2], [Q3, 1], ['nómina para restaurantes', 0]])
  // El competidor no entra; el subdominio se junta con su dominio.
  assert.deepEqual(r[0]!.publishers, [
    { domain: 'capterra.co', citations: 2, pages: [{ title: 'Software de nómina en Colombia', url: 'https://www.capterra.co/directory/nomina' }] },
    { domain: 'pymes-digital.co', citations: 1, pages: [{ title: 'Los 7 mejores software de nómina', url: 'https://pymes-digital.co/mejores-software-nomina' }] },
    { domain: 'reddit.com', citations: 1, pages: [{ title: 'Qué software de nómina usan', url: 'https://reddit.com/r/Colombia/comments/1/nomina' }] },
  ])
  assert.ok(r[0]!.pageUrls.includes('https://otranomina.co/'))
})

const menciones = async () => (await store.listTasks(tenant.id)).filter((t) => t.key.startsWith('content:mention:'))

test('generarTareas: una tarea por pregunta, como mucho dos, las que tienen más citas a terceros', async () => {
  await generarTareas(tenant)
  const tareas = await menciones()
  assert.equal(MAX_MENCIONES, 2)
  assert.deepEqual(tareas.map((t) => t.key).sort(), [claveDeMencion(Q1), claveDeMencion(Q2)].sort())
  const t = tareas.find((x) => x.key === claveDeMencion(Q1))!
  assert.equal(t.kind, 'content')
  assert.equal(t.source, 'citation')
  assert.equal(t.title, `Get mentioned: ${Q1}`)
  assert.equal(t.summary, 'AI assistants answer this citing capterra.co, pymes-digital.co, reddit.com and not Nómina Co. Ask those pages to include you.')
  // Pasa en sitios ajenos: no hay criterio que Peaje pueda revisar, y no se inventa uno.
  assert.deepEqual(t.acceptance, [])
  assert.equal(t.priority?.score, 76)
  assert.equal(t.priority?.label.es, `Pedir que te incluyan donde la IA busca "${Q1}"`)

  // El cuerpo: la pregunta, cada sitio con sus páginas, y qué mandar.
  assert.match(t.body, new RegExp(`^# Get mentioned: ${Q1}`))
  assert.match(t.body, /- capterra\.co \(cited in 2 answers\)\n {2}- "Software de nómina en Colombia": https:\/\/www\.capterra\.co\/directory\/nomina/)
  assert.match(t.body, /- reddit\.com \(cited in 1 answer\)/)
  assert.doesNotMatch(t.body, /otranomina\.co/)
  assert.match(t.body, /Who you are: Nómina Co/)
  assert.match(t.body, /One concrete fact/)
  assert.match(t.body, /The URL: https:\/\/nomina\.co\//)
  assert.match(t.body, /The owner sends them/)
  assert.match(t.body, /Never pay or offer anything in exchange/)
  assert.match(t.body, /Never write reviews of your own business/)
  assert.match(t.body, /Peaje cannot check this on your site/)
  assert.doesNotMatch(t.body, /—|–/)
})

test('no se duplica: otra corrida no crea más, y una descartada no vuelve (entra la siguiente pregunta)', async () => {
  await generarTareas(tenant)
  assert.equal((await menciones()).length, 2)

  const primera = (await menciones()).find((t) => t.key === claveDeMencion(Q1))!
  await store.updateTask(tenant.id, primera.id, { status: 'dismissed', note: 'no va' })
  await generarTareas(tenant)
  const tareas = await menciones()
  assert.equal(tareas.find((t) => t.id === primera.id)?.status, 'dismissed')
  assert.deepEqual(tareas.filter((t) => t.status === 'open').map((t) => t.key).sort(), [claveDeMencion(Q2), claveDeMencion(Q3)].sort())
  // Nunca más de dos abiertas.
  await generarTareas(tenant)
  assert.equal((await menciones()).filter((t) => t.status === 'open').length, 2)
})

test('en la cola va arriba de todo lo que no sea un arreglo, y sale en las de la semana en el idioma del dueño', async () => {
  const abiertas = await store.listTasks(tenant.id, { statuses: ['open'] })
  const es = lasDeLaSemana(abiertas, 'es')
  assert.equal(es[0]!.titulo, `Pedir que te incluyan donde la IA busca "${Q2}"`)
  assert.equal(es[0]!.impacto, 'high')
  assert.match(lasDeLaSemana(abiertas, 'en')[0]!.titulo, /^Ask to be included where AI looks for/)
})

test('marcarla hecha: queda cerrada con la palabra del dueño, sin abrir ninguna página y sin fingir un chequeo', async () => {
  const t = (await menciones()).find((x) => x.key === claveDeMencion(Q2))!
  pedidos.length = 0
  const hecha = await completarTarea(tenant, t, null, store)
  assert.equal(hecha.status, 'verified')
  assert.equal(hecha.note, SIN_CRITERIOS)
  assert.doesNotMatch(hecha.note ?? '', /pass on the live site/)
  assert.deepEqual(pedidos, [])
  // Agenda los dos seguimientos y mide la pregunta real, sin el prefijo "Get mentioned:".
  const seguimientos = (await store.listFollowups(tenant.id, 50)).filter((f) => f.taskId === t.id)
  assert.equal(seguimientos.length, 2)
  assert.equal(seguimientos[0]!.before.question, Q2)
  assert.ok(!(await store.listCitationPrompts(tenant.id)).some((p) => p.text.startsWith('Get mentioned')))
})

// Con los cobros escondidos, las propuestas abiertas sobre cobrar a agentes se retiran por regla.
test('reconoce las páginas sobre cobrar a agentes y no toca las demás', () => {
  for (const t of ['¿Cuánto debo cobrar a un agente de IA por cada petición?', 'USDC en Arbitrum o pathUSD en Tempo: ¿con cuál cobro a los agentes?', '¿Qué es el mystery shopper de agentes y qué prueba en mi web?', 'x402 vs MPP: which payment protocol?']) assert.equal(esDeCobros(t), true, t)
  for (const t of ['Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?', '¿Debo tener mi web en inglés y español para que la IA me cite?', '¿Cuánto tarda ChatGPT en citarme después de arreglar mi web?', 'Improve /blog/how-do-i-show-up-in-google-ai-overviews', '¿Para qué sirve el openapi.json y qué agentes de IA lo leen?']) assert.equal(esDeCobros(t), false, t)
})
