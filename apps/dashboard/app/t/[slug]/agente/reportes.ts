import type { AgentTask } from '@peaje/db'
import type { Citacion } from '@/lib/gateway'

/**
 * Lo que los reportes del agente leen del cuerpo de una tarea de contenido.
 * El gateway escribe esas líneas (tareas/generar.ts lineasDeFormato, ciclo/
 * borrador.ts cuerpoConBorrador, ciclo/serie.ts lineasDeSerie); acá solo se
 * leen, sin modelo.
 */

export const MARCA_BORRADOR = '\n## Draft\n'

export const borradorDe = (t: Pick<AgentTask, 'body'>) => t.body.split(MARCA_BORRADOR)[1]?.trim() ?? null
export const instruccionesDe = (t: Pick<AgentTask, 'body'>) => t.body.split(MARCA_BORRADOR)[0]?.trim() ?? t.body

/** Los [TODO: ...] que quedan en un borrador. */
export const pendientesDe = (markdown: string) => [...markdown.matchAll(/\[TODO:\s*([^\]]+)\]/g)].map((m) => m[1]!.trim())

/** El formato elegido y la página citada a imitar, si la tarea los trae. */
export function formatoDe(t: Pick<AgentTask, 'body'>): { formato: string | null; modelo: string | null } {
  const cabecera = instruccionesDe(t)
  const formato = cabecera.match(/^- Format: ([a-z]+)\./m)?.[1] ?? null
  const modelo = cabecera.match(/^- AI assistants already cite this page[^:]*: (\S+)/m)?.[1] ?? null
  return { formato, modelo }
}

export const esDeSerie = (t: Pick<AgentTask, 'body'>) => /^- Series/m.test(instruccionesDe(t))

/** La URL donde va a vivir la página (criterio de aceptación). */
export const direccionDe = (t: Pick<AgentTask, 'acceptance'>) => {
  const a = t.acceptance.find((x) => x.type === 'url')
  return a && a.type === 'url' ? a.url : null
}

const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,:;"'«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Preguntas medidas donde ningún motor cita al negocio en la última ronda. */
export function preguntasSinCita(c: Citacion | null): string[] {
  if (!c?.summary.measuredAt) return []
  return c.summary.byPrompt
    .filter((p) => {
      const rs = Object.values(p.engines).filter((r) => !r.error)
      return rs.length > 0 && rs.every((r) => !r.cited)
    })
    .map((p) => p.prompt)
}

/** La tarea contesta una pregunta medida: mismo texto, o uno contiene al otro. */
export function coincide(titulo: string, preguntas: string[]): boolean {
  const a = normal(titulo)
  return preguntas.some((q) => {
    const b = normal(q)
    return a === b || (b.length > 12 && a.includes(b)) || (a.length > 12 && b.includes(a))
  })
}

export type Oportunidad = {
  tarea: AgentTask
  formato: string | null
  modelo: string | null
  pendientes: number
  conBorrador: boolean
  noCitado: boolean
  serie: boolean
  puntos: number
}

/**
 * Ordena las tareas de contenido abiertas por evidencia: una pregunta que
 * medimos y donde hoy no aparece pesa más que todo; después tener una página
 * citada para imitar, un formato elegido, un borrador y pocos datos faltantes.
 */
export function ordenarOportunidades(tareas: AgentTask[], citacion: Citacion | null): Oportunidad[] {
  const sinCita = preguntasSinCita(citacion)
  return tareas
    .filter((t) => t.kind === 'content' && (t.status === 'open' || t.status === 'in_progress'))
    .map((t) => {
      const { formato, modelo } = formatoDe(t)
      const borrador = borradorDe(t)
      const pendientes = borrador ? pendientesDe(borrador).length : 0
      const noCitado = coincide(t.title, sinCita)
      const serie = esDeSerie(t)
      const puntos = (noCitado ? 4 : 0) + (modelo ? 2 : formato ? 1 : 0) + (borrador ? 1 : 0) + (borrador && pendientes === 0 ? 1 : 0) + (serie ? 0.5 : 0) - (t.key.startsWith('content:refresh:') ? 2 : 0)
      return { tarea: t, formato, modelo, pendientes, conBorrador: !!borrador, noCitado, serie, puntos }
    })
    .sort((a, b) => b.puntos - a.puntos || b.tarea.updatedAt.localeCompare(a.tarea.updatedAt))
}
