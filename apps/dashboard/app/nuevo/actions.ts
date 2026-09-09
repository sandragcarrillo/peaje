'use server'

import { generateEmbedSecret, slugify } from '@peaje/shared'
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
  const name = String(formData.get('name') ?? '').trim()
  const originUrl = String(formData.get('originUrl') ?? '').trim()
  const accessToken = String(formData.get('privyAccessToken') ?? '').trim()

  if (!name) return { ok: false, error: 'Falta el nombre del negocio.' }
  if (!originUrl) return { ok: false, error: 'Falta la URL de tu sitio web.' }
  if (!accessToken) return { ok: false, error: 'Verifica tu email antes de continuar.' }

  let origin: URL
  try {
    origin = new URL(originUrl)
  } catch {
    return { ok: false, error: 'Esa URL no parece válida. Ejemplo: https://tunegocio.com' }
  }

  let privyUserId: string
  try {
    privyUserId = await verifyPrivyAccessToken(accessToken)
  } catch {
    return { ok: false, error: 'No pudimos verificar tu sesión. Intenta de nuevo.' }
  }

  // Un usuario puede tener varios negocios: no hay shortcut por usuario
  // existente, solo el guard de slug repetido de abajo.
  const slug = slugify(name)
  if (!slug) return { ok: false, error: 'El nombre no genera un identificador válido.' }
  if (await store.getTenantBySlug(slug)) {
    return { ok: false, error: `Ya hay un negocio registrado como "${slug}".` }
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
