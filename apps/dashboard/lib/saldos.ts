import 'server-only'
import type { Balance, NetworkBalance, Tenant } from '@peaje/db'
import { CLAIMABLE_ABI, fromBaseUnits, NETWORKS, SETTLEMENT_CONTRACTS, type NetworkId } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { store } from './store'

const arbitrum = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.ARBITRUM_SEPOLIA_RPC_URL ?? NETWORKS.arbitrum.testnet.rpcUrl),
})

/**
 * Lo que el contrato le debe al negocio en una red con settlement on-chain.
 * null si la red no tiene contrato o la lectura falla (se usa el ledger).
 */
async function claimableOnchain(network: NetworkId, wallet: string | null): Promise<string | null> {
  const contrato = SETTLEMENT_CONTRACTS[network]
  if (!contrato || !wallet || network !== 'arbitrum') return null
  try {
    const raw = await arbitrum.readContract({
      address: contrato,
      abi: CLAIMABLE_ABI,
      functionName: 'claimable',
      args: [NETWORKS.arbitrum.token, wallet as `0x${string}`],
    })
    return fromBaseUnits(raw, NETWORKS.arbitrum.decimals)
  } catch {
    return null
  }
}

/**
 * Saldo por red. En redes con contrato el disponible sale de `claimable`:
 * el ledger solo aporta el historial (ingresos, retiros, cantidad de pagos).
 */
export async function saldosPorRed(tenant: Pick<Tenant, 'id' | 'payoutWallet'>): Promise<NetworkBalance[]> {
  const ledger = await store.balanceByNetwork(tenant.id)
  return Promise.all(
    ledger.map(async (b) => {
      const onchain = await claimableOnchain(b.network as NetworkId, tenant.payoutWallet)
      return onchain === null ? b : { ...b, available: onchain }
    }),
  )
}

/** Saldo agregado con el disponible de cada red ya corregido por el contrato. */
export async function saldoTotal(tenant: Pick<Tenant, 'id' | 'payoutWallet'>): Promise<Balance> {
  const [total, porRed] = await Promise.all([store.balance(tenant.id), saldosPorRed(tenant)])
  const disponible = porRed.reduce((n, b) => n + Number(b.available), 0)
  return { ...total, available: disponible.toFixed(6) }
}
