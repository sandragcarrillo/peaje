import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Route, Tenant } from '@peaje/db'
import { Mppx, Transport } from 'mppx/server'
import { z } from 'zod'
import { creditPayment, refundOriginFailure } from './charge.js'
import { env } from './env.js'
import { chargeMethods } from './methods.js'
import { proxyToOrigin } from './proxy.js'
import { store } from './store.js'
import { llmsTxt, pricingMd } from './wellknown.js'

/**
 * Instancia MPP con transporte MCP: los Challenges viajan como error JSON-RPC
 * -32042 y los Receipts en `_meta`, en vez de headers HTTP. Mismos métodos de
 * cobro (Tempo + Arc) que la instancia HTTP: ver methods.ts.
 */
const mcpMppx = Mppx.create({
  secretKey: env.mppSecretKey,
  methods: chargeMethods(),
  transport: Transport.mcpSdk(),
})

/** `GET /api/empresas/:nit` → `get_api_empresas_by_nit` */
export function toolName(route: Route): string {
  const path = route.pathPattern
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? `by_${seg.slice(1)}` : seg === '*' ? 'any' : seg))
    .join('_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
  return `${route.method.toLowerCase()}_${path || 'root'}`.slice(0, 60)
}

function pathParams(route: Route): string[] {
  return route.pathPattern
    .split('/')
    .filter((seg) => seg.startsWith(':'))
    .map((seg) => seg.slice(1))
}

/**
 * Construye el MCP server de un tenant: una tool paga por cada ruta con precio.
 * Nombre, descripción y precio salen de la DB; el handler cobra por MPP y
 * después hace proxy al origin, igual que el flujo HTTP.
 */
function buildServer(tenant: Tenant, routes: Route[], base: string): McpServer {
  const server = new McpServer(
    {
      name: `${tenant.slug}-peaje`,
      version: '1.0.0',
      title: `${tenant.name} · paid tools`,
      description: `Tools from ${tenant.name}, paid per call via MPP. No API keys: each tool charges the price it advertises and returns a receipt.`,
    },
    { capabilities: { tools: {}, resources: {} } },
  )

  // Recursos informativos (mcp-resource-listing): precios y guía, gratis.
  server.registerResource(
    'pricing',
    `${base}/pricing.md`,
    { description: `Per-endpoint pricing for ${tenant.name}`, mimeType: 'text/markdown' },
    async () => ({
      contents: [
        { uri: `${base}/pricing.md`, mimeType: 'text/markdown', text: pricingMd({ tenant, routes, base }) },
      ],
    }),
  )
  server.registerResource(
    'guia',
    `${base}/llms.txt`,
    { description: `How to use ${tenant.name} as an agent`, mimeType: 'text/markdown' },
    async () => ({
      contents: [
        { uri: `${base}/llms.txt`, mimeType: 'text/markdown', text: llmsTxt({ tenant, routes, base }) },
      ],
    }),
  )

  for (const route of routes) {
    const params = pathParams(route)
    const shape: Record<string, z.ZodType> = {}
    for (const p of params) shape[p] = z.string().describe(`Path segment :${p}`)
    shape.query = z
      .record(z.string(), z.string())
      .optional()
      .describe('Optional query params for the endpoint')

    server.registerTool(
      toolName(route),
      {
        description: `${route.description ?? `${route.method} ${route.pathPattern}`} · Costs $${Number(route.priceUsd)} per call (MPP; pay in pathUSD on Tempo or USDC on Arc).`,
        inputSchema: shape,
        annotations: {
          title: route.description ?? `${route.method} ${route.pathPattern}`,
          readOnlyHint: route.method.toUpperCase() === 'GET',
          destructiveHint: !['GET', 'POST'].includes(route.method.toUpperCase()),
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>, extra) => {
        const result = await mcpMppx.charge({
          amount: route.priceUsd,
          description: route.description ?? `${tenant.name} · ${route.pathPattern}`,
        })(extra)

        if (result.status === 402) throw result.challenge

        // Reconstruye el path real reemplazando :params con los argumentos.
        let path = route.pathPattern
        for (const p of params) path = path.replace(`:${p}`, encodeURIComponent(String(args[p] ?? '')))
        const query = new URLSearchParams((args.query as Record<string, string>) ?? {})
        const url = `http://origin.internal${path}${query.size ? `?${query}` : ''}`

        // El pago ya se validó/liquidó arriba: si el origin falla de acá en
        // más, el agente ya pagó. Sellamos el receipt igual, sobre un texto
        // de error, y devolvemos la plata al agente (refund on-chain).
        let body: string
        let originFallo = false
        try {
          const upstream = await proxyToOrigin(new Request(url, { method: route.method }), tenant, path)
          body = await upstream.text()
        } catch (err) {
          console.error('[mcp] origin no respondió', { tenant: tenant.slug, tool: toolName(route), err })
          originFallo = true
          body = JSON.stringify({
            error: 'The business origin did not respond to this already-paid tool call.',
            hint: 'The payment is refunded to your wallet on-chain automatically. If it does not arrive, keep the receipt reference and contact support.',
          })
        }

        const sealed = result.withReceipt({
          content: [{ type: 'text' as const, text: body }],
        })

        // Acredita el pago al ledger por el mismo camino que el flujo HTTP.
        const receipt = (sealed._meta?.['org.paymentauth/receipt'] ?? {}) as {
          reference?: string
          method?: string
        }
        if (receipt.reference) {
          const payment = await creditPayment(
            {
              tenantId: tenant.id,
              routeId: route.id,
              path: `mcp:${toolName(route)}`,
              priceUsd: route.priceUsd,
            },
            { reference: receipt.reference, method: receipt.method ?? 'tempo' },
          )
          if (originFallo) await refundOriginFailure(payment)
        }

        return sealed
      },
    )
  }

  return server
}

/**
 * Maneja un request MCP (Streamable HTTP, modo stateless: un server y un
 * transport nuevos por request, sin sesiones).
 */
export async function handleMcpRequest(
  tenant: Tenant,
  incoming: import('node:http').IncomingMessage,
  outgoing: import('node:http').ServerResponse,
  body: unknown,
): Promise<void> {
  const routes = await store.listRoutes(tenant.id)
  const base = `${env.publicUrl}/${tenant.slug}`
  const server = buildServer(tenant, routes, base)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  outgoing.on('close', () => {
    void transport.close()
    void server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(incoming, outgoing, body)
}

/** id único para nombrar requests MCP en logs. */
export const mcpRequestId = () => randomUUID().slice(0, 8)
