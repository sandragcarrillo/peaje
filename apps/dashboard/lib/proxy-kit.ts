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
  { path: '/.well-known/ard.json', nota: 'catálogo ARD (path canónico)' },
  { path: '/.well-known/ai-catalog.json', nota: 'catálogo ARD (alias legacy)' },
  { path: '/.well-known/api-catalog', nota: 'linkset RFC 9727' },
  { path: '/.well-known/agent-card.json', nota: 'agent card A2A' },
  { path: '/.well-known/mcp/server-card.json', nota: 'server card MCP' },
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

/** El comodín de links con precio: es lo que pone un 402 real en tu dominio. */
const RUTA_PAGA = '/r/:slug'

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
  const reglas = RUTAS_PROXY.map((r) => {
    const guarda =
      r.path === '/llms.txt'
        ? `,\n        missing: [{ type: 'header', key: '${HEADER_GUARDA}' }]`
        : ''
    return `      {\n        source: '${r.path}',\n        destination: '${base}${r.path}'${guarda},\n      },`
  }).join('\n')

  return `// ${c.titulo}
// ${c.sub}

const nextConfig = {
  async rewrites() {
    return [
${reglas}
      // ${c.rutaPaga}
      {
        source: '${RUTA_PAGA}',
        destination: '${base}${RUTA_PAGA}',
      },
    ]
  },
}

export default nextConfig`
}

function vercel(base: string): string {
  const reglas = [...RUTAS_PROXY.map((r) => r.path), RUTA_PAGA]
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // Guard: avoids the loop when the gateway reads your original llms.txt.
    const esFetchDePeaje = request.headers.get('${HEADER_GUARDA}') !== null
    const proxear =
      (!esFetchDePeaje && RUTAS.includes(url.pathname)) || url.pathname.startsWith('/r/')

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
  return `# nginx — ${c.titulo}

server {
    # ... your current config ...

${bloques}

    # ${c.rutaPaga}
    location /r/ {
        proxy_pass ${base}/r/;
    }
}`
}

function caddy(base: string, c: Comentarios): string {
  const rutas = RUTAS_PROXY.map((r) => r.path).join(' ')
  return `# Caddyfile — ${c.titulo}

tusitio.com {
    # ... your current config ...

    reverse_proxy ${rutas} /r/* ${base} {
        header_up Host {upstream_hostport}
    }
}`
}

/** Header con el que el gateway lee el origen sin disparar el proxy. */
export const PEAJE_FETCH_HEADER = HEADER_GUARDA
