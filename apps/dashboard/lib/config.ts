import { NETWORK_IDS, NETWORKS } from '@peaje/shared'
export const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8787'

export function money(value: string | number): string {
  return `$${Number(value).toFixed(2)}`
}

/** Micropagos: $0.0004 no puede mostrarse como $0.00. Hasta 6 decimales, sin ceros de cola. */
export function microMoney(value: string | number): string {
  const n = Number(value)
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(6).replace(/0+$/, '')}`
  return money(n)
}

/**
 * Cadenas donde se cobra, una vez cada una. Arbitrum tiene dos rieles (USDC y
 * USDG) pero es una sola cadena: la etiqueta cuenta cadenas, no tokens.
 */
export const CHAINS = [
  ...new Map(NETWORK_IDS.map((id) => [NETWORKS[id].testnet.chainId, NETWORKS[id].label.split(' · ')[0].toUpperCase()])).values(),
]

/** Rieles de cobro activos, para las etiquetas del panel. */
export const RAILS_LABEL = CHAINS.join(' + ')

export function shortWallet(wallet: string | null): string {
  if (!wallet) return '—'
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}
