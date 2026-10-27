/**
 * La foto de citación del radar: tres preguntas de compra hechas a los motores
 * de IA, si el sitio sale citado y a quién citan en su lugar. La arma el
 * gateway (POST /_internal/radar/citas); acá van el tipo, la limpieza de lo
 * que llega y los nombres de los motores. Lo usan server y cliente: el único
 * import es la lista de asistentes medidos, que no arrastra nada.
 */

import { MOTORES_MEDIDOS } from '@peaje/shared/asistentes'

export type Celda = { cited: boolean; mentioned: boolean; sources: string[] }

export type Citas = {
  domain: string
  measuredAt: string | null
  cached: boolean
  questions: { text: string; engines: Record<string, Celda> }[]
  coverage: Record<string, { cited: number; total: number }>
  citedInstead: { domain: string; count: number; kind: 'publisher' | 'competitor' | null }[]
  engines: string[]
  /** Solo lo pone el stub de desarrollo (citas.ts): la UI avisa que los datos son inventados. */
  ejemplo?: true
}

/** 'limit' lo pone el dashboard (tope por IP); las otras vienen del gateway. */
export type ErrorCitas = { error: 'budget' | 'unavailable' | 'invalid-domain' | 'limit'; retryAfterSeconds?: number; ejemplo?: true }

export type RespuestaCitas = Citas | ErrorCitas

export const esErrorCitas = (r: RespuestaCitas): r is ErrorCitas => 'error' in r

const NOMBRES: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', claude: 'Claude', gemini: 'Gemini' }

/** Los motores que pregunta el gateway hoy (los medidos en producción), para el texto de espera. */
export const MOTORES_POR_DEFECTO: string[] = [...MOTORES_MEDIDOS]

/** Nombre para mostrar; un id que no conocemos sale tal cual, con mayúscula inicial. */
export function nombreMotor(id: string): string {
  return NOMBRES[id] ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : id)
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const entero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null)
const ID_MOTOR = /^[a-z0-9][a-z0-9_-]{0,31}$/
const DOMINIO = /^([a-z0-9-]+\.)+[a-z]{2,}$/i
const ERRORES = new Set(['budget', 'unavailable', 'invalid-domain'])

/**
 * Lo que respondió el gateway, limpio. Si trae `error`, el error (los que no
 * conocemos cuentan como 'unavailable'). Si la forma no cierra (sin motores o
 * sin preguntas), 'unavailable': nunca se muestra un número que no vino.
 */
export function normalizarCitas(data: unknown, ok: boolean): RespuestaCitas {
  if (esObjeto(data) && typeof data.error === 'string') {
    const error = (ERRORES.has(data.error) ? data.error : 'unavailable') as ErrorCitas['error']
    const espera = entero(data.retryAfterSeconds)
    return espera && espera > 0 ? { error, retryAfterSeconds: Math.min(espera, 86_400) } : { error }
  }
  if (!ok || !esObjeto(data)) return { error: 'unavailable' }

  const engines = (Array.isArray(data.engines) ? data.engines : [])
    .filter((e): e is string => typeof e === 'string' && ID_MOTOR.test(e))
    .slice(0, 8)
  const questions: Citas['questions'] = []
  for (const q of Array.isArray(data.questions) ? data.questions.slice(0, 10) : []) {
    if (!esObjeto(q) || typeof q.text !== 'string' || !q.text.trim() || !esObjeto(q.engines)) continue
    const celdas: Record<string, Celda> = {}
    for (const id of engines) {
      const c = q.engines[id]
      if (!esObjeto(c)) continue
      celdas[id] = {
        cited: c.cited === true,
        mentioned: c.mentioned === true,
        sources: (Array.isArray(c.sources) ? c.sources : []).filter((s): s is string => typeof s === 'string').slice(0, 10).map((s) => s.slice(0, 200)),
      }
    }
    questions.push({ text: q.text.trim().slice(0, 300), engines: celdas })
  }
  if (engines.length === 0 || questions.length === 0) return { error: 'unavailable' }

  // Cobertura: la del gateway; si falta la de un motor, sale de las preguntas (contar, no inventar).
  const coverage: Citas['coverage'] = {}
  const cruda = esObjeto(data.coverage) ? data.coverage : {}
  for (const id of engines) {
    const c = cruda[id]
    const cited = esObjeto(c) ? entero(c.cited) : null
    const total = esObjeto(c) ? entero(c.total) : null
    if (cited !== null && total !== null && cited <= total) coverage[id] = { cited, total }
    else {
      const respondidas = questions.filter((q) => q.engines[id])
      coverage[id] = { cited: respondidas.filter((q) => q.engines[id]!.cited).length, total: respondidas.length }
    }
  }

  const citedInstead: Citas['citedInstead'] = []
  for (const x of Array.isArray(data.citedInstead) ? data.citedInstead : []) {
    if (!esObjeto(x) || typeof x.domain !== 'string') continue
    const domain = x.domain.trim().toLowerCase()
    const count = entero(x.count)
    if (!DOMINIO.test(domain) || domain.length > 100 || !count) continue
    const kind = x.kind === 'publisher' || x.kind === 'competitor' ? x.kind : null
    citedInstead.push({ domain, count, kind })
    if (citedInstead.length >= 12) break
  }

  const medido = typeof data.measuredAt === 'string' && !Number.isNaN(Date.parse(data.measuredAt)) ? data.measuredAt : null
  return {
    domain: typeof data.domain === 'string' ? data.domain.slice(0, 200) : '',
    measuredAt: medido,
    cached: data.cached === true,
    questions,
    coverage,
    citedInstead,
    engines,
  }
}
