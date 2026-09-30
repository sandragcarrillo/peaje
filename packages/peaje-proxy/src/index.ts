/**
 * `@peaje/proxy`: el proxy de Peaje para cualquier servidor con `Request` y
 * `Response` estándar. Decide si una request del dominio del negocio va al
 * gateway (archivos de discovery, links `/r/`, rutas de API con precio del
 * manifiesto) y, si va, la reenvía y devuelve la respuesta del gateway: el
 * 402 con el challenge, o lo que entregó el origen después del pago.
 *
 *   import { peajeFetch } from '@peaje/proxy'
 *   const peaje = peajeFetch({ slug: 'mi-negocio' })
 *   const res = await peaje(request)   // null: no es de Peaje, sigue la app
 *
 * Los adaptadores (`/express`, `/hono`, `/vercel`) usan `crearPeaje`, que
 * separa decidir de reenviar: en Express el body no se lee hasta saber que la
 * request es de Peaje, así los body parsers de la app no pierden nada.
 */
import { crearProxyRuntime, RUTAS_DINAMICAS, RUTAS_PROXY } from '@peaje/shared'

export const GATEWAY_POR_DEFECTO = 'https://peaje-gateway.up.railway.app'

export type OpcionesPeaje = {
  /** El slug del negocio en Peaje (el mismo del dashboard). */
  slug: string
  /**
   * PEAJE_ORIGIN_SECRET del negocio (página del kit en el dashboard). Por
   * defecto la variable de entorno. Sin él, las rutas de API con precio no se
   * reenvían: solo discovery y links `/r/`.
   */
  secret?: string
  /** URL pública del gateway. Por defecto `PEAJE_GATEWAY_URL` o la de producción. */
  gateway?: string
  /** Para tests o runtimes sin fetch global. */
  fetch?: typeof fetch
}

/** Lo mínimo de una request para decidir: sin body, así no se consume nada. */
export type EntradaDecision = { method: string; url: URL; headers: Headers }

export type Peaje = {
  /** `${gateway}/${slug}` sin barra final. */
  base: string
  /** URL del gateway a la que va la request, o null si no es de Peaje. */
  decidir(entrada: EntradaDecision): Promise<string | null>
  /**
   * Reenvía al gateway. Pone `x-forwarded-host` y `x-forwarded-proto` con el
   * host del negocio: el gateway arma con ellos la URL del challenge 402, y
   * sin ellos los clientes x402 estrictos abortan el pago.
   */
  reenviar(destino: string, entrada: EntradaDecision & { body: BodyInit | null }): Promise<Response>
}

function env(nombre: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[nombre] : undefined
}

export function baseDe({ slug, gateway }: Pick<OpcionesPeaje, 'slug' | 'gateway'>): string {
  const raiz = (gateway ?? env('PEAJE_GATEWAY_URL') ?? GATEWAY_POR_DEFECTO).replace(/\/+$/, '')
  return `${raiz}/${slug}`
}

/** Headers de salto a salto: no se reenvían ni de ida ni de vuelta. */
const SALTO = ['host', 'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'content-length']

let avisado = false

/** Solo para tests: vuelve a permitir el aviso de secreto faltante. */
export function _reiniciarAviso(): void {
  avisado = false
}

export function crearPeaje(opciones: OpcionesPeaje): Peaje {
  if (!opciones?.slug) throw new Error('@peaje/proxy: `slug` is required (the business slug from your Peaje dashboard).')
  const base = baseDe(opciones)
  const secreto = opciones.secret ?? env('PEAJE_ORIGIN_SECRET') ?? null
  const fetchImpl = opciones.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const runtime = crearProxyRuntime({
    base,
    secreto,
    fetchImpl,
    respaldo: { rutas: RUTAS_PROXY.map((x) => x.path), prefijos: RUTAS_DINAMICAS.map((x) => x.prefijo), patrones: [] },
  })

  return {
    base,
    async decidir({ method, url, headers }) {
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
      const d = await runtime.decidir({ method, pathname: url.pathname, search: url.search, headers })
      return d?.destino ?? null
    },
    async reenviar(destino, { method, url, headers, body }) {
      const salida = new Headers(headers)
      for (const h of SALTO) salida.delete(h)
      // Detrás de otro proxy (Railway, Render, un load balancer) el host de la
      // URL es el interno: manda el que ya venía reenviado, si venía.
      const primero = (h: string) => headers.get(h)?.split(',')[0]?.trim() || null
      salida.set('x-forwarded-host', primero('x-forwarded-host') ?? url.host)
      salida.set('x-forwarded-proto', primero('x-forwarded-proto') ?? url.protocol.replace(':', ''))
      const sinBody = method === 'GET' || method === 'HEAD'
      const res = await fetchImpl(destino, { method, headers: salida, body: sinBody ? null : body, redirect: 'manual' })
      // fetch ya descomprimió el body: content-encoding y content-length del
      // gateway quedarían mintiendo y el cliente fallaría al leer.
      const vuelta = new Headers(res.headers)
      vuelta.delete('content-encoding')
      vuelta.delete('content-length')
      vuelta.delete('transfer-encoding')
      vuelta.delete('connection')
      return new Response(method === 'HEAD' ? null : res.body, { status: res.status, statusText: res.statusText, headers: vuelta })
    },
  }
}

export type PeajeFetch = (request: Request) => Promise<Response | null>

/**
 * `(request) => Response | null`. Null: la request no es de Peaje y la
 * atiende la app. El body se lee (en memoria) solo si va al gateway.
 */
export function peajeFetch(opciones: OpcionesPeaje): PeajeFetch {
  const peaje = crearPeaje(opciones)
  return async (request) => {
    const url = new URL(request.url)
    const entrada = { method: request.method.toUpperCase(), url, headers: request.headers }
    const destino = await peaje.decidir(entrada)
    if (!destino) return null
    const body = entrada.method === 'GET' || entrada.method === 'HEAD' ? null : await request.arrayBuffer()
    return peaje.reenviar(destino, { ...entrada, body })
  }
}

export default peajeFetch
