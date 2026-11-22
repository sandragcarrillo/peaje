// El reescaneo semanal: Peaje le pide a Ora un escaneo nuevo en vez de leer el guardado.
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { escanearOra } from '../src/monitor/correr.js'

const original = globalThis.fetch
afterEach(() => {
  globalThis.fetch = original
})

test('pide un escaneo con POST y devuelve el puntaje redondeado', async () => {
  const llamadas: { url: string; method?: string; body?: string }[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), method: init?.method, body: String(init?.body) })
    return new Response(JSON.stringify({ score: 71.6 }), { status: 200 })
  }) as typeof fetch
  assert.equal(await escanearOra('taller.test'), 72)
  assert.equal(llamadas.length, 1)
  assert.match(llamadas[0]!.url, /\/api\/scan$/)
  assert.equal(llamadas[0]!.method, 'POST')
  assert.deepEqual(JSON.parse(llamadas[0]!.body!), { url: 'taller.test' })
})

test('si Ora falla o el sitio no abre devuelve null, sin tirar', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'not reachable' }), { status: 400 })) as typeof fetch
  assert.equal(await escanearOra('caido.test'), null)
  globalThis.fetch = (async () => {
    throw new Error('timeout')
  }) as typeof fetch
  assert.equal(await escanearOra('caido.test'), null)
  globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch
  assert.equal(await escanearOra('raro.test'), null)
})
