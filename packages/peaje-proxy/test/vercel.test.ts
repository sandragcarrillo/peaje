import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { peajeVercel } from '../src/vercel'
import { KIT, levantarGateway, SECRETO, SLUG } from './gateway-falso'

let gw: Awaited<ReturnType<typeof levantarGateway>>
before(async () => {
  gw = await levantarGateway()
})
after(() => gw.cerrar())

const req = (p: string, init: RequestInit = {}) => new Request(`https://cafe-andino.test${p}`, init)

test('vercel: ruta con precio → x-middleware-rewrite al gateway con x-forwarded-* en la request', async () => {
  const mw = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  const res = await mw(req('/api/forecast?city=lima'))
  assert.equal(res.headers.get('x-middleware-rewrite'), `${gw.url}/${SLUG}/api/forecast?city=lima`)
  assert.equal(res.headers.get('x-middleware-request-x-forwarded-host'), 'cafe-andino.test')
  assert.equal(res.headers.get('x-middleware-request-x-forwarded-proto'), 'https')
  assert.equal(res.headers.get('x-middleware-request-x-peaje-forwarded-host'), 'cafe-andino.test')
  assert.match(res.headers.get('x-middleware-override-headers') ?? '', /x-forwarded-host/)
  assert.equal(gw.pedidos.filter((p) => p.includes('/api/forecast')).length, 0, 'Vercel reescribe: el middleware no hace el fetch')
})

test('vercel: discovery y /r/ reescritos; ajeno, secreto correcto → next()', async () => {
  const mw = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  assert.equal((await mw(req('/llms.txt'))).headers.get('x-middleware-rewrite'), `${gw.url}/${SLUG}/llms.txt`)
  assert.equal((await mw(req('/r/menu'))).headers.get('x-middleware-rewrite'), `${gw.url}/${SLUG}/r/menu`)
  const ajeno = await mw(req('/about'))
  assert.equal(ajeno.headers.get('x-middleware-next'), '1')
  const pagado = await mw(req('/api/forecast', { headers: { 'x-peaje-origin': SECRETO } }))
  assert.equal(pagado.headers.get('x-middleware-next'), '1')
  const falso = await mw(req('/api/forecast', { headers: { 'x-peaje-origin': 'z'.repeat(64) } }))
  assert.ok(falso.headers.get('x-middleware-rewrite'))
})

test('vercel: con middleware propio, corre solo si Peaje no toma la request', async () => {
  let llamado = 0
  const mw = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO }, () => {
    llamado += 1
    return new Response('propio')
  })
  assert.equal(await (await mw(req('/about'))).text(), 'propio')
  await mw(req('/llms.txt'))
  assert.equal(llamado, 1)
})

test('vercel: la cookie del sitio queda fuera del override de headers; authorization sigue', async () => {
  const mw = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  const res = await mw(req('/api/forecast', { headers: { cookie: 'session=abc', authorization: 'Payment xyz' } }))
  const lista = (res.headers.get('x-middleware-override-headers') ?? '').split(',')
  assert.ok(!lista.includes('cookie'))
  assert.equal(res.headers.get('x-middleware-request-cookie'), null)
  assert.ok(lista.includes('authorization'))
  assert.equal(res.headers.get('x-middleware-request-authorization'), 'Payment xyz')
})

test('vercel: el rewrite al gateway lleva x-peaje-kit como header de respuesta, nunca en la request', async () => {
  const mw = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO }, () => new Response('propio'))
  for (const path of ['/api/forecast', '/llms.txt', '/mcp', '/r/menu']) {
    const res = await mw(req(path, { headers: { 'x-peaje-kit': '@peaje/proxy@0.0.1' } }))
    assert.ok(res.headers.get('x-middleware-rewrite'), path)
    assert.equal(res.headers.get('x-peaje-kit'), KIT, path)
    assert.equal(res.headers.get('x-middleware-request-x-peaje-kit'), null, 'el del cliente no sigue al gateway')
    assert.ok(!(res.headers.get('x-middleware-override-headers') ?? '').split(',').includes('x-peaje-kit'))
  }
  const propio = await mw(req('/about'))
  assert.equal(propio.headers.get('x-peaje-kit'), null, 'la respuesta del middleware del sitio no lo lleva')
  const solo = peajeVercel({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  assert.equal((await solo(req('/about'))).headers.get('x-peaje-kit'), null)
  assert.equal((await solo(req('/api/forecast', { headers: { 'x-peaje-origin': SECRETO } }))).headers.get('x-peaje-kit'), null)
})
