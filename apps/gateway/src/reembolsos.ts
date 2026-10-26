import type { Payment } from '@peaje/db'
import { store } from './store.js'

/**
 * Reembolso de un pago de Tempo cuando el origen falló después de cobrar.
 * En Tempo el agente paga al verificar la credencial (antes del origen) y el
 * neto ya llegó a la wallet del negocio por el split nativo: lo devuelve
 * Peaje de su treasury, entero (lo que pagó el agente), con topes.
 *
 *   TEMPO_REFUND_MAX_USD (1.00): tope por pago. Más que eso no se devuelve.
 *   TEMPO_REFUND_DAILY_USD (5.00): tope por negocio por día (UTC).
 *   TEMPO_REFUND_GLOBAL_DAILY_USD (20.00): tope de todos los negocios por día (UTC).
 *
 * Un tope que bloquea queda en el log con `[refund] TOPE`. El reembolso queda
 * en el ledger (refundTx del pago).
 */

const tope = (nombre: string, porDefecto: number) => {
  const n = Number(process.env[nombre])
  return Number.isFinite(n) && n >= 0 && process.env[nombre] !== undefined && process.env[nombre] !== '' ? n : porDefecto
}

export function topesReembolso() {
  return {
    porPago: tope('TEMPO_REFUND_MAX_USD', 1),
    porNegocioDia: tope('TEMPO_REFUND_DAILY_USD', 5),
    globalDia: tope('TEMPO_REFUND_GLOBAL_DAILY_USD', 20),
  }
}

export type DepsReembolso = {
  /** Wallet del agente que pagó la tx de Tempo. */
  pagador?: (txHash: string) => Promise<string | null>
  /** Transfer desde la treasury en Tempo. Devuelve el hash. */
  enviar?: (to: `0x${string}`, amount: string) => Promise<`0x${string}`>
  ahora?: () => Date
}

export type ResultadoReembolso =
  | { ok: true; tx: string }
  | { ok: false; motivo: 'tope-pago' | 'tope-negocio' | 'tope-global' | 'sin-pagador' | 'fallo-envio' }

// Un reembolso a la vez: dos fallos simultáneos no pasan juntos el tope diario.
let cola: Promise<unknown> = Promise.resolve()

export function reembolsarTempo(payment: Payment, deps: DepsReembolso = {}): Promise<ResultadoReembolso> {
  const turno = cola.then(() => reembolsar(payment, deps))
  cola = turno.catch(() => {})
  return turno
}

async function reembolsar(payment: Payment, deps: DepsReembolso): Promise<ResultadoReembolso> {
  const topes = topesReembolso()
  const total = Number(payment.amount) + Number(payment.platformFee) + Number(payment.networkFee)
  const monto = total.toFixed(6)
  const datos = { payment: payment.id, tenant: payment.tenantId, monto, receipt: payment.receiptRef }

  if (total > topes.porPago + 1e-9) {
    console.warn('[refund] TOPE por pago: no se devuelve', { ...datos, tope: topes.porPago })
    return { ok: false, motivo: 'tope-pago' }
  }
  const ahora = (deps.ahora ?? (() => new Date()))()
  const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())).toISOString()
  const [delNegocio, global] = await Promise.all([store.refundedSince(dia, payment.tenantId), store.refundedSince(dia)])
  if (delNegocio + total > topes.porNegocioDia + 1e-9) {
    console.warn('[refund] TOPE diario del negocio: no se devuelve', { ...datos, devueltoHoy: delNegocio.toFixed(6), tope: topes.porNegocioDia })
    return { ok: false, motivo: 'tope-negocio' }
  }
  if (global + total > topes.globalDia + 1e-9) {
    console.warn('[refund] TOPE diario global: no se devuelve', { ...datos, devueltoHoy: global.toFixed(6), tope: topes.globalDia })
    return { ok: false, motivo: 'tope-global' }
  }

  const pagador = deps.pagador ?? (async (hash: string) => (await import('./chain.js')).resolvePayer('tempo', hash))
  const enviar = deps.enviar ?? (async (to: `0x${string}`, amount: string) => (await import('./treasury.js')).sendPayout('tempo', to, amount))

  const payer = payment.agentWallet ?? (await pagador(payment.receiptRef).catch(() => null))
  if (!payer || !/^0x[0-9a-fA-F]{40}$/.test(payer)) {
    console.warn('[refund] no se pudo resolver el pagador', datos)
    return { ok: false, motivo: 'sin-pagador' }
  }
  try {
    const tx = await enviar(payer as `0x${string}`, monto)
    await store.markPaymentRefunded(payment.id, tx)
    console.log('[refund] pago de Tempo devuelto desde la treasury', { ...datos, to: payer, tx })
    return { ok: true, tx }
  } catch (error) {
    console.error('[refund] falló el envío del reembolso', datos, error instanceof Error ? error.message : error)
    return { ok: false, motivo: 'fallo-envio' }
  }
}
