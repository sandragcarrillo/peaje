import type { Balance, Payment } from '@peaje/db'
import { railExplorerTxUrl, railLabel } from '@peaje/shared'

/**
 * Datos de la vista de ingresos: cada pago con su tx, el neto y la
 * dirección a la que llegó. Sin saldo disponible: con pagos directos el
 * neto ya está en la wallet del negocio y no hay nada que retirar.
 */
export type PagoRecibido = {
  id: string
  fecha: string
  ruta: string
  red: string
  neto: string
  /** null = pago de antes del pago directo (Peaje guardaba el saldo). */
  llegoA: string | null
  txUrl: string | null
  reembolsado: boolean
}

export type Ingresos = {
  recibido: string
  pagos: number
  /** Hay pagos de antes del cambio en la lista. */
  hayAnteriores: boolean
  lista: PagoRecibido[]
}

export function armarIngresos(payments: Payment[], balance: Pick<Balance, 'revenue' | 'requestCount'>, testnet = true): Ingresos {
  const lista = payments.map((p) => ({
    id: p.id,
    fecha: p.createdAt,
    ruta: p.path,
    red: railLabel(p.network),
    neto: p.amount,
    llegoA: p.payoutAddress,
    txUrl: railExplorerTxUrl(p.network, p.receiptRef, testnet),
    reembolsado: p.refundTx !== null,
  }))
  return {
    recibido: balance.revenue,
    pagos: balance.requestCount,
    hayAnteriores: lista.some((p) => p.llegoA === null),
    lista,
  }
}
