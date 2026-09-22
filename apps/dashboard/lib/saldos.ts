import 'server-only'
import type { Balance, NetworkBalance, Tenant } from '@peaje/db'
import {
  CLAIMABLE_ABI,
  fromBaseUnits,
  isSettlementNetwork,
  NETWORKS,
  SETTLEMENT_CONTRACTS,
  type SettlementNetwork,
} from '@peaje/shared'
import { createPublicClient, defineChain, http, type PublicClient } from 'viem'
import { store } from './store'

const clientes = new Map<SettlementNetwork, PublicClient>()

function cliente(network: SettlementNetwork): PublicClient {
  const cached = clientes.get(network)
  if (cached) return cached
  const def = NETWORKS[network]
  const chain = defineChain({
    id: def.testnet.chainId,
    name: def.label,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [def.testnet.rpcUrl] } },
  })
  const nuevo = createPublicClient({ chain, transport: http() }) as PublicClient
  clientes.set(network, nuevo)
  return nuevo
}

/**
 * Lo que el contrato le debe al negocio en una red con settlement on-chain.
 * null si la red no tiene contrato o la lectura falla (se usa el ledger).
 */
async function claimableOnchain(network: string, wallet: string | null): Promise<string | null> {
  if (!isSettlementNetwork(network) || !wallet) return null
  const contrato = SETTLEMENT_CONTRACTS[network]
  if (!contrato) return null
  try {
    const raw = await cliente(network).readContract({
      address: contrato,
      abi: CLAIMABLE_ABI,
      functionName: 'claimable',
      args: [NETWORKS[network].token, wallet as `0x${string}`],
    })
    return fromBaseUnits(raw, NETWORKS[network].decimals)
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
      const onchain = await claimableOnchain(b.network, tenant.payoutWallet)
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
