import type { Context } from 'hono'

/**
 * Errores RFC 9457 (`application/problem+json`). Un agente no puede parsear
 * una página de error en HTML ni adivinar la forma de un `{error: string}`
 * distinto en cada ruta: todos los errores del gateway salen de acá.
 */
export type Problema = {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  hint?: string
}

const BASE_TIPO = 'https://peaje.dev/problems'

export function problema(
  c: Context,
  status: number,
  slug: string,
  title: string,
  extra?: { detail?: string; hint?: string },
) {
  const body: Problema = {
    type: `${BASE_TIPO}/${slug}`,
    title,
    status,
    instance: c.req.path,
    ...(extra?.detail ? { detail: extra.detail } : {}),
    ...(extra?.hint ? { hint: extra.hint } : {}),
  }
  return c.body(JSON.stringify(body, null, 2), status as 400, {
    'content-type': 'application/problem+json',
  })
}
