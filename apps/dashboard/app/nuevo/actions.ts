'use server'

import { generateEmbedSecret, slugify } from '@peaje/shared'
import { getDict } from '@/lib/i18n'
import { entrarComoDueno } from '@/lib/dueno'
import { asegurarWalletDueno, usuarioPrivy, verifyPrivyAccessToken } from '@/lib/privy'
import { setSession } from '@/lib/session'
import { describirSitio } from '@/lib/gateway'
import { store } from '@/lib/store'

export type AltaResultado =
  | { ok: true; slug: string; payoutWallet: string }
  | { ok: false; error: string }

/**
 * Alta de un negocio: login por email vía Privy (OTP verificado en el
 * cliente). La wallet de cobro es la del dueño: una wallet de Privy a su
 * nombre (owner = su DID), no custodial. Ya no hay API key.
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

  const usuario = await usuarioPrivy(privyUserId)
  const email = usuario.email
  // Una por persona: si ya tiene (otro negocio, o la importó la migración), se reusa.
  const wallet = await asegurarWalletDueno(privyUserId, usuario.wallet)

  const tenant = await store.createTenant({
    slug,
    name,
    originUrl: origin.origin + origin.pathname.replace(/\/$/, ''),
    embedSecret: generateEmbedSecret(),
    payoutWallet: wallet.address,
    ownerWallet: wallet.address,
    ownerWalletId: wallet.id,
    // Ya no hay wallet custodiada: Peaje no firma en nombre del negocio.
    custodialWallet: null,
    custodialWalletId: null,
    email,
    privyUserId,
  })

  await store.addAllowedOrigin(tenant.id, origin.origin)
  // Si venía de la app de Privy vieja, sus otros negocios pasan a este DID.
  await entrarComoDueno(privyUserId).catch((error) => console.error('[nuevo] re-match por email', error))
  await setSession(privyUserId)
  // Que llms.txt, openapi y el MCP describan el sitio desde el primer día, sin plantilla.
  describirSitio(tenant.slug)

  return { ok: true, slug: tenant.slug, payoutWallet: wallet.address }
}
