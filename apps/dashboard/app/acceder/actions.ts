'use server'

import { getDict } from '@/lib/i18n'
import { verifyPrivyAccessToken } from '@/lib/privy'
import { setSession } from '@/lib/session'
import { store } from '@/lib/store'

export type EntrarResultado =
  /** slug null = el usuario tiene varios negocios: va al selector. */
  | { ok: true; slug: string | null }
  | { ok: false; error: string }

export async function entrarConPrivy(accessToken: string): Promise<EntrarResultado> {
  const d = await getDict()

  let privyUserId: string
  try {
    privyUserId = await verifyPrivyAccessToken(accessToken)
  } catch {
    return { ok: false, error: d.acceso.errorSesionNoVerificada }
  }

  try {
    const tenants = await store.listTenantsByPrivyUserId(privyUserId)
    if (tenants.length === 0) {
      return { ok: false, error: d.acceso.errorSinNegocio }
    }
    await setSession(privyUserId)
    return { ok: true, slug: tenants.length === 1 ? tenants[0]!.slug : null }
  } catch (error) {
    console.error('[acceder] fallo el login', error)
    return { ok: false, error: d.acceso.errorServidorEntrar }
  }
}
