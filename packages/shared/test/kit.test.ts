import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  claveIndexNow,
  construirKit,
  filtrarChequeos,
  parsearCapas,
  evaluarBots,
  generarProxy,
  headJsonLd,
  HOST_IDS,
  INDEXNOW_KEY_PATH,
  installMd,
  jsonLdOrganization,
  jsonLdWebApi,
  jsonParaScript,
  manifiestoProxy,
  PEAJE_FETCH_HEADER,
  reglasNext,
  robotsTxt,
  RUTAS_DINAMICAS,
  RUTAS_PROXY,
  rutasABorrar,
  scriptJsonLd,
  scriptJsonLdGraph,
  tieneDatosEntidad,
} from '../src/kit/index'

const base = 'https://gateway.example/cafe-andino'
const ofertas = [
  { titulo: 'Menú del día', priceUsd: 0.05, url: `${base}/r/menu` },
  { titulo: 'Reservas </script><b>', priceUsd: 0.2, url: `${base}/r/reservas` },
]

test('todos los hosts llevan todas las rutas fijas y la guarda de llms.txt', () => {
  for (const host of HOST_IDS) {
    const cfg = generarProxy(host, base)
    for (const r of RUTAS_PROXY) assert.ok(cfg.includes(r.path), `${host} sin ${r.path}`)
    assert.ok(cfg.includes(PEAJE_FETCH_HEADER) || host === 'nginx', `${host} sin guarda x-peaje-fetch`)
  }
})

test('las rutas dinámicas aparecen como comodín o prefijo según el host', () => {
  assert.ok(generarProxy('next', base).includes(`source: '/r/:slug'`))
  assert.ok(generarProxy('vercel', base).includes(`"source": "/r/:slug"`))
  for (const host of ['cloudflare', 'nginx', 'caddy'] as const) {
    const cfg = generarProxy(host, base)
    for (const r of RUTAS_DINAMICAS) assert.ok(cfg.includes(r.prefijo), `${host} sin prefijo ${r.prefijo}`)
  }
})

test('nginx reenvía host original y habilita SNI; Caddy y Worker reenvían X-Forwarded-Host', () => {
  const n = generarProxy('nginx', base)
  assert.ok(n.includes('proxy_ssl_server_name on'))
  assert.ok(n.includes('X-Forwarded-Host $host'))
  assert.ok(generarProxy('caddy', base).includes('X-Forwarded-Host {host}'))
  assert.ok(generarProxy('cloudflare', base).includes(`'x-forwarded-host'`))
})

test('reglasNext es la misma lista que la config de texto', () => {
  const reglas = reglasNext(base)
  assert.equal(reglas.length, RUTAS_PROXY.length + RUTAS_DINAMICAS.length)
  const llms = reglas.find((r) => r.source === '/llms.txt')
  assert.deepEqual(llms?.missing, [{ type: 'header', key: PEAJE_FETCH_HEADER }])
})

test('el JSON-LD escapa < para no cerrar el <script> y apunta al dominio del negocio', () => {
  const datos = jsonLdWebApi({ nombre: 'Café Andino', slug: 'cafe-andino', originHost: 'cafeandino.com', ofertas })
  const script = scriptJsonLd(datos)
  assert.ok(!script.includes('</script><b>'))
  assert.ok(script.includes('\\u003c/script>'))
  assert.ok(script.includes('https://cafeandino.com/r/menu'))
  assert.equal(JSON.parse(jsonParaScript({ a: '<x>' })).a, '<x>')
})

test('robots nombra a los bots de búsqueda, bloquea 402 para ellos y opcionalmente el entrenamiento', () => {
  const r = robotsTxt({ originHost: 'cafeandino.com', rutasPagas: ['/r/menu'], sinEntrenamiento: true })
  assert.ok(r.includes('User-agent: OAI-SearchBot'))
  assert.ok(r.includes('Disallow: /r/menu'))
  assert.ok(r.includes('User-agent: GPTBot\nUser-agent: ClaudeBot'))
  assert.ok(r.includes('Sitemap: https://cafeandino.com/sitemap.xml'))
  assert.ok(!robotsTxt({ originHost: 'x.com' }).includes('GPTBot'))
})

test('rutasABorrar no incluye llms.txt', () => {
  assert.ok(!rutasABorrar().includes('/llms.txt'))
  assert.ok(rutasABorrar().includes('/openapi.json'))
})

test('el kit incluye solo lo que falta y mantiene el 402 de prueba', () => {
  const kit = construirKit({
    slug: 'cafe-andino',
    nombre: 'Café Andino',
    originHost: 'cafeandino.com',
    base,
    ofertas,
    host: 'next',
    chequeos: [
      { id: 'proxy', ok: true, motivo: 'ok' },
      { id: 'frescura', ok: false, motivo: 'copias-viejas', faltantes: ['/openapi.json'] },
      { id: 'json-ld', ok: false, motivo: 'jsonld-falta' },
      { id: 'links', ok: true, motivo: 'ok' },
      { id: 'robots', ok: true, motivo: 'ok' },
    ],
  })
  assert.equal(kit.host, 'next')
  assert.deepEqual(kit.files.map((f) => f.path), ['peaje/head.html'])
  assert.ok(kit.files[0]!.content.includes('application/ld+json'))
  assert.ok(!kit.files[0]!.content.includes('rel="service-desc"'))
  assert.deepEqual(kit.remove, ['/openapi.json'])
  assert.equal(kit.paidPath, '/r/menu')
  assert.ok(installMd(kit).includes(kit.verifyUrl))
})

test('sin chequeos ni host, el kit trae todo y un archivo de proxy por host', () => {
  const kit = construirKit({ slug: 's', nombre: 'S', originHost: 's.com', base, ofertas: [] })
  assert.equal(kit.host, 'unknown')
  assert.equal(kit.files.filter((f) => f.path.startsWith('peaje/') && f.path !== 'peaje/head.html').length, HOST_IDS.length)
  assert.ok(kit.files.some((f) => f.path === 'public/robots.txt' && f.mode === 'create'))
  assert.equal(kit.paidPath, null)
})

// ---- motores de respuesta ----

test('Organization lleva solo los campos con dato y cierra el grafo con la API', () => {
  const org = jsonLdOrganization({
    nombre: 'Café Andino',
    originHost: 'cafeandino.com',
    telefono: ' +56 9 1234 5678 ',
    direccion: 'Av. Providencia 1234, Santiago',
    sameAs: ['https://linkedin.com/company/cafe-andino', '', '  '],
  })
  assert.equal(org['@id'], 'https://cafeandino.com/#organization')
  assert.equal(org.url, 'https://cafeandino.com/')
  assert.equal(org.telephone, '+56 9 1234 5678')
  assert.deepEqual(org.address, { '@type': 'PostalAddress', streetAddress: 'Av. Providencia 1234, Santiago' })
  assert.deepEqual(org.sameAs, ['https://linkedin.com/company/cafe-andino'])
  assert.ok(!('logo' in org))
  assert.ok(!('description' in org))
  assert.deepEqual(org.makesOffer, [{ '@type': 'Offer', itemOffered: { '@id': 'https://cafeandino.com/#api' } }])

  const pelada = jsonLdOrganization({ nombre: 'X', originHost: 'x.com' })
  assert.ok(!('address' in pelada) && !('telephone' in pelada) && !('sameAs' in pelada))
  assert.equal(tieneDatosEntidad({ sameAs: [' '], telefono: '' }), false)
  assert.equal(tieneDatosEntidad({ logoUrl: 'https://x.com/logo.png' }), true)
})

test('el graph emite un solo <script> con @context una vez y los @id cruzados', () => {
  const org = jsonLdOrganization({ nombre: 'Café Andino', originHost: 'cafeandino.com', descripcion: 'Café' })
  const api = jsonLdWebApi({ nombre: 'Café Andino', slug: 'cafe-andino', originHost: 'cafeandino.com', ofertas })
  const script = scriptJsonLdGraph([org, api])
  assert.equal(script.split('<script').length - 1, 1)
  const json = JSON.parse(script.replace(/^<script[^>]*>\n/, '').replace(/\n<\/script>$/, ''))
  assert.equal(json['@context'], 'https://schema.org')
  assert.equal(json['@graph'].length, 2)
  assert.ok(json['@graph'].every((n: Record<string, unknown>) => !('@context' in n)))
  assert.equal(json['@graph'][1].provider['@id'], json['@graph'][0]['@id'])
})

test('el head del kit usa el graph solo cuando hay datos de entidad', () => {
  const base_ = { nombre: 'S', slug: 's', originHost: 's.com', ofertas }
  assert.ok(!headJsonLd({ ...base_, entidad: null }).includes('@graph'))
  assert.ok(!headJsonLd({ ...base_, entidad: { telefono: '' } }).includes('@graph'))
  const con = headJsonLd({ ...base_, entidad: { telefono: '+1 555' } })
  assert.ok(con.includes('@graph') && con.includes('"Organization"') && con.includes('"WebAPI"'))
})

test('el kit pasa la entidad al head y el toggle al robots', () => {
  const kit = construirKit({
    slug: 's',
    nombre: 'S',
    originHost: 's.com',
    base,
    ofertas,
    host: 'next',
    entidad: { direccion: 'Calle 1' },
    sinEntrenamiento: true,
  })
  const head = kit.files.find((f) => f.path === 'peaje/head.html')!
  assert.ok(head.content.includes('"streetAddress": "Calle 1"'))
  const robots = kit.files.find((f) => f.path === 'public/robots.txt')!
  assert.ok(robots.content.includes('User-agent: GPTBot'))
  assert.ok(robots.content.includes('User-agent: OAI-SearchBot\n'))
  assert.ok(installMd(kit).includes('Organization'))

  const sinToggle = construirKit({ slug: 's', nombre: 'S', originHost: 's.com', base, ofertas, host: 'next' })
  assert.ok(!sinToggle.files.find((f) => f.path === 'public/robots.txt')!.content.includes('GPTBot'))
})

test('el chequeo bots ordena los motivos por gravedad y lista cada caso', () => {
  const ok = evaluarBots([{ bot: 'Googlebot', path: '/', status: 200, challenge: false, sinHtml: false }])
  assert.equal(ok.ok, true)
  assert.equal(ok.motivo, 'ok')

  const mezcla = evaluarBots([
    { bot: 'Googlebot', path: '/', status: 200, challenge: false, sinHtml: true },
    { bot: 'PerplexityBot', path: '/developers', status: 403, challenge: true, sinHtml: false },
    { bot: 'OAI-SearchBot', path: '/', status: 429, challenge: false, sinHtml: false },
    // Red caída: no es evidencia de bloqueo.
    { bot: 'OAI-SearchBot', path: '/developers', status: 0, challenge: false, sinHtml: false },
  ])
  assert.equal(mezcla.ok, false)
  assert.equal(mezcla.motivo, 'bots-bloqueados')
  assert.deepEqual(mezcla.faltantes, ['Googlebot / sin-html', 'PerplexityBot /developers challenge', 'OAI-SearchBot / 429'])

  const soloChallenge = evaluarBots([{ bot: 'Googlebot', path: '/', status: 403, challenge: true, sinHtml: false }])
  assert.equal(soloChallenge.motivo, 'bots-challenge')
})

test('la clave IndexNow es determinística, de 32 hex, y su ruta está en el proxy', async () => {
  const a = await claveIndexNow('secreto')
  assert.equal(a, await claveIndexNow('secreto'))
  assert.match(a, /^[0-9a-f]{32}$/)
  assert.notEqual(a, await claveIndexNow('otro'))
  assert.ok(RUTAS_PROXY.some((r) => r.path === INDEXNOW_KEY_PATH))
})

test('el Worker lee el manifiesto y conserva la lista embebida como respaldo', () => {
  const w = generarProxy('cloudflare', base)
  assert.ok(w.includes(`'/kit/manifest.json'`))
  assert.ok(w.includes('waitUntil'))
  for (const r of RUTAS_PROXY) assert.ok(w.includes(`'${r.path}'`))
  const m = manifiestoProxy(base, 'v')
  assert.deepEqual(m.rutas, RUTAS_PROXY.map((r) => r.path))
  assert.deepEqual(m.prefijos, RUTAS_DINAMICAS.map((r) => r.prefijo))
})

test('capas: solo aeo trae Organization sin #api, robots sin 402 y nada del proxy', () => {
  assert.deepEqual(parsearCapas(null), ['agentes', 'aeo'])
  assert.deepEqual(parsearCapas('aeo'), ['aeo'])
  assert.deepEqual(parsearCapas('agents'), ['agentes'])
  assert.deepEqual(parsearCapas('basura'), ['agentes', 'aeo'])
  const kit = construirKit({ slug: 's', nombre: 'S', originHost: 's.com', base, ofertas, host: 'next', capas: ['aeo'] })
  assert.deepEqual(kit.layers, ['aeo'])
  assert.deepEqual(kit.files.map((f) => f.path).sort(), ['peaje/head.html', 'public/robots.txt'])
  const head = kit.files.find((f) => f.path === 'peaje/head.html')!.content
  assert.ok(head.includes('"Organization"') && !head.includes('WebAPI') && !head.includes('makesOffer') && !head.includes('rel="service-desc"'))
  const robots = kit.files.find((f) => f.path === 'public/robots.txt')!.content
  assert.ok(robots.includes('OAI-SearchBot') && !robots.includes('Disallow: /r/menu') && !robots.includes('402'))
  assert.deepEqual(kit.remove, [])
  assert.equal(kit.paidPath, null)
  assert.ok(kit.verifyUrl.endsWith('?layers=aeo'))
  assert.ok(!kit.manual.some((m) => m.includes('<a href="/developers">')))
  assert.ok(installMd(kit).includes('--only aeo'))
  const filtrados = filtrarChequeos(
    [
      { id: 'proxy', ok: false, motivo: 'proxy-nada' },
      { id: 'json-ld', ok: true, motivo: 'ok' },
      { id: 'links', ok: false, motivo: 'links-falta' },
      { id: 'robots', ok: true, motivo: 'ok' },
      { id: 'bots', ok: true, motivo: 'ok' },
    ],
    ['aeo'],
  )
  assert.deepEqual(filtrados.map((c) => c.id), ['json-ld', 'robots', 'bots'])
})
