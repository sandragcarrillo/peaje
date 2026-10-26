'use server'

import { revalidatePath } from 'next/cache'
import { getDict } from '@/lib/i18n'
import { avisarIndexNow } from '@/lib/indexnow'
import { validarDireccionDelNegocio } from '@/lib/direccion-propia-server'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

export async function crearRuta(slug: string, formData: FormData) {
  const tenant = await requireTenant(slug)
  const pathPattern = String(formData.get('pathPattern') ?? '').trim()
  const priceUsd = String(formData.get('priceUsd') ?? '').replace(',', '.').trim()
  const method = String(formData.get('method') ?? 'GET').toUpperCase()
  const description = String(formData.get('description') ?? '').trim().slice(0, 300)

  const d = await getDict()
  if (!pathPattern.startsWith('/')) throw new Error(d.panel.errorRutaSlash)
  if (pathPattern.length > 200 || /\s/.test(pathPattern) || pathPattern.includes('..')) throw new Error(d.panel.rutasApiErrorPath)
  const price = Number(priceUsd)
  if (!Number.isFinite(price) || price <= 0) throw new Error(d.panel.errorPrecioMayorCero)
  const existentes = await store.listRoutes(tenant.id)
  if (existentes.some((r) => r.method === method && r.pathPattern === pathPattern)) throw new Error(d.panel.rutasApiErrorDuplicada)

  await store.createRoute({
    tenantId: tenant.id,
    method,
    pathPattern,
    priceUsd: price.toFixed(6),
    description: description || null,
  })
  // Cambió la tabla de precios: que Bing recrawlee /developers y /pricing.md.
  avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
}

export async function editarRuta(slug: string, routeId: string, formData: FormData) {
  const tenant = await requireTenant(slug)
  const d = await getDict()
  const priceUsd = String(formData.get('priceUsd') ?? '').replace(',', '.').trim()
  const price = Number(priceUsd)
  if (!Number.isFinite(price) || price <= 0) throw new Error(d.panel.errorPrecioMayorCero)
  const description = String(formData.get('description') ?? '').trim().slice(0, 300)
  await store.updateRoute(tenant.id, routeId, { priceUsd: price.toFixed(6), description: description || null })
  avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
}

export async function borrarRuta(slug: string, routeId: string) {
  const tenant = await requireTenant(slug)
  await store.deleteRoute(tenant.id, routeId)
  avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
}

export type GuardarWalletResultado = { ok: true; address: string } | { ok: false; error: string }

/**
 * "Usar mi propia dirección": el dueño pone una address suya para cobrar.
 * Se valida checksum, que no sea la treasury, ni un contrato en las redes
 * donde cobramos, ni la wallet de un agente u otra cuenta de Peaje (ver
 * lib/direccion-propia.ts). Con `wallet` vacío vuelve a su wallet de Privy.
 */
export async function guardarWallet(slug: string, formData: FormData): Promise<GuardarWalletResultado> {
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const textos = d.walletPropia.errores
  const raw = String(formData.get('wallet') ?? '').trim()
  const delDueno = { id: tenant.ownerWalletId, address: tenant.ownerWallet }

  if (!raw) {
    if (!tenant.ownerWallet) return { ok: false, error: textos.sinWalletPropia }
    await store.setTenantWallets(tenant.id, { payoutWallet: tenant.ownerWallet })
    revalidatePath(`/t/${slug}`, 'layout')
    revalidatePath('/wallet')
    return { ok: true, address: tenant.ownerWallet }
  }

  try {
    const r = await validarDireccionDelNegocio(raw, delDueno)
    if (!r.ok) return { ok: false, error: textos[r.motivo] }
    await store.setTenantWallets(tenant.id, { payoutWallet: r.address })
    revalidatePath(`/t/${slug}`, 'layout')
    revalidatePath('/wallet')
    return { ok: true, address: r.address }
  } catch (error) {
    console.error('[wallet] no se pudo guardar la dirección propia', error)
    return { ok: false, error: textos.generico }
  }
}

export type ResumenWallet = {
  address: string
  balances: { network: string; symbol: string; amount: string }[]
}

/**
 * Datos del popover de wallet del navbar: saldos live de la wallet del dueño.
 * Sin retiros ni envíos: los pagos llegan directo a la dirección de cobro.
 */
export async function resumenWallet(slug: string): Promise<ResumenWallet | null> {
  const tenant = await requireTenant(slug)
  // La del dueño si ya migró; la custodiada si es un negocio de antes.
  const address = tenant.ownerWallet ?? tenant.custodialWallet
  if (!address) return null
  const { walletBalances } = await import('@/lib/walletops')
  return { address, balances: await walletBalances(address as `0x${string}`) }
}

// ---- links con precio ----

function slugDeUrl(url: URL): string {
  const path = url.pathname.replace(/\/$/, '')
  const partes = path.split('/').filter(Boolean)
  const cola = partes.slice(-2).join('-') || url.hostname.replace(/\./g, '-')
  return cola
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function crearLink(slug: string, formData: FormData) {
  const tenant = await requireTenant(slug)
  const rawUrl = String(formData.get('url') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const rawPrecio = String(formData.get('priceUsd') ?? '').replace(',', '.').trim()
  const priceUsd = rawPrecio === '' ? 0 : Number(rawPrecio)
  const d = await getDict()

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(d.panel.errorUrlInvalida)
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(d.panel.errorSoloHttp)
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error(d.panel.errorPrecioInvalido)

  await store.createResources([
    {
      tenantId: tenant.id,
      slug: slugDeUrl(url),
      url: url.toString(),
      title: title || null,
      priceUsd: priceUsd.toFixed(6),
    },
  ])
  avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
}

export async function borrarLink(slug: string, resourceId: string) {
  const tenant = await requireTenant(slug)
  await store.deleteResource(tenant.id, resourceId)
  avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
}

export type UrlImportable = { url: string; slug: string }

/**
 * Lee el sitemap del sitio y devuelve las URLs importables.
 * Acepta la URL del sitemap directo o el dominio (prueba /sitemap.xml).
 */
export async function leerSitemap(slug: string, rawUrl: string): Promise<UrlImportable[]> {
  await requireTenant(slug)
  const d = await getDict()
  let target: URL
  try {
    target = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
  } catch {
    throw new Error(d.panel.errorUrlSitemapInvalida)
  }
  if (!target.pathname.endsWith('.xml')) target = new URL('/sitemap.xml', target.origin)

  const res = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(d.panel.errorSitemapIlegible(String(target), res.status))
  const xml = await res.text()

  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]!)
  // Si es un índice de sitemaps, bajamos un nivel (solo el primero, alcanza para el MVP).
  if (xml.includes('<sitemapindex') && locs[0]) {
    const inner = await fetch(locs[0], { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (inner.ok) {
      const innerXml = await inner.text()
      locs.length = 0
      locs.push(...[...innerXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]!))
    }
  }

  const vistos = new Set<string>()
  const items: UrlImportable[] = []
  for (const loc of locs.slice(0, 100)) {
    try {
      const u = new URL(loc)
      const s = slugDeUrl(u)
      if (vistos.has(s)) continue
      vistos.add(s)
      items.push({ url: u.toString(), slug: s })
    } catch {
      // loc inválido: se ignora
    }
  }
  if (items.length === 0) throw new Error(d.panel.errorSitemapVacio)
  return items
}

export async function importarLinks(
  slug: string,
  items: { url: string; slug: string }[],
  priceUsd: number,
) {
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error(d.panel.errorPrecioInvalido)
  const created = await store.createResources(
    items.slice(0, 100).map((i) => ({
      tenantId: tenant.id,
      slug: i.slug,
      url: i.url,
      title: null,
      priceUsd: priceUsd.toFixed(6),
    })),
  )
  if (created.length > 0) avisarIndexNow(tenant)
  revalidatePath(`/t/${slug}`)
  return created.length
}
