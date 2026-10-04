import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { _reiniciarAviso, baseDe, crearPeaje, GATEWAY_POR_DEFECTO, peajeFetch } from '../src/index'
import { levantarGateway, SECRETO, SLUG, type Eco } from './gateway-falso'

let gw: Awaited<ReturnType<typeof levantarGateway>>
before(async () => {
  gw = await levantarGateway()
})
after(() => gw.cerrar())

const sitio = 'https://cafe-andino.test'
const req = (path: string, init: RequestInit = {}) => new Request(`${sitio}${path}`, init)

test('discovery (/llms.txt, /openapi.json) y links /r/ van al gateway con query y host del negocio', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url })
  const llms = await peaje(req('/llms.txt'))
  assert.equal(llms?.status, 402)
  const eco = (await llms!.json()) as Eco
  assert.equal(eco.path, `/${SLUG}/llms.txt`)
  assert.equal(eco.forwardedHost, 'cafe-andino.test')
  assert.equal(eco.forwardedProto, 'https')

  const openapi = await peaje(req('/openapi.json'))
  assert.equal(((await openapi!.json()) as Eco).path, `/${SLUG}/openapi.json`)

  const link = await peaje(req('/r/menu?x=1&y=2'))
  const e2 = (await link!.json()) as Eco
  assert.equal(e2.path, `/${SLUG}/r/menu`)
  assert.equal(e2.search, '?x=1&y=2')
})

test('lo que no es de Peaje devuelve null y el patrón /* nunca se reenvía', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  assert.equal(await peaje(req('/')), null)
  assert.equal(await peaje(req('/blog/hola')), null)
  assert.equal(await peaje(req('/api/forecast', { method: 'DELETE' })), null, 'otro método no cobra')
})

test('ruta de API con precio: 402 sin prueba, 402 con header falso, pasa a la app con el secreto', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  const sinPrueba = await peaje(req('/api/forecast?city=bogota'))
  assert.equal(sinPrueba?.status, 402)
  const eco = (await sinPrueba!.json()) as Eco
  assert.equal(eco.path, `/${SLUG}/api/forecast`)
  assert.equal(eco.search, '?city=bogota')

  const falsa = await peaje(req('/api/forecast', { headers: { 'x-peaje-origin': 'b'.repeat(64) } }))
  assert.equal(falsa?.status, 402, 'un header inventado no esquiva el cobro')

  const gateway = await peaje(req('/api/forecast', { headers: { 'x-peaje-origin': SECRETO } }))
  assert.equal(gateway, null, 'el gateway entregando una request pagada llega al handler')
})

test('POST: método y body llegan intactos; x-forwarded-* que ya venían se respetan', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  const res = await peaje(
    req('/api/batch/a/b?v=1', {
      method: 'POST',
      body: JSON.stringify({ hola: 'mundo' }),
      headers: { 'content-type': 'application/json', 'x-forwarded-host': 'www.cafe-andino.com', 'x-forwarded-proto': 'https' },
    }),
  )
  const eco = (await res!.json()) as Eco
  assert.equal(eco.method, 'POST')
  assert.equal(eco.path, `/${SLUG}/api/batch/a/b`)
  assert.equal(eco.search, '?v=1')
  assert.equal(eco.body, '{"hola":"mundo"}')
  assert.equal(eco.forwardedHost, 'www.cafe-andino.com')
  assert.equal(eco.peajeHost, 'www.cafe-andino.com', 'Railway pisa X-Forwarded-Host: el host viaja también en el header propio')
})

test('/llms.txt con x-peaje-fetch es el gateway leyendo el del sitio: pasa a la app', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url })
  assert.equal(await peaje(req('/llms.txt', { headers: { 'x-peaje-fetch': '1' } })), null)
})

test('sin secreto: las rutas de API no se reenvían y se avisa una sola vez', async () => {
  _reiniciarAviso()
  const avisos: string[] = []
  const original = console.warn
  console.warn = (m: string) => void avisos.push(m)
  try {
    const peaje = peajeFetch({ slug: SLUG, gateway: gw.url })
    assert.equal(await peaje(req('/api/forecast')), null)
    await peaje(req('/api/forecast'))
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(avisos.length, 1)
    assert.match(avisos[0]!, /PEAJE_ORIGIN_SECRET is not set: GET \/api\/forecast, POST \/api\/batch\/\*, GET \/gzip/)
    assert.ok(!avisos[0]!.includes('GET /*'), 'el patrón ancho no cuenta')
  } finally {
    console.warn = original
  }
})

test('respuesta comprimida: el proxy saca content-encoding porque fetch ya descomprimió', async () => {
  const peaje = peajeFetch({ slug: SLUG, gateway: gw.url, secret: SECRETO })
  const res = await peaje(req('/gzip'))
  assert.equal(res?.headers.get('content-encoding'), null)
  assert.equal(((await res!.json()) as Eco).path, `/${SLUG}/gzip`)
})

test('gateway caído: discovery igual se reenvía con la lista de respaldo', async () => {
  const peaje = crearPeaje({ slug: SLUG, gateway: 'http://127.0.0.1:1' })
  assert.equal(await peaje.decidir({ method: 'GET', url: new URL(`${sitio}/llms.txt`), headers: new Headers() }), `http://127.0.0.1:1/${SLUG}/llms.txt`)
  assert.equal(await peaje.decidir({ method: 'GET', url: new URL(`${sitio}/api/forecast`), headers: new Headers() }), null)
})

test('slug obligatorio y gateway por defecto', () => {
  assert.throws(() => peajeFetch({ slug: '' }))
  const previo = process.env.PEAJE_GATEWAY_URL
  delete process.env.PEAJE_GATEWAY_URL
  assert.equal(baseDe({ slug: 'x' }), `${GATEWAY_POR_DEFECTO}/x`)
  if (previo !== undefined) process.env.PEAJE_GATEWAY_URL = previo
})
