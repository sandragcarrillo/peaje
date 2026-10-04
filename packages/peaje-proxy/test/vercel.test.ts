import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { peajeVercel } from '../src/vercel'
import { levantarGateway, SECRETO, SLUG } from './gateway-falso'

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
