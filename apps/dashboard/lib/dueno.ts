import 'server-only'
import { patchWalletDueno, revincularPorEmail, type Tenant, type WalletPrivy } from '@peaje/db'
import { asegurarWalletDueno, usuarioPrivy } from './privy'
import { store } from './store'

/**
 * Lo que pasa al entrar con un DID de Privy ya verificado:
 *
 * 1. Re-match por email: si el usuario vino de la app vieja, sus negocios
 *    siguen atados al DID viejo. Se pasan a este DID (ver revincularPorEmail).
 * 2. Cada negocio sin wallet del dueño recibe la suya (owner = este DID); la
 *    custodiada de la app vieja queda en *_legacy para el barrido.
 *
 * El paso 2 no bloquea el login: si Privy falla, se reintenta en el próximo.
 */
export async function entrarComoDueno(privyUserId: string): Promise<Tenant[]> {
  const usuario = await usuarioPrivy(privyUserId)
  const { tenants, revinculados } = await revincularPorEmail(store, privyUserId, usuario.email)
  if (revinculados.length > 0) console.log('[acceder] negocios re-vinculados por email', { revinculados })

  const pendientes = tenants.filter((t) => !t.ownerWalletId || t.custodialWalletId)
  if (pendientes.length === 0) return tenants
  try {
    const wallet = await asegurarWalletDueno(privyUserId, usuario.wallet)
    await darWalletDueno(pendientes, wallet)
    return store.listTenantsByPrivyUserId(privyUserId)
  } catch (error) {
    console.error('[acceder] no se pudo asignar la wallet del dueño', error)
    return tenants
  }
}

export async function darWalletDueno(tenants: Tenant[], wallet: WalletPrivy): Promise<void> {
  for (const t of tenants) {
    const patch = patchWalletDueno(t, wallet)
    if (patch) await store.setTenantWallets(t.id, patch)
  }
}
