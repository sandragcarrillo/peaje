/**
 * Los bloques que viven en el HTML o en la raíz del sitio y que ningún proxy
 * puede inyectar por vos: JSON-LD, <link> de discovery y robots.txt.
 *
 * Regla que costó cara aprender: acá va SOLO lo que el proxy no puede servir.
 * Todo lo que el gateway genera llega al dominio por el proxy. Una copia
 * estática le gana al proxy en casi todos los hosts, se congela el día que la
 * copiaste y el auditor termina leyendo un archivo viejo.
 */

export type Oferta = { titulo: string; priceUsd: number; url: string }

/**
 * `https://gw/tenant/r/x` → `/r/x`: la misma ruta, en el dominio del negocio.
 */
export function rutaDe(url: string, slug: string): string {
  try {
    const path = new URL(url).pathname
    const prefijo = `/${slug}`
    return path.startsWith(`${prefijo}/`) ? path.slice(prefijo.length) : path
  } catch {
    return url
  }
}

/** Un link con precio real, para que la verificación pruebe un 402 de verdad. */
export function primeraRutaPaga(ofertas: Oferta[], slug: string): string | null {
  const conPrecio = ofertas.find((o) => o.priceUsd > 0)
  return conPrecio ? rutaDe(conPrecio.url, slug) : null
}

/**
 * JSON dentro de un <script> no puede llevar `</script>` ni `<!--`: un título
 * de oferta con `<` rompería la página del negocio. `<` es JSON válido y
 * el navegador lo lee como `<`.
 */
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function jsonLdWebApi({
  nombre,
  slug,
  originHost,
  ofertas,
}: {
  nombre: string
  slug: string
  originHost: string
  ofertas: Oferta[]
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    '@id': `https://${originHost}/#api`,
    name: nombre,
    // URLs del dominio del negocio, no del gateway: después del proxy
    // responden acá, y es acá donde el auditor las va a buscar.
    documentation: `https://${originHost}/openapi.json`,
    termsOfService: `https://${originHost}/auth.md`,
    provider: { '@id': `https://${originHost}/#organization` },
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
      url: `https://${originHost}${rutaDe(o.url, slug)}`,
      availability: 'https://schema.org/InStock',
    })),
  }
}

/**
 * Datos de entidad del negocio, tal como los carga en el dashboard. Todo
 * opcional: el Organization se emite solo con lo que hay.
 */
export type Entidad = {
  logoUrl?: string | null
  telefono?: string | null
  /** Texto libre en una línea; va tal cual a PostalAddress.streetAddress. */
  direccion?: string | null
  sameAs?: string[] | null
  descripcion?: string | null
}

/** Hay algo que decir de la entidad más allá del nombre y la URL. */
export function tieneDatosEntidad(e: Entidad | null | undefined): boolean {
  if (!e) return false
  return Boolean(
    limpiar(e.logoUrl) || limpiar(e.telefono) || limpiar(e.direccion) || limpiar(e.descripcion) || (e.sameAs ?? []).some((u) => limpiar(u)),
  )
}

function limpiar(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/**
 * El nodo Organization: quién está detrás de la API. Los motores de respuesta
 * (ChatGPT, Perplexity, Google AI Overviews) resuelven entidades, no
 * endpoints; este nodo es el ancla que `provider` de WebAPI ya apuntaba y
 * que hasta ahora no existía. Sin `address` cuando no hay dato: un
 * PostalAddress vacío es peor que ninguno.
 */
export function jsonLdOrganization({
  nombre,
  originHost,
  logoUrl,
  telefono,
  direccion,
  sameAs,
  descripcion,
  conApi = true,
}: Entidad & { nombre: string; originHost: string; conApi?: boolean }): Record<string, unknown> {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `https://${originHost}/#organization`,
    name: nombre,
    url: `https://${originHost}/`,
  }
  const logo = limpiar(logoUrl)
  if (logo) org.logo = logo
  const tel = limpiar(telefono)
  if (tel) org.telephone = tel
  const dir = limpiar(direccion)
  if (dir) org.address = { '@type': 'PostalAddress', streetAddress: dir }
  const perfiles = (sameAs ?? []).map((u) => u.trim()).filter(Boolean)
  if (perfiles.length > 0) org.sameAs = perfiles
  const desc = limpiar(descripcion)
  if (desc) org.description = desc
  // La API es lo que la organización ofrece: cierra el grafo con WebAPI. Sin
  // capa de agentes no hay nodo #api al que apuntar, y un @id colgado es ruido.
  if (conApi) org.makesOffer = [{ '@type': 'Offer', itemOffered: { '@id': `https://${originHost}/#api` } }]
  return org
}

export function scriptJsonLd(datos: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${jsonParaScript(datos)}\n</script>`
}

/**
 * Varios nodos en UN solo <script> con `@graph`. Un script por nodo también
 * es válido, pero los `@id` cruzados (provider, itemOffered) se leen mejor
 * dentro del mismo documento, y es un bloque menos para pegar en el head.
 * El `@context` de cada nodo se quita: va una sola vez, arriba.
 */
export function scriptJsonLdGraph(datos: Record<string, unknown>[]): string {
  const nodos = datos.map(({ '@context': _ctx, ...resto }) => resto)
  return scriptJsonLd({ '@context': 'https://schema.org', '@graph': nodos })
}

/**
 * Relaciones registradas en IANA (RFC 8631) más `ard`, la del catálogo. El <a>
 * es distinto: los auditores piden documentación ENLAZADA desde la home,
 * visible, no solo metadata. Va en el footer o el nav.
 */
export function linksHtml(): string {
  return [
    `<link rel="service-desc" type="application/openapi+json" href="/openapi.json">`,
    `<link rel="service-doc" type="text/plain" href="/llms.txt">`,
    `<link rel="service-meta" type="text/markdown" href="/pricing.md">`,
    `<link rel="ard" type="application/ai-catalog+json" href="/.well-known/ard.json">`,
    '',
    `<!-- Visible link, in your footer or nav (documentation must be linked from the homepage): -->`,
    `<a href="/developers">API for agents</a>`,
  ].join('\n')
}

/** Solo los <link> del head, para el componente React del paquete npm. */
export const LINKS_HEAD = [
  { rel: 'service-desc', type: 'application/openapi+json', href: '/openapi.json' },
  { rel: 'service-doc', type: 'text/plain', href: '/llms.txt' },
  { rel: 'service-meta', type: 'text/markdown', href: '/pricing.md' },
  { rel: 'ard', type: 'application/ai-catalog+json', href: '/.well-known/ard.json' },
] as const

/**
 * Bots de los motores de respuesta. Separados por lo que hacen, no por
 * empresa: el de búsqueda cita, el de entrenamiento no. OpenAI y Perplexity
 * piden permitir el de búsqueda por nombre; bloquear el de entrenamiento no
 * afecta la citación (docs de OpenAI, Google y Apple, sept 2026).
 */
export const BOTS_BUSQUEDA = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'PerplexityBot',
  'Claude-SearchBot',
  'Applebot',
] as const

export const BOTS_ENTRENAMIENTO = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'] as const

export type OpcionesRobots = {
  originHost: string
  /** false en el kit "solo motores de respuesta": el sitio no cobra 402. */
  conPagos?: boolean
  /** Rutas que devuelven 402: no tiene sentido que un bot de búsqueda las indexe. */
  rutasPagas?: string[]
  /** Bloquear los bots de entrenamiento sin tocar los de búsqueda. */
  sinEntrenamiento?: boolean
}

export function robotsTxt({ originHost, rutasPagas = [], sinEntrenamiento = false, conPagos = true }: OpcionesRobots): string {
  const pagas = conPagos ? rutasPagas : []
  const bloqueBusqueda = BOTS_BUSQUEDA.map((b) => `User-agent: ${b}`).join('\n')
  const disallowPagas = pagas.map((p) => `Disallow: ${p}`).join('\n')
  const partes = [
    conPagos
      ? `# Agents welcome. This site charges per request over MPP (HTTP 402).`
      : `# Answer engines welcome.`,
    `# Answer engines: allowed by name so a stricter default never locks them out.`,
    `${bloqueBusqueda}\nAllow: /${disallowPagas ? `\n# Paid endpoints answer 402: nothing to index there.\n${disallowPagas}` : ''}`,
  ]
  if (sinEntrenamiento) {
    partes.push(
      `# Training crawlers: blocked. Does not affect search or citations.\n${BOTS_ENTRENAMIENTO.map((b) => `User-agent: ${b}`).join('\n')}\nDisallow: /`,
    )
  }
  partes.push(`User-agent: *\nAllow: /`)
  partes.push(`# Where the machine-readable catalogs live\nSitemap: https://${originHost}/sitemap.xml`)
  return partes.join('\n\n')
}
