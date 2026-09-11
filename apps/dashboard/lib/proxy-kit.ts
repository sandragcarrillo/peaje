/**
 * Generador del proxy de borde: la pieza que hace que Peaje deje de ser
 * "punteros a otro origen" y pase a vivir EN el dominio del negocio.
 *
 * El problema que resuelve: los auditores de agent-readiness (Ora y los que
 * vengan) miden tu origen. Publicar un catálogo que apunta a
 * `peaje-gateway.../tu-negocio` no cuenta: en tu dominio no hay MCP, no hay
 * OpenAPI y no hay ningún endpoint que devuelva 402. Con estas reglas, sí.
 *
 * No hay código nuevo del lado del negocio: es configuración de su host.
 */

/** Rutas que el negocio reenvía a su gateway de Peaje. */
export const RUTAS_PROXY = [
  { path: '/llms.txt', nota: 'guía para agentes (fusionada con la tuya)' },
  { path: '/pricing.md', nota: 'precios por endpoint' },
  { path: '/auth.md', nota: 'cómo pagar (el "auth" acá es el pago)' },
  { path: '/agents.md', nota: 'qué es y cuándo usarte' },
  { path: '/openapi.json', nota: 'discovery con precios' },
  { path: '/mcp', nota: 'MCP server con tools pagas, en TU dominio' },
  { path: '/.well-known/mcp', nota: 'el MCP también acá: es donde lo buscan los auditores' },
  { path: '/.well-known/ard.json', nota: 'catálogo ARD (path canónico)' },
  { path: '/.well-known/ai-catalog.json', nota: 'catálogo ARD (alias legacy)' },
  { path: '/.well-known/api-catalog', nota: 'linkset RFC 9727' },
  { path: '/.well-known/agent-card.json', nota: 'agent card A2A' },
  { path: '/.well-known/mcp/server-card.json', nota: 'server card MCP' },
  { path: '/discovery/resources', nota: 'lista x402 Bazaar: lo que cobra 402 de verdad' },
  { path: '/.well-known/ucp', nota: 'perfil UCP: qué sabe hacer tu negocio' },
  { path: '/checkout_sessions', nota: 'checkout ACP (el de OpenAI)' },
  { path: '/agentic_commerce/delegate_payment', nota: 'delegate payment ACP' },
] as const

/**
 * `/llms.txt` lleva guarda: el gateway necesita poder leer el llms.txt
 * original del negocio para fusionarlo, y sin esto se llamaría a sí mismo.
 */
const HEADER_GUARDA = 'x-peaje-fetch'

export type Host = 'next' | 'vercel' | 'cloudflare' | 'nginx' | 'caddy'

/** El label lo pone la UI desde el diccionario; acá solo el archivo destino. */
export const HOSTS: { id: Host; archivo: string }[] = [
  { id: 'next', archivo: 'next.config.ts' },
  { id: 'vercel', archivo: 'vercel.json' },
  { id: 'cloudflare', archivo: 'worker.js' },
  { id: 'nginx', archivo: 'nginx.conf' },
  { id: 'caddy', archivo: 'Caddyfile' },
]

/** Comentarios del archivo generado: siguen el idioma de la UI. */
export type Comentarios = { titulo: string; sub: string; rutaPaga: string }

/**
 * Rutas con un segmento variable. Van aparte porque cada host las escribe
 * distinto: comodín en Next y Vercel, prefijo en Cloudflare, nginx y Caddy.
 * `/r/:slug` es la importante: es lo que pone un 402 real en tu dominio.
 */
export const RUTAS_DINAMICAS = [
  { path: '/r/:slug', prefijo: '/r/', nota: 'links con precio: el 402 en tu dominio' },
  { path: '/checkout_sessions/:id', prefijo: '/checkout_sessions/', nota: 'leer una sesión de checkout ACP' },
] as const

export function generarProxy(host: Host, base: string, c: Comentarios): string {
  switch (host) {
    case 'next':
      return next(base, c)
    case 'vercel':
      return vercel(base)
    case 'cloudflare':
      return cloudflare(base, c)
    case 'nginx':
      return nginx(base, c)
    case 'caddy':
      return caddy(base, c)
  }
}

function next(base: string, c: Comentarios): string {
  const regla = (path: string, guarda = '') =>
    `        {\n          source: '${path}',\n          destination: '${base}${path}'${guarda},\n        },`

  const reglas = RUTAS_PROXY.map((r) =>
    regla(
      r.path,
      r.path === '/llms.txt'
        ? `,\n          missing: [{ type: 'header', key: '${HEADER_GUARDA}' }]`
        : '',
    ),
  ).join('\n')

  const dinamicas = RUTAS_DINAMICAS.map((r) => regla(r.path)).join('\n')

  return `// ${c.titulo}
// ${c.sub}

const nextConfig = {
  async rewrites() {
    // beforeFiles, not the default: these paths may also exist as static files
    // in public/, and a static file would otherwise win and shadow the rewrite.
    return {
      beforeFiles: [
${reglas}
        // ${c.rutaPaga}
${dinamicas}
      ],
    }
  },
}

export default nextConfig`
}

function vercel(base: string): string {
  const reglas = [...RUTAS_PROXY.map((r) => r.path), ...RUTAS_DINAMICAS.map((r) => r.path)]
    .map((p) => `    { "source": "${p}", "destination": "${base}${p}" }`)
    .join(',\n')
  return `{
  "rewrites": [
${reglas}
  ]
}`
}

function cloudflare(base: string, c: Comentarios): string {
  const lista = [...RUTAS_PROXY.map((r) => r.path)].map((p) => `  '${p}',`).join('\n')
  return `// Cloudflare Worker — ${c.titulo}
// ${c.sub}

const PEAJE = '${base}'
const RUTAS = [
${lista}
]
const PREFIJOS = [${RUTAS_DINAMICAS.map((r) => `'${r.prefijo}'`).join(', ')}]

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // Guard: avoids the loop when the gateway reads your original llms.txt.
    const esFetchDePeaje = request.headers.get('${HEADER_GUARDA}') !== null
    const proxear =
      (!esFetchDePeaje && RUTAS.includes(url.pathname)) ||
      PREFIJOS.some((p) => url.pathname.startsWith(p))

    if (!proxear) return fetch(request)

    const destino = new URL(PEAJE + url.pathname + url.search)
    return fetch(new Request(destino, request))
  },
}`
}

function nginx(base: string, c: Comentarios): string {
  const bloques = RUTAS_PROXY.map(
    (r) => `    location = ${r.path} {\n        proxy_pass ${base}${r.path};\n    }`,
  ).join('\n\n')
  const prefijos = RUTAS_DINAMICAS.map(
    (r) => `    location ${r.prefijo} {\n        proxy_pass ${base}${r.prefijo};\n    }`,
  ).join('\n\n')

  return `# nginx — ${c.titulo}

server {
    # ... your current config ...

${bloques}

    # ${c.rutaPaga}
${prefijos}
}`
}

function caddy(base: string, c: Comentarios): string {
  const rutas = [
    ...RUTAS_PROXY.map((r) => r.path),
    ...RUTAS_DINAMICAS.map((r) => `${r.prefijo}*`),
  ].join(' ')
  return `# Caddyfile — ${c.titulo}

tusitio.com {
    # ... your current config ...

    reverse_proxy ${rutas} ${base} {
        header_up Host {upstream_hostport}
    }
}`
}

/** Header con el que el gateway lee el origen sin disparar el proxy. */
export const PEAJE_FETCH_HEADER = HEADER_GUARDA
