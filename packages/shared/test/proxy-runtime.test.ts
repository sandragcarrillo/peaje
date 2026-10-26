import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  coincidePatron,
  crearProxyRuntime,
  esReservado,
  generarProxy,
  manifiestoProxy,
  patronARegex,
  patronANext,
  patronPermitido,
  patronReenviable,
  prefijosApiValidos,
  reglasNext,
  secretoOrigen,
} from '../src/kit/index'

const base = 'https://gateway.example/cafe-andino'
const patrones = [
  { method: 'GET', path: '/api/forecast' },
  { method: 'GET', path: '/api/history/:city' },
  { method: 'POST', path: '/api/batch/*' },
  { method: 'GET', path: '/*' },
]

test('coincidePatron: literal, :param y * de cola, con las reglas del gateway', () => {
  assert.ok(coincidePatron('/api/forecast', '/api/forecast'))
  assert.ok(!coincidePatron('/api/forecast', '/api/forecast/hoy'))
  assert.ok(coincidePatron('/api/history/:city', '/api/history/bogota'))
  assert.ok(!coincidePatron('/api/history/:city', '/api/history'))
  assert.ok(coincidePatron('/api/batch/*', '/api/batch/a/b/c'))
  assert.ok(coincidePatron('/api/batch/*', '/api/batch'))
})

test('coincidePatron: las variantes que el servidor enruta igual también cobran', () => {
  // Express enruta sin mayúsculas; Hono decodifica %xx antes de enrutar.
  for (const p of ['/API/forecast', '/api/FORECAST', '/api/%66orecast', '//api//forecast/', '/api/./forecast', '/x/../api/forecast', '/api%2fforecast']) {
    assert.ok(coincidePatron('/api/forecast', p), p)
  }
  assert.ok(coincidePatron('/api/history/:city', '/Api/History/bogota'))
  assert.ok(!coincidePatron('/api/forecast', '/api/forecasts'))
})

test('patronReenviable deja fuera /* y /:x a la raíz', () => {
  assert.ok(!patronReenviable('/*'))
  assert.ok(!patronReenviable('/:id'))
  assert.ok(patronReenviable('/api/*'))
  assert.equal(manifiestoProxy(base, '1', patrones).patrones.length, 3)
})

test('conversión a Next/Vercel y a regex de nginx', () => {
  assert.equal(patronANext('/api/batch/*'), '/api/batch/:rest*')
  assert.equal(patronANext('/api/history/:city'), '/api/history/:city')
  assert.equal(patronARegex('/api/history/:city'), '^/api/history/[^/]+$')
  assert.equal(patronARegex('/api/batch/*'), '^/api/batch/.*$')
  assert.ok(new RegExp(patronARegex('/api/v1.0/x')).test('/api/v1.0/x'))
  assert.ok(!new RegExp(patronARegex('/api/v1.0/x')).test('/api/v1Z0/x'))
})

test('los archivos públicos del kit nunca llevan rutas de API (no pueden llevar el secreto)', () => {
  for (const host of ['next', 'vercel', 'nginx', 'caddy'] as const) {
    const cfg = generarProxy(host, base, undefined, patrones)
    assert.ok(!cfg.includes('/api/history'), `${host} no debe reenviar rutas de API sin secreto`)
  }
  const worker = generarProxy('cloudflare', base)
  assert.ok(worker.includes('env.PEAJE_ORIGIN_SECRET'))
  assert.ok(!worker.includes('x-peaje-tenant'))
  assert.equal(reglasNext(base).filter((r) => r.source.startsWith('/api/')).length, 0)
})

test('secretoOrigen es estable, de 64 hex, y distinto por negocio', async () => {
  const a = await secretoOrigen('embed-a')
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.equal(a, await secretoOrigen('embed-a'))
  assert.notEqual(a, await secretoOrigen('embed-b'))
})

test('crearProxyRuntime con secreto: reenvía lo que toca, deja pasar al gateway y no a un impostor', async () => {
  let llamadas = 0
  const fetchImpl = (async () => {
    llamadas += 1
    return new Response(JSON.stringify(manifiestoProxy(base, '1', patrones)), { status: 200 })
  }) as unknown as typeof fetch
  const secreto = await secretoOrigen('embed-a')
  const proxy = crearProxyRuntime({ base, fetchImpl, ttlMs: 60_000, secreto })
  const h = new Headers()
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/llms.txt', headers: h }), { destino: `${base}/llms.txt` })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/r/menu', search: '?x=1', headers: h }), { destino: `${base}/r/menu?x=1` })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/api/history/bogota', headers: h }), { destino: `${base}/api/history/bogota` })
  assert.equal(await proxy.decidir({ method: 'POST', pathname: '/api/history/bogota', headers: h }), null, 'el método cuenta')
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/blog/hola', headers: h }), null, 'el catch-all no se reenvía')
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers({ 'x-peaje-origin': secreto }) }), null, 'el gateway con el secreto pasa al handler')
  assert.deepEqual(
    await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers({ 'x-peaje-origin': 'falso', 'x-peaje-tenant': 'cafe-andino' }) }),
    { destino: `${base}/api/forecast` },
    'un impostor sigue pagando',
  )
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/llms.txt', headers: new Headers({ 'x-peaje-fetch': '1' }) }), null, 'el gateway leyendo el llms.txt propio')
  assert.equal(llamadas, 1, 'una sola lectura del manifiesto dentro del TTL')
})

test('sin secreto: discovery y /r/ sí, rutas de API no, y lo reporta', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify(manifiestoProxy(base, '1', patrones)), { status: 200 })) as unknown as typeof fetch
  const proxy = crearProxyRuntime({ base, fetchImpl })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/openapi.json', headers: new Headers() }), { destino: `${base}/openapi.json` })
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers() }), null)
  assert.equal((await proxy.sinSecreto()).length, 3)
})

test('crearProxyRuntime sin manifiesto usa la lista del paquete y no lanza', async () => {
  const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
  const proxy = crearProxyRuntime({ base, fetchImpl, secreto: 'x' })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/llms.txt', headers: new Headers() }), { destino: `${base}/llms.txt` })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/r/x', headers: new Headers() }), { destino: `${base}/r/x` })
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers() }), null)
})

test('el manifiesto no agrega rutas fijas ni prefijos, y no reenvía API fuera de los prefijos declarados', async () => {
  const hostil = {
    version: 'x',
    base,
    rutas: ['/llms.txt', '/login', '/', '/pricing'],
    prefijos: ['/r/', '/blog/', '/'],
    patrones: [
      { method: 'GET', path: '/api/forecast' },
      { method: 'GET', path: '/v1/quote' },
      { method: 'GET', path: '/login' },
      { method: 'POST', path: '/auth/*' },
      { method: 'GET', path: '/api/auth/*' },
      { method: 'GET', path: '/api/*' },
      { method: 'GET', path: '/_next/static/*' },
      { method: 'GET', path: '/weather/:city' },
      { method: 'GET', path: '/:x/forecast' },
      { method: 'GET', path: '/api' },
    ],
  }
  const fetchImpl = (async () => new Response(JSON.stringify(hostil), { status: 200 })) as unknown as typeof fetch
  const proxy = crearProxyRuntime({ base, fetchImpl, secreto: 's' })
  const d = (pathname: string, method = 'GET') => proxy.decidir({ method, pathname, headers: new Headers() })
  for (const p of ['/login', '/', '/pricing', '/blog/hola', '/auth/callback', '/api/auth/session', '/API/Auth/session', '/_next/static/x.js', '/weather/bogota', '/es/forecast', '/api']) {
    assert.equal(await d(p, p.startsWith('/auth') ? 'POST' : 'GET'), null, p)
  }
  assert.deepEqual(await d('/api/forecast'), { destino: `${base}/api/forecast` })
  assert.deepEqual(await d('/v1/quote'), { destino: `${base}/v1/quote` })
  assert.deepEqual(await d('/api/otra/cosa'), { destino: `${base}/api/otra/cosa` }, '/api/* sigue dentro del prefijo declarado')
  assert.deepEqual(await d('/llms.txt'), { destino: `${base}/llms.txt` }, 'las fijas del paquete siguen')
  const fuera = (await proxy.fueraDePrefijos()).map((p) => `${p.method} ${p.path}`)
  assert.ok(fuera.includes('GET /weather/:city') && fuera.includes('GET /api/auth/*') && fuera.includes('GET /login'))
  assert.ok(!fuera.includes('GET /api/forecast'))
})

test('apiPrefixes propios: se aceptan, y la raíz y los reservados nunca', async () => {
  assert.deepEqual(prefijosApiValidos(['weather', '/Weather/', '/', '', '/_next/', '/api/auth', '/data/v2']), ['/weather/', '/data/v2/'])
  assert.ok(patronPermitido('/weather/:city', ['/weather/']))
  assert.ok(!patronPermitido('/weather', ['/weather/']), 'tiene que colgar del prefijo')
  assert.ok(!patronPermitido('/:x/weather', ['/weather/']))
  assert.ok(esReservado('/Login/') && esReservado('/api/auth/x') && esReservado('/') && !esReservado('/api/x') && !esReservado('/authors'))
  const fetchImpl = (async () =>
    new Response(JSON.stringify(manifiestoProxy(base, '1', [{ method: 'GET', path: '/weather/:city' }, { method: 'GET', path: '/api/forecast' }])), { status: 200 })) as unknown as typeof fetch
  const proxy = crearProxyRuntime({ base, fetchImpl, secreto: 's', prefijosApi: ['/weather/', '/'] })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/weather/bogota', headers: new Headers() }), { destino: `${base}/weather/bogota` })
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers() }), null, 'con prefijos propios, /api/ ya no va por defecto')
  assert.deepEqual(proxy.prefijosApi, ['/weather/'])
})

test('el Worker de Cloudflare aplica las mismas reglas y no manda cookies', () => {
  const worker = generarProxy('cloudflare', base)
  assert.ok(worker.includes("const API_PREFIXES = ['/api/', '/v1/']"))
  assert.ok(worker.includes("'/api/auth'"))
  assert.ok(worker.includes("headers.delete('cookie')"))
  assert.ok(!worker.includes('m.rutas'), 'las rutas fijas no salen del manifiesto')
  assert.ok(!worker.includes('—'))
})
