import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import express from 'express'
import { peajeExpress } from '../src/express'
import { levantarGateway, SECRETO, SLUG, type Eco } from './gateway-falso'

let gw: Awaited<ReturnType<typeof levantarGateway>>
const servidores: Server[] = []

async function levantar(app: express.Express): Promise<string> {
  const s = await new Promise<Server>((r) => {
    const x = app.listen(0, '127.0.0.1', () => r(x))
  })
  servidores.push(s)
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`
}

function appCon(orden: 'peaje-primero' | 'parser-primero') {
  const app = express()
  if (orden === 'parser-primero') app.use(express.json())
  app.use(peajeExpress({ slug: SLUG, gateway: gw.url, secret: SECRETO }))
  if (orden === 'peaje-primero') app.use(express.json())
  app.get('/api/forecast', (_req, res) => void res.json({ desde: 'app', ruta: 'forecast' }))
  app.post('/api/batch/:id', (req, res) => void res.json({ desde: 'app', body: req.body }))
  app.post('/contacto', (req, res) => void res.json({ desde: 'app', body: req.body }))
  app.get('/blog', (_req, res) => void res.send('blog de la app'))
  return app
}

let url: string
let urlParser: string
before(async () => {
  gw = await levantarGateway()
  url = await levantar(appCon('peaje-primero'))
  urlParser = await levantar(appCon('parser-primero'))
})
after(async () => {
  for (const s of servidores) await new Promise<void>((r) => s.close(() => r()))
  await gw.cerrar()
})

test('express: la ruta con precio contesta 402 en el dominio de la app, con los headers del gateway', async () => {
  const res = await fetch(`${url}/api/forecast?city=bogota`)
  assert.equal(res.status, 402)
  assert.equal(res.headers.get('www-authenticate'), 'Payment realm="test"')
  const eco = (await res.json()) as Eco
  assert.equal(eco.path, `/${SLUG}/api/forecast`)
  assert.equal(eco.search, '?city=bogota')
  assert.equal(eco.forwardedHost, new URL(url).host)
  assert.equal(eco.forwardedProto, 'http')
})

test('express: con el secreto correcto la request llega al handler; con uno falso, 402', async () => {
  const ok = await fetch(`${url}/api/forecast`, { headers: { 'x-peaje-origin': SECRETO } })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { desde: 'app', ruta: 'forecast' })
  const falso = await fetch(`${url}/api/forecast`, { headers: { 'x-peaje-origin': 'f'.repeat(64) } })
  assert.equal(falso.status, 402)
})

test('express: discovery y /r/ reenviados; lo demás lo sirve la app, body parser incluido', async () => {
  assert.equal(((await (await fetch(`${url}/llms.txt`)).json()) as Eco).path, `/${SLUG}/llms.txt`)
  assert.equal(((await (await fetch(`${url}/openapi.json`)).json()) as Eco).path, `/${SLUG}/openapi.json`)
  assert.equal(((await (await fetch(`${url}/r/menu`)).json()) as Eco).path, `/${SLUG}/r/menu`)
  const blog = await fetch(`${url}/blog`)
  assert.equal(blog.status, 200)
  assert.equal(await blog.text(), 'blog de la app')
  const contacto = await fetch(`${url}/contacto`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' })
  assert.deepEqual(await contacto.json(), { desde: 'app', body: { a: 1 } }, 'el body de una ruta ajena no se consume')
})

test('express: POST con precio reenvía método y body crudo; entregado por el gateway, el handler lo parsea', async () => {
  const cobro = await fetch(`${url}/api/batch/7`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"n":7}' })
  assert.equal(cobro.status, 402)
  const eco = (await cobro.json()) as Eco
  assert.equal(eco.method, 'POST')
  assert.equal(eco.body, '{"n":7}')
  const pagado = await fetch(`${url}/api/batch/7`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-peaje-origin': SECRETO },
    body: '{"n":7}',
  })
  assert.deepEqual(await pagado.json(), { desde: 'app', body: { n: 7 } })
})

test('express: con express.json() antes, el body se reenvía serializado', async () => {
  const res = await fetch(`${urlParser}/api/batch/1`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"x":true}' })
  assert.equal(res.status, 402)
  assert.equal(((await res.json()) as Eco).body, '{"x":true}')
})

test('express: respuesta gzip del gateway llega legible', async () => {
  const res = await fetch(`${url}/gzip`)
  assert.equal(res.status, 402)
  assert.equal(((await res.json()) as Eco).path, `/${SLUG}/gzip`)
})

test('express: HEAD a discovery no manda body', async () => {
  const res = await fetch(`${url}/llms.txt`, { method: 'HEAD' })
  assert.equal(res.status, 402)
  assert.equal(await res.text(), '')
})
