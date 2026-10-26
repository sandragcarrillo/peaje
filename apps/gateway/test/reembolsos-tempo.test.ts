// Reembolsos de Tempo desde la treasury cuando el origen falla después de
// cobrar: monto entero, topes por pago, por negocio por día y global por día.
// Store en memoria; el envío y el pagador son falsos (no hay red).
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { store } from '../src/store.js'
import { reembolsarTempo, topesReembolso } from '../src/reembolsos.js'

const AGENTE = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'
let n = 0
const hash = () => `0x${(++n).toString(16).padStart(64, '0')}`

async function negocio() {
  const slug = `tempo-${++n}`
  return store.createTenant({ slug, name: slug, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
}

/** Pago de Tempo con split: 98% al negocio, 2% a Peaje. El agente pagó `precio`. */
async function pagoTempo(tenantId: string, precio: number) {
  return store.recordPayment({
    tenantId,
    routeId: null,
    path: '/api/dato',
    agentWallet: null,
    amount: (precio * 0.98).toFixed(6),
    platformFee: (precio * 0.02).toFixed(6),
    receiptRef: hash(),
    method: 'tempo',
    network: 'tempo-split',
  })
}

function falsos() {
  const enviados: { to: string; amount: string }[] = []
  return {
    enviados,
    deps: {
      pagador: async () => AGENTE,
      enviar: async (to: `0x${string}`, amount: string) => {
        enviados.push({ to, amount })
        return hash() as `0x${string}`
      },
    },
  }
}

beforeEach(() => {
  delete process.env.TEMPO_REFUND_MAX_USD
  delete process.env.TEMPO_REFUND_DAILY_USD
  delete process.env.TEMPO_REFUND_GLOBAL_DAILY_USD
})

test('topes por defecto: 1 por pago, 5 por negocio al día, 20 global al día', () => {
  assert.deepEqual(topesReembolso(), { porPago: 1, porNegocioDia: 5, globalDia: 20 })
})

test('dentro de los topes: devuelve lo que pagó el agente y queda en el ledger', async () => {
  const t = await negocio()
  const pago = await pagoTempo(t.id, 0.1)
  const { enviados, deps } = falsos()
  const r = await reembolsarTempo(pago, deps)
  assert.equal(r.ok, true)
  assert.deepEqual(enviados, [{ to: AGENTE, amount: '0.100000' }])
  const [guardado] = await store.listPayments(t.id)
  assert.equal(guardado?.refundTx, r.ok ? r.tx : null)
})

test('tope por pago: más de TEMPO_REFUND_MAX_USD no se devuelve', async () => {
  const t = await negocio()
  const pago = await pagoTempo(t.id, 1.5)
  const { enviados, deps } = falsos()
  assert.deepEqual(await reembolsarTempo(pago, deps), { ok: false, motivo: 'tope-pago' })
  assert.equal(enviados.length, 0)
  assert.equal((await store.listPayments(t.id))[0]?.refundTx, null)
})

test('tope diario del negocio', async () => {
  process.env.TEMPO_REFUND_DAILY_USD = '0.25'
  const t = await negocio()
  const { enviados, deps } = falsos()
  assert.equal((await reembolsarTempo(await pagoTempo(t.id, 0.1), deps)).ok, true)
  assert.equal((await reembolsarTempo(await pagoTempo(t.id, 0.1), deps)).ok, true)
  assert.deepEqual(await reembolsarTempo(await pagoTempo(t.id, 0.1), deps), { ok: false, motivo: 'tope-negocio' })
  assert.equal(enviados.length, 2)
  // Otro negocio tiene su propio tope.
  assert.equal((await reembolsarTempo(await pagoTempo((await negocio()).id, 0.1), deps)).ok, true)
})

test('tope diario global, entre negocios', async () => {
  const hoy = new Date()
  const dia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())).toISOString()
  process.env.TEMPO_REFUND_GLOBAL_DAILY_USD = String((await store.refundedSince(dia)) + 0.15)
  const { enviados, deps } = falsos()
  assert.equal((await reembolsarTempo(await pagoTempo((await negocio()).id, 0.1), deps)).ok, true)
  assert.deepEqual(await reembolsarTempo(await pagoTempo((await negocio()).id, 0.1), deps), { ok: false, motivo: 'tope-global' })
  assert.equal(enviados.length, 1)
})

test('dos fallos a la vez no pasan juntos el tope (se procesan en fila)', async () => {
  process.env.TEMPO_REFUND_DAILY_USD = '0.15'
  const t = await negocio()
  const { enviados, deps } = falsos()
  const [p1, p2] = [await pagoTempo(t.id, 0.1), await pagoTempo(t.id, 0.1)]
  const [a, b] = await Promise.all([reembolsarTempo(p1, deps), reembolsarTempo(p2, deps)])
  assert.deepEqual([a.ok, b.ok].sort(), [false, true])
  assert.equal(enviados.length, 1)
})
