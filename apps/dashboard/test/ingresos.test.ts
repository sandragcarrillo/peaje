/**
 * Datos de la vista de ingresos con el store en memoria.
 *   cd apps/dashboard && npx tsx --test test/ingresos.test.ts
 */
import { MemoryStore } from '@peaje/db'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armarIngresos } from '../lib/ingresos'

const DUENO = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
const TX_ARB = `0x${'a1'.repeat(32)}`
const TX_TEMPO = `0x${'b2'.repeat(32)}`
const TX_VIEJO = `0x${'c3'.repeat(32)}`

test('cada pago trae su tx, el neto y la dirección a la que llegó; los viejos quedan marcados', async () => {
  const store = new MemoryStore()
  const t = await store.createTenant({ slug: 'x', name: 'x', originUrl: 'https://x.test', embedSecret: 's' })
  const base = { tenantId: t.id, routeId: null, agentWallet: null, method: 'evm' }
  await store.recordPayment({ ...base, path: '/viejo', amount: '0.490000', receiptRef: TX_VIEJO, network: 'arbitrum', platformFee: '0.010000' })
  await store.recordPayment({ ...base, path: '/r/a', amount: '0.980000', receiptRef: TX_ARB, network: 'arbitrum', platformFee: '0.020000', payoutAddress: DUENO })
  await store.recordPayment({ ...base, method: 'tempo', path: '/r/b', amount: '0.098000', receiptRef: TX_TEMPO, network: 'tempo-split', platformFee: '0.002000', payoutAddress: DUENO })

  const ingresos = armarIngresos(await store.listPayments(t.id), await store.balance(t.id))
  assert.equal(ingresos.pagos, 3)
  assert.equal(Number(ingresos.recibido).toFixed(6), '1.568000')
  assert.equal(ingresos.hayAnteriores, true)

  const [tempo, arb, viejo] = ingresos.lista
  assert.equal(tempo?.red, 'Tempo · Direct')
  assert.equal(tempo?.txUrl, `https://explore.testnet.tempo.xyz/tx/${TX_TEMPO}`)
  assert.equal(arb?.neto, '0.980000')
  assert.equal(arb?.llegoA, DUENO)
  assert.equal(arb?.red, 'Arbitrum')
  assert.equal(arb?.txUrl, `https://sepolia.arbiscan.io/tx/${TX_ARB}`)
  assert.equal(viejo?.llegoA, null)
})

test('sin pagos: cero y lista vacía', async () => {
  const ingresos = armarIngresos([], { revenue: '0', requestCount: 0 })
  assert.deepEqual(ingresos, { recibido: '0', pagos: 0, hayAnteriores: false, lista: [] })
})
