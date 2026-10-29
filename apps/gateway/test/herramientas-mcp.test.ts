// Activas en Integraciones sale de acá: cada cliente MCP se presenta en el
// `initialize` y el gateway guarda su marca con la clave que usó.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MemoryStore } from '@peaje/db'
import { clienteMcp, marcaDeCliente } from '../src/tareas/herramientas.js'

test('reconoce la marca por el nombre del cliente', () => {
  assert.equal(marcaDeCliente('claude-code'), 'claude')
  assert.equal(marcaDeCliente('cursor-vscode'), 'cursor')
  assert.equal(marcaDeCliente('codex-mcp-client'), 'codex')
  assert.equal(marcaDeCliente('Visual Studio Code'), 'copilot')
  assert.equal(marcaDeCliente('v0'), 'v0')
  assert.equal(marcaDeCliente('mcp-client-v0.3'), 'otra')
  assert.equal(marcaDeCliente('mcp-inspector'), 'otra')
})

test('saca el nombre del initialize, suelto o en lote', () => {
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'claude-code', version: '2.1' } } }
  assert.equal(clienteMcp(init), 'claude-code')
  assert.equal(clienteMcp([{ jsonrpc: '2.0', method: 'notifications/initialized' }, init]), 'claude-code')
  assert.equal(clienteMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), null)
  assert.equal(clienteMcp(undefined), null)
  assert.equal(clienteMcp({ method: 'initialize', params: { clientInfo: { name: 42 } } }), null)
})

test('el store guarda y devuelve las herramientas del negocio', async () => {
  const store = new MemoryStore()
  const t = await store.createTenant({ slug: 'h', name: 'H', originUrl: 'https://h.test', embedSecret: 'x' })
  const reg = { claude: { nombre: 'claude-code', at: '2026-10-28T00:00:00.000Z', prefijo: 'peaje_live_abcdef…' } }
  await store.setTenantHerramientas(t.id, reg)
  assert.deepEqual((await store.getTenantById(t.id))?.herramientas, reg)
})
