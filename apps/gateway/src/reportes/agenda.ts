import type { ReportFrequency } from '@peaje/db'

/**
 * Cuándo toca el próximo reporte programado. Todo con zonas IANA por Intl,
 * sin dependencias: la hora que eligió el dueño es hora de su reloj, así que
 * en una zona con horario de verano (America/New_York) el instante UTC cambia
 * de una semana a otra y la hora local no.
 *
 * Reglas para las horas raras del cambio de hora:
 * - Hora que no existe (se adelanta el reloj, 2:00 → 3:00): sale a la primera
 *   hora válida después, con el desfase de antes (2:00 queda en 3:00).
 * - Hora que existe dos veces (se atrasa el reloj, 1:00 dos veces): la primera.
 */

export type Agenda = {
  frequency: ReportFrequency
  /** 0-23, hora local. */
  hour: number
  /** weekly: 0 domingo … 6 sábado. */
  weekday?: number | null
  /** monthly: 1-28. */
  dayOfMonth?: number | null
  timezone: string
}

export const ZONA_POR_DEFECTO = 'America/Bogota'

const formatos = new Map<string, Intl.DateTimeFormat>()
function formato(zona: string): Intl.DateTimeFormat {
  let f = formatos.get(zona)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formatos.set(zona, f)
  }
  return f
}

/** True si Intl conoce la zona. */
export function zonaValida(zona: string): boolean {
  try {
    formato(zona)
    return true
  } catch {
    return false
  }
}

/** La fecha y hora de reloj de un instante en la zona. */
export function relojEn(ms: number, zona: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const p: Record<string, number> = {}
  for (const parte of formato(zona).formatToParts(new Date(ms))) if (parte.type !== 'literal') p[parte.type] = Number(parte.value)
  return { y: p.year!, m: p.month!, d: p.day!, h: p.hour! % 24, min: p.minute!, s: p.second! }
}

/** Desfase de la zona en ese instante, en ms (Bogotá: -5 h). */
function desfase(ms: number, zona: string): number {
  const r = relojEn(ms, zona)
  return Date.UTC(r.y, r.m - 1, r.d, r.h, r.min, r.s) - Math.floor(ms / 1000) * 1000
}

/** El instante UTC de una hora de reloj en la zona (m es 1-12). */
export function relojAUtc(y: number, m: number, d: number, h: number, zona: string): number {
  const local = Date.UTC(y, m - 1, d, h)
  // Los dos desfases posibles alrededor de esa hora (iguales casi siempre).
  const antes = desfase(local - 36 * 3_600_000, zona)
  const despues = desfase(local + 36 * 3_600_000, zona)
  const validos = [...new Set([antes, despues])].map((o) => local - o).filter((t) => desfase(t, zona) === local - t)
  if (validos.length) return Math.min(...validos)
  // No existe (el reloj saltó): con el desfase de antes cae justo después del salto.
  return local - antes
}

/** El primer instante estrictamente después de `despues` que cumple la agenda. */
export function proximaCorrida(agenda: Agenda, despues: Date | number = Date.now()): Date {
  const t0 = typeof despues === 'number' ? despues : despues.getTime()
  const hoy = relojEn(t0, agenda.timezone)
  // Hasta 62 días de reloj: alcanza para cualquier día de mes 1-28.
  for (let i = 0; i <= 62; i++) {
    const dia = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + i))
    const y = dia.getUTCFullYear()
    const m = dia.getUTCMonth() + 1
    const d = dia.getUTCDate()
    if (agenda.frequency === 'weekly' && dia.getUTCDay() !== agenda.weekday) continue
    if (agenda.frequency === 'monthly' && d !== agenda.dayOfMonth) continue
    const t = relojAUtc(y, m, d, agenda.hour, agenda.timezone)
    if (t > t0) return new Date(t)
  }
  throw new Error('proximaCorrida: agenda inválida')
}

/** Lo que dura un período nominal, para el primer reporte y para comparar. */
export function largoNominal(frecuencia: ReportFrequency): number {
  return (frecuencia === 'daily' ? 1 : frecuencia === 'weekly' ? 7 : 30) * 86_400_000
}

/** Valida y normaliza lo que llega del dashboard o del agente. Devuelve el error en palabras si algo no cierra. */
export function validarAgenda(x: { frequency?: unknown; hour?: unknown; weekday?: unknown; dayOfMonth?: unknown; timezone?: unknown }): Agenda | { error: string } {
  const frequency = x.frequency
  if (frequency !== 'daily' && frequency !== 'weekly' && frequency !== 'monthly') return { error: 'frequency must be daily, weekly or monthly' }
  const hour = Number(x.hour)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: 'hour must be an integer 0-23' }
  const timezone = typeof x.timezone === 'string' && x.timezone.trim() ? x.timezone.trim() : ZONA_POR_DEFECTO
  if (!zonaValida(timezone)) return { error: `unknown timezone ${timezone}` }
  let weekday: number | null = null
  let dayOfMonth: number | null = null
  if (frequency === 'weekly') {
    weekday = Number(x.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: 'weekday must be 0 (Sunday) to 6 (Saturday)' }
  }
  if (frequency === 'monthly') {
    dayOfMonth = Number(x.dayOfMonth)
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) return { error: 'dayOfMonth must be 1-28' }
  }
  return { frequency, hour, weekday, dayOfMonth, timezone }
}
