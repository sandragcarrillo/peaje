import { serve, type HttpBindings } from '@hono/node-server'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import { NETWORK_IDS } from '@peaje/shared'
import { Hono, type Context } from 'hono'
import { generate } from 'mppx/discovery'
import { agentCard } from './agents/erc8004.js'
import { agentsRouter } from './agents/router.js'
import { iniciarScheduler } from './agents/scheduler.js'
import { usdcStatus } from './chainlink.js'
import { creditReceipt, refundOriginFailure } from './charge.js'
import { env } from './env.js'
import { mppx } from './mpp.js'
import { proxyToOrigin } from './proxy.js'
import { matchRoute } from './router.js'
import { store } from './store.js'
import {
  ACP_VERSION_HEADER,
  acpError,
  crearCheckout,
  getCheckoutSession,
  ucpProfile,
} from './commerce.js'
import { handleMcpRequest } from './mcp.js'
import { enriquecer } from './openapi.js'
import { docsBase, gatewayBase } from './base.js'
import { problema } from './problem.js'
import { rateLimit } from './ratelimit.js'
import * as wk from './wellknown.js'
import { withdrawals } from './withdrawals.js'

const app = new Hono<{ Bindings: HttpBindings }>()

// Antes de cualquier ruta: las cabeceras de rate limit van en todas.
app.use('*', rateLimit)

app.get('/health', async (c) => {
  const usdc = await usdcStatus()
  return c.json({
    ok: true,
    network: env.testnet ? 'testnet' : 'mainnet',
    settlementNetworks: NETWORK_IDS,
    // Depeg guard (Chainlink USDC/USD): con depeg, el rail de Arc se pausa.
    usdcPeg: { price: usdc.price, depegged: usdc.depegged, checkedAt: usdc.checkedAt },
  })
})

/**
 * Discovery MPP por tenant. Un agente lee esto y sabe qué rutas cobran
 * y cuánto, sin tener que provocar un 402 primero.
 */
app.get('/:slug/openapi.json', async (c) => {
  const slug = c.req.param('slug')
  const tenant = await store.getTenantBySlug(slug)
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  // El discovery de pagos solo lista lo que cobra; lo gratis va en llms.txt.
  // La forma `handler` toma la metadata compuesta de la instancia MPP: emite
  // una oferta por red (Tempo y Arc) en `x-payment-info.offers`.
  const routes = (await sellableRoutes(tenant.id)).filter((r) => Number(r.priceUsd) > 0)
  const doc = generate(mppx, {
      info: { title: `${tenant.name} · Peaje`, version: '1.0.0' },
      routes: routes.map((route) => ({
        handler: mppx.charge({
          amount: route.priceUsd,
          description: route.description ?? `${route.method} ${route.pathPattern}`,
        }),
        method: route.method,
        path: route.pathPattern,
        summary: route.description ?? undefined,
      })),
    })
  // Los paths van sin el slug; la base la declara `servers`, como manda OpenAPI.
  const base = docsBase(tenant)
  const directo = gatewayBase(tenant)
  // Primero el dominio del negocio: es el que un agente acaba de leer y el que
  // mide el auditor. El gateway queda como alternativa para quien todavía no
  // puso el proxy; si son el mismo, no lo repetimos.
  doc.servers =
    base === directo
      ? [{ url: base }]
      : [
          { url: base, description: `${tenant.name} own domain` },
          { url: directo, description: 'Peaje gateway (direct, no proxy needed)' },
        ]
  return c.body(JSON.stringify(enriquecer(doc as never, tenant, base), null, 2), 200, {
    'content-type': 'application/json',
  })
})

// El ledger interno vive dentro del router de withdrawals: comparte su
// middleware de auth (antes estaba acá afuera y quedaba expuesto sin token).
app.route('/_internal', withdrawals)
app.route('/_internal', agentsRouter)

/**
 * Link headers (RFC 8288) en todas las respuestas de tenant: los agentes
 * encuentran el discovery sin parsear ni una página.
 */
app.use('/:slug/*', async (c, next) => {
  await next()
  const slug = c.req.param('slug')
  const tenant = slug ? await store.getTenantBySlug(slug) : null
  if (!tenant) return
  const b = docsBase(tenant)
  c.res.headers.append(
    'Link',
    `<${b}/llms.txt>; rel="describedby", <${b}/.well-known/ard.json>; rel="ard", <${b}/openapi.json>; rel="service-desc", <${b}/pricing.md>; rel="service-meta"`,
  )
  // Versionado visible en la respuesta, no solo documentado.
  c.res.headers.set('API-Version', '2026-09-01')
})

/** Archivos de agent-readiness por tenant. Ver wellknown.ts: cada uno mapea a un check de Ora. */
const WELL_KNOWN: Record<string, { builder: (ctx: { tenant: Parameters<typeof wk.llmsTxt>[0]['tenant']; routes: Parameters<typeof wk.llmsTxt>[0]['routes']; base: string }) => string | Record<string, unknown>; contentType: string }> = {
  'auth.md': { builder: wk.authMd, contentType: 'text/markdown; charset=utf-8' },
  'agents.md': { builder: wk.agentsMd, contentType: 'text/markdown; charset=utf-8' },
  'pricing.md': { builder: wk.pricingMd, contentType: 'text/markdown; charset=utf-8' },
  // ard.json es el path canónico de ARD v0.91; ai-catalog.json queda como
  // alias legacy, que la spec mantiene como fuente equivalente.
  '.well-known/ard.json': { builder: wk.aiCatalog, contentType: 'application/ai-catalog+json' },
  '.well-known/ai-catalog.json': { builder: wk.aiCatalog, contentType: 'application/ai-catalog+json' },
  '.well-known/agent-card.json': { builder: wk.agentCard, contentType: 'application/json' },
  // El profile del Content-Type es parte de RFC 9727, no decoración: sin él
  // el cliente no sabe que este linkset es un catálogo de APIs.
  '.well-known/api-catalog': {
    builder: wk.apiCatalog,
    contentType: 'application/linkset+json;profile="https://www.rfc-editor.org/info/rfc9727"',
  },
  // Lista x402 Bazaar: las URLs que devuelven 402 de verdad.

  '.well-known/mcp/server-card.json': { builder: wk.mcpServerCard, contentType: 'application/json' },
}

/** Rutas de API + links con precio, unificados para discovery y archivos. */
async function sellableRoutes(tenantId: string) {
  const [routes, resources] = await Promise.all([
    store.listRoutes(tenantId),
    store.listResources(tenantId),
  ])
  return [
    ...routes,
    ...resources.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      method: 'GET',
      pathPattern: `/r/${r.slug}`,
      priceUsd: r.priceUsd,
      description: r.title ?? r.slug,
      active: true,
    })),
  ]
}

for (const [path, def] of Object.entries(WELL_KNOWN)) {
  app.get(`/:slug/${path}`, async (c) => {
    const tenant = await store.getTenantBySlug(c.req.param('slug'))
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    const routes = await sellableRoutes(tenant.id)
    const base = docsBase(tenant)
    const body = def.builder({ tenant, routes, base })
    // `c.json` pisaría el content-type con application/json, y estos archivos
    // se identifican por el suyo (ai-catalog+json, linkset+json con profile).
    const texto = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    return c.body(texto, 200, { 'content-type': def.contentType })
  })
}

/**
 * llms.txt por tenant: el archivo que leen los agentes que navegan en vez de
 * llamar APIs. Apunta al discovery doc y al MCP. El tenant puede linkearlo o
 * copiarlo a su propio dominio.
 */
app.get('/:slug/llms.txt', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.text('Tenant not found', 404)
  const routes = await sellableRoutes(tenant.id)
  const base = docsBase(tenant)

  // Si el negocio ya tenía su propio llms.txt, lo respetamos y le pegamos la
  // sección de pagos debajo. Reemplazarlo perdía su contenido, que es
  // justamente lo que un agente necesita para saber cuándo usarlo.
  const propio = await wk.llmsDelOrigen(tenant.originUrl)
  const cuerpo = propio
    ? `${propio}\n\n${wk.seccionPagos({ tenant, routes, base })}`
    : wk.llmsTxt({ tenant, routes, base })

  return c.text(cuerpo, 200, { 'content-type': 'text/markdown; charset=utf-8' })
})
/**
 * Links con precio: /{slug}/r/{resource}. La URL destino es absoluta (no
 * depende del origin del tenant): cualquier página, PDF o dataset público
 * se vuelve cobrable sin que el negocio tenga API.
 */
app.get('/:slug/r/:rslug', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

  const resource = await store.getResource(tenant.id, c.req.param('rslug'))
  if (!resource) {
    const disponibles = (await store.listResources(tenant.id)).map((r) => r.slug)
    return c.json(
      { error: 'Resource not found', hint: 'Check the tenant discovery doc.', available: disponibles },
      404,
    )
  }

  // Precio 0 = link gratis: se sirve directo, sin 402.
  const gratis = Number(resource.priceUsd) <= 0

  const result = gratis
    ? null
    : await mppx.charge({
        amount: resource.priceUsd,
        description: resource.title ?? resource.slug,
      })(c.req.raw)

  if (result && result.status === 402) return result.challenge

  let respuesta: Response
  let originFallo = false
  try {
    const upstream = await fetch(resource.url, { redirect: 'follow' })
    const headers = new Headers(upstream.headers)
    headers.delete('content-encoding')
    headers.delete('content-length')
    respuesta = new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    console.error('[gateway] no se pudo traer el recurso', { tenant: tenant.slug, resource: resource.slug, err })
    originFallo = true
    respuesta = c.json(
      {
        error: 'We could not fetch the resource you already paid for.',
        hint: 'The payment is refunded to your wallet automatically (see the Payment-Refund header). If it does not arrive, keep the receipt and contact support.',
      },
      502,
    )
  }
  if (!result) return respuesta
  const sealed = result.withReceipt(respuesta)

  const payment = await creditReceipt(sealed, {
    tenantId: tenant.id,
    routeId: null,
    path: `/r/${resource.slug}`,
    priceUsd: resource.priceUsd,
  })

  // Pago condicionado: origin caído = plata de vuelta al agente.
  if (originFallo && payment) {
    const refund = await refundOriginFailure(payment)
    if (refund) {
      try {
        sealed.headers.set('Payment-Refund', refund)
      } catch {
        // headers inmutables: el refund igual quedó registrado y on-chain
      }
    }
  }

  return sealed
})

/**
 * Lista x402 Bazaar con paginación por cursor. Va aparte del mapa de archivos
 * porque lee query params.
 */
app.get('/:slug/discovery/resources', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return problema(c, 404, 'not-found', 'Unknown merchant')
  const routes = await sellableRoutes(tenant.id)
  const base = docsBase(tenant)
  const limit = Number.parseInt(c.req.query('limit') ?? '', 10)
  const body = wk.bazaarResources(
    { tenant, routes, base },
    { cursor: c.req.query('cursor'), limit: Number.isFinite(limit) ? limit : undefined },
  )
  return c.json(body)
})

/**
 * UCP · ACP · AP2. Los tres protocolos de comercio agéntico sobre el mismo
 * riel de pago que ya usa el 402. Ver commerce.ts para el porqué de cada uno.
 */
app.get('/:slug/.well-known/ucp', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  return c.body(JSON.stringify(ucpProfile(tenant, docsBase(tenant)), null, 2), 200, {
    'content-type': 'application/json',
  })
})

/** Preflight: un agente de navegador pregunta antes de postear. */
const acpPreflight = (c: Context) =>
  c.body(null, 204, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, idempotency-key, request-id, api-version, signature, timestamp',
    'access-control-max-age': '86400',
  })

app.options('/:slug/checkout_sessions', acpPreflight)
app.options('/:slug/agentic_commerce/delegate_payment', acpPreflight)

app.post('/:slug/checkout_sessions', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json(acpError('invalid_request', 'not_found', 'Unknown merchant'), 404)

  let body: { items?: { id: string; quantity: number }[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json(acpError('invalid_request', 'invalid', 'Body must be JSON'), 400, cabecerasAcp(c))
  }

  const resources = await store.listResources(tenant.id)
  const r = crearCheckout(tenant, docsBase(tenant), resources, body.items ?? [])
  return r.ok
    ? c.json(r.sesion, 201, cabecerasAcp(c))
    : c.json(r.error, 400, cabecerasAcp(c))
})

app.get('/:slug/checkout_sessions/:id', async (c) => {
  const sesion = getCheckoutSession(c.req.param('id'))
  return sesion
    ? c.json(sesion, 200, cabecerasAcp(c))
    : c.json(acpError('invalid_request', 'not_found', 'Unknown or expired checkout session', '$.id'), 404, cabecerasAcp(c))
})

/**
 * ACP Delegate Payment. Existe y responde con la forma de la spec, pero
 * rechaza tarjetas: Peaje no es procesador y no toca PANs. Le decimos al
 * agente cuál es el riel real en vez de dejarlo adivinando con un 404.
 */
app.post('/:slug/agentic_commerce/delegate_payment', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json(acpError('invalid_request', 'not_found', 'Unknown merchant'), 404)
  const base = docsBase(tenant)
  return c.json(
    acpError(
      'invalid_request',
      'unsupported_payment_method',
      `${tenant.name} settles in stablecoin over HTTP 402, not cards. No card data is accepted or stored here. Call the resource, read the 402 terms, pay on Tempo or Arc: ${base}/auth.md`,
      '$.payment_method.type',
    ),
    400,
    cabecerasAcp(c),
  )
})

/** ACP pide que el servidor devuelva la versión y eco de idempotencia. */
function cabecerasAcp(c: Context): Record<string, string> {
  const eco = (k: string) => c.req.header(k)
  return {
    'api-version': ACP_VERSION_HEADER,
    ...(eco('idempotency-key') ? { 'idempotency-key': eco('idempotency-key')! } : {}),
    ...(eco('request-id') ? { 'request-id': eco('request-id')! } : {}),
    'access-control-allow-origin': '*',
  }
}

/**
 * Agent card de un agente comprador (ERC-8004). Es el `agentURI` del registro:
 * pública a propósito, la leen el registro y cualquier agente que quiera saber
 * quién es el que le está comprando.
 */
app.get('/:slug/agents/:id/card.json', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)
  return c.json(agentCard(tenant, agent))
})

/**
 * MCP por tenant: las rutas con precio del tenant expuestas como tools pagas
 * sobre Streamable HTTP. Un agente MCP las descubre, paga por JSON-RPC y
 * recibe el recurso, sin conocer la API HTTP.
 */
/**
 * Sonda GET al MCP: el transporte Streamable HTTP habla por POST, pero los
 * detectores (y Ora) tantean con GET. Un 404 les dice "acá no hay nada"; un
 * 405 con Allow y un puntero al server card les dice "existe, hablá POST".
 */
/**
 * Ora pide el MCP también en `/.well-known/mcp` ("Serve your MCP server at
 * /.well-known/mcp"), así que el endpoint vive en las dos rutas.
 */
app.post('/:slug/.well-known/mcp', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const body = await c.req.json().catch(() => undefined)
  await handleMcpRequest(tenant, c.env.incoming, c.env.outgoing, body)
  return RESPONSE_ALREADY_SENT
})

/**
 * GET en `/.well-known/mcp` es una pregunta de discovery, no una llamada
 * JSON-RPC: devolvemos el descriptor del servidor. El transporte sigue
 * hablando por POST en la misma ruta.
 */
app.get('/:slug/.well-known/mcp', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return problema(c, 404, 'not-found', 'Unknown merchant')
  const b = docsBase(tenant)
  return c.body(
    JSON.stringify(
      {
        servers: [
          {
            name: tenant.slug,
            url: `${b}/mcp`,
            transport: 'streamable-http',
            description: `Paid tools from ${tenant.name}: each one charges the price it advertises and returns a receipt. No API keys.`,
            serverCard: `${b}/.well-known/mcp/server-card.json`,
          },
        ],
      },
      null,
      2,
    ),
    200,
    { 'content-type': 'application/json' },
  )
})

app.get('/:slug/mcp', async (c) => sondaMcp(c))

/** Respuesta a una sonda GET sobre un endpoint MCP. */
async function sondaMcp(c: Context<{ Bindings: HttpBindings }>) {
  const slug = c.req.param('slug')
  const tenant = slug ? await store.getTenantBySlug(slug) : null
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  return c.json(
    {
      error: 'This MCP endpoint speaks Streamable HTTP over POST.',
      transport: 'streamable-http',
      serverCard: `${docsBase(tenant)}/.well-known/mcp/server-card.json`,
    },
    405,
    { allow: 'POST' },
  )
}

app.post('/:slug/mcp', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const body = await c.req.json().catch(() => undefined)
  await handleMcpRequest(tenant, c.env.incoming, c.env.outgoing, body)
  return RESPONSE_ALREADY_SENT
})

/**
 * Gateway multi-tenant: `/{slug}/<lo que sea>`.
 *
 * Resuelve el tenant por slug, busca si el path tiene precio configurado.
 * Con precio: cobra por MPP y recién ahí llama al origin. Sin precio:
 * pasa derecho, gratis. El tenant decide qué cobra desde el dashboard.
 */
app.all('/:slug/*', async (c) => {
  const slug = c.req.param('slug')
  const tenant = await store.getTenantBySlug(slug)
  if (!tenant) {
    return c.json(
      {
        error: `Tenant "${slug}" not found`,
        hint: 'The first path segment is the business slug. Check the gateway URL in your discovery doc.',
      },
      404,
    )
  }

  const url = new URL(c.req.url)
  const path = url.pathname.slice(`/${slug}`.length) || '/'
  const routes = await store.listRoutes(tenant.id)
  const match = matchRoute(routes, c.req.method, path)

  if (!match) return proxyToOrigin(c.req.raw, tenant, path)

  const result = await mppx.charge({
    amount: match.route.priceUsd,
    description: match.route.description ?? `${tenant.name} · ${path}`,
  })(c.req.raw)

  if (result.status === 402) return result.challenge

  // El pago ya se validó/liquidó arriba: si el origin falla de acá en más, el
  // agente ya pagó. Sellamos el receipt igual (sobre una respuesta de error)
  // para que el pago quede acreditado, y devolvemos la plata (Payment-Refund).
  let upstream: Response
  let originFallo = false
  try {
    upstream = await proxyToOrigin(c.req.raw, tenant, path)
  } catch (err) {
    console.error('[gateway] origin no respondió', { tenant: tenant.slug, path, err })
    originFallo = true
    upstream = c.json(
      {
        error: 'The business origin did not respond to this already-paid request.',
        hint: 'The payment is refunded to your wallet automatically (see the Payment-Refund header). If it does not arrive, keep the receipt and contact support.',
      },
      502,
    )
  }
  const sealed = result.withReceipt(upstream)

  const payment = await creditReceipt(sealed, {
    tenantId: tenant.id,
    routeId: match.route.id,
    path,
    priceUsd: match.route.priceUsd,
  })

  if (originFallo && payment) {
    const refund = await refundOriginFailure(payment)
    if (refund) {
      try {
        sealed.headers.set('Payment-Refund', refund)
      } catch {
        // headers inmutables: el refund igual quedó registrado y on-chain
      }
    }
  }

  return sealed
})

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[gateway] escuchando en http://localhost:${info.port}`)
  console.log(`[gateway] treasury ${env.treasuryAddress} · currency ${env.currency}`)
  iniciarScheduler()
})
