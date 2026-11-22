// La prioridad de las tareas abiertas se recalcula en cada búsqueda con las
// reglas de hoy: una comparación guardada con el puntaje viejo (50) sube, las
// de mención siguen arriba, y las tomadas o descartadas no se tocan. Y la
// pregunta que se vuelve a medir en una tarea de mención va sin el prefijo.
// Store en memoria; el sitio es un fetch falso.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY
delete process.env.TELEGRAM_BOT_TOKEN
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-repriorizar-0123456789abcdef0123456789',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { esDeDecision, lasDeLaSemana, prioridadMencion, prioridadPagina, prioridadVigente } = await import('../src/tareas/prioridad.js')
const { claveDeMencion, generarTareas, repriorizar } = await import('../src/tareas/generar.js')
const { preguntaDe } = await import('../src/ciclo/seguimiento.js')

const fetchReal = globalThis.fetch
globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch
process.on('exit', () => {
  globalThis.fetch = fetchReal
})

test('comparaciones y decisiones cuentan como intención de compra, en español y en inglés', () => {
  for (const t of [
    'Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?',
    'Peaje vs Otterly vs Peec vs Profound: ¿cuál conviene?',
    'Alternativas a Semrush para pymes',
    '¿Cuál es el mejor software de nómina para pymes?',
    'Otterly frente a Profound',
    'Best AEO tool for small businesses',
    'Semrush alternatives for startups',
    'Peaje vs. Profound',
    'How to choose an AI visibility tool',
  ])
    assert.equal(esDeDecision(t), true, t)
  for (const t of ['¿Debo tener mi web en inglés y español para que la IA me cite?', '¿Cuánto tarda ChatGPT en citarme después de arreglar mi web?', '¿Cómo mejoro mi sitio?', 'What is MCP?'])
    assert.equal(esDeDecision(t), false, t)
})

test('prioridadVigente: recalcula las páginas nuevas y deja el resto como está', () => {
  const base = { kind: 'content' as const, summary: 'Comparativa con precios verificables.', priority: null }
  // Comparación con borrador: 55 + 15. Sin borrador: 50 + 15.
  assert.equal(prioridadVigente({ ...base, key: 'content:peaje-vs-semrush', title: 'Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?' }, { conBorrador: true, sinCita: false })?.score, 70)
  assert.equal(prioridadVigente({ ...base, key: 'chat:peaje-vs-otterly', title: 'Peaje vs Otterly vs Peec vs Profound: ¿cuál conviene?' }, { conBorrador: false, sinCita: false })?.score, 65)
  // La medición de citas pesa más y no se acumula con la de decisión.
  assert.equal(prioridadVigente({ ...base, key: 'content:x', title: 'Alternativas a Semrush' }, { conBorrador: true, sinCita: true })?.score, 75)
  // Una que subió por la medición no baja si esta corrida no la trae.
  const conMedicion = prioridadPagina({ pregunta: '¿Qué es AEO?', porQue: 'x' }, false, true)
  assert.equal(prioridadVigente({ ...base, key: 'content:que-es-aeo', title: '¿Qué es AEO?', priority: conMedicion }, { conBorrador: false, sinCita: false })?.score, 70)
  // Arreglos, menciones y Search Console no se recalculan acá.
  for (const key of ['content:mention:x', 'content:refresh:/x', 'content:improve:/blog/x', 'content:snippet:/x']) assert.equal(prioridadVigente({ ...base, key, title: 'Peaje vs X' }, { conBorrador: false, sinCita: false }), null, key)
  assert.equal(prioridadVigente({ ...base, kind: 'fix', key: 'fix:robots', title: 'Fix robots vs bots' }, { conBorrador: false, sinCita: false }), null)
})

const tenant = await store.createTenant({ slug: 'repriorizar-prueba', name: 'Peaje Prueba', originUrl: 'https://www.peaje-prueba.co', embedSecret: 'x' })
const BORRADOR = '# New page\n\n## Draft\n\nTexto del borrador.'
const viejo = (titulo: string) => ({ score: 50, impact: 'medium' as const, effort: 'medium' as const, label: { es: titulo, en: titulo }, why: { es: 'x', en: 'x' } })

test('generarTareas: recalcula las abiertas guardadas con el puntaje viejo y las de mención siguen arriba', async () => {
  const pagina = (key: string, title: string, body: string, priority?: ReturnType<typeof viejo>, source = 'agent') =>
    store.upsertTask({ tenantId: tenant.id, key, kind: 'content', title, summary: 'Comparativa con precios verificables.', body, acceptance: [], source, ...(priority ? { priority } : {}) })
  // Guardadas antes de la columna (sin prioridad) o con el puntaje del día en que se crearon.
  const semrush = (await pagina('content:peaje-vs-semrush', 'Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?', BORRADOR)).task
  const otterly = (await pagina('content:peaje-vs-otterly', 'Peaje vs Otterly vs Peec vs Profound: ¿cuál conviene?', BORRADOR, viejo('Peaje vs Otterly'), 'chat')).task
  const guia = (await pagina('content:debo-tener-mi-web-en-ingles', '¿Debo tener mi web en inglés y español para que la IA me cite?', 'Sin borrador.')).task
  const tomada = (await pagina('content:alternativas-a-semrush', 'Alternativas a Semrush', BORRADOR, viejo('Alternativas a Semrush'))).task
  await store.updateTask(tenant.id, tomada.id, { status: 'in_progress' })
  const pregunta = 'Herramientas de AEO en español: ¿cuáles existen y cuánto cuestan?'
  const mencion = (
    await store.upsertTask({
      tenantId: tenant.id,
      key: claveDeMencion(pregunta),
      kind: 'content',
      title: `Get mentioned: ${pregunta}`,
      summary: 'x',
      body: 'x',
      acceptance: [],
      priority: prioridadMencion({ pregunta, sitios: ['g2.com'], citas: 8 }),
      source: 'citation',
    })
  ).task

  const r = await generarTareas(tenant)
  assert.equal(r.repriorizadas, 3)
  const por = async (id: string) => (await store.getTask(tenant.id, id))!
  assert.equal((await por(semrush.id)).priority?.score, 70)
  assert.equal((await por(semrush.id)).priority?.label.es, 'Publicar la página "Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?"')
  assert.equal((await por(otterly.id)).priority?.score, 70)
  // La informativa queda donde estaba (55 con borrador, 50 sin), ahora guardada.
  assert.equal((await por(guia.id)).priority?.score, 50)
  // Tomada: no se toca. Mención: no se recalcula acá.
  assert.equal((await por(tomada.id)).priority?.score, 50)
  assert.equal((await por(mencion.id)).priority?.score, 80)
  // Cambiar el orden no cuenta como cambio de contenido.
  assert.equal((await por(semrush.id)).updatedAt, semrush.updatedAt)

  const semana = lasDeLaSemana(await store.listTasks(tenant.id, { statuses: ['open'] }), 'es')
  assert.equal(semana[0]!.titulo, `Pedir que te incluyan donde la IA busca "${pregunta}"`)
  // Las dos comparaciones empatan en 70: a igual puntaje va la más nueva.
  assert.deepEqual(semana.slice(1).map((p) => p.titulo).sort(), ['Publicar la página "Peaje vs Otterly vs Peec vs Profound: ¿cuál conviene?"', 'Publicar la página "Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?"'])

  // Otra corrida no reescribe lo que no cambió.
  assert.equal(await repriorizar(tenant, []), 0)
})

test('preguntaDe: la pregunta real, sin el prefijo de mención, y nada para Search Console o frescura', () => {
  const t = (key: string, title: string, kind: 'content' | 'fix' = 'content') => ({ key, kind, title })
  const q = '¿Qué herramientas GEO arreglan tu sitio y no solo lo miden?'
  assert.equal(preguntaDe(t(claveDeMencion(q), `Get mentioned: ${q}`)), q)
  assert.equal(preguntaDe(t(claveDeMencion(q), `get mentioned:${q}`)), q)
  assert.equal(preguntaDe(t(claveDeMencion(q), `Pedir que te incluyan: ${q}`)), q)
  assert.equal(preguntaDe(t(claveDeMencion(q), `Pedir que te incluyan donde la IA busca "${q}"`)), q)
  assert.equal(preguntaDe(t(claveDeMencion(q), `Ask to be included where AI looks for "${q}"`)), q)
  assert.equal(preguntaDe(t('content:peaje-vs-semrush', 'Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?')), 'Peaje vs Semrush AI Visibility: ¿cuál necesita mi pyme?')
  assert.equal(preguntaDe(t('content:mention:vacia', 'Get mentioned: ')), null)
  for (const key of ['content:refresh:/precios', 'content:improve:/blog/x', 'content:snippet:/developers']) assert.equal(preguntaDe(t(key, 'Improve /blog/x')), null, key)
  assert.equal(preguntaDe(t('fix:robots', 'Fix robots', 'fix')), null)
})
