/**
 * `peajeProxy({ slug })`: el middleware (`proxy.ts` en Next 16, `middleware.ts`
 * antes) que reenvía al gateway de Peaje, en tiempo de ejecución, las rutas
 * que cobran: los archivos de discovery, los links con precio y las rutas de
 * API con precio de la tabla del negocio. Lee `/kit/manifest.json` y lo cachea
 * un minuto, así una ruta publicada desde el dashboard o por el agente cobra
 * en el dominio del negocio sin redeploy.
 *
 * Uso mínimo (proxy.ts o middleware.ts en la raíz):
 *
 *   import { peajeProxy } from '@peaje/next/proxy'
 *   export default peajeProxy({ slug: 'mi-negocio' })
 *   export const config = { matcher: ['/((?!_next/|favicon.ico).*)'] }
 *
 * Con un middleware propio: `peajeProxy({ slug }, miMiddleware)`. Lo de Peaje
 * corre primero; si no le toca, sigue el tuyo.
 *
 * Las rutas de API con precio necesitan PEAJE_ORIGIN_SECRET (dashboard, página
 * del kit) en el entorno: es lo que distingue al gateway entregando una
 * request pagada de un agente que se hace pasar por él. Sin él, solo se
 * reenvían los archivos de discovery y los links `/r/`, y se avisa en consola.
 */
import { crearProxyRuntime, RUTAS_DINAMICAS, RUTAS_PROXY } from '@peaje/shared'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { baseDe, type OpcionesPeaje } from './index'

type Middleware = (req: NextRequest, ev: NextFetchEvent) => Response | undefined | void | Promise<Response | undefined | void>

const runtimes = new Map<string, ReturnType<typeof crearProxyRuntime>>()

function runtimeDe(base: string, secreto: string | null) {
  const clave = `${base}|${secreto ? 'con' : 'sin'}`
  let r = runtimes.get(clave)
  if (!r) {
    r = crearProxyRuntime({
      base,
      secreto,
      respaldo: { rutas: RUTAS_PROXY.map((x) => x.path), prefijos: RUTAS_DINAMICAS.map((x) => x.prefijo), patrones: [] },
    })
    runtimes.set(clave, r)
  }
  return r
}

export type OpcionesProxy = OpcionesPeaje & {
  /** Por defecto `process.env.PEAJE_ORIGIN_SECRET`. */
  secret?: string
}

let avisado = false

export function peajeProxy(opciones: OpcionesProxy, siguiente?: Middleware): Middleware {
  if (!opciones?.slug) throw new Error('peajeProxy: `slug` is required (the business slug from your Peaje dashboard).')
  const base = baseDe(opciones)
  const secreto = opciones.secret ?? process.env.PEAJE_ORIGIN_SECRET ?? null
  return async (req, ev) => {
    const runtime = runtimeDe(base, secreto)
    if (!secreto && !avisado) {
      avisado = true
      void runtime.sinSecreto().then((faltan) => {
        if (faltan.length > 0) {
          console.warn(
            `[peaje] ${faltan.length} priced API route(s) are not charged on this domain because PEAJE_ORIGIN_SECRET is not set: ${faltan.map((p) => `${p.method} ${p.path}`).join(', ')}. Copy it from the Kit page of your Peaje dashboard into your hosting environment variables.`,
          )
        }
      })
    }
    const decision = await runtime.decidir({
      method: req.method,
      pathname: req.nextUrl.pathname,
      search: req.nextUrl.search,
      headers: req.headers,
    })
    if (decision) {
      // El gateway arma la URL del 402 con estos headers: sin ellos el
      // challenge nombra al gateway y los clientes x402 estrictos abortan.
      const headers = new Headers(req.headers)
      headers.set('x-forwarded-host', req.nextUrl.host)
      headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''))
      return NextResponse.rewrite(new URL(decision.destino), { request: { headers } })
    }
    return siguiente ? siguiente(req, ev) : NextResponse.next()
  }
}

export default peajeProxy
