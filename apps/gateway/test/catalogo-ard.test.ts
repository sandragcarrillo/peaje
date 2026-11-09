// Catálogo ARD (/.well-known/ard.json): cada entrada trae representativeQueries
// (Lighthouse ard-schema baja el puntaje sin ellas) y una ruta en precio 0, la
// de un negocio con cobros apagados, no se anuncia como paga.
// Store en memoria, sin red: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-catalogo-ard-0123456789abcdef0123456789ab',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { aiCatalog } = await import('../src/wellknown.js')

type Entrada = { displayName: string; description: string; tags: string[]; representativeQueries?: string[]; metadata?: { priceUsd: number } }

let n = 0
async function catalogo(precio: string) {
  n += 1
  const tenant = await store.createTenant({ slug: `ard-${n}`, name: 'Clima Uno', originUrl: 'https://clima.example', embedSecret: 'x' })
  const ruta = {
    method: 'GET',
    pathPattern: '/api/pronostico/:ciudad',
    priceUsd: precio,
    description: 'Hourly forecast for a city. Pass the city as ciudad. Returns JSON.',
  }
  const doc = aiCatalog({ tenant, routes: [ruta as never], base: 'https://clima.example' }) as { entries: Entrada[] }
  return doc.entries
}

test('todas las entradas traen entre 2 y 5 representativeQueries', async () => {
  for (const e of await catalogo('0.05')) {
    assert.ok(e.representativeQueries, `${e.displayName} sin representativeQueries`)
    assert.ok(e.representativeQueries.length >= 2 && e.representativeQueries.length <= 5, e.displayName)
  }
})

test('una ruta con precio se anuncia como paga, con nombre corto', async () => {
  const ruta = (await catalogo('0.05')).at(-1)!
  assert.equal(ruta.displayName, 'Hourly forecast for a city')
  assert.match(ruta.description, /\$0\.05 USD per request, paid over HTTP 402/)
  assert.ok(ruta.tags.includes('paid'))
  assert.equal(ruta.metadata?.priceUsd, 0.05)
})

test('una ruta en 0 (cobros apagados) sale gratis, sin 402', async () => {
  const ruta = (await catalogo('0')).at(-1)!
  assert.doesNotMatch(ruta.description, /402/)
  assert.match(ruta.description, /free, no payment or API key/)
  assert.ok(ruta.tags.includes('free'))
  assert.ok(!ruta.tags.includes('paid'))
})
