'use server'

import { generateEmbedSecret, slugify } from '@peaje/shared'
import { getDict } from '@/lib/i18n'
import { createMerchantWallet, getPrivyUserEmail, verifyPrivyAccessToken } from '@/lib/privy'
import { setSession } from '@/lib/session'
import { store } from '@/lib/store'

export type AltaResultado =
  | { ok: true; slug: string; payoutWallet: string }
  | { ok: false; error: string }

/**
 * Alta de un negocio: login por email vía Privy (OTP verificado en el
 * cliente), wallet de payout creada automáticamente. Ya no hay API key.
 */
export async function registrarNegocio(
  _previo: AltaResultado | null,
  formData: FormData,
): Promise<AltaResultado> {
  const d = await getDict()
  const name = String(formData.get('name') ?? '').trim()
  const originUrl = String(formData.get('originUrl') ?? '').trim()
  const accessToken = String(formData.get('privyAccessToken') ?? '').trim()

  if (!name) return { ok: false, error: d.acceso.errorFaltaNombre }
  if (!originUrl) return { ok: false, error: d.acceso.errorFaltaUrl }
  if (!accessToken) return { ok: false, error: d.acceso.errorVerificaEmail }

  let origin: URL
  try {
    origin = new URL(originUrl)
  } catch {
    return { ok: false, error: d.acceso.errorUrlInvalida }
  }

  let privyUserId: string
  try {
    privyUserId = await verifyPrivyAccessToken(accessToken)
  } catch {
    return { ok: false, error: d.acceso.errorSesionNoVerificada }
  }

  // Un usuario puede tener varios negocios: no hay shortcut por usuario
  // existente, solo el guard de slug repetido de abajo.
  const slug = slugify(name)
  if (!slug) return { ok: false, error: d.acceso.errorNombreSinIdentificador }
  if (await store.getTenantBySlug(slug)) {
    return { ok: false, error: d.acceso.errorSlugTomado(slug) }
  }

  const email = await getPrivyUserEmail(privyUserId)
  const wallet = await createMerchantWallet(name)

  const tenant = await store.createTenant({
    slug,
    name,
    originUrl: origin.origin + origin.pathname.replace(/\/$/, ''),
    embedSecret: generateEmbedSecret(),
    payoutWallet: wallet.address,
    email,
    privyUserId,
  })

  await store.addAllowedOrigin(tenant.id, origin.origin)
  await setSession(privyUserId)

  return { ok: true, slug: tenant.slug, payoutWallet: wallet.address }
}
