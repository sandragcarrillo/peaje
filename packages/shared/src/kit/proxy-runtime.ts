import { PEAJE_FETCH_HEADER, type ManifiestoProxy, type Patron } from './rutas'

/**
 * Núcleo del proxy en tiempo de ejecución, sin framework: decide si una
 * request del dominio del negocio va al gateway de Peaje y a qué URL.
 *
 * Lo usan `@peaje/next/proxy` (middleware de Next) y cualquier servidor con
 * `Request`/`Response` estándar (Hono, Express con un adaptador, Astro,
 * SvelteKit). Lee `/kit/manifest.json` del gateway y lo cachea; cuando el
 * dueño publica una ruta nueva, el sitio la reenvía en un minuto sin redeploy.
 *
 * Bucle y paywall: una ruta de API con precio vive en el mismo sitio al que
 * el gateway reenvía después del pago. El gateway manda `x-peaje-origin` con
 * un secreto del negocio (derivado de su embedSecret); solo esa request pasa
 * directo al handler. Sin secreto configurado, las rutas de API no se
 * reenvían: un header público se falsifica y la ruta quedaría gratis.
 * `/llms.txt` con `x-peaje-fetch` es el gateway leyendo el llms.txt propio.
 */

/** Header con el que el gateway prueba ante el origen que la request ya pagó. */
export const PEAJE_ORIGIN_HEADER = 'x-peaje-origin'

/**
 * El secreto que el gateway manda al origen: HMAC-SHA256(embedSecret,
 * 'peaje-origin-v1'), 64 hex. Derivado, no guardado: sin columna nueva y sin
 * exponer el embedSecret. El dueño lo ve en el dashboard y lo pone como
 * PEAJE_ORIGIN_SECRET en su hosting. Web Crypto: corre en edge y en Node.
 */
export async function secretoOrigen(embedSecret: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(embedSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode('peaje-origin-v1'))
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparación en tiempo constante para no filtrar el secreto por timing. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export type OpcionesProxyRuntime = {
  /** `${gateway}/${slug}`, sin barra final. */
  base: string
  /** Cuánto vive el manifiesto en memoria. Por defecto 60 s. */
  ttlMs?: number
  /** Para tests: reemplaza el fetch global. */
  fetchImpl?: typeof fetch
  /** Respaldo mientras el manifiesto no responde (la lista fija del kit). */
  respaldo?: Pick<ManifiestoProxy, 'rutas' | 'prefijos' | 'patrones'>
  /**
   * PEAJE_ORIGIN_SECRET del negocio. Sin él solo se reenvían los archivos de
   * discovery y los links `/r/`: las rutas de API con precio necesitan saber
   * distinguir al gateway de un agente que se hace pasar por él.
   */
  secreto?: string | null
}

/**
 * Empareja un path contra un patrón con `:param` y `*` de cola. Mismas reglas
 * que el gateway (`apps/gateway/src/router.ts`): un `*` consume el resto.
 */
export function coincidePatron(patron: string, pathname: string): boolean {
  const p = patron.split('/').filter(Boolean)
  const parts = segmentosCanonicos(pathname)
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!
    if (seg === '*') return true
    const v = parts[i]
    if (v === undefined) return false
    if (seg.startsWith(':')) continue
    if (seg.toLowerCase() !== v.toLowerCase()) return false
  }
  return p.length === parts.length
}

/**
 * Los segmentos de un path como los ve el servidor del negocio: decodificados
 * (%70 es p), sin barras repetidas ni `.`, con `..` resuelto. El cobro compara
 * además sin mayúsculas: Express y otros enrutan /API/x igual que /api/x, y
 * Hono decodifica antes de enrutar; si Peaje comparaba el texto crudo, esas
 * variantes llegaban al handler sin pagar. Misma función en gateway y sitio.
 */
export function segmentosCanonicos(pathname: string): string[] {
  const out: string[] = []
  for (const crudo of pathname.split(/[\\/]+/)) {
    if (!crudo) continue
    let seg = crudo
    try {
      seg = decodeURIComponent(crudo)
    } catch {
      // Codificación inválida: queda el texto crudo.
    }
    for (const s of seg.split(/[\\/]+/)) {
      if (!s || s === '.') continue
      if (s === '..') out.pop()
      else out.push(s)
    }
  }
  return out
}

/** El path canónico, con `/` inicial: para comparar contra rutas fijas y prefijos. */
export const pathCanonico = (pathname: string) => `/${segmentosCanonicos(pathname).join('/')}`

/**
 * Patrones demasiado anchos para reenviar desde el sitio: `/*` o `/:x` a la
 * raíz mandarían el sitio entero al gateway y los humanos verían 402. Esas
 * rutas cobran igual en la URL del gateway; en el dominio solo van las
 * concretas.
 */
export function patronReenviable(patron: string): boolean {
  const segs = patron.split('/').filter(Boolean)
  if (segs.length === 0) return false
  return !(segs.length === 1 && (segs[0] === '*' || segs[0]!.startsWith(':')))
}

export type Decision = { destino: string } | null

export function crearProxyRuntime(opciones: OpcionesProxyRuntime) {
  const base = opciones.base.replace(/\/+$/, '')
  const ttl = opciones.ttlMs ?? 60_000
  const fetchImpl = opciones.fetchImpl ?? fetch
  let cache: { at: number; rutas: string[]; prefijos: string[]; patrones: Patron[] } = {
    at: 0,
    rutas: opciones.respaldo?.rutas ?? [],
    prefijos: opciones.respaldo?.prefijos ?? [],
    patrones: opciones.respaldo?.patrones ?? [],
  }
  let refrescando: Promise<void> | null = null

  async function refrescar(): Promise<void> {
    try {
      const res = await fetchImpl(`${base}/kit/manifest.json`, { signal: AbortSignal.timeout(5_000) })
      if (!res.ok) throw new Error(String(res.status))
      const m = (await res.json()) as Partial<ManifiestoProxy>
      cache = {
        at: Date.now(),
        rutas: Array.isArray(m.rutas) ? m.rutas : cache.rutas,
        prefijos: Array.isArray(m.prefijos) ? m.prefijos : cache.prefijos,
        patrones: Array.isArray(m.patrones) ? m.patrones : cache.patrones,
      }
    } catch {
      // Sin manifiesto seguimos con lo que había; se reintenta al vencer el TTL.
      cache = { ...cache, at: Date.now() }
    } finally {
      refrescando = null
    }
  }

  async function listas() {
    const vencido = Date.now() - cache.at >= ttl
    if (vencido) {
      refrescando ??= refrescar()
      // La primera vez esperamos; después el refresco corre al costado.
      if (cache.at === 0) await refrescando
    }
    return cache
  }

  return {
    /** Rutas de API con precio que este sitio no puede cobrar por falta de secreto. */
    async sinSecreto(): Promise<Patron[]> {
      if (opciones.secreto) return []
      return (await listas()).patrones.filter((p) => patronReenviable(p.path))
    },
    /** Fuerza la carga del manifiesto (útil al arrancar o en tests). */
    cargar: () => (refrescando ??= refrescar()),
    /**
     * Decide si la request va al gateway. `method` y `pathname` de la request,
     * `search` con el `?` incluido, y los headers para cortar bucles.
     */
    async decidir(input: { method: string; pathname: string; search?: string; headers: Headers }): Promise<Decision> {
      const secreto = opciones.secreto || null
      // El gateway entregando una request ya pagada: pasa al handler del sitio.
      const prueba = input.headers.get(PEAJE_ORIGIN_HEADER)
      if (secreto && prueba && iguales(prueba, secreto)) return null
      const { rutas, prefijos, patrones } = await listas()
      const path = input.pathname
      const canon = pathCanonico(path).toLowerCase()
      const esFetchDePeaje = input.headers.get(PEAJE_FETCH_HEADER) !== null
      const fija = (rutas.includes(path) || rutas.some((r) => r.toLowerCase() === canon)) && !(canon === '/llms.txt' && esFetchDePeaje)
      const prefijo = prefijos.some((p) => path.startsWith(p) || canon.startsWith(p.toLowerCase()))
      const method = input.method.toUpperCase()
      const patron =
        secreto !== null &&
        patrones.some((p) => p.method.toUpperCase() === method && patronReenviable(p.path) && coincidePatron(p.path, path))
      if (!fija && !prefijo && !patron) return null
      return { destino: `${base}${path}${input.search ?? ''}` }
    },
  }
}

export type ProxyRuntime = ReturnType<typeof crearProxyRuntime>
