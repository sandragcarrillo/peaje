import type { MetadataRoute } from 'next'
import { articulos } from '@/lib/blog'
import { comparativas, RUTA } from '@/lib/comparar'
import { paginasPara, RUTA as RUTA_PARA } from '@/lib/para'

/**
 * Páginas públicas de usepeaje.com para buscadores y agentes. Lo mismo que
 * robots.txt deja abierto; los paneles (/t/), el alta y las rutas internas no
 * van. /developers lo sirve el gateway en este mismo dominio.
 */
const BASE = 'https://usepeaje.com'
// /mercado se retiró del sitio (redirige a /radar).
const PAGINAS = ['/', '/radar', '/precios', '/blog', '/developers', '/terms', '/privacy', '/reembolsos']
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
  // Preguntas frecuentes (una URL por idioma) y la página humana del MCP.
  const ayuda: MetadataRoute.Sitemap = ['/preguntas', '/faq', '/docs/mcp', '/demo'].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: '2026-11-22',
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  // Comparativas: el índice y cada página, en los dos idiomas, con su fecha de revisión.
  const comparar: MetadataRoute.Sitemap = (
    await Promise.all(
      (['es', 'en'] as const).map(async (idioma) => [
        { url: `${BASE}${RUTA[idioma]}`, lastModified: '2026-11-22', changeFrequency: 'monthly' as const, priority: 0.7 },
        ...(await comparativas(idioma)).map((c) => ({
          url: `${BASE}${RUTA[idioma]}/${c.slug}`,
          lastModified: c.revisado || c.fecha,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
      ]),
    )
  ).flat()
  // Páginas por tipo de negocio: el índice y cada página, en los dos idiomas.
  const para: MetadataRoute.Sitemap = (
    await Promise.all(
      (['es', 'en'] as const).map(async (idioma) => [
        { url: `${BASE}${RUTA_PARA[idioma]}`, lastModified: '2026-11-22', changeFrequency: 'monthly' as const, priority: 0.7 },
        ...(await paginasPara(idioma)).map((pg) => ({
          url: `${BASE}${RUTA_PARA[idioma]}/${pg.slug}`,
          lastModified: '2026-11-22',
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
      ]),
    )
  ).flat()
  return [...fijas, ...ayuda, ...comparar, ...para, ...blog]
}
