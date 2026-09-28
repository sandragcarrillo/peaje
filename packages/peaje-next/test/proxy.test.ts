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
