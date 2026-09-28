import { Hono } from 'hono'
import { dominioVerificable } from '@peaje/shared'
import { env } from '../env.js'
import { store } from '../store.js'
import { correrTenant, eventosAlertables } from './correr.js'
import { enviarCorreo, htmlAlerta, htmlSemanal } from './email.js'
import { armarReporte } from './reporte.js'

/**
 * Rutas internas del monitor (las llama el cron de Railway, ver docs/monitor.md):
 *   POST /internal/monitor/run           corrida diaria de todos los negocios con dominio
 *   POST /internal/monitor/run/:slug     uno solo
 *   POST /internal/monitor/weekly        reporte semanal a los Pro
 *   GET  /internal/monitor/preview/:slug el reporte como HTML, para mirarlo
 *
 * Las filas se guardan para todos; los correos salen solo a los Pro con email.
 */
export const monitorRouter = new Hono()

monitorRouter.use('*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

const esPro = (t: { plan: string; email: string | null }) => t.plan === 'pro' && !!t.email

async function corridaConAlerta(slug: string) {
  const tenant = await store.getTenantBySlug(slug)
  if (!tenant) return { slug, error: 'not found' }
  const corrida = await correrTenant(tenant)
  if (!corrida) return { slug, skipped: 'sin dominio público' }
  const alertables = eventosAlertables(corrida.eventos)
  let alerted: string[] = []
  if (alertables.length > 0 && esPro(tenant)) {
    try {
      const reporte = await armarReporte(tenant, corrida.verificacion)
      const { subject, html } = htmlAlerta(tenant, reporte, alertables)
      await enviarCorreo(tenant.email!, subject, html)
      alerted = alertables
      await store.markAlerted(corrida.verificacion.id, alerted)
    } catch (error) {
      console.error('[monitor] no se pudo alertar a', slug, error instanceof Error ? error.message : error)
    }
  }
  return { slug, ok: corrida.verificacion.ok, score: corrida.verificacion.score, eventos: corrida.eventos, alerted }
}

monitorRouter.post('/run/:slug', async (c) => c.json(await corridaConAlerta(c.req.param('slug'))))

monitorRouter.post('/run', async (c) => {
  const tenants = (await store.listTenants()).filter((t) => dominioVerificable(t.originUrl))
  const resultados: unknown[] = []
  // Secuencial: cada corrida hace ~12 GET al dominio del negocio y una segunda
  // medición si algo falló; en paralelo sería fácil parecer un ataque.
  for (const t of tenants) {
    try {
      resultados.push(await corridaConAlerta(t.slug))
    } catch (error) {
      resultados.push({ slug: t.slug, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return c.json({ tenants: tenants.length, resultados })
})

monitorRouter.post('/weekly', async (c) => {
  const tenants = (await store.listTenants()).filter((t) => esPro(t) && dominioVerificable(t.originUrl))
  const enviados: string[] = []
  const errores: { slug: string; error: string }[] = []
  for (const t of tenants) {
    try {
      const actual = (await store.lastVerification(t.id)) ?? (await correrTenant(t))?.verificacion
      if (!actual) continue
      const reporte = await armarReporte(t, actual, { conContenido: true })
      const { subject, html } = htmlSemanal(t, reporte)
      await enviarCorreo(t.email!, subject, html)
      enviados.push(t.slug)
    } catch (error) {
      errores.push({ slug: t.slug, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return c.json({ enviados, errores })
})

monitorRouter.get('/preview/:slug', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'not found' }, 404)
  const actual = (await store.lastVerification(tenant.id)) ?? (await correrTenant(tenant))?.verificacion
  if (!actual) return c.json({ error: 'sin dominio público' }, 400)
  const conContenido = c.req.query('contenido') !== '0'
  const reporte = await armarReporte(tenant, actual, { conContenido })
  const { subject, html } = htmlSemanal(tenant, reporte)
  return c.html(`<!doctype html><title>${subject}</title><p style="color:#666;font:13px sans-serif">Subject: ${subject}</p>${html}`)
})
