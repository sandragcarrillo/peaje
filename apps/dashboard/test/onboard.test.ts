// usepeaje.com/onboard.md: el archivo que lee el agente del dueño.
// Correr: cd apps/dashboard && npx tsx --conditions=react-server --test test/onboard.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FRASE_ONBOARD, onboardMd } from '../lib/onboard'

const md = onboardMd('https://api.usepeaje.com/_owner/mcp', 'https://usepeaje.com')

test('lleva la URL exacta del MCP y cómo deshacer en cada cliente', () => {
  assert.match(md, /claude mcp add --transport http --scope user peaje https:\/\/api\.usepeaje\.com\/_owner\/mcp/)
  assert.match(md, /claude mcp remove peaje --scope user/)
  assert.match(md, /codex mcp remove peaje/)
})

test('no pide ni trae secretos', () => {
  assert.doesNotMatch(md, /peaje_live_|Bearer|PEAJE_ORIGIN_SECRET/)
  assert.match(md, /Never ask for its value/)
})

test('manda a peaje_setup y deja las compuertas de la persona', () => {
  assert.match(md, /Call `peaje_setup`/)
  assert.match(md, /## The person's gates/)
  assert.match(md, /Check once; do not poll/)
})

test('la frase lleva el permiso, y el archivo dice costos y que termine el pedido', () => {
  assert.match(FRASE_ONBOARD, /Tienes mi OK/)
  assert.match(md, /finish it after setup/)
  assert.match(md, /## Costs and where it runs/)
  assert.match(md, /does not cover committing, deploying/)
})

test('cabe para lectores que resumen', () => {
  assert.ok(md.split(/\s+/).length < 2000)
  assert.match(FRASE_ONBOARD, /usepeaje\.com\/onboard\.md/)
})
