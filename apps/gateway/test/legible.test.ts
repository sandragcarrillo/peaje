// Tools MCP de links: una página HTML llega como markdown legible (título,
// encabezados, párrafos, listas, links absolutos), sin scripts, estilos ni
// menú del sitio; JSON y texto pasan tal cual; max_chars corta después de
// convertir. Y una ruta de API a precio 0 (el radar del sitio "peaje") es una
// tool gratis que llama al origen con la prueba de origen, sin 402.
// Store en memoria, fetch falso: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-legible-0123456789abcdef0123456789abcdef',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const HTML = readFileSync(new URL('./fixtures/articulo.html', import.meta.url), 'utf8')
const ARTICULO = 'https://tostadores.example/blog/cafe-de-origen'

type Pedido = { url: string; headers: Headers }
let pedidos: Pedido[] = []
const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  pedidos.push({ url, headers: new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)) })
  if (url === ARTICULO) return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  if (url === 'https://tostadores.example/precios.json') return new Response('{"huila":48000,"html":"<p>no se toca</p>"}', { headers: { 'content-type': 'application/json' } })
  if (url === 'https://tostadores.example/notas.md') return new Response('# Notas\n\n<b>tal cual</b>', { headers: { 'content-type': 'text/markdown' } })
  if (url.startsWith('https://usepeaje.example/api/radar/')) {
    const dominio = decodeURIComponent(url.split('/').pop()!)
    if (dominio === 'no-existe.example') return Response.json({ error: 'unreachable', hint: 'no-existe.example did not answer.' }, { status: 404 })
    return Response.json({ domain: dominio, score: 41, grade: 'D', topFixes: [{ id: 'llms-txt-exists', points: 8 }] })
  }
  if (/\.example(\/|$)/.test(url)) return new Response('', { status: 404 })
  return fetchReal(input, init)
}) as typeof fetch

const { esHtml, htmlAMarkdown, legible, decodificar, ENTIDADES } = await import('../src/legible.js')
const { buildServer, toolName } = await import('../src/mcp.js')
const { store } = await import('../src/store.js')
const { PEAJE_ORIGIN_HEADER, secretoOrigen } = await import('@peaje/shared')

// ---------------------------------------------------------------- conversión

test('una página HTML queda en markdown: título, encabezados, párrafos, listas, tablas y links absolutos', () => {
  const md = htmlAMarkdown(HTML, ARTICULO)
  // El contenido es el <main>: el h1 del artículo, sin repetir el <title>.
  assert.match(md, /^Guías\n\n# Café de origen: guía de compra\n\nPor Ana Ruiz · 30 de septiembre de 2026\n\n/)
  assert.ok(md.includes('El café de origen viene de **una sola finca** o región, y se nota en la taza. Lee [nuestra guía de tueste](https://tostadores.example/blog/tueste) o escríbenos a [hola@tostadores.example](mailto:hola@tostadores.example).'))
  // <p> sin cierre, link javascript: solo el texto.
  assert.ok(md.includes('Un párrafo sin cierre, con *énfasis* y un link falso.'))
  assert.ok(md.includes('## Qué mirar en la etiqueta\n\n- Altura de cultivo\n  - Más de 1.600 m\n  - Entre 1.200 y 1.600 m\n- Fecha de tueste \u2014 no la de empaque\n- Proceso lavado, natural o honey'))
  assert.ok(md.includes('### Pasos para comprar\n\n3. Elige la región.\n4. Pide la molienda.'))
  assert.ok(md.includes('> El mejor café es el que te gusta.\n>\n> Ana Ruiz'))
  assert.ok(md.includes('```bash\ncurl -s https://tostadores.example/api/precios?region=huila&peso=500\n# <json>\n```'))
  assert.ok(md.includes('**Precios por libra**\n\n| Región | Precio (COP) |\n| --- | --- |\n| Huila | 48.000 |\n| Nariño | 52.000 \\| envío gratis |'))
  assert.ok(md.includes('![Finca en el Huila](https://cdn.tostadores.example/finca.jpg)\n\nLa finca El Mirador.'))
  // Lo que se lee en pantalla del formulario queda; los controles no.
  assert.ok(md.endsWith('Recibe el boletín'))
})

test('fuera: scripts, estilos, menú, cookies, lo oculto, aside, footers y controles de formulario', () => {
  const md = htmlAMarkdown(HTML, ARTICULO)
  for (const ruido of [
    'dataLayer', 'no soy contenido', 'text-decoration', 'Saltar al contenido', 'Tienda', 'Contacto', 'Usamos cookies', 'Aceptar',
    'Icono', 'Texto oculto', 'Otro texto oculto', 'Suscribirme', 'tu@correo.com', 'Te puede interesar', 'Otros artículos',
    'Etiquetas', 'Privacidad', '2026 Tostadores', 'secreto', 'pixel', '<', 'class=',
  ]) {
    assert.ok(!md.replace('# <json>', '').includes(ruido), `quedó "${ruido}"`)
  }
})

test('sin <main>: el cuerpo sin el header ni el footer del sitio, y el <title> como encabezado', () => {
  const md = htmlAMarkdown(
    '<html><head><title>Precios &amp; planes</title></head><body><header><a href="/">Logo</a><nav><a href="/a">A</a></nav></header>' +
      '<div class="wrap"><p>Plan b&aacute;sico: <b>US$10</b>.</p><div><span>Uno</span><span>Dos</span></div></div>' +
      '<footer>Pie</footer></body></html>',
    'https://sitio.example/precios',
  )
  assert.equal(md, '# Precios & planes\n\nPlan básico: **US$10**.\n\nUno Dos')
})

test('una app que se arma en el navegador: título y descripción, no un cuerpo vacío', () => {
  const md = htmlAMarkdown('<!doctype html><html><head><title>App</title><meta name="description" content="Tu panel de pedidos."></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
  assert.equal(md, '# App\n\nTu panel de pedidos.')
})

test('entidades: nombradas, Latin-1 completo y numéricas', () => {
  assert.equal(ENTIDADES.nbsp, '\u00a0')
  assert.equal(ENTIDADES.yuml, '\u00ff')
  assert.equal(ENTIDADES.Ntilde, '\u00d1')
  assert.equal(decodificar('Se&ntilde;or &quot;caf&eacute;&quot; &#8217;x&#x2019; &copy; &desconocida; &amp;amp;'), 'Señor "café" \u2019x\u2019 \u00a9 &desconocida; &amp;')
})

test('qué es HTML: por content-type, o por cómo empieza si no hay; JSON, texto y markdown pasan tal cual', () => {
  assert.equal(esHtml('text/html; charset=utf-8', ''), true)
  assert.equal(esHtml('application/xhtml+xml', ''), true)
  assert.equal(esHtml(null, '\n  <!DOCTYPE html><html>'), true)
  assert.equal(esHtml('application/octet-stream', '<html lang="es">'), true)
  assert.equal(esHtml('text/plain', '<!doctype html>'), false)
  assert.equal(esHtml(null, '{"a":1}'), false)
  const json = '{"html":"<p>hola</p>"}'
  assert.equal(legible(json, 'application/json', 'https://x.example'), json)
  assert.equal(legible('# Hola\n\n<b>x</b>', 'text/markdown', null), '# Hola\n\n<b>x</b>')
  assert.equal(legible('%PDF-1.7 binario', 'application/pdf', null), '%PDF-1.7 binario')
  assert.equal(legible('<html><body></body></html>', 'text/html', null), 'The page has no readable text.')
})

// ---------------------------------------------------------------- por MCP

let n = 0
async function negocio(originUrl = `https://tienda-${++n}.example`) {
  return store.createTenant({ slug: `legible-${++n}`, name: 'Tostadores Andinos', originUrl, embedSecret: `secreto-${n}` })
}

async function conectar(tenant: Awaited<ReturnType<typeof negocio>>) {
  const [routes, resources] = await Promise.all([store.listRoutes(tenant.id), store.listResources(tenant.id)])
  const server = buildServer(tenant, routes, resources, `https://docs.example/${tenant.slug}`)
  const [delServidor, delCliente] = InMemoryTransport.createLinkedPair()
  await server.connect(delServidor)
  const client = new Client({ name: 'prueba', version: '1.0.0' })
  await client.connect(delCliente)
  return client
}

const textoDe = (r: Awaited<ReturnType<Client['callTool']>>) => ((r.content as { type: string; text: string }[])[0]?.text ?? '')

test('MCP: un link a una página HTML devuelve el markdown, y max_chars corta después de convertir', async () => {
  const t = await negocio()
  await store.createResources([
    { tenantId: t.id, slug: 'cafe-de-origen', url: ARTICULO, title: 'Café de origen', priceUsd: '0' },
    { tenantId: t.id, slug: 'precios', url: 'https://tostadores.example/precios.json', title: 'Precios', priceUsd: '0' },
    { tenantId: t.id, slug: 'notas', url: 'https://tostadores.example/notas.md', title: 'Notas', priceUsd: '0' },
  ])
  const client = await conectar(t)

  const completo = textoDe(await client.callTool({ name: 'read_cafe_de_origen', arguments: {} }))
  assert.equal(completo, htmlAMarkdown(HTML, ARTICULO))
  assert.ok(!completo.includes('<'.concat('script')))

  const corto = textoDe(await client.callTool({ name: 'read_cafe_de_origen', arguments: { max_chars: 40 } }))
  assert.equal(corto, completo.slice(0, 40))
  assert.equal(corto.length, 40)

  assert.equal(textoDe(await client.callTool({ name: 'read_precios', arguments: {} })), '{"huila":48000,"html":"<p>no se toca</p>"}')
  assert.equal(textoDe(await client.callTool({ name: 'read_notas', arguments: {} })), '# Notas\n\n<b>tal cual</b>')
  await client.close()
})

test('MCP: una ruta a precio 0 con :dominio es una tool gratis; llama al origen con la prueba de origen y sin 402', async () => {
  const t = await negocio('https://usepeaje.example')
  const ruta = await store.createRoute({ tenantId: t.id, method: 'GET', pathPattern: '/api/radar/:dominio', priceUsd: '0', description: 'Agent-readiness score of a website.' })
  assert.equal(toolName(ruta), 'get_api_radar_by_dominio')
  const client = await conectar(t)

  const { tools } = await client.listTools()
  const tool = tools.find((x) => x.name === 'get_api_radar_by_dominio')
  assert.ok(tool, 'falta la tool del radar')
  assert.equal(tool.description, 'Agent-readiness score of a website. · Free.')
  assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), ['dominio', 'query'])
  assert.deepEqual(tool.inputSchema.required, ['dominio'])

  pedidos = []
  const r = await client.callTool({ name: 'get_api_radar_by_dominio', arguments: { dominio: 'tostadores.example' } })
  assert.equal(r.isError, undefined)
  assert.deepEqual(JSON.parse(textoDe(r)), { domain: 'tostadores.example', score: 41, grade: 'D', topFixes: [{ id: 'llms-txt-exists', points: 8 }] })
  assert.equal(r._meta, undefined) // sin receipt: no hubo cobro
  const [pedido] = pedidos.filter((p) => p.url.startsWith('https://usepeaje.example/'))
  assert.equal(pedido?.url, 'https://usepeaje.example/api/radar/tostadores.example')
  assert.equal(pedido?.headers.get(PEAJE_ORIGIN_HEADER), await secretoOrigen(t.embedSecret))

  // Un 4xx del origen vuelve como error legible para el agente.
  const malo = await client.callTool({ name: 'get_api_radar_by_dominio', arguments: { dominio: 'no-existe.example' } })
  assert.equal(malo.isError, true)
  assert.equal(JSON.parse(textoDe(malo)).error, 'unreachable')
  await client.close()
})
