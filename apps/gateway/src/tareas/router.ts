import type { AgentTask, Tenant } from '@peaje/db'
import { hashApiKey, TASK_STATUSES_PUBLICOS } from './comun.js'
import { Hono } from 'hono'
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response'
import type { HttpBindings } from '@hono/node-server'
import { env } from '../env.js'
import { store } from '../store.js'
import { generarTareas } from './generar.js'
import { handleOwnerMcp } from './mcp.js'
import { completarTarea } from './verificar.js'

/**
 * Tareas del agente Pro.
 *
 * Para el coding agent del dueño, con la clave del agente (`Authorization:
 * Bearer peaje_live_…`, se genera en el dashboard, página "Mi agente"):
 *   GET  /_owner/tasks?status=open        lista
 *   GET  /_owner/tasks/:id                una, con el prompt completo
 *   POST /_owner/tasks/:id/start          la toma
 *   POST /_owner/tasks/:id/done {url?}    la marca hecha; Peaje la verifica en el acto
 *   POST /_owner/tasks/:id/dismiss {reason}
 *   POST /_owner/mcp                      lo mismo como MCP (Streamable HTTP)
 *
 * Para el dashboard, con el secreto interno:
 *   POST /_internal/:slug/tasks/generate  busca tareas nuevas (con contenido: una llamada a Opus)
 *   POST /_internal/:slug/tasks/:id/done  {url?} igual que el dueño
 */
export const tareasRouter = new Hono<{ Bindings: HttpBindings; Variables: { tenant: Tenant } }>()

tareasRouter.onError((err, c) => {
  console.error('[tareas] error no manejado', err)
  return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
})

export async function tenantDeClave(authorization: string | undefined): Promise<Tenant | null> {
  const clave = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!clave.startsWith('peaje_live_')) return null
  return store.getTenantByApiKeyHash(await hashApiKey(clave))
}

tareasRouter.use('/_owner/*', async (c, next) => {
  const tenant = await tenantDeClave(c.req.header('authorization'))
  if (!tenant) return c.json({ error: 'Missing or invalid agent key. Create one in the Peaje dashboard, "My agent" page.' }, 401)
  c.set('tenant', tenant)
  await next()
})

/** Lo que ve el coding agent: sin ids internos del tenant. */
export function tareaPublica(t: AgentTask, completa = false) {
  return {
    id: t.id,
    kind: t.kind,
    title: t.title,
    summary: t.summary,
    status: t.status,
    note: t.note,
    doneUrl: t.doneUrl,
    createdAt: t.createdAt,
    ...(completa ? { prompt: t.body, acceptance: t.acceptance } : {}),
  }
}

function estados(q: string | undefined) {
  if (!q) return ['open', 'in_progress', 'done'] as AgentTask['status'][]
  if (q === 'all') return []
  return q.split(',').filter((s): s is AgentTask['status'] => (TASK_STATUSES_PUBLICOS as readonly string[]).includes(s))
}

tareasRouter.get('/_owner/tasks', async (c) => {
  const tenant = c.get('tenant')
  const tasks = await store.listTasks(tenant.id, { statuses: estados(c.req.query('status')) })
  return c.json({ business: tenant.slug, tasks: tasks.map((t) => tareaPublica(t)) })
})

tareasRouter.get('/_owner/tasks/:id', async (c) => {
  const t = await store.getTask(c.get('tenant').id, c.req.param('id'))
  if (!t) return c.json({ error: 'Task not found' }, 404)
  return c.json({ task: tareaPublica(t, true) })
})

tareasRouter.post('/_owner/tasks/:id/start', async (c) => {
  const tenant = c.get('tenant')
  const t = await store.getTask(tenant.id, c.req.param('id'))
  if (!t) return c.json({ error: 'Task not found' }, 404)
  if (t.status !== 'open') return c.json({ task: tareaPublica(t) })
  return c.json({ task: tareaPublica(await store.updateTask(tenant.id, t.id, { status: 'in_progress' })) })
})

tareasRouter.post('/_owner/tasks/:id/done', async (c) => {
  const tenant = c.get('tenant')
  const t = await store.getTask(tenant.id, c.req.param('id'))
  if (!t) return c.json({ error: 'Task not found' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as { url?: string }
  const r = await completarTarea(tenant, t, urlValida(body.url), store)
  return c.json({ task: tareaPublica(r) })
})

tareasRouter.post('/_owner/tasks/:id/dismiss', async (c) => {
  const tenant = c.get('tenant')
  const t = await store.getTask(tenant.id, c.req.param('id'))
  if (!t) return c.json({ error: 'Task not found' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string }
  return c.json({ task: tareaPublica(await store.updateTask(tenant.id, t.id, { status: 'dismissed', note: String(body.reason ?? 'Dismissed by the owner').slice(0, 500) })) })
})

tareasRouter.post('/_owner/mcp', async (c) => {
  const body = await c.req.json().catch(() => undefined)
  await handleOwnerMcp(c.get('tenant'), c.env.incoming, c.env.outgoing, body)
  return RESPONSE_ALREADY_SENT
})

tareasRouter.get('/_owner/mcp', (c) => c.json({ error: 'Use POST (MCP Streamable HTTP, stateless).' }, 405, { allow: 'POST' }))

// ---- interno (dashboard) ----

tareasRouter.use('/_internal/:slug/tasks/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  c.set('tenant', tenant)
  await next()
})

/** Una búsqueda con contenido cuesta una llamada a Opus: una cada 10 minutos por negocio. */
const ultimaBusqueda = new Map<string, number>()
export const ESPERA_BUSQUEDA_MS = 10 * 60_000

export async function buscarTareas(tenant: Tenant) {
  const antes = ultimaBusqueda.get(tenant.id) ?? 0
  if (Date.now() - antes < ESPERA_BUSQUEDA_MS) {
    return { error: 'too-soon' as const, retryInSeconds: Math.ceil((ESPERA_BUSQUEDA_MS - (Date.now() - antes)) / 1000) }
  }
  ultimaBusqueda.set(tenant.id, Date.now())
  return { ...(await generarTareas(tenant, { conContenido: true })) }
}

tareasRouter.post('/_internal/:slug/tasks/generate', async (c) => {
  const r = await buscarTareas(c.get('tenant'))
  return c.json(r, 'error' in r ? 429 : 200)
})

tareasRouter.post('/_internal/:slug/tasks/:id/done', async (c) => {
  const tenant = c.get('tenant')
  const t = await store.getTask(tenant.id, c.req.param('id'))
  if (!t) return c.json({ error: 'Tarea no encontrada' }, 404)
  const body = (await c.req.json().catch(() => ({}))) as { url?: string }
  return c.json({ task: await completarTarea(tenant, t, urlValida(body.url), store) })
})

export function urlValida(u: unknown): string | null {
  if (typeof u !== 'string' || !u) return null
  try {
    const url = new URL(u)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}
