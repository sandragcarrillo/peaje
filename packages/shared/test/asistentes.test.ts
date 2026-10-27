// Los asistentes que Peaje mide, en frases: `pnpm --filter @peaje/shared test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { asistentesMedidos, unirNombres } from '../src/asistentes'

test('asistentesMedidos: ChatGPT y Claude, con y / o en cada idioma', () => {
  assert.equal(asistentesMedidos('es'), 'ChatGPT y Claude')
  assert.equal(asistentesMedidos('es', 'o'), 'ChatGPT o Claude')
  assert.equal(asistentesMedidos('en'), 'ChatGPT and Claude')
  assert.equal(asistentesMedidos('en', 'o'), 'ChatGPT or Claude')
})

test('unirNombres: uno solo, dos, y tres sin coma antes de la conjunción', () => {
  assert.equal(unirNombres([], 'es'), '')
  assert.equal(unirNombres(['Claude'], 'en', 'o'), 'Claude')
  assert.equal(unirNombres(['ChatGPT', 'Claude', 'los agentes que compran'], 'es'), 'ChatGPT, Claude y los agentes que compran')
  assert.equal(unirNombres(['ChatGPT', 'Claude', 'buying agents'], 'en'), 'ChatGPT, Claude and buying agents')
})
