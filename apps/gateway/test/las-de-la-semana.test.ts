// Las 3 de la semana: Search Console genera tareas sin que nadie pregunte, cada
// tarea lleva prioridad (impacto, esfuerzo, evidencia), la cola sale ordenada y
// el correo abre con la propuesta en el idioma del dueño. Store en memoria;
// Google y el sitio son un fetch falso.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY
delete process.env.TELEGRAM_BOT_TOKEN
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-las-de-la-semana-0123456789abcdef01234567',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  GATEWAY_PUBLIC_URL: 'https://api.ejemplo.test',
  GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-de-prueba',
  GOOGLE_TOKEN_KEY: 'llave-de-prueba-para-cifrar-tokens-0123456789',
})

const { store } = await import('../src/store.js')
const api = await import('../src/google/api.js')
const { oportunidades } = await import('../src/google/oportunidades.js')
const { lasDeLaSemana, ordenar, prioridadBloqueo, prioridadBusqueda, prioridadDe, prioridadFrescura, prioridadPagina } = await import('../src/tareas/prioridad.js')
const { generarTareas } = await import('../src/tareas/generar.js')
const { armarReporte } = await import('../src/monitor/reporte.js')
const { htmlSemanal, textoSemana } = await import('../src/monitor/email.js')
const { tocaCorreo } = await import('../src/tareas/plan.js')

const fila = (keys: string[], clicks: number, impressions: number, position: number) => ({ keys, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position })

// Parecido a un sitio real con poco tráfico: dos guías lejos del primer puesto y una página en la primera sin clics.
const S = 'https://www.ejemplo.co'
const PAGINAS = [
  fila([`${S}/blog/guia-a`], 1, 122, 68.1),
  fila([`${S}/blog/guia-b`], 0, 78, 79.3),
  fila([`${S}/developers`], 0, 21, 6.5),
  fila([`${S}/`], 3, 60, 4.2),
  fila([`${S}/blog/poca`], 0, 4, 30),
  fila([`${S}/blog/guia-a#seccion`], 0, 40, 50),
]
const PARES = [
  fila(['como salir en ai overviews', `${S}/blog/guia-a`], 0, 70, 66),
  fila(['ai overviews seo', `${S}/blog/guia-a`], 1, 30, 71),
  fila(['pagos por uso para agentes', `${S}/developers`], 0, 15, 6),
]

test('oportunidades: lejos del primer puesto es "mejorar", primera página sin clics es "titulo"; poca muestra y anclas quedan afuera', () => {
  const o = oportunidades(PAGINAS, PARES)
  assert.deepEqual(o.map((x) => [x.ruta, x.tipo]), [
    ['/blog/guia-a', 'mejorar'],
    ['/blog/guia-b', 'mejorar'],
    ['/developers', 'titulo'],
  ])
  // La home está en la primera página y sí recibe clics: no hay nada que proponer.
  assert.ok(!o.some((x) => x.ruta === '/'))
  assert.deepEqual(o[0]!.consultas.map((c) => c.texto), ['como salir en ai overviews', 'ai overviews seo'])
  assert.equal(oportunidades([], []).length, 0)
})

test('la evidencia va en los dos idiomas, con los números que midió Google y sin prometer clics', () => {
  const todas = oportunidades(PAGINAS, PARES)
  const guia = todas.find((x) => x.ruta === '/blog/guia-a')
  const dev = todas.find((x) => x.ruta === '/developers')
  const p = prioridadBusqueda(guia!)
  assert.equal(p.effort, 'medium')
  assert.equal(p.impact, 'high')
  assert.match(p.why.es, /122 en 28 días/)
  assert.match(p.why.es, /puesto 68\.1/)
  assert.match(p.why.es, /"como salir en ai overviews"/)
  assert.match(p.why.en, /position 68\.1/)
  const t = prioridadBusqueda(dev!)
  assert.equal(t.effort, 'small')
  assert.match(t.label.es, /^Cambiar el título de \/developers$/)
  assert.match(t.why.es, /nadie entró/)
  for (const texto of [p.why.es, p.why.en, t.why.es, t.why.en]) assert.doesNotMatch(texto, /—|–|vas a ganar|you will get/)
})

const tenant = await store.createTenant({ slug: 'semana-prueba', name: 'Semana Prueba', originUrl: S, embedSecret: 'x', email: 'duena@ejemplo.co' } as Parameters<typeof store.createTenant>[0])
await store.setTenantPlan(tenant.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
await store.saveGoogleConnection({ tenantId: tenant.id, email: 'duena@ejemplo.co', refreshTokenEnc: api.cifrar('1//refresco'), scope: 'https://www.googleapis.com/auth/webmasters.readonly', property: 'sc-domain:ejemplo.co', properties: [{ siteUrl: 'sc-domain:ejemplo.co', permissionLevel: 'siteOwner' }] } as Parameters<typeof store.saveGoogleConnection>[0])

const fetchReal = globalThis.fetch
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada)
  const json = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } })
  if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'ya29.nuevo', expires_in: 3600 })
  if (url.endsWith('/searchAnalytics/query')) {
    const q = JSON.parse(String(init?.body)) as { dimensions: string[] }
    if (q.dimensions.length === 2) return json({ rows: PARES })
    if (q.dimensions[0] === 'page') return json({ rows: PAGINAS })
    return json({ rows: [fila(['como salir en ai overviews'], 0, 70, 66)] })
  }
  // El sitio del negocio: no responde (las otras fuentes de tareas quedan vacías).
  return new Response('', { status: 404 })
}) as typeof fetch
process.on('exit', () => {
  globalThis.fetch = fetchReal
})

test('generarTareas: Search Console deja sus tareas con prioridad; una descartada no vuelve', async () => {
  await generarTareas(tenant)
  const deBusqueda = async () => (await store.listTasks(tenant.id)).filter((t) => t.source === 'search-console')
  let tareas = await deBusqueda()
  assert.deepEqual(tareas.map((t) => t.key).sort(), ['content:improve:/blog/guia-a', 'content:improve:/blog/guia-b', 'content:snippet:/developers'])
  const guia = tareas.find((t) => t.key === 'content:improve:/blog/guia-a')!
  assert.equal(guia.kind, 'content')
  assert.equal(guia.priority?.impact, 'high')
  assert.match(guia.body, /"como salir en ai overviews": 70 impressions, average position 66/)
  assert.deepEqual(guia.acceptance, [{ type: 'url', url: `${S}/blog/guia-a` }])

  await store.updateTask(tenant.id, guia.id, { status: 'dismissed', note: 'no va' })
  await generarTareas(tenant)
  tareas = await deBusqueda()
  assert.equal(tareas.length, 3)
  assert.equal(tareas.find((t) => t.id === guia.id)?.status, 'dismissed')
})

test('la cola: primero lo que impide leer el sitio, después lo de Google, páginas nuevas y mantenimiento', async () => {
  const base = { tenantId: tenant.id, kind: 'content' as const, summary: '', body: 'x', acceptance: [] }
  await store.upsertTask({ ...base, key: 'content:refresh:/vieja', title: 'Refresh /vieja', priority: prioridadFrescura({ ruta: '/vieja', fecha: '2024-01-01' }) })
  await store.upsertTask({ ...base, key: 'content:que-es-x', title: '¿Qué es X?', priority: prioridadPagina({ pregunta: '¿Qué es X?', porQue: 'Nadie lo explica con precios.' }, false) })
  await store.upsertTask({ ...base, kind: 'fix', key: 'fix:robots:OAI-SearchBot', title: 'Let ChatGPT read the site', priority: prioridadBloqueo({ bot: 'OAI-SearchBot', producto: 'ChatGPT', por: 'robots' }) })
  // Una tarea de antes de la columna: sin prioridad guardada, igual entra en el orden.
  await store.upsertTask({ ...base, kind: 'route', key: 'route:GET /precios', title: 'Serve GET /precios' })

  const abiertas = await store.listTasks(tenant.id, { statuses: ['open'] })
  assert.deepEqual(ordenar(abiertas).map((t) => t.key), ['fix:robots:OAI-SearchBot', 'content:improve:/blog/guia-b', 'content:snippet:/developers', 'content:que-es-x', 'route:GET /precios', 'content:refresh:/vieja'])
  assert.equal(prioridadDe(abiertas.find((t) => t.key === 'route:GET /precios')!).label.es, 'Serve GET /precios')

  const es = lasDeLaSemana(abiertas, 'es')
  assert.equal(es.length, 3)
  assert.equal(es[0]!.titulo, 'Dejar que ChatGPT lea tu sitio')
  assert.equal(lasDeLaSemana(abiertas, 'en')[0]!.titulo, 'Let ChatGPT read your site')
})

test('el correo abre con la propuesta, en el idioma del dueño, con el enlace a cada tarea', async () => {
  const v = await store.recordVerification({ tenantId: tenant.id, ok: true, score: 80, checks: [{ id: 'proxy', ok: true, motivo: 'ok' }], robotsHash: null, llmsHash: null, alerted: [], pending: [] })
  const r = await armarReporte(tenant, v, { idioma: 'es' })
  assert.equal(r.semana.length, 3)
  const { subject, html } = htmlSemanal(tenant, r)
  assert.equal(subject, 'Semana Prueba: 3 cosas para probar esta semana')
  const cuerpo = html.slice(html.indexOf('Esta semana probemos con estas 3'))
  assert.ok(cuerpo.indexOf('Dejar que ChatGPT lea tu sitio') < cuerpo.indexOf('Cambiar el título de /developers'))
  assert.ok(html.indexOf('Esta semana probemos') < html.indexOf('Qué tan listo está tu sitio'))
  assert.match(html, /impacto alto · poco trabajo/)
  assert.match(html, new RegExp(`https://usepeaje.com/t/semana-prueba/agente/(tareas/|contenido\\?id=)`))
  assert.doesNotMatch(html, /Content to create|this week/)
  assert.match(textoSemana(r), /^\*\*Esta semana probemos con estas 3\*\*/)

  const en = htmlSemanal(tenant, await armarReporte(tenant, v, { idioma: 'en' }))
  assert.equal(en.subject, 'Semana Prueba: 3 things to try this week')

  // Sin nada abierto no inventa trabajo: dice que está todo en orden.
  for (const t of await store.listTasks(tenant.id, { statuses: ['open'] })) await store.updateTask(tenant.id, t.id, { status: 'dismissed' })
  const vacio = htmlSemanal(tenant, await armarReporte(tenant, v, { idioma: 'es' }))
  assert.equal(vacio.subject, 'Semana Prueba: todo en orden esta semana')
  assert.match(vacio.html, /No hay nada que te convenga cambiar esta semana/)
})

test('Telegram: la propuesta sale en el idioma del chat y "No va" descarta solo esa tarea', async () => {
  const { bandeja } = await import('../src/telegram/api.js')
  const { procesarUpdate, proponerPorTelegram } = await import('../src/telegram/bot.js')
  const { semanaDe } = await import('../src/monitor/reporte.js')
  const otro = await store.createTenant({ slug: 'semana-tg', name: 'Semana TG', originUrl: 'https://tg.ejemplo.co', embedSecret: 'x' })
  const base = { tenantId: otro.id, kind: 'content' as const, summary: '', body: 'x', acceptance: [] }
  await store.upsertTask({ ...base, key: 'content:refresh:/a', title: 'Refresh /a', priority: prioridadFrescura({ ruta: '/a', fecha: '2024-01-01' }) })
  await store.upsertTask({ ...base, key: 'content:refresh:/b', title: 'Add a date to /b', priority: prioridadFrescura({ ruta: '/b', fecha: null }) })
  await store.createTelegramCode(otro.id, 'cod-semana', new Date(Date.now() + 600_000).toISOString())
  await procesarUpdate({ message: { chat: { id: 9901 }, from: { language_code: 'es' }, text: '/start cod-semana' } })
  bandeja.length = 0

  const abiertas = await store.listTasks(otro.id, { statuses: ['open'] })
  await proponerPorTelegram(otro.id, (idioma) => {
    const semana = semanaDe(otro, abiertas, idioma)
    return { texto: textoSemana({ idioma, semana } as Parameters<typeof textoSemana>[0]), propuestas: semana.map((p) => ({ id: p.id, url: p.url })) }
  })
  const msg = bandeja.find((b) => b.metodo === 'sendMessage')!.cuerpo as { text: string; reply_markup: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] } }
  assert.match(msg.text, /Esta semana probemos con estas 2/)
  assert.match(msg.text, /Actualizar <code>\/a<\/code>/)
  const filas = msg.reply_markup.inline_keyboard
  assert.deepEqual(filas.map((f) => f.map((b) => b.text)), [['1 · Ver', '1 · No va'], ['2 · Ver', '2 · No va']])

  const primera = abiertas.find((t) => t.key === 'content:refresh:/a')!
  bandeja.length = 0
  await procesarUpdate({ callback_query: { id: 'cb', data: `t:${primera.id}:n`, message: { chat: { id: 9901 }, message_id: 5, reply_markup: msg.reply_markup } } })
  assert.equal((await store.getTask(otro.id, primera.id))?.status, 'dismissed')
  const editado = bandeja.find((b) => b.metodo === 'editMessageReplyMarkup')!.cuerpo as { reply_markup: { inline_keyboard: { text: string }[][] } }
  assert.deepEqual(editado.reply_markup.inline_keyboard.map((f) => f.map((b) => b.text)), [['2 · Ver', '2 · No va']])
  assert.match((bandeja.find((b) => b.metodo === 'sendMessage')!.cuerpo as { text: string }).text, /saqué "Actualizar \/a" de tu lista/)
})

test('la cadencia "a pedido" calla el mensaje y nada más: el generador no depende de ella', () => {
  assert.equal(tocaCorreo({ cadence: 'on-demand', createdAt: new Date().toISOString() } as Parameters<typeof tocaCorreo>[0]), false)
  assert.equal(tocaCorreo(null), true)
})
