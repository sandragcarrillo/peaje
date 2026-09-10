import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

/**
 * Depeg guard: precio USDC/USD del Price Feed oficial de Chainlink en
 * Ethereum mainnet. Si USDC se despega, el gateway deja de ofrecer y settlear
 * el rail de Arc: un agente no debería pagar (ni un negocio acumular revenue)
 * con un token despegado.
 *
 * Feed: https://data.chain.link/feeds/ethereum/mainnet/usdc-usd
 */

const FEED = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6' as const
const FEED_DECIMALS = 8

/** Umbral en basis points bajo $1.00 (default 50 = $0.9950). */
const THRESHOLD_BPS = Number(process.env.DEPEG_THRESHOLD_BPS ?? 50)
const CACHE_MS = 60_000

const aggregatorAbi = [
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.CHAINLINK_RPC_URL ?? 'https://ethereum-rpc.publicnode.com'),
})

export type UsdcStatus = {
  price: number | null
  depegged: boolean
  checkedAt: string
}

let cache: { status: UsdcStatus; at: number } | null = null

/**
 * Estado del peg de USDC, cacheado 60s. Falla abierta: si el feed no responde
 * el rail sigue operando (disponibilidad sobre estrictez) y se loguea el warn.
 */
export async function usdcStatus(): Promise<UsdcStatus> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.status

  let status: UsdcStatus
  try {
    const [, answer] = await client.readContract({
      address: FEED,
      abi: aggregatorAbi,
      functionName: 'latestRoundData',
    })
    const price = Number(answer) / 10 ** FEED_DECIMALS
    status = {
      price,
      depegged: price < 1 - THRESHOLD_BPS / 10_000,
      checkedAt: new Date().toISOString(),
    }
    if (status.depegged) {
      console.warn(`[chainlink] USDC despegado: $${price} (umbral ${THRESHOLD_BPS}bps). Rail de Arc pausado.`)
    }
  } catch (error) {
    console.warn('[chainlink] no se pudo leer el feed USDC/USD; el rail sigue activo', error)
    status = { price: null, depegged: false, checkedAt: new Date().toISOString() }
  }

  cache = { status, at: Date.now() }
  return status
}
