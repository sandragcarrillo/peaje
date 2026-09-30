import type { Route } from '@peaje/db'
import { segmentosCanonicos } from '@peaje/shared'

type Match = { route: Route; params: Record<string, string> }

/**
 * Empareja un path contra los patrones del tenant.
 *
 * Soporta segmentos literales, `:param` y `*` como comodín de cola.
 * Gana el patrón más específico: literal sobre param, param sobre comodín.
 */
export function matchRoute(routes: Route[], method: string, path: string): Match | null {
  // Mismo path que ve el servidor del negocio (ver segmentosCanonicos).
  const parts = segmentosCanonicos(path)
  let best: (Match & { score: number }) | null = null

  for (const route of routes) {
    if (route.method.toUpperCase() !== method.toUpperCase()) continue
    const result = matchPattern(route.pathPattern, parts)
    if (!result) continue
    if (!best || result.score > best.score) best = { route, params: result.params, score: result.score }
  }

  return best ? { route: best.route, params: best.params } : null
}

function split(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function matchPattern(
  pattern: string,
  parts: string[],
): { params: Record<string, string>; score: number } | null {
  const patternParts = split(pattern)
  const params: Record<string, string> = {}
  let score = 0

  for (let i = 0; i < patternParts.length; i++) {
    const segment = patternParts[i]!
    if (segment === '*') {
      // El comodín consume el resto, incluso si no queda nada.
      return { params, score }
    }
    const value = parts[i]
    if (value === undefined) return null
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = value
      score += 1
      continue
    }
    if (segment.toLowerCase() !== value.toLowerCase()) return null
    score += 2
  }

  return patternParts.length === parts.length ? { params, score } : null
}
