import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { peajeProxy } from '../src/proxy'

const slug = 'cafe-andino'
const gateway = 'https://gateway.invalid'

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://cafe-andino.test${path}`, { headers })
}
const ev = {} as never

test('sin manifiesto alcanzable, las rutas fijas y /r/ igual se reenvían (respaldo)', async () => {
  const mw = peajeProxy({ slug, gateway })
  const res = await mw(req('/llms.txt'), ev)
  assert.ok(res)
  assert.equal(res.headers.get('x-middleware-rewrite'), `${gateway}/${slug}/llms.txt`)
  const r2 = await mw(req('/r/menu?x=1'), ev)
  assert.equal(r2?.headers.get('x-middleware-rewrite'), `${gateway}/${slug}/r/menu?x=1`)
})

test('lo que no es de Peaje sigue al middleware del sitio, y el bucle se corta', async () => {
  let llamado = 0
  const mw = peajeProxy({ slug, gateway }, () => {
    llamado += 1
    return undefined
  })
  const res = await mw(req('/blog/hola'), ev)
  assert.equal(res, undefined)
  assert.equal(llamado, 1)
  const gatewayLeyendo = await mw(req('/llms.txt', { 'x-peaje-fetch': '1' }), ev)
  assert.equal(gatewayLeyendo, undefined)
  assert.equal(llamado, 2)
})

test('slug obligatorio', () => {
  assert.throws(() => peajeProxy({ slug: '' }))
})

test('la cookie del sitio no viaja al gateway; authorization sí', async () => {
  const mw = peajeProxy({ slug, gateway })
  const res = await mw(req('/llms.txt', { cookie: 'session=abc', authorization: 'Payment xyz' }), ev)
  const lista = (res?.headers.get('x-middleware-override-headers') ?? '').split(',')
  assert.ok(!lista.includes('cookie'))
  assert.equal(res?.headers.get('x-middleware-request-cookie'), null)
  assert.equal(res?.headers.get('x-middleware-request-authorization'), 'Payment xyz')
})

test('el manifiesto no agrega rutas fijas ni reenvía API fuera de apiPrefixes', async () => {
  const { createServer } = await import('node:http')
  const manifiesto = {
    rutas: ['/llms.txt', '/login'],
    prefijos: ['/r/', '/'],
    patrones: [
      { method: 'GET', path: '/api/forecast' },
      { method: 'GET', path: '/login' },
      { method: 'GET', path: '/weather/:city' },
    ],
  }
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(manifiesto))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as { port: number }
  const gw = `http://127.0.0.1:${port}`
  try {
    const mw = peajeProxy({ slug, gateway: gw, secret: 'a'.repeat(64) })
    assert.equal((await mw(req('/login'), ev))?.headers.get('x-middleware-rewrite') ?? null, null, '/login no se reenvía')
    assert.equal((await mw(req('/blog/hola'), ev))?.headers.get('x-middleware-rewrite') ?? null, null)
    assert.equal((await mw(req('/weather/bogota'), ev))?.headers.get('x-middleware-rewrite') ?? null, null)
    assert.equal((await mw(req('/api/forecast'), ev))?.headers.get('x-middleware-rewrite'), `${gw}/${slug}/api/forecast`)
    const propio = peajeProxy({ slug, gateway: gw, secret: 'a'.repeat(64), apiPrefixes: ['/weather/'] })
    assert.equal((await propio(req('/weather/bogota'), ev))?.headers.get('x-middleware-rewrite'), `${gw}/${slug}/weather/bogota`)
  } finally {
    await new Promise<void>((r) => server.close(() => r()))
  }
})
