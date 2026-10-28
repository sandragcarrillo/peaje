import { NETWORKS, SETTLEMENT_NETWORKS, type SettlementNetwork } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { settlementV3Abi } from './abi/settlement-v3.js'
import { ethUsd } from './chainlink.js'
import { env } from './env.js'
import { contratoV3 } from './settlement.js'

/**
 * Costo de red por riel: lo que el relayer gasta en gas para liquidar UN pago
 * en PeajeSettlementV3, en dólares. Se le cobra al agente encima del precio
 * (ver methods.ts) y el contrato lo acredita a Peaje junto con el 2%.
 *
 * Se calcula en segundo plano cada 30 s y se lee en sincrónico: el 402 se
 * arma en el camino del request y no puede esperar un RPC. Si no hay dato
 * todavía, el recargo es 0 y Peaje absorbe ese pago: mejor que rechazarlo.
 */

/**
 * Gas de `settle` en PeajeSettlementV3: ~163k en estado estable y ~203k el
 * primer pago a una wallet que nunca tuvo el token (docs/contrato-v3.md; los
 * chequeos de roles de la auditoría del 28 oct 2026 sumaron ~8k a cada pago).
 * 180k por 1,2 de margen (216k) cubre los dos.
 */
export const GAS_SETTLE = 180_000n
/** Margen sobre el precio del gas del momento: el bloque siguiente puede ser más caro. */
const MARGEN = 1.2
/**
 * Tope por riel, en USD, por si no se puede leer el del contrato. El que manda
 * es `maxNetworkFee` del contrato (0,02 en Arbitrum y Robinhood según el
 * script de deploy): cotizar más que eso hacía que el contrato rechazara todos
 * los pagos del riel. Si el gas sube más que el tope, Peaje absorbe la diferencia.
 */
const TOPE_USD: Record<SettlementNetwork, number> = {
  arbitrum: 0.02,
  'arbitrum-usdg': 0.02,
  robinhood: 0.02,
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
  const tope = Math.min(TOPE_USD[network], await topeDelContrato(network).catch(() => Number.POSITIVE_INFINITY))
  return Math.min(tope, Math.ceil(usd * 1e6) / 1e6)
}

/** `maxNetworkFee` del contrato para el token del riel, en USD (stablecoin, sus decimales). */
async function topeDelContrato(network: SettlementNetwork): Promise<number> {
  const contrato = contratoV3(network)
  if (!contrato) return Number.POSITIVE_INFINITY
  const def = NETWORKS[network]
  const cap = await cliente(env.settlementRpcUrls[network]).readContract({ address: contrato, abi: settlementV3Abi, functionName: 'maxNetworkFee', args: [def.token as `0x${string}`] })
  return Number(cap) / 10 ** def.decimals
}

async function refrescar(): Promise<void> {
  for (const network of SETTLEMENT_NETWORKS) {
    if (!contratoV3(network)) continue
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
