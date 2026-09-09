import type { Payment } from '@peaje/db'
import { networkFromReceiptMethod, isNetworkId } from '@peaje/shared'
import { Receipt } from 'mppx'
import { resolvePayer } from './chain.js'
import { store } from './store.js'
import { sendPayout } from './treasury.js'

export type ChargeContext = {
  tenantId: string
  routeId: string | null
  path: string
  priceUsd: string
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
export async function creditPayment(ctx: ChargeContext, receipt: ReceiptInfo): Promise<void> {
  const network = networkFromReceiptMethod(receipt.method)
  const payment = await store.recordPayment({
    tenantId: ctx.tenantId,
    routeId: ctx.routeId,
    path: ctx.path,
    agentWallet: null,
    amount: ctx.priceUsd,
    receiptRef: receipt.reference,
    method: receipt.method,
    network,
  })

  console.log('[charge] pago acreditado', {
    tenant: ctx.tenantId,
    path: ctx.path,
    amount: ctx.priceUsd,
    ref: receipt.reference,
    network,
  })

  // La wallet del agente sale de la tx on-chain; no bloqueamos la respuesta por eso.
  void resolvePayer(network, receipt.reference).then((wallet) => {
    if (wallet) void store.setPaymentWallet(payment.id, wallet).catch(() => {})
  })
}

/**
 * Lee el `Payment-Receipt` de la respuesta ya sellada y acredita el pago
 * al tenant. Se hace acá porque este scope es el único que conoce tenant,
 * ruta y precio decimal: el Receipt solo trae método, referencia y timestamp.
 */
export async function creditReceipt(response: Response, ctx: ChargeContext): Promise<void> {
  const header = response.headers.get('Payment-Receipt')
  if (!header) {
    console.warn('[charge] respuesta sin Payment-Receipt para', ctx.path)
    return
  }

  const receipt = Receipt.deserialize(header)
  await creditPayment(ctx, { reference: receipt.reference, method: receipt.method })
}
