/**
 * `@peaje/proxy/vercel`: Routing Middleware de Vercel para proyectos que no
 * son Next (Vite, SPA estática, Remix, SvelteKit en Vercel). Va en
 * `middleware.ts` en la raíz, al lado de `package.json`:
 *
 *   import peaje from '@peaje/proxy/vercel'
 *   export default peaje({ slug: 'mi-negocio' })
 *   export const config = { matcher: ['/((?!assets/|favicon.ico).*)'] }
 *
 * Responde con el mismo contrato de headers que `rewrite()` y `next()` de
 * `@vercel/functions` (y antes `@vercel/edge`, y `NextResponse` en Next):
 * `x-middleware-rewrite` con el destino, `x-middleware-next` para seguir, y
 * `x-middleware-override-headers` + `x-middleware-request-<nombre>` para
 * cambiar los headers de la request. Así no hace falta instalar nada más: la
 * request no pasa por la función, Vercel la reescribe al gateway (método,
 * body y query intactos). Con un middleware propio: `peaje({ slug }, tuyo)`.
 */
import { PEAJE_HOST_HEADER } from '@peaje/shared'
import { crearPeaje, type OpcionesPeaje } from './index'

export type { OpcionesPeaje } from './index'

type Contexto = { waitUntil(promesa: Promise<unknown>): void }
export type MiddlewareVercel = (request: Request, context?: Contexto) => Response | undefined | void | Promise<Response | undefined | void>

/** Lo que hacen `rewrite()` / `next()` de @vercel/functions 3.x, sin la dependencia. */
function respuestaMiddleware(control: Record<string, string>, requestHeaders?: Headers): Response {
  const headers = new Headers(control)
  if (requestHeaders) {
    const claves: string[] = []
    requestHeaders.forEach((valor, clave) => {
      headers.set(`x-middleware-request-${clave}`, valor)
      claves.push(clave)
    })
    headers.set('x-middleware-override-headers', claves.join(','))
  }
  return new Response(null, { headers })
}

export function peajeVercel(opciones: OpcionesPeaje, siguiente?: MiddlewareVercel): (request: Request, context?: Contexto) => Promise<Response> {
  const peaje = crearPeaje(opciones)
  return async (request, context) => {
    const url = new URL(request.url)
    const entrada = { method: request.method.toUpperCase(), url, headers: request.headers }
    const destino = await peaje.decidir(entrada)
    if (destino) {
      // El gateway arma la URL del 402 con estos headers: sin ellos el
      // challenge nombra al gateway y los clientes x402 estrictos abortan.
      const headers = new Headers(request.headers)
      headers.set('x-forwarded-host', url.host)
      // Railway (donde corre el gateway) pisa X-Forwarded-Host: el host del negocio va también acá.
      headers.set(PEAJE_HOST_HEADER, url.host)
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
      return respuestaMiddleware({ 'x-middleware-rewrite': destino }, headers)
    }
    const propia = siguiente ? await siguiente(request, context) : undefined
    return propia ?? respuestaMiddleware({ 'x-middleware-next': '1' })
  }
}

export default peajeVercel
