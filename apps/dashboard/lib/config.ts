import { chainLabels, modoTestnet } from '@peaje/shared'
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
 * Testnet o mainnet: NEXT_PUBLIC_RED, el mismo nombre que en Railway. Sin valor
 * es testnet. Cambia las cadenas, los tokens y los explorers que muestra el panel.
 */
export const TESTNET = modoTestnet(process.env.NEXT_PUBLIC_RED)

/** Cadenas donde se cobra en este modo, una vez cada una (ver chainLabels en @peaje/shared). */
export const CHAINS = chainLabels(TESTNET).map((c) => c.toUpperCase())

/** Rieles de cobro activos, para las etiquetas del panel. */
export const RAILS_LABEL = CHAINS.join(' + ')

export function shortWallet(wallet: string | null): string {
  if (!wallet) return '—'
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}

/**
 * Wallet y cobros a la vista. Apagado hasta lanzar en mainnet: las wallets se
 * siguen creando al registrarse (Privy), pero el panel no las muestra ni los
 * cobros de prueba (menú de cuenta, Cobros en el sidebar, Ingresos, Rutas,
 * /wallet). Para mostrarlos: NEXT_PUBLIC_COBROS=1 en Vercel y redeploy.
 */
export const COBROS_VISIBLES = process.env.NEXT_PUBLIC_COBROS === '1'
