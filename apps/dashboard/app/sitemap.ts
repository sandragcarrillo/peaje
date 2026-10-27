import type { MetadataRoute } from 'next'
import { articulos } from '@/lib/blog'

/**
 * Páginas públicas de usepeaje.com para buscadores y agentes. Lo mismo que
 * robots.txt deja abierto; los paneles (/t/), el alta y las rutas internas no
 * van. /developers lo sirve el gateway en este mismo dominio.
 */
const BASE = 'https://usepeaje.com'
const PAGINAS = ['/', '/radar', '/precios', '/blog', '/mercado', '/developers', '/terms', '/privacy', '/reembolsos']
/** Último cambio real del contenido público (landing y legales nuevos). Subirla cuando cambie el copy. */
const ACTUALIZADO = '2026-10-24'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = PAGINAS.map((p) => ({
    url: p === '/' ? BASE : `${BASE}${p}`,
    lastModified: ACTUALIZADO,
    changeFrequency: p === '/' || p === '/radar' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p === '/radar' ? 0.9 : 0.6,
  }))
  // Cada artículo del blog, con su fecha de actualización real.
  const blog: MetadataRoute.Sitemap = (await articulos()).map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: a.actualizado,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
  return [...fijas, ...blog]
}
