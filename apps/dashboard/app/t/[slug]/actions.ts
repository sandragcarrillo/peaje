'use server'

import { isNetworkId, explorerTxUrl } from '@peaje/shared'
import { revalidatePath } from 'next/cache'
import { getWithdrawal, requestWithdrawal } from '@/lib/gateway'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { sendFromMerchantWallet } from '@/lib/walletops'

export async function crearRuta(slug: string, formData: FormData) {
  const tenant = await requireTenant(slug)
  const pathPattern = String(formData.get('pathPattern') ?? '').trim()
  const priceUsd = String(formData.get('priceUsd') ?? '').trim()
  const method = String(formData.get('method') ?? 'GET').toUpperCase()
  const description = String(formData.get('description') ?? '').trim()

  if (!pathPattern.startsWith('/')) throw new Error('La ruta tiene que empezar con /')
  const price = Number(priceUsd)
  if (!Number.isFinite(price) || price <= 0) throw new Error('El precio tiene que ser mayor a 0')

  await store.createRoute({
    tenantId: tenant.id,
    method,
    pathPattern,
    priceUsd: price.toFixed(6),
    description: description || null,
  })
  revalidatePath(`/t/${slug}`)
}

export async function borrarRuta(slug: string, routeId: string) {
  const tenant = await requireTenant(slug)
  await store.deleteRoute(tenant.id, routeId)
  revalidatePath(`/t/${slug}`)
}

export async function guardarWallet(slug: string, formData: FormData) {
  const tenant = await requireTenant(slug)
  const wallet = String(formData.get('wallet') ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) throw new Error('Esa no parece una wallet válida')
  await store.setPayoutWallet(tenant.id, wallet)
  revalidatePath(`/t/${slug}`)
}

export type RetiroEstado = {
  id: string
  status: 'pending' | 'confirmed' | 'failed'
  amount: string
  toWallet: string
  explorerUrl: string | null
}

export async function retirar(slug: string, formData: FormData): Promise<RetiroEstado> {
  await requireTenant(slug)
  const amount = String(formData.get('amount') ?? '').trim()
  const network = String(formData.get('network') ?? 'tempo').trim()
  const result = await requestWithdrawal(slug, { network, ...(amount ? { amount } : {}) })
  revalidatePath(`/t/${slug}`)
  return {
    id: result.withdrawal.id,
    status: result.withdrawal.status,
    amount: result.withdrawal.amount,
    toWallet: result.withdrawal.toWallet,
    explorerUrl: result.explorerUrl,
  }
}

export async function estadoRetiro(slug: string, id: string): Promise<RetiroEstado> {
  await requireTenant(slug)
  const result = await getWithdrawal(slug, id)
  if (result.withdrawal.status !== 'pending') revalidatePath(`/t/${slug}`)
  return {
    id: result.withdrawal.id,
    status: result.withdrawal.status,
    amount: result.withdrawal.amount,
    toWallet: result.withdrawal.toWallet,
    explorerUrl: result.explorerUrl,
  }
}

export type EnvioResultado =
  | { ok: true; tx: string; explorerUrl: string }
  | { ok: false; error: string }

/** Envía fondos desde la wallet Peaje (Privy) del merchant a una address externa. */
export async function enviarFondos(slug: string, formData: FormData): Promise<EnvioResultado> {
  const tenant = await requireTenant(slug)
  if (!tenant.payoutWallet) return { ok: false, error: 'Este negocio no tiene wallet.' }

  const to = String(formData.get('to') ?? '').trim()
  const network = String(formData.get('network') ?? '').trim()
  const amount = Number(String(formData.get('amount') ?? '').replace(',', '.').trim())

  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return { ok: false, error: 'La address de destino no es válida.' }
  if (!isNetworkId(network)) return { ok: false, error: 'Red inválida.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Monto inválido.' }
  if (to.toLowerCase() === tenant.payoutWallet.toLowerCase()) {
    return { ok: false, error: 'Ese es el destino de tu propia wallet.' }
  }

  try {
    const tx = await sendFromMerchantWallet(
      tenant.payoutWallet as `0x${string}`,
      network,
      to as `0x${string}`,
      amount.toFixed(6),
    )
    revalidatePath(`/t/${slug}/wallet`)
    return { ok: true, tx, explorerUrl: explorerTxUrl(network, tx) }
  } catch (error) {
    console.error('[wallet] fallo el envío', error)
    const msg = error instanceof Error ? error.message : ''
    return {
      ok: false,
      error: msg.includes('custodia')
        ? msg
        : 'No se pudo enviar. Revisa el saldo (el gas sale del mismo token) y reintenta.',
    }
  }
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

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('La URL no es válida. Incluye https://')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Solo http(s)')
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error('Precio inválido (0 = gratis)')

  await store.createResources([
    {
      tenantId: tenant.id,
      slug: slugDeUrl(url),
      url: url.toString(),
      title: title || null,
      priceUsd: priceUsd.toFixed(6),
    },
  ])
  revalidatePath(`/t/${slug}`)
}

export async function borrarLink(slug: string, resourceId: string) {
  const tenant = await requireTenant(slug)
  await store.deleteResource(tenant.id, resourceId)
  revalidatePath(`/t/${slug}`)
}

export type UrlImportable = { url: string; slug: string }

/**
 * Lee el sitemap del sitio y devuelve las URLs importables.
 * Acepta la URL del sitemap directo o el dominio (prueba /sitemap.xml).
 */
export async function leerSitemap(slug: string, rawUrl: string): Promise<UrlImportable[]> {
  await requireTenant(slug)
  let target: URL
  try {
    target = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
  } catch {
    throw new Error('URL inválida')
  }
  if (!target.pathname.endsWith('.xml')) target = new URL('/sitemap.xml', target.origin)

  const res = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`No pude leer ${target} (${res.status})`)
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
  if (items.length === 0) throw new Error('El sitemap no tiene URLs legibles')
  return items
}

export async function importarLinks(
  slug: string,
  items: { url: string; slug: string }[],
  priceUsd: number,
) {
  const tenant = await requireTenant(slug)
  if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error('Precio inválido (0 = gratis)')
  const created = await store.createResources(
    items.slice(0, 100).map((i) => ({
      tenantId: tenant.id,
      slug: i.slug,
      url: i.url,
      title: null,
      priceUsd: priceUsd.toFixed(6),
    })),
  )
  revalidatePath(`/t/${slug}`)
  return created.length
}
