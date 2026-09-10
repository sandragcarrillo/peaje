import type { Route, Tenant } from '@peaje/db'
import { NETWORKS, NETWORK_IDS } from '@peaje/shared'

/**
 * Archivos de agent-readiness servidos por tenant. Cada uno mapea a un check
 * del auditor de Ora (id en el comentario). El tenant no configura nada:
 * todo se genera de la DB.
 *
 * El CONTENIDO va en inglés a propósito: lo consumen agentes de IA y
 * herramientas de terceros, donde el inglés es la lingua franca. La UI del
 * dashboard sí es bilingüe.
 */

type Ctx = { tenant: Tenant; routes: Route[]; base: string }

/** "pathUSD on Tempo or USDC on Arc" — para prosa de discovery. */
const RAILS = NETWORK_IDS.map((id) => `${NETWORKS[id].tokenSymbol} on ${NETWORKS[id].label}`).join(' or ')

/**
 * Header con el que leemos el origen sin que el proxy del negocio nos
 * reenvíe de vuelta a nosotros. Ver lib/proxy-kit.ts en el dashboard.
 */
export const PEAJE_FETCH_HEADER = 'x-peaje-fetch'

/**
 * llms.txt del negocio, si ya tenía uno propio. Devuelve null si no hay, si
 * es el nuestro (evita duplicar al re-proxear) o si el origen no responde.
 */
export async function llmsDelOrigen(originUrl: string): Promise<string | null> {
  try {
    const url = new URL('/llms.txt', originUrl)
    const res = await fetch(url, {
      headers: { [PEAJE_FETCH_HEADER]: '1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) return null
    const texto = (await res.text()).trim()
    if (!texto || texto.length > 100_000) return null
    // Si ya es el nuestro, no lo fusionamos con sí mismo.
    if (texto.includes('## Payments for agents')) return null
    return texto
  } catch {
    return null
  }
}

/**
 * La sección de pagos que Peaje agrega. Se emite sola o pegada al llms.txt
 * que el negocio ya tenía: reemplazar el suyo perdía su contenido y hacía
 * fallar el check de "cuándo usarme".
 */
export function seccionPagos({ tenant, routes, base }: Ctx): string {
  return [
    '## Payments for agents',
    '',
    `> ${tenant.name} charges per request via MPP (HTTP 402). No API keys, no signup: the agent gets a 402, pays in stablecoin (${RAILS}) and receives the resource.`,
    '',
    '### When to use this',
    '',
    `Reach for ${tenant.name} when you need its data or content programmatically and only want to pay for what you consume. There is no plan to sign up for and no key to rotate: the payment is the credential.`,
    '',
    '### Priced routes',
    '',
    ...routes.map(
      (r) =>
        `- ${r.method} ${r.pathPattern} — ${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Free'} · ${r.description ?? ''}`,
    ),
    '',
    '### Where to look',
    '',
    `- [OpenAPI discovery with prices](${base}/openapi.json)`,
    `- [Pricing](${base}/pricing.md)`,
    `- [How to pay](${base}/auth.md)`,
    `- [MCP with paid tools](${base}/mcp)`,
    '',
    'Reference client: `npx mppx@latest <url>` (creates a wallet, pays and retries on its own).',
  ].join('\n')
}

/** llms.txt (llms-txt-exists, llms-txt-formatting, agent-instruction) */
export function llmsTxt({ tenant, routes, base }: Ctx): string {
  return [
    `# ${tenant.name}`,
    '',
    `> Pay-per-request API for agents (MPP over HTTP 402). No API keys, no signup: the agent gets a 402, pays in stablecoin (${RAILS}) and receives the resource. Use it when you need ${tenant.name} programmatically and only want to pay for what you consume.`,
    '',
    '## Resources',
    '',
    `- [OpenAPI discovery with prices](${base}/openapi.json): routes, offers and amounts`,
    `- [Pricing](${base}/pricing.md): plain table per endpoint`,
    `- [How to authenticate and pay](${base}/auth.md): walkthrough for agents`,
    `- [Agent guide](${base}/agents.md): what this is and when to use it`,
    `- [MCP with paid tools](${base}/mcp): same catalog over JSON-RPC`,
    '',
    '## Priced routes',
    '',
    ...routes.map(
      (r) =>
        `- ${r.method} ${r.pathPattern} — ${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Free'} · ${r.description ?? ''}`,
    ),
    '',
    'Reference client: `npx mppx@latest <url>` (creates a wallet, pays and retries on its own).',
  ].join('\n')
}

/** pricing.md (pricing-md, pricing-info) */
export function pricingMd({ tenant, routes, base }: Ctx): string {
  return [
    `# ${tenant.name} pricing`,
    '',
    `Pay per request via MPP (HTTP 402). No subscription, no API key, no minimums. Payable in ${RAILS}: the challenge carries one offer per network and the agent picks.`,
    '',
    '| Endpoint | Price |',
    '|---|---|',
    ...routes.map(
      (r) => `| ${r.method} ${r.pathPattern} | ${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Free'} |`,
    ),
    '',
    `Gateway: ${base} · Discovery: ${base}/openapi.json · MCP: ${base}/mcp`,
  ].join('\n')
}

/** auth.md (auth-md-exists, auth-md-structure) — el "auth" acá es el pago. */
export function authMd({ tenant, base }: Ctx): string {
  return [
    `# ${tenant.name} authentication`,
    '',
    'This API uses no API keys and no OAuth. Access is bought per request with MPP',
    '(Machine Payments Protocol, HTTP 402). The credential IS the payment.',
    '',
    '## How to get access (walkthrough)',
    '',
    '1. Make the request with no credentials:',
    '```bash',
    `curl -i ${base}/<route>`,
    '```',
    '2. You get `402 Payment Required` with a `WWW-Authenticate: Payment` header carrying the Challenge (amount, token, recipient, chain). It includes one offer per supported network: pick the one your wallet can pay.',
    '3. Pay the Challenge and retry with the `Authorization: Payment <credential>` header.',
    '4. You get the resource plus a `Payment-Receipt` header as proof.',
    '',
    '## Payment networks',
    '',
    ...NETWORK_IDS.map((id) => {
      const n = NETWORKS[id]
      return `- **${n.label}** (testnet): ${n.tokenSymbol} · chainId ${n.testnet.chainId} · token \`${n.token}\``
    }),
    '',
    '## The easy way',
    '',
    '```bash',
    '# the mppx client does all four steps for you (testnet wallet included)',
    `npx mppx@latest ${base}/<route>`,
    '```',
    '',
    '## Errors',
    '',
    '- `402` with no credential: not an error, it is the price. Always includes a fresh Challenge.',
    '- Invalid or expired credential: `402` again, with a new Challenge. Retry by paying.',
    '- Unknown route: `404` with JSON `{ error, hint }`.',
    '',
    `Protocol spec: https://mpp.dev · Discovery: ${base}/openapi.json`,
  ].join('\n')
}

/** agents.md (agent-discovery-file, agent-instruction) */
export function agentsMd({ tenant, routes, base }: Ctx): string {
  return [
    `# ${tenant.name} for agents`,
    '',
    '## What this is',
    '',
    `${tenant.name} exposes data through a pay-per-request API. You pay per call in stablecoin (${RAILS}) via MPP/HTTP 402, with no prior signup.`,
    '',
    '## When to use it',
    '',
    ...routes.map((r) => `- ${r.description ?? `${r.method} ${r.pathPattern}`}: \`${r.method} ${base}${r.pathPattern}\` ($${Number(r.priceUsd)})`),
    '',
    '## How to start',
    '',
    `1. Read the discovery doc: ${base}/openapi.json`,
    `2. Pay and consume: \`npx mppx@latest ${base}<route>\``,
    `3. Or use MCP: ${base}/mcp (Streamable HTTP, paid tools over JSON-RPC)`,
    '',
    `Authentication (= payment): ${base}/auth.md`,
  ].join('\n')
}

/**
 * .well-known/ai-catalog.json — ARD (ard-catalog, ard-entries-valid).
 *
 * El formato lo verificamos contra catálogos reales que pasan validación
 * (ora.ai, vercel.com): raíz con `specVersion` + `host` + `entries`, y cada
 * entrada con un identificador `urn:air:{dominio}:{clase}:{nombre}`, un
 * `displayName` y un **media type** en `type` (no una categoría suelta).
 *
 * El `trustManifest` es opcional en la spec pero Ora lo puntúa aparte: acá va
 * la versión sin firmar, que es la mínima que declara identidad y de dónde
 * sale la atestación.
 */
export function aiCatalog({ tenant, routes, base }: Ctx): Record<string, unknown> {
  // La identidad se ancla al dominio del NEGOCIO, no al del gateway: es su
  // catálogo y, con el proxy instalado, se sirve desde su dominio. Las URLs
  // sí apuntan al gateway, que funciona con o sin proxy.
  const host = hostDe(tenant.originUrl)
  const urn = (clase: string, nombre: string) => `urn:air:${host}:${clase}:${slugSeguro(nombre)}`

  // El dominio del `identity` tiene que coincidir con el publisher del URN
  // (publisher-authority binding), o el manifiesto no vale.
  const identidad = { identity: `did:web:${host}`, identityType: 'did' as const }

  const trustManifest = {
    ...identidad,
    attestations: [
      {
        type: 'payment-rail',
        uri: `${base}/auth.md`,
        mediaType: 'text/markdown',
      },
    ],
  }

  return {
    specVersion: '1.0',
    host: {
      displayName: tenant.name,
      identifier: `did:web:${host}`,
      documentationUrl: `${base}/llms.txt`,
      trustManifest,
    },
    trustManifest,
    entries: [
      {
        identifier: urn('api', tenant.slug),
        displayName: `${tenant.name} API`,
        type: 'application/vnd.oai.openapi+json;version=3.1',
        url: `${base}/openapi.json`,
        description: `Pay-per-request API from ${tenant.name} (MPP over HTTP 402). No API keys.`,
        tags: ['api', 'openapi', 'pay-per-request', 'x402', 'mpp'],
        representativeQueries: [
          `buy data from ${tenant.name} without an API key`,
          `pay per request for ${tenant.name}`,
          `what does ${tenant.name} charge per call`,
        ],
        trustManifest: identidad,
      },
      {
        identifier: urn('mcp', tenant.slug),
        displayName: `${tenant.name} MCP server`,
        type: 'application/mcp-server-card+json',
        url: `${base}/.well-known/mcp/server-card.json`,
        description: `Paid tools from ${tenant.name} over Streamable HTTP: each tool charges the price it advertises and returns a receipt.`,
        tags: ['mcp', 'tools', 'paid', 'streamable-http'],
        representativeQueries: [
          `use ${tenant.name} tools from an MCP client`,
          `call ${tenant.name} and pay per tool call`,
        ],
        trustManifest: identidad,
      },
      {
        identifier: urn('agent', tenant.slug),
        displayName: `${tenant.name} agent card`,
        type: 'application/a2a-agent-card+json',
        url: `${base}/.well-known/agent-card.json`,
        description: `A2A agent card for ${tenant.name}.`,
        tags: ['a2a', 'agent-card'],
        trustManifest: identidad,
      },
      ...routes.map((r) => ({
        identifier: urn('capability', r.description ?? r.pathPattern),
        displayName: r.description ?? `${r.method} ${r.pathPattern}`,
        type: 'application/json',
        url: `${base}${r.pathPattern}`,
        description: `${r.method} ${r.pathPattern} — $${Number(r.priceUsd)} USD per request via MPP (HTTP 402).`,
        tags: ['capability', 'paid'],
        // `pricing` no es un miembro del esquema; los escalares van en metadata.
        metadata: {
          priceUsd: Number(r.priceUsd),
          currency: 'USD',
          pricingModel: 'per-request',
          method: r.method,
        },
        trustManifest: identidad,
      })),
    ],
  }
}

/** Dominio que ancla los `urn:air` y el `did:web`. */
function hostDe(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    // La spec exige un FQDN como publisher: `localhost` está prohibido.
    return host.includes('.') ? host : `${host}.localhost`
  } catch {
    return 'invalid.localhost'
  }
}

/** Segmento seguro para un urn:air (sin espacios ni dos puntos). */
function slugSeguro(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  )
}

/** .well-known/agent-card.json (a2a-agent-card) */
export function agentCard({ tenant, routes, base }: Ctx): Record<string, unknown> {
  return {
    name: tenant.name,
    description: `Pay-per-request API (MPP/HTTP 402). ${routes.map((r) => r.description).filter(Boolean).join(' · ')}`,
    url: base,
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: routes.map((r) => ({
      id: `${r.method.toLowerCase()}${r.pathPattern.replace(/[/:*]/g, '_')}`,
      name: r.description ?? `${r.method} ${r.pathPattern}`,
      description: `${r.description ?? ''} — $${Number(r.priceUsd)} per call via MPP`.trim(),
    })),
  }
}

/** .well-known/api-catalog (api-catalog-rfc9727, formato linkset RFC 9264) */
export function apiCatalog({ tenant, base }: Ctx): Record<string, unknown> {
  // El ancla es el ORIGEN del negocio, no el gateway: quien audita este archivo
  // lo pide en el dominio del negocio y espera que el linkset hable de ese
  // dominio. Los href siguen apuntando al gateway, que responde con o sin proxy.
  const origen = new URL(tenant.originUrl).origin
  return {
    linkset: [
      {
        anchor: origen,
        'service-desc': [{ href: `${base}/openapi.json`, type: 'application/openapi+json' }],
        'service-doc': [{ href: `${base}/llms.txt`, type: 'text/plain' }],
        'service-meta': [{ href: `${base}/pricing.md`, type: 'text/markdown' }],
      },
    ],
  }
}

/** .well-known/mcp/server-card.json (mcp-server-card) */
export function mcpServerCard({ tenant, routes, base }: Ctx): Record<string, unknown> {
  return {
    name: `${tenant.slug}-peaje`,
    description: `Paid tools from ${tenant.name}: pay per call via MPP, no API keys`,
    url: `${base}/mcp`,
    transport: { type: 'streamable-http' },
    version: '1.0.0',
    tools: routes.map((r) => ({
      name: `${r.method.toLowerCase()}_${r.pathPattern.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? `by_${s.slice(1)}` : s === '*' ? 'any' : s)).join('_').replace(/[^a-zA-Z0-9_]/g, '_')}`.slice(0, 60),
      description: `${r.description ?? `${r.method} ${r.pathPattern}`} — $${Number(r.priceUsd)}/call`,
    })),
  }
}
