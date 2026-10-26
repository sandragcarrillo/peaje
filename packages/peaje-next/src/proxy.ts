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
 *
 * Desde 0.3.0 el manifiesto solo aporta rutas de API, y solo bajo `apiPrefixes`
 * (por defecto `/api/` y `/v1/`) y fuera de los paths reservados (raíz, login,
 * auth, `/_next`): un gateway no puede tapar una página del sitio. Las cookies
 * del sitio no viajan al gateway.
 */
import { crearProxyRuntime, HEADERS_NO_REENVIADOS, PEAJE_HOST_HEADER, PREFIJOS_API_POR_DEFECTO, type ProxyRuntime } from '@peaje/shared'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { baseDe, type OpcionesPeaje } from './index'

type Middleware = (req: NextRequest, ev: NextFetchEvent) => Response | undefined | void | Promise<Response | undefined | void>

const runtimes = new Map<string, ProxyRuntime>()

function runtimeDe(base: string, secreto: string | null, prefijosApi: readonly string[]) {
  const clave = `${base}|${secreto ? 'con' : 'sin'}|${prefijosApi.join(',')}`
  let r = runtimes.get(clave)
  if (!r) {
    r = crearProxyRuntime({ base, secreto, prefijosApi })
    runtimes.set(clave, r)
  }
  return r
}

export type OpcionesProxy = OpcionesPeaje & {
  /** Por defecto `process.env.PEAJE_ORIGIN_SECRET`. */
  secret?: string
  /**
   * Prefijos bajo los que viven tus rutas de API con precio. Una ruta del
   * dashboard fuera de ellos cobra solo en la URL del gateway, no en tu
   * dominio. Por defecto `['/api/', '/v1/']`. La raíz y los paths reservados
   * (`/login`, `/auth`, `/api/auth`, `/_next`...) nunca se aceptan.
   */
  apiPrefixes?: string[]
}

let avisado = false

/**
 * Un aviso por proceso con lo que el sitio no cobra en su dominio: rutas de API
 * sin PEAJE_ORIGIN_SECRET, y rutas fuera de `apiPrefixes` (o en un path
 * reservado), que el manifiesto ya no puede reenviar.
 */
function avisar(runtime: ProxyRuntime, conSecreto: boolean): void {
  if (!conSecreto) {
    void runtime.sinSecreto().then((faltan) => {
      if (faltan.length > 0) {
        console.warn(
          `[peaje] ${faltan.length} priced API route(s) are not charged on this domain because PEAJE_ORIGIN_SECRET is not set: ${faltan.map((p) => `${p.method} ${p.path}`).join(', ')}. Copy it from the Kit page of your Peaje dashboard into your hosting environment variables.`,
        )
      }
    })
  }
  void runtime.fueraDePrefijos().then((fuera) => {
    if (fuera.length > 0) {
      console.warn(
        `[peaje] ${fuera.length} priced API route(s) are outside apiPrefixes (${runtime.prefijosApi.join(', ') || 'none'}) or on a reserved path, so they are charged only at the gateway URL, not on this domain: ${fuera.map((p) => `${p.method} ${p.path}`).join(', ')}. A route under a prefix of its own (/weather/:city) is charged here once that prefix is in the apiPrefixes option; a single path at the root or a reserved path never is.`,
      )
    }
  })
}

export function peajeProxy(opciones: OpcionesProxy, siguiente?: Middleware): Middleware {
  if (!opciones?.slug) throw new Error('peajeProxy: `slug` is required (the business slug from your Peaje dashboard).')
  const base = baseDe(opciones)
  const secreto = opciones.secret ?? process.env.PEAJE_ORIGIN_SECRET ?? null
  const prefijosApi = opciones.apiPrefixes ?? PREFIJOS_API_POR_DEFECTO
  return async (req, ev) => {
    const runtime = runtimeDe(base, secreto, prefijosApi)
    if (!avisado) {
      avisado = true
      avisar(runtime, Boolean(secreto))
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
      // El host va también en PEAJE_HOST_HEADER porque Railway pisa X-Forwarded-Host.
      const headers = new Headers(req.headers)
      // Las cookies del sitio (la sesión de quien navega) no salen hacia el gateway.
      for (const h of HEADERS_NO_REENVIADOS) headers.delete(h)
      headers.set('x-forwarded-host', req.nextUrl.host)
      headers.set(PEAJE_HOST_HEADER, req.nextUrl.host)
      headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''))
      return NextResponse.rewrite(new URL(decision.destino), { request: { headers } })
    }
    return siguiente ? siguiente(req, ev) : NextResponse.next()
  }
}

export default peajeProxy
