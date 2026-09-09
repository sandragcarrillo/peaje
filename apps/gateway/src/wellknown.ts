import type { Route, Tenant } from '@peaje/db'
import { NETWORKS, NETWORK_IDS } from '@peaje/shared'

/**
 * Archivos de agent-readiness servidos por tenant. Cada uno mapea a un check
 * del auditor de Ora (id en el comentario). El tenant no configura nada:
 * todo se genera de la DB.
 */

type Ctx = { tenant: Tenant; routes: Route[]; base: string }

/** "pathUSD en Tempo o USDC en Arc" — para prosa de discovery. */
const REDES = NETWORK_IDS.map((id) => `${NETWORKS[id].tokenSymbol} en ${NETWORKS[id].label}`).join(' o ')

/** llms.txt (llms-txt-exists, llms-txt-formatting, agent-instruction) */
export function llmsTxt({ tenant, routes, base }: Ctx): string {
  return [
    `# ${tenant.name}`,
    '',
    `> API con pagos por request para agentes (MPP sobre HTTP 402). Sin API keys ni registro: el agente recibe un 402, paga en stablecoin (${REDES}) y recibe el recurso. Úsala cuando necesites ${tenant.name} de forma programática pagando solo por lo que consumes.`,
    '',
    '## Recursos',
    '',
    `- [Discovery OpenAPI con precios](${base}/openapi.json): rutas, ofertas y montos`,
    `- [Precios](${base}/pricing.md): tabla simple por endpoint`,
    `- [Cómo autenticarse y pagar](${base}/auth.md): walkthrough para agentes`,
    `- [Guía para agentes](${base}/agents.md): qué es y cuándo usarla`,
    `- [MCP con tools pagas](${base}/mcp): mismo catálogo por JSON-RPC`,
    '',
    '## Rutas con precio',
    '',
    ...routes.map(
      (r) =>
        `- ${r.method} ${r.pathPattern} — ${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Gratis'} · ${r.description ?? ''}`,
    ),
    '',
    'Cliente de referencia: `npx mppx@latest <url>` (crea wallet, paga y reintenta solo).',
  ].join('\n')
}

/** pricing.md (pricing-md, pricing-info) */
export function pricingMd({ tenant, routes, base }: Ctx): string {
  return [
    `# Precios de ${tenant.name}`,
    '',
    `Pago por request vía MPP (HTTP 402). Sin suscripción, sin API key, sin mínimos. Se paga en ${REDES}: el challenge trae una oferta por red y el agente elige.`,
    '',
    '| Endpoint | Precio |',
    '|---|---|',
    ...routes.map(
      (r) => `| ${r.method} ${r.pathPattern} | ${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Gratis'} |`,
    ),
    '',
    `Gateway: ${base} · Discovery: ${base}/openapi.json · MCP: ${base}/mcp`,
  ].join('\n')
}

/** auth.md (auth-md-exists, auth-md-structure) — el "auth" acá es el pago. */
export function authMd({ tenant, base }: Ctx): string {
  return [
    `# Autenticación de ${tenant.name}`,
    '',
    'Esta API no usa API keys ni OAuth. El acceso se compra por request con MPP',
    '(Machine Payments Protocol, HTTP 402). La credencial ES el pago.',
    '',
    '## Cómo obtener acceso (walkthrough)',
    '',
    '1. Haz el request sin credenciales:',
    '```bash',
    `curl -i ${base}/<ruta>`,
    '```',
    '2. Recibes `402 Payment Required` con un header `WWW-Authenticate: Payment` que incluye el Challenge (monto, token, destinatario, chain). Trae una oferta por red soportada: elige la que tu wallet pueda pagar.',
    '3. Paga el Challenge y reintenta con el header `Authorization: Payment <credential>`.',
    '4. Recibes el recurso con un header `Payment-Receipt` como comprobante.',
    '',
    '## Redes de pago',
    '',
    ...NETWORK_IDS.map((id) => {
      const n = NETWORKS[id]
      return `- **${n.label}** (testnet): ${n.tokenSymbol} · chainId ${n.testnet.chainId} · token \`${n.token}\``
    }),
    '',
    '## La vía fácil',
    '',
    '```bash',
    '# el cliente mppx hace los 4 pasos solo (crea wallet en testnet incluida)',
    `npx mppx@latest ${base}/<ruta>`,
    '```',
    '',
    '## Errores',
    '',
    '- `402` sin credential: no es error, es el precio. Incluye siempre un Challenge fresco.',
    '- Credential inválida o expirada: `402` de nuevo, con nuevo Challenge. Reintenta pagando.',
    '- Ruta inexistente: `404` con JSON `{ error, hint }`.',
    '',
    `Spec del protocolo: https://mpp.dev · Discovery: ${base}/openapi.json`,
  ].join('\n')
}

/** agents.md (agent-discovery-file, agent-instruction) */
export function agentsMd({ tenant, routes, base }: Ctx): string {
  return [
    `# ${tenant.name} para agentes`,
    '',
    '## Qué es',
    '',
    `${tenant.name} expone datos vía API paga por request. Pagas por llamada en stablecoin (${REDES}) vía MPP/HTTP 402, sin registro previo.`,
    '',
    '## Cuándo usarla',
    '',
    ...routes.map((r) => `- ${r.description ?? `${r.method} ${r.pathPattern}`}: \`${r.method} ${base}${r.pathPattern}\` ($${Number(r.priceUsd)})`),
    '',
    '## Cómo empezar',
    '',
    `1. Lee el discovery: ${base}/openapi.json`,
    `2. Paga y consume: \`npx mppx@latest ${base}<ruta>\``,
    `3. O usa MCP: ${base}/mcp (Streamable HTTP, tools pagas por JSON-RPC)`,
    '',
    `Autenticación (= pago): ${base}/auth.md`,
  ].join('\n')
}

/** .well-known/ai-catalog.json (ard-catalog, ard-entries-valid) */
export function aiCatalog({ tenant, routes, base }: Ctx): Record<string, unknown> {
  return {
    $schema: 'https://ard.dev/schema/v1',
    name: tenant.name,
    description: `API paga por request de ${tenant.name} (MPP sobre HTTP 402)`,
    entries: [
      {
        type: 'api',
        name: `${tenant.name} API`,
        url: base,
        spec: `${base}/openapi.json`,
        auth: 'mpp',
        pricing: `${base}/pricing.md`,
        networks: NETWORK_IDS.map((id) => ({
          id,
          chainId: NETWORKS[id].testnet.chainId,
          token: NETWORKS[id].token,
          symbol: NETWORKS[id].tokenSymbol,
        })),
      },
      {
        type: 'mcp-server',
        name: `${tenant.slug}-peaje`,
        url: `${base}/mcp`,
        transport: 'streamable-http',
        description: `Tools pagas de ${tenant.name}`,
      },
      ...routes.map((r) => ({
        type: 'capability',
        name: r.description ?? `${r.method} ${r.pathPattern}`,
        url: `${base}${r.pathPattern}`,
        method: r.method,
        price: { amount: Number(r.priceUsd), currency: 'USD', model: 'per-request' },
      })),
    ],
  }
}

/** .well-known/agent-card.json (a2a-agent-card) */
export function agentCard({ tenant, routes, base }: Ctx): Record<string, unknown> {
  return {
    name: tenant.name,
    description: `API paga por request (MPP/HTTP 402). ${routes.map((r) => r.description).filter(Boolean).join(' · ')}`,
    url: base,
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: routes.map((r) => ({
      id: `${r.method.toLowerCase()}${r.pathPattern.replace(/[/:*]/g, '_')}`,
      name: r.description ?? `${r.method} ${r.pathPattern}`,
      description: `${r.description ?? ''} — $${Number(r.priceUsd)} por llamada vía MPP`.trim(),
    })),
  }
}

/** .well-known/api-catalog (api-catalog-rfc9727, formato linkset RFC 9264) */
export function apiCatalog({ tenant, base }: Ctx): Record<string, unknown> {
  return {
    linkset: [
      {
        anchor: base,
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
    description: `Tools pagas de ${tenant.name}: paga por llamada vía MPP, sin API keys`,
    url: `${base}/mcp`,
    transport: { type: 'streamable-http' },
    version: '1.0.0',
    tools: routes.map((r) => ({
      name: `${r.method.toLowerCase()}_${r.pathPattern.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? `by_${s.slice(1)}` : s === '*' ? 'any' : s)).join('_').replace(/[^a-zA-Z0-9_]/g, '_')}`.slice(0, 60),
      description: `${r.description ?? `${r.method} ${r.pathPattern}`} — $${Number(r.priceUsd)}/llamada`,
    })),
  }
}
