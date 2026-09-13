export const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:8787'

export function money(value: string | number): string {
  return `$${Number(value).toFixed(2)}`
}

/** Precios de micropagos: $0.001 no puede mostrarse como $0.00. */
export function microMoney(value: string | number): string {
  const n = Number(value)
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(3)}`
  return money(n)
}

export function shortWallet(wallet: string | null): string {
  if (!wallet) return '—'
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}
