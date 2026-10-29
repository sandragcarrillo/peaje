// La clave del agente se deriva del secreto del negocio con una sal que va en
// su prefijo visible: Integraciones la vuelve a armar y la muestra tapada.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiKeyPrefix, claveAgente, generateApiKey, salDeClave } from '@peaje/shared'

test('la clave derivada se reconstruye desde su prefijo', async () => {
  const k = await claveAgente('secreto-de-prueba')
  assert.match(k, /^peaje_live_[0-9a-f]{48}$/)
  assert.equal(k.length, generateApiKey().length)
  const sal = salDeClave(apiKeyPrefix(k))
  assert.ok(sal)
  assert.equal(await claveAgente('secreto-de-prueba', sal), k)
  assert.notEqual(await claveAgente('otro-secreto', sal), k)
})

test('un prefijo sin formato no da sal', () => {
  assert.equal(salDeClave(null), null)
  assert.equal(salDeClave('otra_cosa_abc123…'), null)
  assert.equal(salDeClave('peaje_live_zzzzzz…'), null)
})
