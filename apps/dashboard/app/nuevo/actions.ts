'use server'

import { domainToUnicode } from 'node:url'
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
 * Nombre del sitio sacado de su URL: el dominio sin "www." y en Unicode
 * ("https://www.tupuente.app/x" → "tupuente.app"). Es estable (no depende de
 * cómo lo escriba cada uno) y es lo que el resto del panel ya muestra.
 */
function nombreDesdeUrl(url: URL): string {
  const host = domainToUnicode(url.hostname) || url.hostname
  return host.replace(/^www\./, '')
}

/**
 * Alta de un negocio: login por email vía Privy (OTP verificado en el
 * cliente). Solo pide la URL: el nombre y el slug salen del dominio. La
 * wallet de cobro se crea sin pedir nada: una wallet de Privy a nombre del
 * dueño (owner = su DID), no custodial. Los cobros se explican en Ingresos.
 */
export async function registrarNegocio(
  _previo: AltaResultado | null,
  formData: FormData,
): Promise<AltaResultado> {
  const d = await getDict()
  const originUrl = String(formData.get('originUrl') ?? '').trim()
  const accessToken = String(formData.get('privyAccessToken') ?? '').trim()

  if (!originUrl) return { ok: false, error: d.acceso.errorFaltaUrl }
  if (!accessToken) return { ok: false, error: d.acceso.errorVerificaEmail }

  let origin: URL
  try {
    origin = new URL(originUrl)
  } catch {
    return { ok: false, error: d.acceso.errorUrlInvalida }
  }
  if (!['http:', 'https:'].includes(origin.protocol)) return { ok: false, error: d.acceso.errorUrlInvalida }

  const name = nombreDesdeUrl(origin)
  // slugify corta a 40 caracteres: el corte puede dejar un guion al final.
  const slug = slugify(name).replace(/-+$/, '')
  if (!slug) return { ok: false, error: d.acceso.errorUrlInvalida }

  let privyUserId: string
  try {
    privyUserId = await verifyPrivyAccessToken(accessToken)
  } catch {
    return { ok: false, error: d.acceso.errorSesionNoVerificada }
  }

  // Un usuario puede tener varios negocios: no hay shortcut por usuario
  // existente, solo el guard de slug repetido (el mismo dominio dos veces).
  if (await store.getTenantBySlug(slug)) {
    return { ok: false, error: d.acceso.errorSitioTomado(name) }
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
