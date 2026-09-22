import type { Dict } from '@/lib/i18n/dict'
import { headJsonLd, linksHtml, robotsTxt, rutasABorrar, type Entidad, type Oferta } from '@peaje/shared'

export { primeraRutaPaga, type Oferta } from '@peaje/shared'

type Kit = Dict['kit']
/** El id ata cada bloque a su chequeo, para saber cuál falta. */
export type BloqueId = 'json-ld' | 'links' | 'robots'
export type Bloque = { id: BloqueId; titulo: string; detalle: string; contenido: string }

/**
 * Los bloques manuales del kit, con los textos de la UI. El contenido lo
 * genera `@peaje/shared` (el mismo que sirve el gateway en kit.json): acá va
 * SOLO lo que el proxy no puede servir, y la regla que costó cara aprender es
 * que una copia estática de lo que sí sirve el proxy le gana y se congela.
 */
export function construirBloques({
  d,
  tenant,
  originHost,
  ofertas,
  tieneJsonLd,
  entidad,
  sinEntrenamiento,
}: {
  d: Kit
  tenant: { name: string; slug: string }
  /** Dominio del NEGOCIO: el sitemap vive ahí, no en el gateway. */
  originHost: string
  ofertas: Oferta[]
  tieneJsonLd: boolean
  /** Datos del formulario "Tu entidad": con alguno cargado, el head lleva Organization + WebAPI. */
  entidad?: Entidad | null
  /** Toggle "bloquear bots de entrenamiento" del mismo formulario. */
  sinEntrenamiento?: boolean
}): Bloque[] {
  const jsonLd = headJsonLd({ nombre: tenant.name, slug: tenant.slug, originHost, ofertas, entidad })
  const rutasPagas = ofertas.filter((o) => o.priceUsd > 0).map((o) => rutaLocal(o.url, tenant.slug))
  return [
    {
      id: 'json-ld',
      titulo: d.bloqueJsonLd,
      detalle: tieneJsonLd ? d.bloqueJsonLdExiste : d.bloqueJsonLdFalta,
      contenido: jsonLd,
    },
    { id: 'links', titulo: d.bloqueLink, detalle: d.bloqueLinkDetalle, contenido: linksHtml() },
    {
      id: 'robots',
      titulo: d.bloqueRobots,
      detalle: d.bloqueRobotsDetalle,
      contenido: robotsTxt({ originHost, rutasPagas, sinEntrenamiento: sinEntrenamiento ?? false }),
    },
  ]
}

function rutaLocal(url: string, slug: string): string {
  try {
    const path = new URL(url).pathname
    return path.startsWith(`/${slug}/`) ? path.slice(slug.length + 1) : path
  } catch {
    return url
  }
}

/**
 * Las rutas que el proxy sirve y que alguien podría recrear a mano como
 * archivo. Sin `/llms.txt`: el gateway lee el del negocio y lo fusiona.
 */
export function rutasDelProxy(): string[] {
  return rutasABorrar()
}
