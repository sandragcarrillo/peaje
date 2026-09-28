import type { Route } from '@peaje/db'
import { Hono } from 'hono'
import { env } from './env.js'
import { avisarIndexNow } from './indexnow.js'
import { store } from './store.js'

/**
 * API interna de rutas con precio. La consumen el dashboard y el agente Pro
 * (cambiar un precio, publicar una ruta, cambiar una descripción) con el
 * mismo secreto compartido que retiros y agentes.
 *
 *   GET    /_internal/:slug/routes            lista (solo activas)
 *   POST   /_internal/:slug/routes            { method, pathPattern, priceUsd, description? }
 *   PATCH  /_internal/:slug/routes/:id        { priceUsd?, description? }
 *   DELETE /_internal/:slug/routes/:id        borrado suave
 *
 * Los cambios se ven al instante: el gateway lee las rutas en cada request y
 * los catálogos (openapi, llms.txt, developers, discovery, MCP) se generan en
 * vivo. El proxy del negocio las reenvía leyendo /kit/manifest.json, con la
 * caché que tenga cada host (ver docs/kit.md).
 */
export const rutasRouter = new Hono()

rutasRouter.onError((err, c) => {
  console.error('[rutas] error no manejado', err)
  return c.json({ error: err instanceof Error ? err.message : 'Error interno del gateway.' }, 500)
})

rutasRouter.use('/:slug/routes', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})
rutasRouter.use('/:slug/routes/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

export type ErrorRuta = 'path-slash' | 'path-invalido' | 'metodo-invalido' | 'precio-invalido' | 'duplicada'

const METODOS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

/** Validación compartida con el dashboard: devuelve el código del error, no el texto. */
export function validarRuta(input: { method?: unknown; pathPattern?: unknown; priceUsd?: unknown }): ErrorRuta | null {
  const method = String(input.method ?? 'GET').toUpperCase()
  if (!METODOS.has(method)) return 'metodo-invalido'
  const path = String(input.pathPattern ?? '')
  if (!path.startsWith('/')) return 'path-slash'
  if (path.length > 200 || /\s/.test(path) || path.includes('..')) return 'path-invalido'
  if (input.priceUsd !== undefined) {
    const p = Number(input.priceUsd)
    if (!Number.isFinite(p) || p <= 0 || p > 1000) return 'precio-invalido'
  }
  return null
}

function publica(r: Route) {
  return { id: r.id, method: r.method, pathPattern: r.pathPattern, priceUsd: r.priceUsd, description: r.description }
}

rutasRouter.get('/:slug/routes', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const routes = await store.listRoutes(tenant.id)
  return c.json({ routes: routes.map(publica) })
})

rutasRouter.post('/:slug/routes', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const error = validarRuta({ ...body, priceUsd: body.priceUsd ?? '' })
  if (error) return c.json({ error }, 400)
  const method = String(body.method ?? 'GET').toUpperCase()
  const pathPattern = String(body.pathPattern)
  const existentes = await store.listRoutes(tenant.id)
  if (existentes.some((r) => r.method === method && r.pathPattern === pathPattern)) return c.json({ error: 'duplicada' satisfies ErrorRuta }, 409)
  const route = await store.createRoute({
    tenantId: tenant.id,
    method,
    pathPattern,
    priceUsd: Number(body.priceUsd).toFixed(6),
    description: body.description ? String(body.description).slice(0, 300) : null,
  })
  avisarIndexNow(tenant)
  return c.json({ route: publica(route) }, 201)
})

rutasRouter.patch('/:slug/routes/:id', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  if (body.priceUsd !== undefined) {
    const error = validarRuta({ pathPattern: '/', priceUsd: body.priceUsd })
    if (error) return c.json({ error }, 400)
  }
  const actual = (await store.listRoutes(tenant.id)).find((r) => r.id === c.req.param('id'))
  if (!actual) return c.json({ error: 'Ruta no encontrada' }, 404)
  const route = await store.updateRoute(tenant.id, actual.id, {
    ...(body.priceUsd !== undefined ? { priceUsd: Number(body.priceUsd).toFixed(6) } : {}),
    ...(body.description !== undefined ? { description: body.description ? String(body.description).slice(0, 300) : null } : {}),
  })
  avisarIndexNow(tenant)
  return c.json({ route: publica(route), previous: publica(actual) })
})

rutasRouter.delete('/:slug/routes/:id', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const actual = (await store.listRoutes(tenant.id)).find((r) => r.id === c.req.param('id'))
  if (!actual) return c.json({ error: 'Ruta no encontrada' }, 404)
  await store.deleteRoute(tenant.id, actual.id)
  avisarIndexNow(tenant)
  return c.json({ ok: true, previous: publica(actual) })
})
