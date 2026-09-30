import type { Payment } from '@peaje/db'
import {
  isNetworkId,
  isDirectRail,
  isSettlementNetwork,
  networkFromReceiptMethod,
  TEMPO_SPLIT_RAIL,
  type NetworkId,
  type SettlementNetwork,
} from '@peaje/shared'
import { Receipt } from 'mppx'
import { withdrawFromSettlement } from './settlement.js'
import { resolvePayer } from './chain.js'
import { env } from './env.js'
import { store } from './store.js'
import { custodiaDe, sendPayout } from './treasury.js'

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
  /** Reparto de la oferta de Tempo de este cobro (ver contexto.ts). null = custodial. */
  tempoSplit?: { neto: string; fee: string } | null
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

  // El agente pagó el precio listado (bruto). El negocio recibe el neto; la
  // diferencia es el take rate de Peaje y se queda en la treasury, donde el
  // pago ya cayó on-chain. Un solo punto de cobro: acá.
  const bruto = Number(ctx.priceUsd)
  const fee = split ? Number(split.fee) : bruto * env.feePct
  const neto = split ? Number(split.neto) : Math.max(0, bruto - fee)

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
 * Pago condicionado: si el origin del negocio no respondió a un request ya
 * pagado, devolvemos el pago al agente desde la treasury de esa red y lo
 * marcamos refundeado (deja de contar para el balance del tenant).
 * Devuelve el hash del refund, o null si no se pudo (queda el camino manual).
 */
export async function refundOriginFailure(payment: Payment): Promise<string | null> {
  if (payment.refundTx) return payment.refundTx // Receipt re-presentado: ya se devolvió.
  // ---- Tempo splits ----
  // El neto de un pago con split ya está en la wallet del negocio, fuera de
  // Peaje: la treasury no puede devolverlo sin pagar de su bolsillo la parte
  // del negocio. Queda sin reembolso automático y a la vista en el log.
  if (isDirectRail(payment.network)) {
    console.warn('[refund] NO SOPORTADO: pago de Tempo con split directo, el neto ya está en la wallet del negocio', {
      payment: payment.id,
      tenant: payment.tenantId,
      amount: payment.amount,
      receipt: payment.receiptRef,
    })
    return null
  }
  if (!isNetworkId(payment.network)) return null

  const payer = await resolvePayer(payment.network, payment.receiptRef)
  if (!payer) {
    console.warn('[refund] no se pudo resolver el pagador de', payment.receiptRef)
    return null
  }

  try {
    const hash =
      isSettlementNetwork(payment.network)
        ? await refundFromSettlement(payment.network, payment, payer as `0x${string}`)
        : await sendPayout(payment.network, payer as `0x${string}`, payment.amount)
    await store.markPaymentRefunded(payment.id, hash)
    console.log('[refund] pago devuelto', {
      payment: payment.id,
      network: payment.network,
      to: payer,
      amount: payment.amount,
      tx: hash,
    })
    return hash
  } catch (error) {
    console.error('[refund] fallo el refund de', payment.id, error)
    return null
  }
}

/**
 * En redes con settlement el pago quedó acreditado al comerciante dentro de
 * PeajeSettlement, no en la treasury: el reembolso sale de ese saldo, firmado
 * por su wallet.
 */
async function refundFromSettlement(
  network: SettlementNetwork,
  payment: Payment,
  payer: `0x${string}`,
): Promise<`0x${string}`> {
  const tenant = await store.getTenantById(payment.tenantId)
  const custodia = tenant ? custodiaDe(tenant) : null
  if (!custodia) throw new Error('El negocio no tiene wallet custodiada para reembolsar desde el contrato')
  return withdrawFromSettlement(network, custodia, payer, payment.amount)
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
