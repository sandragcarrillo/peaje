import type { Store, Tenant, TenantWalletPatch } from './types'

/**
 * Wallet del dueño del negocio: una wallet de Privy cuyo owner es el usuario
 * (su DID en la app nueva). Peaje no firma con ella. Lo usan el login del
 * dashboard (al entrar o al registrarse) y scripts/privy-migracion.mts, así
 * que la regla de qué cambia en el negocio vive en un solo lugar.
 */

export type WalletPrivy = { id: string; address: string }

type TenantWallets = Pick<
  Tenant,
  | 'payoutWallet'
  | 'ownerWallet'
  | 'ownerWalletId'
  | 'custodialWallet'
  | 'custodialWalletId'
  | 'custodialWalletLegacy'
  | 'custodialWalletIdLegacy'
>

const igual = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** De dónde sale la address de cobro del negocio hoy. */
export type TipoWalletCobro = 'propia' | 'externa' | 'custodiada' | 'ninguna'

export function tipoWalletCobro(t: TenantWallets): TipoWalletCobro {
  if (!t.payoutWallet) return 'ninguna'
  if (igual(t.payoutWallet, t.ownerWallet)) return 'propia'
  if (t.custodialWalletId && igual(t.payoutWallet, t.custodialWallet)) return 'custodiada'
  return 'externa'
}

/**
 * true si la address de cobro la eligió el dueño (no es ninguna wallet que
 * Peaje haya creado para él, ni la custodiada vieja ni la suya de Privy).
 */
export function cobroEsExterno(t: TenantWallets): boolean {
  const p = t.payoutWallet
  if (!p) return false
  return !igual(p, t.custodialWallet) && !igual(p, t.custodialWalletLegacy) && !igual(p, t.ownerWallet)
}

/**
 * Qué cambia en el negocio al darle la wallet del dueño. null si ya está.
 *
 * - ownerWallet pasa a ser esa wallet.
 * - payoutWallet pasa a esa wallet, salvo que el dueño haya puesto una
 *   address externa (se respeta: es suya).
 * - La custodiada de la app vieja pasa a *_legacy (para barrerla) y se
 *   limpia: con la app nueva Peaje ya no puede firmar con ella.
 */
export function patchWalletDueno(t: TenantWallets, w: WalletPrivy): TenantWalletPatch | null {
  const patch: TenantWalletPatch = {}
  if (t.ownerWalletId !== w.id || !igual(t.ownerWallet, w.address)) {
    patch.ownerWallet = w.address
    patch.ownerWalletId = w.id
  }
  if (!cobroEsExterno(t) && !igual(t.payoutWallet, w.address)) patch.payoutWallet = w.address
  if (t.custodialWalletId || t.custodialWallet) {
    if (!t.custodialWalletIdLegacy) {
      patch.custodialWalletLegacy = t.custodialWallet
      patch.custodialWalletIdLegacy = t.custodialWalletId
    }
    patch.custodialWallet = null
    patch.custodialWalletId = null
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * La wallet embebida de Ethereum del usuario dentro de sus linked_accounts de
 * Privy (las que crea `users().pregenerateWallets`). Tipado estructural para
 * no depender del SDK desde este paquete.
 */
export function walletEmbebidaDe(linkedAccounts: readonly unknown[]): WalletPrivy | null {
  for (const raw of linkedAccounts) {
    const a = raw as Record<string, unknown>
    if (
      a.type === 'wallet' &&
      a.chain_type === 'ethereum' &&
      a.wallet_client_type === 'privy' &&
      a.connector_type === 'embedded' &&
      typeof a.id === 'string' &&
      typeof a.address === 'string'
    ) {
      return { id: a.id, address: a.address }
    }
  }
  return null
}

/** El email del usuario de Privy (la cuenta linkeada de tipo email), o null. */
export function emailDe(linkedAccounts: readonly unknown[]): string | null {
  for (const raw of linkedAccounts) {
    const a = raw as Record<string, unknown>
    if (a.type === 'email' && typeof a.address === 'string') return a.address
  }
  return null
}

/**
 * Re-match por email tras pasar a la app de Privy nueva: el mismo correo
 * verificado tiene otro DID. Pasa a `nuevoDid` los negocios de ese email que
 * todavía no migraron (privyUserIdLegacy null) y guarda el DID viejo.
 *
 * Seguro porque el email viene de Privy (verificado por OTP al entrar) y un
 * email no puede tener dos usuarios en la misma app. Un negocio ya migrado no
 * se vuelve a mover, y uno sin dueño (privyUserId null) no se toma por email.
 *
 * Devuelve todos los negocios del usuario después del cambio.
 */
export async function revincularPorEmail(
  store: Store,
  nuevoDid: string,
  email: string | null,
): Promise<{ tenants: Tenant[]; revinculados: string[] }> {
  const revinculados: string[] = []
  if (email) {
    const candidatos = (await store.listTenantsByEmail(email)).filter(
      (t) => t.privyUserId !== null && t.privyUserId !== nuevoDid && t.privyUserIdLegacy === null,
    )
    for (const t of candidatos) {
      if (await store.rebindTenantOwner(t.id, nuevoDid, t.privyUserId)) revinculados.push(t.slug)
    }
  }
  return { tenants: await store.listTenantsByPrivyUserId(nuevoDid), revinculados }
}
