import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { peajeProxy } from '../src/proxy'

/** Lo que tiene que llegar en x-peaje-kit: nombre y versión del package.json en disco. */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string }
const KIT = `${pkg.name}@${pkg.version}`

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

test('un bot leyendo una página del sitio se reporta al gateway en waitUntil; una persona o un archivo de discovery no', async () => {
  const { createServer } = await import('node:http')
  const recibidos: { path: string; body: string }[] = []
  const server = createServer((r, s) => {
    let body = ''
    r.on('data', (c) => (body += c))
    r.on('end', () => {
      recibidos.push({ path: `${r.method} ${r.url}`, body })
      s.statusCode = r.url?.endsWith('/kit/visita') ? 204 : 404
      s.end()
    })
  })
  await new Promise<void>((ok) => server.listen(0, ok))
  const gw = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const esperas: Promise<unknown>[] = []
    const evento = { waitUntil: (p: Promise<unknown>) => void esperas.push(p) } as never
    const gptbot = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'

    const mw = peajeProxy({ slug, gateway: gw })
    const res = await mw(req('/blog/hola?utm=x', { 'user-agent': gptbot }), evento)
    assert.equal(res?.headers.get('x-middleware-next'), '1', 'la página sigue normal')
    assert.equal(esperas.length, 1)
    await Promise.all(esperas)
    const reporte = recibidos.find((x) => x.path === `POST /${slug}/kit/visita`)
    assert.ok(reporte)
    assert.deepEqual(JSON.parse(reporte.body), { path: '/blog/hola', method: 'GET', userAgent: gptbot })

    await mw(req('/blog/hola', { 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1.15' }), evento)
    await mw(req('/llms.txt', { 'user-agent': gptbot }), evento)
    assert.equal(esperas.length, 1, 'ni la persona ni el archivo que ya va al gateway')

    const apagado = peajeProxy({ slug, gateway: gw, reportBotVisits: false })
    await apagado(req('/blog/hola', { 'user-agent': gptbot }), evento)
    assert.equal(esperas.length, 1, 'reportBotVisits: false no reporta')
  } finally {
    server.close()
  }
})

test('x-peaje-kit: el rewrite al gateway lo lleva como header de respuesta, con la versión de package.json', async () => {
  assert.match(KIT, /^@peaje\/next@\d+\.\d+\.\d+$/)
  const { createServer } = await import('node:http')
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ patrones: [{ method: 'GET', path: '/api/forecast' }] }))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const gw = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const mw = peajeProxy({ slug, gateway: gw, secret: 'a'.repeat(64) })
    for (const path of ['/llms.txt', '/mcp', '/.well-known/mcp', '/openapi.json', '/r/menu', '/api/forecast']) {
      // Un x-peaje-kit inventado por el cliente no sigue al gateway.
      const res = await mw(req(path, { 'x-peaje-kit': '@peaje/next@0.0.1' }), ev)
      assert.ok(res?.headers.get('x-middleware-rewrite'), path)
      assert.equal(res?.headers.get('x-peaje-kit'), KIT, path)
      assert.equal(res?.headers.get('x-middleware-request-x-peaje-kit'), null, path)
      assert.ok(!(res?.headers.get('x-middleware-override-headers') ?? '').split(',').includes('x-peaje-kit'), path)
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()))
  }
})

test('x-peaje-kit: lo que pasa al sitio no lo lleva, ni en la respuesta ni en la request del middleware propio', async () => {
  const secreto = 'a'.repeat(64)
  const vistas: NextRequest[] = []
  const conPropio = peajeProxy({ slug, gateway, secret: secreto }, (r) => {
    vistas.push(r)
    return undefined
  })
  assert.equal(await conPropio(req('/blog/hola'), ev), undefined)
  assert.equal(await conPropio(req('/api/forecast', { 'x-peaje-origin': secreto }), ev), undefined, 'la entrega pagada pasa al handler')
  assert.equal(vistas.length, 2)
  for (const r of vistas) assert.equal(r.headers.get('x-peaje-kit'), null)

  const solo = peajeProxy({ slug, gateway, secret: secreto })
  for (const r of [req('/blog/hola'), req('/llms.txt', { 'x-peaje-fetch': '1' }), req('/api/forecast', { 'x-peaje-origin': secreto })]) {
    const res = await solo(r, ev)
    assert.equal(res?.headers.get('x-middleware-next'), '1', r.nextUrl.pathname)
    assert.equal(res?.headers.get('x-peaje-kit'), null, r.nextUrl.pathname)
    assert.equal(res?.headers.get('x-middleware-request-x-peaje-kit') ?? null, null)
  }
})
