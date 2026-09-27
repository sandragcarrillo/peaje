import { NETWORKS, SETTLEMENT_NETWORKS, type SettlementNetwork } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { ethUsd } from './chainlink.js'
import { env } from './env.js'

/**
 * Costo de red por riel: lo que el relayer gasta en gas para liquidar UN pago
 * en PeajeSettlement, en dólares. Se le cobra al agente encima del precio
 * (ver methods.ts) y el contrato lo acredita a Peaje junto con el 2%.
 *
 * Se calcula en segundo plano cada 30 s y se lee en sincrónico: el 402 se
 * arma en el camino del request y no puede esperar un RPC. Si no hay dato
 * todavía, el recargo es 0 y Peaje absorbe ese pago: mejor que rechazarlo.
 */

/** Gas de `settle` medido en Arbitrum Sepolia (tx 0x8789a7a3…): 146.990. Con margen. */
const GAS_SETTLE = 160_000n
/** Margen sobre el precio del gas del momento: el bloque siguiente puede ser más caro. */
const MARGEN = 1.2
/**
 * Tope por riel, en USD: coincide con `maxNetworkFee` del contrato (0,05 en
 * Arbitrum y Robinhood). Si el gas sube más que esto, Peaje absorbe la
 * diferencia; el contrato rechaza cualquier valor mayor.
 */
const TOPE_USD: Record<SettlementNetwork, number> = {
  arbitrum: 0.05,
  'arbitrum-usdg': 0.05,
  robinhood: 0.05,
  arc: 0.01,
}
const REFRESCO_MS = 30_000

const costos = new Map<SettlementNetwork, number>()
const clientes = new Map<string, ReturnType<typeof createPublicClient>>()

function cliente(rpcUrl: string) {
  let c = clientes.get(rpcUrl)
  if (!c) {
    c = createPublicClient({ transport: http(rpcUrl) })
    clientes.set(rpcUrl, c)
  }
  return c
}

/** Costo de red vigente para el riel, en USD con 6 decimales. 0 si aún no se conoce. */
export function costoRedUsd(network: SettlementNetwork): number {
  return costos.get(network) ?? 0
}

/** Suma el costo de red a un precio decimal, sin flotantes sueltos. */
export function conCostoRed(precioUsd: string | number, network: SettlementNetwork): string {
  const micro = Math.round(Number(precioUsd) * 1e6) + Math.round(costoRedUsd(network) * 1e6)
  return (micro / 1e6).toFixed(6)
}

async function calcular(network: SettlementNetwork): Promise<number> {
  const rpcUrl = env.settlementRpcUrls[network]
  const gasPrice = await cliente(rpcUrl).getGasPrice()
  // En Arc el gas se paga en USDC nativo (18 decimales): el costo ya está en
  // dólares. En las demás redes es ETH y hay que convertirlo.
  const nativoEnUsd = Number(GAS_SETTLE * gasPrice) / 1e18
  const usd = (network === 'arc' ? nativoEnUsd : nativoEnUsd * (await ethUsd())) * MARGEN
  const tope = TOPE_USD[network]
  return Math.min(tope, Math.ceil(usd * 1e6) / 1e6)
}

async function refrescar(): Promise<void> {
  for (const network of SETTLEMENT_NETWORKS) {
    if (!env.settlementContracts[network]) continue
    try {
      costos.set(network, await calcular(network))
    } catch (error) {
      console.warn(`[costo-red] no se pudo calcular en ${NETWORKS[network].label}`, error instanceof Error ? error.message : error)
    }
  }
}

let iniciado = false

/** Arranca el refresco periódico. Idempotente; el primer cálculo no bloquea. */
export function iniciarCostoRed(): void {
  if (iniciado) return
  iniciado = true
  void refrescar()
  const timer = setInterval(() => void refrescar(), REFRESCO_MS)
  timer.unref()
}
