import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coincidePatron, crearProxyRuntime, generarProxy, manifiestoProxy, patronARegex, patronANext, patronReenviable, reglasNext, secretoOrigen } from '../src/kit/index'

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

test('crearProxyRuntime sin manifiesto usa el respaldo y no lanza', async () => {
  const fetchImpl = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
  const proxy = crearProxyRuntime({ base, fetchImpl, respaldo: { rutas: ['/llms.txt'], prefijos: ['/r/'], patrones: [] } })
  assert.deepEqual(await proxy.decidir({ method: 'GET', pathname: '/r/x', headers: new Headers() }), { destino: `${base}/r/x` })
  assert.equal(await proxy.decidir({ method: 'GET', pathname: '/api/forecast', headers: new Headers() }), null)
})
