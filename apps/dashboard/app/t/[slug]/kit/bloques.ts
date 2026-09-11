import type { Dict } from '@/lib/i18n/dict'
import { RUTAS_PROXY } from '@/lib/proxy-kit'

type Kit = Dict['kit']
export type Bloque = { titulo: string; detalle: string; contenido: string }
export type Oferta = { titulo: string; priceUsd: number; url: string }

/**
 * Los bloques manuales del kit.
 *
 * Regla que costó cara aprender: acá va SOLO lo que el proxy no puede servir.
 * Todo lo que el gateway genera (llms.txt, pricing.md, auth.md, los catálogos)
 * llega al dominio por el proxy del paso 1. Si además le pedimos al usuario que
 * guarde una copia estática, esa copia gana sobre el proxy en casi todos los
 * hosts, queda congelada el día que la copió, y el auditor termina leyendo un
 * archivo viejo. Pasó: un ai-catalog.json estático con el esquema 0.91 tapó el
 * 1.0 que servía el gateway y el chequeo dio inválido.
 *
 * Lo que queda son las tres cosas que viven en el HTML o en la raíz del sitio y
 * que ningún proxy puede inyectar por vos.
 */
export function construirBloques({
  d,
  tenant,
  base,
  originHost,
  ofertas,
  tieneJsonLd,
}: {
  d: Kit
  tenant: { name: string; slug: string }
  base: string
  /** Dominio del NEGOCIO: el sitemap vive ahí, no en el gateway. */
  originHost: string
  ofertas: Oferta[]
  tieneJsonLd: boolean
}): Bloque[] {
  const jsonLd = `<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: tenant.name,
    // Las URLs son del dominio del negocio, no del gateway: después del paso 1
    // responden acá, y es acá donde el auditor las va a buscar.
    documentation: `https://${originHost}/openapi.json`,
    termsOfService: `https://${originHost}/auth.md`,
    potentialAction: {
      '@type': 'ConsumeAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `https://${originHost}/mcp`,
        actionPlatform: 'MCP',
      },
    },
    offers: ofertas.map((o) => ({
      '@type': 'Offer',
      name: o.titulo,
      price: o.priceUsd,
      priceCurrency: 'USD',
      url: `https://${originHost}${rutaDe(o.url)}`,
      availability: 'https://schema.org/InStock',
    })),
  },
  null,
  2,
)}
</script>`

  // Relaciones registradas en IANA (RFC 8631) más `ard`, la del catálogo.
  const links = [
    `<link rel="service-desc" type="application/openapi+json" href="/openapi.json">`,
    `<link rel="service-doc" type="text/plain" href="/llms.txt">`,
    `<link rel="service-meta" type="text/markdown" href="/pricing.md">`,
    `<link rel="ard" type="application/ai-catalog+json" href="/.well-known/ard.json">`,
  ].join('\n')

  const robots = `# Agents welcome. This site charges per request over MPP (HTTP 402).
User-agent: *
Allow: /

# Where the machine-readable catalogs live
Sitemap: https://${originHost}/sitemap.xml`

  return [
    {
      titulo: d.bloqueJsonLd,
      detalle: tieneJsonLd ? d.bloqueJsonLdExiste : d.bloqueJsonLdFalta,
      contenido: jsonLd,
    },
    { titulo: d.bloqueLink, detalle: d.bloqueLinkDetalle, contenido: links },
    { titulo: d.bloqueRobots, detalle: d.bloqueRobotsDetalle, contenido: robots },
  ]
}

/** `https://gw/tenant/r/x` → `/r/x`: la misma ruta, en el dominio del negocio. */
function rutaDe(url: string): string {
  const i = url.indexOf('/r/')
  return i === -1 ? url : url.slice(i)
}

/**
 * Las rutas que el proxy ya sirve y que alguien podría recrear a mano como
 * archivo. Las dinámicas quedan afuera: nadie escribe `/r/:slug` en public/,
 * y nombrarlas solo agrega ruido a una lista que ya es larga.
 */
export function rutasDelProxy(): string[] {
  return RUTAS_PROXY.map((r) => r.path)
}

/** Un link con precio real, para que la verificación pruebe un 402 de verdad. */
export function primeraRutaPaga(ofertas: Oferta[]): string | null {
  const conPrecio = ofertas.find((o) => o.priceUsd > 0)
  return conPrecio ? rutaDe(conPrecio.url) : null
}
