import type { Tenant } from '@peaje/db'
import { asegurarDescripcion } from '../describir.js'
import { Hono } from 'hono'
import { dominioVerificable } from '@peaje/shared'
import { env } from '../env.js'
import { store } from '../store.js'
import { correrTenant, eventosAlertables } from './correr.js'
import { enviarCorreo, htmlAlerta, htmlSemanal } from './email.js'
import { armarReporte } from './reporte.js'
import { generarTareas, reverificarHechas, sincronizarFixes } from '../tareas/generar.js'
import { tocaCorreo } from '../tareas/plan.js'
import { avisarPorTelegram } from '../telegram/bot.js'
import { correrRonda } from '../citacion/medir.js'
// ---- M6 ----
import { procesarSeguimientos } from '../ciclo/seguimiento.js'
// ---- M7 ----
import { correrComprador } from '../comprador/misterioso.js'
// ---- M9 ----
import { esActivo } from '../billing/acceso.js'
// ---- reportes programados ----
import { correrVencidos } from '../reportes/entregar.js'
// Los canales se registran al importarse (Telegram; Slack desde su módulo).
import '../telegram/reportes.js'
import '../slack/reportes.js'

/**
 * Rutas internas del monitor (las llama el cron de Railway, ver docs/monitor.md):
 *   POST /internal/monitor/run           corrida diaria de todos los negocios con dominio
 *   POST /internal/monitor/run/:slug     uno solo
 *   POST /internal/monitor/weekly        reporte semanal a los Pro
 *   GET  /internal/monitor/preview/:slug el reporte como HTML, para mirarlo
 *   POST /internal/monitor/schedules     reportes programados vencidos (cron horario)
 *
 * Las filas se guardan para todos; los correos salen solo a los Pro con email.
 */
export const monitorRouter = new Hono()

monitorRouter.use('*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

// M9: Pro vigente (pago o prueba) y con correo. Alertas y semanal son Pro; la corrida diaria no.
const esPro = (t: Tenant) => esActivo(t) && !!t.email

async function corridaConAlerta(slug: string) {
  const tenant = await store.getTenantBySlug(slug)
  if (!tenant) return { slug, error: 'not found' }
  const corrida = await correrTenant(tenant)
  if (!corrida) return { slug, skipped: 'sin dominio público' }
  // Tareas de arreglo al día con la corrida, y las hechas que esperaban el deploy.
  const tareas = await sincronizarFixes(tenant).catch(() => null)
  await reverificarHechas(tenant).catch(() => 0)
  // ---- M6: seguimientos vencidos (re-medición a 2 y 6 semanas) ----
  // Preguntan a los asistentes de IA, que es Pro: sin plan activo quedan
  // pendientes y se procesan si el negocio vuelve a Pro.
  const seguimientos = esActivo(tenant)
    ? await procesarSeguimientos(tenant).catch((e) => ({ procesados: 0, veredictos: [], error: e instanceof Error ? e.message : String(e) }))
    : { procesados: 0, veredictos: [], omitido: 'sin Pro' }
  // ---- fin M6 ----
  const alertables = eventosAlertables(corrida.eventos)
  let alerted: string[] = []
  if (alertables.length > 0 && esPro(tenant)) {
    try {
      const reporte = await armarReporte(tenant, corrida.verificacion)
      const { subject, html } = htmlAlerta(tenant, reporte, alertables)
      await enviarCorreo(tenant.email!, subject, html)
      // La misma alerta, corta, en Telegram si el dueño lo conectó.
      await avisarPorTelegram(tenant.id, `${subject}\n\n${reporte.comando}`, [{ text: 'Mi agente / My agent', url: reporte.agenteUrl }]).catch(() => 0)
      alerted = alertables
      await store.markAlerted(corrida.verificacion.id, alerted)
    } catch (error) {
      console.error('[monitor] no se pudo alertar a', slug, error instanceof Error ? error.message : error)
    }
  }
  return { slug, ok: corrida.verificacion.ok, score: corrida.verificacion.score, eventos: corrida.eventos, alerted, tareas, seguimientos }
}

monitorRouter.post('/run/:slug', async (c) => c.json(await corridaConAlerta(c.req.param('slug'))))

monitorRouter.post('/run', async (c) => {
  const tenants = (await store.listTenants()).filter((t) => dominioVerificable(t.originUrl))
  const resultados: unknown[] = []
  // Secuencial: cada corrida hace ~12 GET al dominio del negocio y una segunda
  // medición si algo falló; en paralelo sería fácil parecer un ataque.
  for (const t of tenants) {
    try {
      // Sitios sin descripción: se escribe una leyendo el sitio (una vez; la del dueño nunca se pisa).
      if (!t.entityDescription?.trim()) await asegurarDescripcion(t).catch((e) => console.warn('[monitor] descripción', t.slug, e instanceof Error ? e.message : e))
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
      // La cadencia la eligió el dueño en su plan: quincenal o solo a pedido no reciben todas las semanas.
      if (!tocaCorreo(await store.getPlan(t.id))) continue
      // Las sugerencias de contenido entran como tareas (una sola llamada a Opus);
      // el correo lista las tareas abiertas.
      await generarTareas(t, { conContenido: true })
      // Citación: una ronda por semana con las preguntas del negocio (si tiene).
      if ((await store.listCitationPrompts(t.id)).length > 0) await correrRonda(t).catch((e) => console.warn('[monitor] citación', t.slug, e instanceof Error ? e.message : e))
      // ---- M7: comprador misterioso, solo si el objetivo incluye vender a agentes y los cobros están prendidos (mainnet) ----
      const objetivo = (await store.getPlan(t.id))?.goal
      if (env.cobrosVisibles && (objetivo === 'agent-sales' || objetivo === 'both')) await correrComprador(t).catch((e) => console.warn('[monitor] comprador misterioso', t.slug, e instanceof Error ? e.message : e))
      // ---- fin M7 ----
      const reporte = await armarReporte(t, actual)
      const { subject, html } = htmlSemanal(t, reporte)
      await enviarCorreo(t.email!, subject, html)
      // Resumen corto por Telegram: el avance del plan y lo abierto, con el enlace.
      const pasos = reporte.plan?.pasos.map((p) => `${p.hecho ? '✓' : '·'} ${p.titulo}`).join('\n') ?? ''
      await avisarPorTelegram(t.id, [subject, reporte.plan ? `\n**Plan**\n${pasos}` : '', reporte.tareas.length ? `\n${reporte.tareas.length} tareas abiertas / open tasks` : ''].filter(Boolean).join('\n'), [
        { text: 'Mi agente / My agent', url: reporte.agenteUrl },
      ]).catch(() => 0)
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

// ---- reportes programados: el cron horario manda los vencidos ----
// Seguro de correr dos veces: cada agenda se toma con un update condicional
// antes de mandarse. `?now=ISO` solo para probar en local.
monitorRouter.post('/schedules', async (c) => {
  const now = c.req.query('now')
  const ahora = now && !Number.isNaN(Date.parse(now)) ? new Date(now) : new Date()
  return c.json(await correrVencidos(ahora))
})
