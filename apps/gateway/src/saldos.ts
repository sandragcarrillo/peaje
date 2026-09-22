import type { NetworkBalance, Tenant } from '@peaje/db'
import { isSettlementNetwork } from '@peaje/shared'
import { claimableEnContrato } from './settlement.js'
import { env } from './env.js'
import { store } from './store.js'

/**
 * Saldo por red del negocio. En redes con settlement el disponible es lo que el contrato
 * le debe (`claimable`): el ledger solo aporta historial. Si la lectura
 * on-chain falla se cae al ledger, que en la práctica coincide.
 */
export async function saldosPorRed(tenant: Pick<Tenant, 'id' | 'payoutWallet'>): Promise<NetworkBalance[]> {
  const ledger = await store.balanceByNetwork(tenant.id)
  return Promise.all(
    ledger.map(async (b) => {
      if (!isSettlementNetwork(b.network) || !env.settlementContracts[b.network] || !tenant.payoutWallet) return b
      try {
        return { ...b, available: await claimableEnContrato(b.network, tenant.payoutWallet as `0x${string}`) }
      } catch {
        return b
      }
    }),
  )
}
