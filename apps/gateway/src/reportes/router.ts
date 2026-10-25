import { Hono } from 'hono'
import type { ReportKind, ReportSchedule } from '@peaje/db'
import { env } from '../env.js'
import { store } from '../store.js'
import { accesoPro, sinPro } from '../billing/acceso.js'
import { proximaCorrida, validarAgenda, ZONA_POR_DEFECTO } from './agenda.js'
import { destinosDe } from './entregar.js'

/**
 * Reportes programados desde el dashboard ("Mi agente", sección Telegram):
 *   GET    /_internal/:slug/schedules   destinos conectados y lo programado
 *   PUT    /_internal/:slug/schedules   crea o cambia uno (Pro, como Telegram)
 *   DELETE /_internal/:slug/schedules   ?id= o ?channel=&target=&kind=
 */
export const reportesRouter = new Hono()

reportesRouter.use('/_internal/:slug/schedules', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

const publico = (s: ReportSchedule) => ({
  id: s.id,
  channel: s.channel,
  target: s.target,
  kind: s.kind,
  prompt: s.prompt,
  frequency: s.frequency,
  hour: s.hour,
  weekday: s.weekday,
  dayOfMonth: s.dayOfMonth,
  timezone: s.timezone,
  nextRunAt: s.nextRunAt,
  lastRunAt: s.lastRunAt,
})

reportesRouter.get('/_internal/:slug/schedules', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const [destinos, schedules] = await Promise.all([destinosDe(tenant.id), store.listReportSchedules(tenant.id)])
  return c.json({
    pro: accesoPro(tenant).activo,
    defaultTimezone: ZONA_POR_DEFECTO,
    destinations: destinos.map((d) => ({ channel: d.channel, target: d.target, name: d.nombre, language: d.idioma })),
    schedules: schedules.map(publico),
  })
})

reportesRouter.put('/_internal/:slug/schedules', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const bloqueo = sinPro(tenant)
  if (bloqueo) return c.json(bloqueo, 403)
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return c.json({ error: 'JSON inválido' }, 400)
  const channel = String(b.channel ?? 'telegram')
  const target = String(b.target ?? '')
  if (!(await destinosDe(tenant.id)).some((d) => d.channel === channel && d.target === target)) return c.json({ error: 'Ese chat no está conectado a este negocio' }, 400)
  const kind: ReportKind = b.kind === 'custom' ? 'custom' : 'agent_visits'
  const prompt = kind === 'custom' ? String(b.prompt ?? '').trim().slice(0, 500) : null
  if (kind === 'custom' && !prompt) return c.json({ error: 'Falta el pedido' }, 400)
  const agenda = validarAgenda(b)
  if ('error' in agenda) return c.json({ error: agenda.error }, 400)
  try {
    const s = await store.upsertReportSchedule({
      id: typeof b.id === 'string' && b.id ? b.id : undefined,
      tenantId: tenant.id,
      channel,
      target,
      kind,
      prompt,
      ...agenda,
      weekday: agenda.weekday ?? null,
      dayOfMonth: agenda.dayOfMonth ?? null,
      nextRunAt: proximaCorrida(agenda).toISOString(),
    })
    return c.json({ schedule: publico(s) })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})

reportesRouter.delete('/_internal/:slug/schedules', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const id = c.req.query('id')
  const channel = c.req.query('channel')
  const target = c.req.query('target')
  const kind = c.req.query('kind')
  if (!id && !(channel && target)) return c.json({ error: 'Falta id, o channel y target' }, 400)
  const deleted = await store.deleteReportSchedules(tenant.id, {
    id: id || undefined,
    channel: channel || undefined,
    target: target || undefined,
    kind: kind === 'custom' || kind === 'agent_visits' ? kind : undefined,
  })
  return c.json({ deleted })
})
