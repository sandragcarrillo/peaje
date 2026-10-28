// Detrás de Railway el cobro reconstruye la Request con la URL externa. Un
// POST pago no puede perder ahí el método, la credencial ni el body
// (auditoría del 28 oct 2026: `{ ...req }` armaba un GET vacío).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Tenant } from '@peaje/db'
import { conUrlExterna } from '../src/url-externa.js'

const tenant = { slug: 'clima', originUrl: 'https://clima.example' } as Tenant

test('un POST pago conserva método, credencial y body al pasar a la URL externa', async () => {
  const req = new Request('http://gateway.internal/clima/api/dato', {
    method: 'POST',
    headers: { authorization: 'Payment abc', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'api.usepeaje.com', 'content-type': 'application/json' },
    body: JSON.stringify({ ciudad: 'Bogotá' }),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
  const externa = conUrlExterna(req, tenant)
  assert.equal(externa.url, 'https://api.usepeaje.com/clima/api/dato')
  assert.equal(externa.method, 'POST')
  assert.equal(externa.headers.get('authorization'), 'Payment abc')
  assert.deepEqual(await externa.json(), { ciudad: 'Bogotá' })
})

test('un GET sigue igual', () => {
  const req = new Request('http://gateway.internal/clima/api/dato', { headers: { 'payment-signature': 'x', 'x-forwarded-proto': 'https', host: 'api.usepeaje.com' } })
  const externa = conUrlExterna(req, tenant)
  assert.equal(externa.url, 'https://api.usepeaje.com/clima/api/dato')
  assert.equal(externa.headers.get('payment-signature'), 'x')
})
