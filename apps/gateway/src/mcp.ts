import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Resource, Route, Tenant } from '@peaje/db'
import { Mppx, Transport } from 'mppx/server'
import { z } from 'zod'
import { contextoCobro, nuevoContexto, prepararOrigen, type ContextoCobro } from './contexto.js'
import { creditPayment, refundOriginFailure } from './charge.js'
import { motivoNoLiquidado, sinDireccionDeCobro, tieneDireccionDeCobro } from './cobro.js'
import { cortado, registrarFalloOrigen, respuestaCortado } from './cortacircuito.js'
import { docsBase } from './base.js'
import { env } from './env.js'
import { leerLegible } from './legible.js'
import { chargeMethods } from './methods.js'
import { proxyToOrigin } from './proxy.js'
import { store } from './store.js'
import { llmsTxt, pricingMd } from './wellknown.js'

/**
 * Instancia MPP con transporte MCP: los Challenges viajan como error JSON-RPC
 * -32042 y los Receipts en `_meta`, en vez de headers HTTP. Mismos métodos de
 * cobro (todos los rieles) que la instancia HTTP: ver methods.ts.
 */
const mcpMppx = Mppx.create({
  secretKey: env.mppSecretKey,
  methods: chargeMethods(),
  transport: Transport.mcpSdk(),
})

/** Lo que el settlement anotó en el contexto y el ledger necesita. */
function liquidado(cobro: ContextoCobro) {
  return {
    network: cobro.network,
    networkFee: cobro.networkFee,
    tempoSplit: cobro.tempoSplit, // ---- Tempo splits ----
    reparto: cobro.reparto,
    payoutAddress: cobro.payoutAddress,
  }
}

/** Pago adelantado servido una vez: sin receipt (no hubo tx de Peaje), el Safe reparte después. */
function pendienteDeReparto(texto: string) {
  return { content: [{ type: 'text' as const, text: texto }], _meta: { 'peaje/payment': 'pending-split' } }
}

/** Resultado de tool con error legible para el agente (sin cobrar). */
function errorTexto(cuerpo: Record<string, string>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(cuerpo) }], isError: true }
}

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

/**
 * Título legible para un link con precio. Muchos `title` en la DB son basura
 * heredada ("Artículo", o vacío); el slug casi siempre trae el nombre real,
 * así que lo usamos de respaldo. Importa porque la descripción de cada tool es
 * lo único que el agente lee antes de decidir si paga.
 */
export function resourceTitle(resource: Resource): string {
  const t = (resource.title ?? '').trim()
  if (t.length > 3 && !/^(art[íi]culo|recurso|resource|untitled)$/i.test(t)) return t
  const palabras = resource.slug
    .replace(/^(resources?|blog|posts?|articles?)-/i, '')
    .split('-')
    .filter(Boolean)
  if (palabras.length === 0) return resource.slug
  const texto = palabras.join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** `resources-lo-que-importa` → `read_resources_lo_que_importa` */
export function resourceToolName(resource: Resource): string {
  const base = resource.slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `read_${base || 'resource'}`.slice(0, 60)
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
/**
 * Los archivos de discovery listan rutas y links con precio en una sola tabla
 * (ver `sellableRoutes` en index.ts). Acá replicamos esa vista para que el
 * texto de precios que sirve el MCP sea el mismo que sirve el HTTP: un tenant
 * que solo vende links tenía una tabla vacía.
 */
function vendibles(routes: Route[], resources: Resource[]): Route[] {
  return [
    ...routes,
    ...resources.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      method: 'GET',
      pathPattern: `/r/${r.slug}`,
      priceUsd: r.priceUsd,
      description: resourceTitle(r),
      active: true,
    })),
  ]
}

export function buildServer(
  tenant: Tenant,
  routes: Route[],
  resources: Resource[],
  base: string,
): McpServer {
  const catalogo = vendibles(routes, resources)
  const server = new McpServer(
    {
      name: `${tenant.slug}-peaje`,
      version: '1.0.0',
      title: `${tenant.name} · paid tools`,
      description: tenant.entityDescription?.trim() || `Tools from ${tenant.name}, paid per call via MPP. No API keys: each tool charges the price it advertises and returns a receipt.`,
    },
    {
      capabilities: { tools: {}, resources: {} },
      // Las instrucciones viajan en el saludo inicial: un agente sabe qué es
      // este servidor y cómo pagar sin leer nada más.
      instructions: [
        tenant.entityDescription?.trim() || `${tenant.name} sells content and data to AI agents through this server.`,
        'Call get_pricing first: it is free and lists every tool with its price. Each paid tool returns an HTTP 402 payment challenge (MPP) on the first call; pay it with a wallet that supports MPP or x402 and call again. There are no API keys and no accounts: the receipt comes back in the tool result.',
        'Free resources: pricing.md and llms.txt.',
      ].join(' '),
    },
  )

  // Recursos informativos (mcp-resource-listing): precios y guía, gratis.
  server.registerResource(
    'pricing',
    `${base}/pricing.md`,
    { description: `Per-endpoint pricing for ${tenant.name}`, mimeType: 'text/markdown' },
    async () => ({
      contents: [
        { uri: `${base}/pricing.md`, mimeType: 'text/markdown', text: pricingMd({ tenant, routes: catalogo, base }) },
      ],
    }),
  )
  server.registerResource(
    'guia',
    `${base}/llms.txt`,
    { description: `How to use ${tenant.name} as an agent`, mimeType: 'text/markdown' },
    async () => ({
      contents: [
        { uri: `${base}/llms.txt`, mimeType: 'text/markdown', text: llmsTxt({ tenant, routes: catalogo, base }) },
      ],
    }),
  )

  /**
   * Tool gratis de precios. Va SIEMPRE, incluso si el tenant todavía no tiene
   * nada monetizado: un server que declara la capability `tools` pero no
   * registra ninguna hace que el SDK no instale el handler de `tools/list`, y
   * el cliente recibe "Method not found". Para un auditor eso no es un MCP
   * vacío, es un MCP roto: no lo detecta como servidor.
   */
  server.registerTool(
    'get_pricing',
    {
      description: `List everything ${tenant.name} sells to agents and what each item costs. Free to call: use it before paying for anything else.`,
      inputSchema: {
        detail: z.enum(['summary', 'full']).optional().describe('summary: one line per item with its price (default). full: the complete pricing document with descriptions and how to pay.'),
      },
      annotations: {
        title: `${tenant.name} pricing`,
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args: { detail?: 'summary' | 'full' }) => ({
      content: [
        {
          type: 'text' as const,
          text:
            args.detail === 'full'
              ? pricingMd({ tenant, routes: catalogo, base })
              : catalogo.map((r) => `${r.method} ${r.pathPattern}: $${Number(r.priceUsd)}`).join('\n') || `${tenant.name} has nothing priced yet.`,
        },
      ],
    }),
  )

  // Una tool por link con precio. Es la única superficie monetizada de muchos
  // tenants (artículos, PDFs, datasets): sin esto su MCP queda sin tools.
  for (const resource of resources) {
    const precio = Number(resource.priceUsd)
    const titulo = resourceTitle(resource)

    server.registerTool(
      resourceToolName(resource),
      {
        description:
          precio > 0
            ? `Fetch "${titulo}" from ${tenant.name}. Costs $${precio} per call (MPP; pay in pathUSD on Tempo, or USDC/USDG on Arbitrum, Robinhood or Arc). No API key needed.`
            : `Fetch "${titulo}" from ${tenant.name}. Free.`,
        inputSchema: {
          max_chars: z.number().int().positive().optional().describe('Return at most this many characters of the content, from the start. Omit for the whole thing.'),
        },
        annotations: {
          title: titulo,
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (args: { max_chars?: number }, extra) => {
        const recortar = (texto: string) => (args.max_chars ? texto.slice(0, args.max_chars) : texto)
        if (precio <= 0) {
          const libre = await fetch(resource.url, { redirect: 'follow' })
          return { content: [{ type: 'text' as const, text: recortar(await leerLegible(libre, resource.url)) }] }
        }

        if (!tieneDireccionDeCobro(tenant)) return errorTexto(sinDireccionDeCobro(tenant))

        const pausa = cortado(tenant.id)
        if (pausa) return errorTexto((await respuestaCortado(tenant, pausa).json()) as Record<string, string>)

        const cobro = nuevoContexto(tenant.payoutWallet, resource.priceUsd, { tenantId: tenant.id, path: `mcp:/r/${resource.slug}` })
        // En los rieles de contrato la fuente se lee antes de enviar el
        // settlement: si falla, no se cobra (ver liquidacion-v3.ts).
        const origen = prepararOrigen(cobro, async () => {
          try {
            const upstream = await fetch(resource.url, { redirect: 'follow' })
            if (upstream.status >= 500) registrarFalloOrigen(tenant)
            // Una página HTML llega como markdown legible; JSON, texto y lo demás, tal cual.
            return { valor: await leerLegible(upstream, resource.url), fallo: upstream.status >= 500 }
          } catch (err) {
            console.error('[mcp] recurso no disponible', { tenant: tenant.slug, resource: resource.slug, err })
            registrarFalloOrigen(tenant)
            return { valor: JSON.stringify({ error: 'We could not fetch this resource.', hint: 'If you were charged, keep the receipt reference and contact support.' }), fallo: true }
          }
        })
        const result = await contextoCobro.run(cobro, () => mcpMppx.charge({ amount: resource.priceUsd, description: titulo })(extra))
        if (result.status === 402) {
          if (cobro.sinLiquidar === 'adelantado' && cobro.servirAdelantado) return pendienteDeReparto((await origen()).valor)
          if (cobro.sinLiquidar) return errorTexto(motivoNoLiquidado(cobro.sinLiquidar))
          throw result.challenge
        }

        const { valor: body, fallo: originFallo } = await origen()
        const sealed = result.withReceipt({ content: [{ type: 'text' as const, text: originFallo ? body : recortar(body) }] })

        const receipt = (sealed._meta?.['org.paymentauth/receipt'] ?? {}) as {
          reference?: string
          method?: string
        }
        if (receipt.reference) {
          const payment = await creditPayment(
            { tenantId: tenant.id, routeId: null, path: `mcp:/r/${resource.slug}`, priceUsd: resource.priceUsd, ...liquidado(cobro) },
            { reference: receipt.reference, method: receipt.method ?? 'tempo' },
          )
          if (originFallo) await refundOriginFailure(payment)
        }

        return sealed
      },
    )
  }

  for (const route of routes) {
    const params = pathParams(route)
    const gratis = Number(route.priceUsd) <= 0
    const shape: Record<string, z.ZodType> = {}
    for (const p of params) shape[p] = z.string().describe(`Path segment :${p}`)
    shape.query = z
      .record(z.string(), z.string())
      .optional()
      .describe('Optional query params for the endpoint')

    server.registerTool(
      toolName(route),
      {
        description: gratis
          ? `${route.description ?? `${route.method} ${route.pathPattern}`} · Free.`
          : `${route.description ?? `${route.method} ${route.pathPattern}`} · Costs $${Number(route.priceUsd)} per call (MPP; pay in pathUSD on Tempo, or USDC/USDG on Arbitrum, Robinhood or Arc).`,
        inputSchema: shape,
        annotations: {
          title: route.description ?? `${route.method} ${route.pathPattern}`,
          readOnlyHint: route.method.toUpperCase() === 'GET',
          destructiveHint: !['GET', 'POST'].includes(route.method.toUpperCase()),
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>, extra) => {
        // Reconstruye el path real reemplazando :params con los argumentos.
        let path = route.pathPattern
        for (const p of params) path = path.replace(`:${p}`, encodeURIComponent(String(args[p] ?? '')))
        const query = new URLSearchParams((args.query as Record<string, string>) ?? {})
        const url = `http://origin.internal${path}${query.size ? `?${query}` : ''}`

        // Precio 0 = ruta gratis, como un link gratis: directo al origen, sin 402 ni receipt.
        if (gratis) {
          try {
            const upstream = await proxyToOrigin(new Request(url, { method: route.method }), tenant, path)
            return { content: [{ type: 'text' as const, text: await upstream.text() }], ...(upstream.status >= 400 ? { isError: true } : {}) }
          } catch (err) {
            console.error('[mcp] origin no respondió (ruta gratis)', { tenant: tenant.slug, tool: toolName(route), err })
            return errorTexto({ error: 'The business origin did not respond.', hint: 'Try again in a minute.' })
          }
        }

        if (!tieneDireccionDeCobro(tenant)) return errorTexto(sinDireccionDeCobro(tenant))

        const pausa = cortado(tenant.id)
        if (pausa) return errorTexto((await respuestaCortado(tenant, pausa).json()) as Record<string, string>)

        const cobro = nuevoContexto(tenant.payoutWallet, route.priceUsd, { tenantId: tenant.id, path: `mcp:${toolName(route)}` })
        // Liquidar después del origen (rieles de contrato): si el origen falla
        // o responde 5xx, el settlement no se envía y el agente no paga.
        const origen = prepararOrigen(cobro, async () => {
          try {
            const upstream = await proxyToOrigin(new Request(url, { method: route.method }), tenant, path)
            if (upstream.status >= 500) registrarFalloOrigen(tenant)
            return { valor: await upstream.text(), fallo: upstream.status >= 500 }
          } catch (err) {
            console.error('[mcp] origin no respondió', { tenant: tenant.slug, tool: toolName(route), err })
            registrarFalloOrigen(tenant)
            return { valor: JSON.stringify({ error: 'The business origin did not respond.', hint: 'If you were charged, keep the receipt reference and contact support.' }), fallo: true }
          }
        })
        const result = await contextoCobro.run(cobro, () =>
          mcpMppx.charge({
            amount: route.priceUsd,
            description: route.description ?? `${tenant.name} · ${route.pathPattern}`,
          })(extra),
        )

        if (result.status === 402) {
          if (cobro.sinLiquidar === 'adelantado' && cobro.servirAdelantado) return pendienteDeReparto((await origen()).valor)
          if (cobro.sinLiquidar) return errorTexto(motivoNoLiquidado(cobro.sinLiquidar))
          throw result.challenge
        }

        const { valor: body, fallo: originFallo } = await origen()
        const sealed = result.withReceipt({
          content: [{ type: 'text' as const, text: body }],
        })

        // Registra el pago en el ledger por el mismo camino que el flujo HTTP.
        const receipt = (sealed._meta?.['org.paymentauth/receipt'] ?? {}) as {
          reference?: string
          method?: string
        }
        if (receipt.reference) {
          const payment = await creditPayment(
            { tenantId: tenant.id, routeId: route.id, path: `mcp:${toolName(route)}`, priceUsd: route.priceUsd, ...liquidado(cobro) },
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
  const [routes, resources] = await Promise.all([
    store.listRoutes(tenant.id),
    store.listResources(tenant.id),
  ])
  const base = docsBase(tenant)
  const server = buildServer(tenant, routes, resources, base)
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
