/**
 * `@peaje/proxy/hono`: middleware de Hono (Node, Bun, Deno, Workers).
 *
 *   import { peajeHono } from '@peaje/proxy/hono'
 *   app.use(peajeHono({ slug: 'mi-negocio' }))
 *
 * Tipos locales en vez de importar los de Hono: el paquete compila sin `hono`
 * instalado y el middleware encaja en `app.use` de cualquier 4.x, porque solo
 * pide `c.req.raw`. El secreto sale de `secret`, de `c.env.PEAJE_ORIGIN_SECRET`
 * (Workers, donde no hay `process.env`) o de `process.env`, en ese orden.
 */
import { peajeFetch, type OpcionesPeaje } from './index'

export type { OpcionesPeaje } from './index'

export type ContextoMinimo = { req: { raw: Request }; env?: unknown }
export type MiddlewareHono = (c: ContextoMinimo, next: () => Promise<void>) => Promise<Response | void>

export function peajeHono(opciones: OpcionesPeaje): MiddlewareHono {
  let peaje: ReturnType<typeof peajeFetch> | null = null
  return async (c, next) => {
    // En Workers el secreto vive en `c.env`, que recién existe con la primera request.
    peaje ??= peajeFetch({
      ...opciones,
      secret: opciones.secret ?? (c.env as { PEAJE_ORIGIN_SECRET?: string } | undefined)?.PEAJE_ORIGIN_SECRET,
    })
    const res = await peaje(c.req.raw)
    if (res) return res
    await next()
  }
}

export default peajeHono
