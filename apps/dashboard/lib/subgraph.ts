import 'server-only'
import { fromBaseUnits, NETWORKS } from '@peaje/shared'

export type MovimientoOnchain = {
  tipo: 'pago' | 'retiro'
  monto: string
  fee: string | null
  contraparte: string
  txHash: string
  fecha: string
}

export type HistorialOnchain = {
  recibido: string
  fees: string
  retirado: string
  pagos: number
  movimientos: MovimientoOnchain[]
}

const QUERY = `query ($id: Bytes!) {
  account(id: $id) {
    totalReceived
    totalFees
    totalWithdrawn
    paymentCount
    payments(first: 10, orderBy: timestamp, orderDirection: desc) { net fee payer txHash timestamp }
    withdrawals(first: 10, orderBy: timestamp, orderDirection: desc) { amount to txHash timestamp }
  }
}`

type Respuesta = {
  data?: {
    account: {
      totalReceived: string
      totalFees: string
      totalWithdrawn: string
      paymentCount: number
      payments: { net: string; fee: string; payer: string; txHash: string; timestamp: string }[]
      withdrawals: { amount: string; to: string; txHash: string; timestamp: string }[]
    } | null
  }
}

/**
 * Historial del negocio en Arbitrum leído del subgraph de PeajeSettlement,
 * que indexa los eventos del contrato. null si el subgraph no está configurado
 * o no responde: el panel sigue funcionando con el ledger.
 */
export async function historialOnchain(wallet: string | null): Promise<HistorialOnchain | null> {
  const url = process.env.PEAJE_SUBGRAPH_URL
  if (!url || !wallet) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { id: wallet.toLowerCase() } }),
      next: { revalidate: 15 },
    })
    const { data } = (await res.json()) as Respuesta
    const cuenta = data?.account
    if (!cuenta) return { recibido: '0', fees: '0', retirado: '0', pagos: 0, movimientos: [] }

    const usdc = (raw: string) => fromBaseUnits(raw, NETWORKS.arbitrum.decimals)
    const fecha = (ts: string) => new Date(Number(ts) * 1000).toISOString()
    const movimientos: MovimientoOnchain[] = [
      ...cuenta.payments.map((p) => ({
        tipo: 'pago' as const,
        monto: usdc(p.net),
        fee: usdc(p.fee),
        contraparte: p.payer,
        txHash: p.txHash,
        fecha: fecha(p.timestamp),
      })),
      ...cuenta.withdrawals.map((w) => ({
        tipo: 'retiro' as const,
        monto: usdc(w.amount),
        fee: null,
        contraparte: w.to,
        txHash: w.txHash,
        fecha: fecha(w.timestamp),
      })),
    ].toSorted((a, b) => b.fecha.localeCompare(a.fecha))

    return {
      recibido: usdc(cuenta.totalReceived),
      fees: usdc(cuenta.totalFees),
      retirado: usdc(cuenta.totalWithdrawn),
      pagos: cuenta.paymentCount,
      movimientos: movimientos.slice(0, 10),
    }
  } catch {
    return null
  }
}
