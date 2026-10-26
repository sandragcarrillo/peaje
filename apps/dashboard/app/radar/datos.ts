import 'server-only'
import { PEAJE_FIXABLE, prevision, type OraCheck, type OraScore } from '@/lib/ora'
import { esfuerzoDe, RANGO_ESFUERZO, type Esfuerzo } from '@/lib/radar/esfuerzo'

/** Lo que Ora devuelve y el tipo de `lib/ora` no declara. */
type CheckCrudo = OraCheck & { details?: string }
type ScoreCrudo = OraScore & { pendingChecks?: (string | { id?: string })[] }

const CONOCIDOS = new Set(['pass', 'fail', 'warning', 'na', 'not_applicable'])

export type Fila = { check: CheckCrudo; puntos: number; bloque: string | null; viaGateway: boolean }

/** Un arreglo del radar: cuánto trabajo pide y si lo entrega el agente de Peaje. */
export type Paso = Fila & { esfuerzo: Esfuerzo; loArreglaElKit: boolean }

export type Lectura = {
  /** Checks que pasan (X de la frase). */
  bien: CheckCrudo[]
  /** Checks que aplican y se pudieron medir (Y de la frase). */
  total: number
  /** Lo que falta y el kit arregla, de más a menos puntos. */
  arreglables: Fila[]
  /** Lo que falta y el kit no cubre. */
  otras: Fila[]
  /** Todo lo que falta, lo fácil primero y, dentro de cada nivel, lo que más suma. */
  pasos: Paso[]
  /** Lo que falta y entrega el agente de Peaje, en el mismo orden. */
  delKit: Paso[]
  /** Cuándo midió Ora (ISO), si lo dice. */
  medido: string | null
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
 * Lo fácil primero; dentro de cada nivel, lo que más suma; a igual puntaje, lo
 * que entrega el agente de Peaje. Así arriba queda lo que sale en una tarde y
 * sube el puntaje, no lo que más suma en teoría pero depende de Google.
 */
function porEsfuerzo(a: Paso, b: Paso): number {
  return (
    RANGO_ESFUERZO[a.esfuerzo] - RANGO_ESFUERZO[b.esfuerzo] ||
    b.puntos - a.puntos ||
    Number(b.loArreglaElKit) - Number(a.loArreglaElKit)
  )
}

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

  const pasos: Paso[] = [
    ...arreglables.map((f) => ({ ...f, esfuerzo: esfuerzoDe(f.check.id), loArreglaElKit: true })),
    ...otras.map((f) => ({ ...f, esfuerzo: esfuerzoDe(f.check.id), loArreglaElKit: false })),
  ].sort(porEsfuerzo)

  return {
    bien,
    total: bien.length + faltan.length,
    arreglables,
    otras,
    pasos,
    delKit: pasos.filter((p) => p.loArreglaElKit),
    medido: s.scannedAt ?? null,
    sinMedir,
    parcial: sinMedir.length > 0 || (s.analysisStatus !== undefined && s.analysisStatus !== 'complete'),
    actual: p.actual,
    estimado: p.estimado,
    max: score.maxScore || 100,
  }
}

/**
 * La lista de "Lo que falta": todo lo que entrega el agente de Peaje más los
 * tres primeros del orden aunque el kit no los cubra. Los tres primeros salen
 * de lo fácil o de lo que pide más trabajo; lo que depende de otros solo
 * encabeza si no queda nada más. Lo que el kit no cubre fuera de esos tres no
 * se lista: eran decenas de filas y tapaban lo importante.
 */
export function principales(l: Lectura): Paso[] {
  const noDificiles = l.pasos.filter((p) => p.esfuerzo !== 'dificil')
  const primeros = new Set((noDificiles.length > 0 ? noDificiles : l.pasos).slice(0, 3).map((p) => p.check.id))
  return l.pasos.filter((p) => p.loArreglaElKit || primeros.has(p.check.id))
}

/**
 * Lo que más sube el puntaje pero pide más trabajo o depende de otros: de los
 * cinco arreglos que más suman, los que no están ya en la lista y no son
 * fáciles. Van al final, con la nota de que toman más tiempo. Tres como mucho.
 */
export function masTiempo(l: Lectura, mostrados: Paso[]): Paso[] {
  const ya = new Set(mostrados.map((p) => p.check.id))
  const masSuman = l.pasos
    .filter((p) => p.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 5)
  return masSuman.filter((p) => !ya.has(p.check.id) && p.esfuerzo !== 'facil').sort(porEsfuerzo).slice(0, 3)
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
