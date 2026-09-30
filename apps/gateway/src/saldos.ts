import type { NetworkBalance, Tenant } from '@peaje/db'
import { isDirectRail, isSettlementNetwork } from '@peaje/shared'
import { claimableEnContrato } from './settlement.js'
import { env } from './env.js'
import { store } from './store.js'

/**
 * Saldo por red del negocio. En redes con settlement el disponible es lo que el contrato
 * le debe (`claimable`): el ledger solo aporta historial. Si la lectura
 * on-chain falla se cae al ledger, que en la práctica coincide.
 */
export async function saldosPorRed(tenant: Pick<Tenant, 'id' | 'custodialWallet'>): Promise<NetworkBalance[]> {
  const ledger = await store.balanceByNetwork(tenant.id)
  return Promise.all(
    ledger.map(async (b) => {
      // ---- Tempo splits ----
      // Lo cobrado por split directo ya está en la wallet del negocio: es
      // ingreso (revenue), nunca saldo retirable de la treasury.
      if (isDirectRail(b.network)) return { ...b, available: '0' }
      if (!isSettlementNetwork(b.network) || !env.settlementContracts[b.network]) return b
      // Solo lo que Peaje puede retirar: lo acreditado a la wallet que custodia.
      // Con la de cobro, cualquiera que pusiera la address de otro negocio
      // veía (y retiraba) el saldo ajeno.
      if (!tenant.custodialWallet) return { ...b, available: '0' }
      try {
        return { ...b, available: await claimableEnContrato(b.network, tenant.custodialWallet as `0x${string}`) }
      } catch {
        return b
      }
    }),
  )
}
