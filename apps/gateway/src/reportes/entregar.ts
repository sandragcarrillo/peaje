import type { AgentMessage, ReportSchedule, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { esActivo } from '../billing/acceso.js'
import { conversar } from '../tareas/agente.js'
import { largoNominal, proximaCorrida } from './agenda.js'
import { reporteVisitas } from './visitas.js'

/**
 * Reportes programados: un registro de canales (Telegram hoy, Slack después)
 * y la entrega de una agenda vencida. Cada canal se registra solo con
 * `registrarCanal` desde su módulo; este archivo no importa ningún canal.
 *
 *   agent_visits → el resumen de visitas (reportes/visitas.ts)
 *   custom       → el pedido del dueño pasa por `conversar` y la respuesta
 *                  del agente sale al mismo destino, con sus botones
 */

export type Idioma = 'es' | 'en'

/** Lo que se entrega: un texto con enlaces, o la respuesta del agente a un pedido programado. */
export type Entrega =
  | { tipo: 'reporte'; texto: string; botones: { text: string; url: string }[] }
  | { tipo: 'agente'; pedido: string; mensaje: AgentMessage }

export type CanalReportes = {
  /** El destino sigue conectado a ese negocio: su idioma. Null si ya no (la agenda se borra). */
  destino(s: ReportSchedule): Promise<{ idioma: Idioma } | null>
  /** Manda la entrega. Markdown mínimo: **negrita** y viñetas "- ". */
  enviar(s: ReportSchedule, tenant: Tenant, entrega: Entrega, idioma: Idioma): Promise<void>
  /** Destinos conectados de un negocio, para el agente y el dashboard. */
  destinos(tenantId: string): Promise<{ target: string; nombre: string; idioma: Idioma }[]>
}

const canales = new Map<string, CanalReportes>()

export function registrarCanal(nombre: string, canal: CanalReportes): void {
  canales.set(nombre, canal)
}

export const canalReportes = (nombre: string) => canales.get(nombre) ?? null
export const canalesReportes = () => [...canales.keys()]

/** Todos los destinos conectados del negocio, en todos los canales registrados. */
export async function destinosDe(tenantId: string): Promise<{ channel: string; target: string; nombre: string; idioma: Idioma }[]> {
  const listas = await Promise.all(
    [...canales.entries()].map(async ([channel, c]) => (await c.destinos(tenantId).catch(() => [])).map((d) => ({ channel, ...d }))),
  )
  return listas.flat()
}

export type ResultadoEntrega = 'sent' | 'no-pro' | 'disconnected' | 'no-tenant' | 'no-channel'

/**
 * Entrega una agenda: arma el contenido y lo manda por su canal. No marca ni
 * calcula la próxima corrida (eso lo hace `correrVencidos`, que la toma antes
 * para no mandar dos veces). Usa `s.lastRunAt` tal como estaba antes de tomarla.
 * Lanza si el envío falla.
 */
export async function entregarProgramado(s: ReportSchedule, hasta: Date = new Date()): Promise<ResultadoEntrega> {
  const canal = canales.get(s.channel)
  if (!canal) return 'no-channel'
  const tenant = await store.getTenantById(s.tenantId)
  if (!tenant) return 'no-tenant'
  const destino = await canal.destino(s)
  if (!destino) {
    // El chat se desconectó: la agenda ya no tiene a quién mandarle.
    await store.deleteReportSchedules(s.tenantId, { id: s.id })
    return 'disconnected'
  }
  // Igual que Telegram: los reportes al chat son parte de Pro.
  if (!esActivo(tenant)) return 'no-pro'
  const { idioma } = destino

  if (s.kind === 'custom') {
    const pedido = s.prompt ?? ''
    let mensaje: AgentMessage
    try {
      mensaje = await conversar(tenant, pedido, { idioma, canal: s.channel, destino: { canal: s.channel, id: s.target }, programado: true })
    } catch (error) {
      const msj = error instanceof Error ? error.message : String(error)
      // Tope de mensajes o sin Pro: se le dice al dueño en una línea. Lo demás es error del cron.
      if (!/mensajes|messages|Pro/i.test(msj)) throw error
      const texto = idioma === 'es' ? `No pude correr lo que pediste ("${pedido}"): ${msj}` : `I could not run what you asked for ("${pedido}"): ${msj}`
      await canal.enviar(s, tenant, { tipo: 'reporte', texto, botones: [] }, idioma)
      return 'sent'
    }
    await canal.enviar(s, tenant, { tipo: 'agente', pedido, mensaje }, idioma)
    return 'sent'
  }

  const desde = s.lastRunAt ? new Date(s.lastRunAt) : new Date(hasta.getTime() - largoNominal(s.frequency))
  const r = await reporteVisitas(tenant, { desde, hasta, frecuencia: s.frequency, zona: s.timezone, idioma })
  await canal.enviar(s, tenant, { tipo: 'reporte', texto: r.texto, botones: r.botones }, idioma)
  return 'sent'
}

/**
 * Lo que llama el cron horario: toma cada agenda vencida (condicional sobre
 * next_run_at, así dos corridas a la vez no mandan dos veces), calcula la
 * próxima desde ahora (una agenda atrasada manda una vez, no una por cada
 * hora perdida) y la entrega. A lo sumo una vez: si el envío falla, queda
 * para el próximo período.
 */
export async function correrVencidos(ahora: Date = new Date()): Promise<{
  due: number
  results: { id: string; tenantId: string; channel: string; kind: string; result: ResultadoEntrega | 'taken' | 'error'; error?: string; nextRunAt?: string }[]
}> {
  const vencidas = await store.listDueReportSchedules(ahora.toISOString())
  const results: Awaited<ReturnType<typeof correrVencidos>>['results'] = []
  // En serie: un custom llama al modelo y tarda; en paralelo sería fácil topar el límite de la API.
  for (const s of vencidas) {
    const base = { id: s.id, tenantId: s.tenantId, channel: s.channel, kind: s.kind }
    let siguiente: Date
    try {
      siguiente = proximaCorrida(s, ahora)
    } catch (error) {
      results.push({ ...base, result: 'error', error: error instanceof Error ? error.message : String(error) })
      continue
    }
    const tomada = await store.markReportScheduleSent(s.id, { previousNextRunAt: s.nextRunAt, sentAt: ahora.toISOString(), nextRunAt: siguiente.toISOString() })
    if (!tomada) {
      results.push({ ...base, result: 'taken' })
      continue
    }
    try {
      results.push({ ...base, result: await entregarProgramado(s, ahora), nextRunAt: siguiente.toISOString() })
    } catch (error) {
      console.error('[reportes] no se pudo entregar', s.id, error instanceof Error ? error.message : error)
      results.push({ ...base, result: 'error', error: error instanceof Error ? error.message : String(error), nextRunAt: siguiente.toISOString() })
    }
  }
  return { due: vencidas.length, results }
}

/** La próxima corrida en palabras, en la zona de la agenda. */
export function fechaLocal(iso: string, zona: string, idioma: Idioma): string {
  return new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', {
    timeZone: zona,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}
