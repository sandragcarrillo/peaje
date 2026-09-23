import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
import { base } from 'viem/chains'

/**
 * Base mainnet: la red donde vive el mercado real de x402 (el Bazaar de CDP
 * lista ~14.000 servicios y casi todos cobran USDC en Base). Los rieles
 * testnet de Peaje se quedan para el demo Peaje-comprándole-a-Peaje; esta
 * red es para comprar servicios de terceros con dinero real.
 *
 * OJO: acá el USDC es real. El tope duro sigue siendo el saldo de la wallet
 * del agente, y el runner además respeta maxPerRun por compra.
 */

export const BASE_CAIP2 = 'eip155:8453'
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
export const BASE_USDC_DECIMALS = 6

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'),
})

/** Saldo USDC (mainnet) de una address, en decimal legible. */
export async function baseUsdcBalance(address: `0x${string}`): Promise<string> {
  const raw = await basePublicClient.readContract({
    address: BASE_USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })
  return formatUnits(raw, BASE_USDC_DECIMALS)
}

export function baseExplorerTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`
}
