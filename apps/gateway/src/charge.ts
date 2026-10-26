import type { Payment } from '@peaje/db'
import {
  isNetworkId,
  isDirectRail,
  isSettlementNetwork,
  networkFromReceiptMethod,
  TEMPO_SPLIT_RAIL,
} from '@peaje/shared'
import { Receipt } from 'mppx'
import { resolvePayer } from './chain.js'
import { env } from './env.js'
import { reembolsarTempo } from './reembolsos.js'
import { store } from './store.js'

export type ChargeContext = {
  tenantId: string
  routeId: string | null
  path: string
  priceUsd: string
  /** Red o riel donde se liquidó, si el settlement lo anotó (ver contexto.ts). */
  network?: string | null
  /** Wallet del agente si el settlement ya la conoce (rieles Gateway). */
  payer?: string | null
  /** Costo de red pagado por el agente, si el settlement lo anotó. */
  networkFee?: string | null
  // ---- Tempo splits ----
  /** Reparto de la oferta de Tempo de este cobro (ver contexto.ts). null = cobro propio. */
  tempoSplit?: { neto: string; fee: string } | null
  /** Reparto que hizo PeajeSettlementV3 según su evento (ver contexto.ts). */
  reparto?: { neto: string; fee: string } | null
  /** Dirección a la que llegó el neto en la tx del pago. */
  payoutAddress?: string | null
}

export type ReceiptInfo = {
  reference: string
  method: string
}

/**
 * Acredita un pago al ledger del tenant. Único punto de escritura: lo usan el
 * flujo HTTP (vía creditReceipt) y el MCP (que lee el receipt de `_meta`).
 * La red sale del método del Receipt: `tempo` → tempo, `evm` → arc.
 */
export async function creditPayment(ctx: ChargeContext, receipt: ReceiptInfo): Promise<Payment> {
  // ---- Tempo splits ----
  // Pago de Tempo con split nativo: el neto ya llegó a la wallet del negocio en
  // la misma tx, así que va al riel directo (saldo retirable 0) con los montos
  // exactos que se transfirieron on-chain.
  const split = receipt.method === 'tempo' && (!ctx.network || ctx.network === 'tempo') ? (ctx.tempoSplit ?? null) : null
  const network: string = split ? TEMPO_SPLIT_RAIL : (ctx.network ?? networkFromReceiptMethod(receipt.method))

  // El agente pagó el precio listado (bruto). El negocio recibe el neto en su
  // wallet en la misma transacción; la diferencia es el 2% de Peaje. El
  // ledger es historial: no hay saldo que retirar. Un solo punto de registro: acá.
  // En los rieles de contrato los montos salen del evento PaymentSettled.
  const exacto = split ?? (isSettlementNetwork(network) ? (ctx.reparto ?? null) : null)
  const bruto = Number(ctx.priceUsd)
  const fee = exacto ? Number(exacto.fee) : bruto * env.feePct
  const neto = exacto ? Number(exacto.neto) : Math.max(0, bruto - fee)

  const payment = await store.recordPayment({
    tenantId: ctx.tenantId,
    routeId: ctx.routeId,
    path: ctx.path,
    agentWallet: ctx.payer ?? null,
    amount: neto.toFixed(6),
    receiptRef: receipt.reference,
    method: receipt.method,
    network,
    platformFee: fee.toFixed(6),
    // Costo de red que pagó el agente encima del precio (lo anota el settlement).
    networkFee: ctx.networkFee ?? '0',
    // ---- pagos directos ----
    payoutAddress: split || exacto ? (ctx.payoutAddress ?? null) : null,
  })

  console.log('[charge] pago acreditado', {
    tenant: ctx.tenantId,
    path: ctx.path,
    bruto: ctx.priceUsd,
    neto: neto.toFixed(6),
    feePct: env.feePct,
    ref: receipt.reference,
    network,
  })

  // La wallet del agente sale de la tx on-chain; no bloqueamos la respuesta por
  // eso. En los rieles Gateway ya vino en el payload y no hay tx que leer.
  const redPagador = isDirectRail(network) ? 'tempo' : network
  if (!ctx.payer && isNetworkId(redPagador)) {
    void resolvePayer(redPagador, receipt.reference).then((wallet) => {
      if (wallet) void store.setPaymentWallet(payment.id, wallet).catch(() => {})
    })
  }

  return payment
}

/**
 * Reembolso si el origin falló con un pago ya cobrado. En los rieles de
 * contrato no pasa: el settlement se envía solo si el origen respondió
 * (ver liquidacion-v3.ts). En Tempo (split o custodial viejo) lo devuelve la
 * treasury, entero y con topes (ver reembolsos.ts).
 * Devuelve el hash del refund, o null si no se pudo.
 */
export async function refundOriginFailure(payment: Payment): Promise<string | null> {
  if (payment.refundTx) return payment.refundTx // Receipt re-presentado: ya se devolvió.
  if (isDirectRail(payment.network) || payment.network === 'tempo') {
    const r = await reembolsarTempo(payment)
    return r.ok ? r.tx : null
  }
  console.warn('[refund] NO SOPORTADO en esta red', {
    payment: payment.id,
    tenant: payment.tenantId,
    network: payment.network,
    amount: payment.amount,
    receipt: payment.receiptRef,
  })
  return null
}

/**
 * Lee el `Payment-Receipt` de la respuesta ya sellada y acredita el pago
 * al tenant. Se hace acá porque este scope es el único que conoce tenant,
 * ruta y precio decimal: el Receipt solo trae método, referencia y timestamp.
 */
export async function creditReceipt(response: Response, ctx: ChargeContext): Promise<Payment | null> {
  const header = response.headers.get('Payment-Receipt')
  if (!header) {
    console.warn('[charge] respuesta sin Payment-Receipt para', ctx.path)
    return null
  }

  const receipt = Receipt.deserialize(header)
  return creditPayment(ctx, { reference: receipt.reference, method: receipt.method })
}
