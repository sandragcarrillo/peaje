/**
 * Rutas del proxy de borde y sus generadores por host.
 *
 * La pieza que hace que Peaje deje de ser "punteros a otro origen" y pase a
 * vivir EN el dominio del negocio: los auditores de agent-readiness miden tu
 * origen, y un catálogo que apunta a `peaje-gateway.../tu-negocio` no cuenta.
 *
 * Vive en shared porque la consumen tres cosas: el dashboard (UI del kit), el
 * gateway (endpoint `/:slug/kit.json`) y el paquete npm del cliente. Antes
 * estaba solo en el dashboard y ya divergía de las rutas reales del gateway.
 */

/** Rutas fijas que el negocio reenvía a su gateway de Peaje. */
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
  { path: '/developers', nota: 'portal de desarrolladores, renderizado con tus precios' },
  { path: '/.well-known/peaje-indexnow.txt', nota: 'clave IndexNow: avisa a Bing y Copilot cuando cambian precios' },
  // Los auditores prueban /docs y /developers; el gateway redirige uno al otro.
  { path: '/docs', nota: 'alias del portal: los auditores prueban ambos' },
] as const

/**
 * Rutas con un segmento variable. Van aparte porque cada host las escribe
 * distinto: comodín en Next y Vercel, prefijo en Cloudflare, nginx y Caddy.
 * `/r/:slug` es la importante: es lo que pone un 402 real en tu dominio.
 *
 * `/agents/:id/card.json` (A2A por agente) queda fuera a propósito: su
 * prefijo `/agents/` es demasiado ancho para un sitio real y la card se
 * enlaza con URL absoluta al gateway, así que funciona igual sin proxy.
 */
export const RUTAS_DINAMICAS = [
  { path: '/r/:slug', prefijo: '/r/', nota: 'links con precio: el 402 en tu dominio' },
  { path: '/checkout_sessions/:id', prefijo: '/checkout_sessions/', nota: 'leer una sesión de checkout ACP' },
] as const

/**
 * `/llms.txt` lleva guarda: el gateway lee el llms.txt original del negocio
 * para fusionarlo, y sin la guarda el proxy lo devolvería al gateway en bucle.
 * El gateway también corta el bucle del lado suyo (si la request ya trae este
 * header no vuelve a leer el origen), pero la guarda en el proxy evita el
 * viaje. Antes solo la emitían Next y Cloudflare.
 */
export const PEAJE_FETCH_HEADER = 'x-peaje-fetch'

/** Paths que el proxy sirve y que alguien podría recrear a mano como archivo. */
export function rutasDelProxy(): string[] {
  return RUTAS_PROXY.map((r) => r.path)
}

/**
 * Paths que, si existen como copia estática, hay que borrar. `/llms.txt` no
 * está: el gateway lee el del negocio y lo fusiona, así que la copia propia
 * es deseable. El prompt viejo lo listaba para borrar y dos líneas después
 * pedía no tocarlo.
 */
export function rutasABorrar(): string[] {
  return rutasDelProxy().filter((p) => p !== '/llms.txt')
}

export type Host = 'next' | 'vercel' | 'cloudflare' | 'nginx' | 'caddy'

export const HOST_IDS: Host[] = ['next', 'vercel', 'cloudflare', 'nginx', 'caddy']

/** El label lo pone la UI desde el diccionario; acá solo el archivo destino. */
export const HOSTS: { id: Host; archivo: string }[] = [
  { id: 'next', archivo: 'next.config.ts' },
  { id: 'vercel', archivo: 'vercel.json' },
  { id: 'cloudflare', archivo: 'worker.js' },
  { id: 'nginx', archivo: 'nginx.conf' },
  { id: 'caddy', archivo: 'Caddyfile' },
]

export function esHost(x: unknown): x is Host {
  return typeof x === 'string' && (HOST_IDS as string[]).includes(x)
}

/** Comentarios del archivo generado: siguen el idioma de la UI. */
export type Comentarios = { titulo: string; sub: string; rutaPaga: string }

export const COMENTARIOS_EN: Comentarios = {
  titulo: 'Peaje: your site now speaks MPP, MCP and OpenAPI on your own domain.',
  sub: 'These routes are served from your gateway without touching your code.',
  rutaPaga: 'Priced links: this is where your domain returns the 402.',
}

export function generarProxy(host: Host, base: string, c: Comentarios = COMENTARIOS_EN): string {
  switch (host) {
    case 'next':
      return next(base, c)
    case 'vercel':
      return vercel(base, c)
    case 'cloudflare':
      return cloudflare(base, c)
    case 'nginx':
      return nginx(base, c)
    case 'caddy':
      return caddy(base, c)
  }
}

/**
 * Solo las reglas de Next, como array, sin el `nextConfig` envolvente. Es lo
 * que exporta `@peaje/next` y lo que un agente puede mezclar en un
 * `rewrites()` existente sin reescribir el archivo.
 */
export function reglasNext(base: string): { source: string; destination: string; missing?: { type: 'header'; key: string }[] }[] {
  return [
    ...RUTAS_PROXY.map((r) => ({
      source: r.path,
      destination: `${base}${r.path}`,
      ...(r.path === '/llms.txt' ? { missing: [{ type: 'header' as const, key: PEAJE_FETCH_HEADER }] } : {}),
    })),
    ...RUTAS_DINAMICAS.map((r) => ({ source: r.path, destination: `${base}${r.path}` })),
  ]
}

function next(base: string, c: Comentarios): string {
  const regla = (path: string, guarda = '') =>
    `        {\n          source: '${path}',\n          destination: '${base}${path}'${guarda},\n        },`
  const reglas = RUTAS_PROXY.map((r) =>
    regla(
      r.path,
      r.path === '/llms.txt'
        ? `,\n          missing: [{ type: 'header', key: '${PEAJE_FETCH_HEADER}' }]`
        : '',
    ),
  ).join('\n')
  const dinamicas = RUTAS_DINAMICAS.map((r) => regla(r.path)).join('\n')
  return `// ${c.titulo}
// ${c.sub}
const nextConfig = {
  async rewrites() {
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

function vercel(base: string, _c: Comentarios): string {
  const reglas = [
    ...RUTAS_PROXY.map((r) =>
      r.path === '/llms.txt'
        ? `    { "source": "${r.path}", "destination": "${base}${r.path}", "missing": [{ "type": "header", "key": "${PEAJE_FETCH_HEADER}" }] }`
        : `    { "source": "${r.path}", "destination": "${base}${r.path}" }`,
    ),
    ...RUTAS_DINAMICAS.map((r) => `    { "source": "${r.path}", "destination": "${base}${r.path}" }`),
  ].join(',\n')
  return `{
  "rewrites": [
${reglas}
  ]
}`
}

/** Manifiesto de rutas que el gateway sirve en `/:slug/kit/manifest.json`. */
export type ManifiestoProxy = { version: string; base: string; rutas: string[]; prefijos: string[] }

export function manifiestoProxy(base: string, version: string): ManifiestoProxy {
  return {
    version,
    base,
    rutas: RUTAS_PROXY.map((r) => r.path),
    prefijos: RUTAS_DINAMICAS.map((r) => r.prefijo),
  }
}

/**
 * El Worker lee la lista de rutas del manifiesto del gateway y la cachea en
 * el edge: cuando Peaje agrega una ruta, el sitio la reenvía en minutos sin
 * que nadie redespliegue nada. La lista embebida es el respaldo si el
 * manifiesto no responde. Es el único host donde esto es posible: Next,
 * Vercel, nginx y Caddy fijan las reglas en tiempo de build o de reload.
 */
function cloudflare(base: string, c: Comentarios): string {
  const lista = RUTAS_PROXY.map((r) => `  '${r.path}',`).join('\n')
  return `// Cloudflare Worker — ${c.titulo}
// ${c.sub}
const PEAJE = '${base}'
const MANIFIESTO = PEAJE + '/kit/manifest.json'
const MANIFIESTO_TTL_S = 300

// Fallback list, used only while the manifest cannot be fetched.
const RUTAS = [
${lista}
]
// ${c.rutaPaga}
const PREFIJOS = [${RUTAS_DINAMICAS.map((r) => `'${r.prefijo}'`).join(', ')}]

let cache = { at: 0, rutas: RUTAS, prefijos: PREFIJOS }

async function listas(ctx) {
  const ahora = Date.now()
  if (ahora - cache.at < MANIFIESTO_TTL_S * 1000) return cache
  const refresco = fetch(MANIFIESTO, { cf: { cacheTtl: MANIFIESTO_TTL_S, cacheEverything: true } })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (m && Array.isArray(m.rutas) && Array.isArray(m.prefijos)) {
        cache = { at: Date.now(), rutas: m.rutas, prefijos: m.prefijos }
      } else {
        cache = { ...cache, at: Date.now() }
      }
    })
    .catch(() => {
      cache = { ...cache, at: Date.now() }
    })
  // First request after a cold start waits; the rest refresh in the background.
  if (cache.at === 0) await refresco
  else ctx.waitUntil(refresco)
  return cache
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const { rutas, prefijos } = await listas(ctx)
    const esFetchDePeaje = request.headers.get('${PEAJE_FETCH_HEADER}') !== null
    const proxear =
      (!esFetchDePeaje && rutas.includes(url.pathname)) ||
      prefijos.some((p) => url.pathname.startsWith(p))
    if (!proxear) return fetch(request)
    const destino = new URL(PEAJE + url.pathname + url.search)
    const headers = new Headers(request.headers)
    // The gateway rebuilds the 402 challenge URL from these: without them the
    // challenge names the gateway host and strict x402 clients abort.
    headers.set('x-forwarded-host', url.host)
    headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
    return fetch(new Request(destino, { method: request.method, headers, body: request.body, redirect: 'manual' }))
  },
}`
}

function nginx(base: string, c: Comentarios): string {
  const comunes = `        proxy_ssl_server_name on;
        proxy_set_header Host ${new URL(base).host};
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;`
  // Sin guarda condicional para /llms.txt: en nginx un `if` dentro de
  // `location` con proxy_pass es terreno minado. El gateway corta el bucle
  // solo (si la request ya trae x-peaje-fetch no vuelve a leer el origen);
  // lo que se pierde es la fusión con tu llms.txt propio.
  const bloques = RUTAS_PROXY.map(
    (r) => `    location = ${r.path} {
        proxy_pass ${base}${r.path};
${comunes}
    }`,
  ).join('\n\n')
  const prefijos = RUTAS_DINAMICAS.map(
    (r) => `    location ${r.prefijo} {
        proxy_pass ${base}${r.prefijo};
${comunes}
    }`,
  ).join('\n\n')
  return `# nginx — ${c.titulo}
# ${c.sub}
server {
    # ... your current config ...

${bloques}

    # ${c.rutaPaga}
${prefijos}
}`
}

function caddy(base: string, c: Comentarios): string {
  const fijas = RUTAS_PROXY.filter((r) => r.path !== '/llms.txt').map((r) => r.path)
  const rutas = [...fijas, ...RUTAS_DINAMICAS.map((r) => `${r.prefijo}*`)].join(' ')
  const upstream = new URL(base).host
  return `# Caddyfile — ${c.titulo}
# ${c.sub}
yoursite.com {
    # ... your current config ...

    # ${c.rutaPaga}
    @peaje {
        path ${rutas}
    }
    # Guard: when the gateway itself reads your llms.txt, serve your own file.
    @peajeLlms {
        path /llms.txt
        header !${PEAJE_FETCH_HEADER}
    }
    reverse_proxy @peaje https://${upstream} {
        header_up Host {upstream_hostport}
        header_up X-Forwarded-Host {host}
    }
    reverse_proxy @peajeLlms https://${upstream} {
        header_up Host {upstream_hostport}
        header_up X-Forwarded-Host {host}
    }
}`
}
