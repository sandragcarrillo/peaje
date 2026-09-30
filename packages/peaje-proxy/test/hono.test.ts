import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Hono } from 'hono'
import { peajeHono } from '../src/hono'
import { levantarGateway, SECRETO, SLUG, type Eco } from './gateway-falso'

let gw: Awaited<ReturnType<typeof levantarGateway>>
let app: Hono
before(async () => {
  gw = await levantarGateway()
  app = new Hono()
  app.use(peajeHono({ slug: SLUG, gateway: gw.url, secret: SECRETO }))
  app.get('/api/forecast', (c) => c.json({ desde: 'app' }))
  app.post('/api/batch/:id', async (c) => c.json({ desde: 'app', body: await c.req.json() }))
  app.get('/blog', (c) => c.text('blog de la app'))
})
after(() => gw.cerrar())

const u = (p: string) => `https://cafe-andino.test${p}`

test('hono: ruta con precio 402, spoof 402, secreto pasa al handler', async () => {
  const cobro = await app.request(u('/api/forecast?city=cali'))
  assert.equal(cobro.status, 402)
  const eco = (await cobro.json()) as Eco
  assert.equal(eco.path, `/${SLUG}/api/forecast`)
  assert.equal(eco.search, '?city=cali')
  assert.equal(eco.forwardedHost, 'cafe-andino.test')
  assert.equal((await app.request(u('/api/forecast'), { headers: { 'x-peaje-origin': 'c'.repeat(64) } })).status, 402)
  const pagado = await app.request(u('/api/forecast'), { headers: { 'x-peaje-origin': SECRETO } })
  assert.equal(pagado.status, 200)
  assert.deepEqual(await pagado.json(), { desde: 'app' })
})

test('hono: discovery y /r/ al gateway, lo demás a la app', async () => {
  assert.equal(((await (await app.request(u('/llms.txt'))).json()) as Eco).path, `/${SLUG}/llms.txt`)
  assert.equal(((await (await app.request(u('/openapi.json'))).json()) as Eco).path, `/${SLUG}/openapi.json`)
  assert.equal(((await (await app.request(u('/r/x?y=1'))).json()) as Eco).search, '?y=1')
  const blog = await app.request(u('/blog'))
  assert.equal(await blog.text(), 'blog de la app')
})

test('hono: POST reenvía body; entregado con secreto, el handler lo lee', async () => {
  const cobro = await app.request(u('/api/batch/1'), { method: 'POST', body: '{"k":1}', headers: { 'content-type': 'application/json' } })
  assert.equal(((await cobro.json()) as Eco).body, '{"k":1}')
  const pagado = await app.request(u('/api/batch/1'), { method: 'POST', body: '{"k":1}', headers: { 'content-type': 'application/json', 'x-peaje-origin': SECRETO } })
  assert.deepEqual(await pagado.json(), { desde: 'app', body: { k: 1 } })
})
