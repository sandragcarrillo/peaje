import { serve, type HttpBindings } from '@hono/node-server'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import { NETWORK_IDS } from '@peaje/shared'
import { Hono } from 'hono'
import { generate } from 'mppx/discovery'
import { usdcStatus } from './chainlink.js'
import { creditReceipt, refundOriginFailure } from './charge.js'
import { env } from './env.js'
import { mppx } from './mpp.js'
import { proxyToOrigin } from './proxy.js'
import { matchRoute } from './router.js'
import { store } from './store.js'
import { handleMcpRequest } from './mcp.js'
import * as wk from './wellknown.js'
import { withdrawals } from './withdrawals.js'

const app = new Hono<{ Bindings: HttpBindings }>()

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
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

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
  doc.servers = [{ url: `${env.publicUrl}/${tenant.slug}` }]
  return c.json(doc)
})

// El ledger interno vive dentro del router de withdrawals: comparte su
// middleware de auth (antes estaba acá afuera y quedaba expuesto sin token).
app.route('/_internal', withdrawals)

/**
 * Link headers (RFC 8288) en todas las respuestas de tenant: los agentes
 * encuentran el discovery sin parsear ni una página.
 */
app.use('/:slug/*', async (c, next) => {
  await next()
  const slug = c.req.param('slug')
  const origin = env.publicUrl
  c.res.headers.append(
    'Link',
    `<${origin}/${slug}/llms.txt>; rel="describedby", <${origin}/${slug}/.well-known/ai-catalog.json>; rel="ai-catalog", <${origin}/${slug}/openapi.json>; rel="service-desc"`,
  )
})

/** Archivos de agent-readiness por tenant. Ver wellknown.ts: cada uno mapea a un check de Ora. */
const WELL_KNOWN: Record<string, { builder: (ctx: { tenant: Parameters<typeof wk.llmsTxt>[0]['tenant']; routes: Parameters<typeof wk.llmsTxt>[0]['routes']; base: string }) => string | Record<string, unknown>; contentType: string }> = {
  'auth.md': { builder: wk.authMd, contentType: 'text/markdown; charset=utf-8' },
  'agents.md': { builder: wk.agentsMd, contentType: 'text/markdown; charset=utf-8' },
  'pricing.md': { builder: wk.pricingMd, contentType: 'text/markdown; charset=utf-8' },
  '.well-known/ai-catalog.json': { builder: wk.aiCatalog, contentType: 'application/json' },
  '.well-known/agent-card.json': { builder: wk.agentCard, contentType: 'application/json' },
  '.well-known/api-catalog': { builder: wk.apiCatalog, contentType: 'application/linkset+json' },
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
    if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
    const routes = await sellableRoutes(tenant.id)
    const base = `${env.publicUrl}/${tenant.slug}`
    const body = def.builder({ tenant, routes, base })
    return typeof body === 'string'
      ? c.text(body, 200, { 'content-type': def.contentType })
      : c.json(body)
  })
}

/**
 * llms.txt por tenant: el archivo que leen los agentes que navegan en vez de
 * llamar APIs. Apunta al discovery doc y al MCP. El tenant puede linkearlo o
 * copiarlo a su propio dominio.
 */
app.get('/:slug/llms.txt', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.text('Tenant no encontrado', 404)
  const routes = await sellableRoutes(tenant.id)
  const base = `${env.publicUrl}/${tenant.slug}`
  return c.text(wk.llmsTxt({ tenant, routes, base }), 200, {
    'content-type': 'text/markdown; charset=utf-8',
  })
})
/**
 * Links con precio: /{slug}/r/{resource}. La URL destino es absoluta (no
 * depende del origin del tenant): cualquier página, PDF o dataset público
 * se vuelve cobrable sin que el negocio tenga API.
 */
app.get('/:slug/r/:rslug', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const resource = await store.getResource(tenant.id, c.req.param('rslug'))
  if (!resource) {
    const disponibles = (await store.listResources(tenant.id)).map((r) => r.slug)
    return c.json(
      { error: 'Recurso no encontrado', hint: 'Revisa el discovery del tenant.', disponibles },
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
        error: 'No pudimos traer el recurso ya pagado.',
        hint: 'El pago se devuelve automáticamente a tu wallet (mira el header Payment-Refund). Si no llega, guarda el receipt y contacta a soporte.',
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
 * MCP por tenant: las rutas con precio del tenant expuestas como tools pagas
 * sobre Streamable HTTP. Un agente MCP las descubre, paga por JSON-RPC y
 * recibe el recurso, sin conocer la API HTTP.
 */
app.post('/:slug/mcp', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
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
        error: `Tenant "${slug}" no encontrado`,
        hint: 'El primer segmento del path es el slug del negocio. Revisa el gateway URL en tu discovery.',
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
        error: 'El origin del negocio no respondió a esta request ya pagada.',
        hint: 'El pago se devuelve automáticamente a tu wallet (mira el header Payment-Refund). Si no llega, guarda el receipt y contacta a soporte.',
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
})
