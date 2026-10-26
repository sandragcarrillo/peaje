import 'server-only'
import { PEAJE_FIXABLE, prevision, type OraCheck, type OraScore } from '@/lib/ora'

/** Lo que Ora devuelve y el tipo de `lib/ora` no declara. */
type CheckCrudo = OraCheck & { details?: string }
type ScoreCrudo = OraScore & { pendingChecks?: (string | { id?: string })[] }

const CONOCIDOS = new Set(['pass', 'fail', 'warning', 'na', 'not_applicable'])

export type Fila = { check: CheckCrudo; puntos: number; bloque: string | null; viaGateway: boolean }

export type Lectura = {
  /** Checks que pasan (X de la frase). */
  bien: CheckCrudo[]
  /** Checks que aplican y se pudieron medir (Y de la frase). */
  total: number
  /** Lo que falta y el kit arregla, de más a menos puntos. */
  arreglables: Fila[]
  /** Lo que falta y el kit no cubre. */
  otras: Fila[]
  /** Lo que Ora no pudo medir: ni a favor ni en contra. */
  sinMedir: CheckCrudo[]
  /** Ora dice que el análisis no terminó. */
  parcial: boolean
  actual: number
  estimado: number
  max: number
}

const puntosDe = (c: OraCheck) => c.estScoreGain ?? c.maxScore ?? 0

/**
 * Lee el score de Ora para el radar. "No se pudo medir" sale de lo que Ora
 * expone: `pendingChecks` (ids que no terminaron) y cualquier estado que no
 * sea pass/fail/warning/na. Ora no marca un check como "error" de otra forma.
 */
export function leer(score: OraScore): Lectura {
  const s = score as ScoreCrudo
  const pendientes = new Set(
    (s.pendingChecks ?? []).map((p) => (typeof p === 'string' ? p : p?.id ?? '')).filter(Boolean),
  )
  const vistos = new Set<string>()
  const bien: CheckCrudo[] = []
  const faltan: CheckCrudo[] = []
  const sinMedir: CheckCrudo[] = []
  for (const layer of score.layers ?? []) {
    for (const check of layer.checks as CheckCrudo[]) {
      // Ora repite algunos checks (MCP de producto y de docs): para el dueño es uno.
      if (vistos.has(check.id)) continue
      vistos.add(check.id)
      if (pendientes.has(check.id) || !CONOCIDOS.has(check.status)) sinMedir.push(check)
      else if (check.status === 'pass') bien.push(check)
      else if (check.status === 'fail' || check.status === 'warning') faltan.push(check)
    }
  }
  const p = prevision(score)
  const noMedidos = new Set(sinMedir.map((c) => c.id))
  const arreglables: Fila[] = p.arreglables
    .filter((a) => !noMedidos.has(a.check.id))
    .map((a) => ({ check: a.check as CheckCrudo, puntos: puntosDe(a.check), bloque: a.bloque, viaGateway: a.viaGateway }))
    .sort((a, b) => b.puntos - a.puntos)
  const otras: Fila[] = faltan
    .filter((c) => !PEAJE_FIXABLE[c.id])
    .map((c) => ({ check: c, puntos: c.estScoreGain ?? 0, bloque: null, viaGateway: false }))
    .sort((a, b) => b.puntos - a.puntos)

  return {
    bien,
    total: bien.length + faltan.length,
    arreglables,
    otras,
    sinMedir,
    parcial: sinMedir.length > 0 || (s.analysisStatus !== undefined && s.analysisStatus !== 'complete'),
    actual: p.actual,
    estimado: p.estimado,
    max: score.maxScore || 100,
  }
}

/** El arreglo para "Empieza por aquí": el que más suma de lo que el dueño puede hacer en su repo. */
export function primero(l: Lectura): Fila | null {
  return l.arreglables.find((a) => !a.viaGateway) ?? l.arreglables[0] ?? null
}

export type Barra = { clave: 'encuentran' | 'usan' | 'compran'; puntos: number; max: number }

/** Las cuatro capas de Ora en las tres preguntas del dueño. Usa el puntaje que Ora da a cada capa. */
const GRUPO: Record<string, Barra['clave']> = {
  discovery: 'encuentran',
  accessibility: 'usan',
  usability: 'usan',
  payments: 'compran',
}

export function barras(score: OraScore): Barra[] {
  const suma = { encuentran: { p: 0, m: 0 }, usan: { p: 0, m: 0 }, compran: { p: 0, m: 0 } }
  for (const layer of score.layers ?? []) {
    const g = GRUPO[layer.id]
    if (!g) continue
    suma[g].p += layer.score ?? 0
    suma[g].m += layer.maxScore ?? 0
  }
  return (['encuentran', 'usan', 'compran'] as const).map((clave) => ({ clave, puntos: suma[clave].p, max: suma[clave].m }))
}
