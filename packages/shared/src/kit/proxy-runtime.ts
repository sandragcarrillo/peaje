import { MAX_PATH_LECTURA, MAX_UA_LECTURA, NO_ES_PAGINA, PEAJE_VERIFICADOR_HEADER, tipoDeBot, type LecturaDeBot } from './bots'
import {
  PATHS_RESERVADOS,
  PEAJE_FETCH_HEADER,
  PREFIJOS_API_POR_DEFECTO,
  RUTAS_DINAMICAS,
  RUTAS_PROXY,
  type ManifiestoProxy,
  type Patron,
} from './rutas'

/**
 * Núcleo del proxy en tiempo de ejecución, sin framework: decide si una
 * request del dominio del negocio va al gateway de Peaje y a qué URL.
 *
 * Lo usan `@peaje/next/proxy` (middleware de Next) y cualquier servidor con
 * `Request`/`Response` estándar (Hono, Express con un adaptador, Astro,
 * SvelteKit). Lee `/kit/manifest.json` del gateway y lo cachea; cuando el
 * dueño publica una ruta de API nueva, el sitio la reenvía en un minuto sin
 * redeploy.
 *
 * Lo que el manifiesto NO puede hacer: agregar rutas fijas o prefijos (salen
 * solo de la lista que viene con el paquete), reenviar rutas de API fuera de
 * los prefijos que el dueño declaró en código (`prefijosApi`, por defecto
 * `/api/` y `/v1/`) ni tocar los paths reservados de una app (raíz, login,
 * auth, `/_next`). Un gateway comprometido o con un bug no puede tapar
 * páginas del sitio.
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
  /**
   * Las rutas fijas (`/llms.txt`, `/mcp`...) y los prefijos de links (`/r/`).
   * Por defecto la lista que viene con el paquete. El manifiesto nunca la
   * amplía: lo que traiga de más se ignora.
   */
  fijas?: { rutas: readonly string[]; prefijos: readonly string[] }
  /**
   * PEAJE_ORIGIN_SECRET del negocio. Sin él solo se reenvían los archivos de
   * discovery y los links `/r/`: las rutas de API con precio necesitan saber
   * distinguir al gateway de un agente que se hace pasar por él.
   */
  secreto?: string | null
  /**
   * Prefijos bajo los que viven las rutas de API con precio del negocio
   * (`apiPrefixes` en los paquetes publicados). Una ruta del manifiesto fuera
   * de ellos no se reenvía desde el dominio; sigue cobrando en la URL del
   * gateway. Por defecto `PREFIJOS_API_POR_DEFECTO`.
   */
  prefijosApi?: readonly string[]
}

/**
 * Headers que no viajan del sitio al gateway. Las cookies del dominio del
 * negocio (la sesión de quien navega) no le sirven al gateway y no tienen por
 * qué salir del sitio; `authorization` sí viaja: ahí va la credencial MPP.
 */
export const HEADERS_NO_REENVIADOS: readonly string[] = ['cookie']

/** Path canónico en minúsculas contra la lista de reservados. */
export function esReservado(path: string): boolean {
  const canon = pathCanonico(path).toLowerCase()
  return PATHS_RESERVADOS.some((r) => (r === '/' ? canon === '/' : canon === r || canon.startsWith(`${r}/`)))
}

/** Los prefijos declarados como `/x/`, canónicos y en minúsculas, sin la raíz ni los reservados. */
export function prefijosApiValidos(prefijos: readonly string[] = PREFIJOS_API_POR_DEFECTO): string[] {
  const out: string[] = []
  for (const crudo of prefijos) {
    const segs = segmentosCanonicos(String(crudo ?? '')).map((s) => s.toLowerCase())
    if (segs.length === 0) continue
    const path = `/${segs.join('/')}`
    if (esReservado(path)) continue
    if (!out.includes(`${path}/`)) out.push(`${path}/`)
  }
  return out
}

/**
 * Una ruta del manifiesto que el sitio puede reenviar: concreta (no `/*` ni
 * `/:x` a la raíz), que empieza con todos los segmentos de un prefijo
 * declarado escritos literales y sigue con al menos uno más, y cuyo tramo
 * literal no es un path reservado (`/api/auth/*` no pasa).
 */
export function patronPermitido(patron: string, prefijos: readonly string[]): boolean {
  if (!patronReenviable(patron)) return false
  const segs = patron.split('/').filter(Boolean)
  const literal = (s: string) => s !== '*' && !s.startsWith(':')
  const bajoPrefijo = prefijos.some((pre) => {
    const ps = pre.split('/').filter(Boolean)
    return segs.length > ps.length && ps.every((s, i) => literal(segs[i]!) && segs[i]!.toLowerCase() === s)
  })
  if (!bajoPrefijo) return false
  const literales: string[] = []
  for (const s of segs) {
    if (!literal(s)) break
    literales.push(s)
  }
  return !esReservado(`/${literales.join('/')}`)
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

/**
 * La lectura que el proxy le reporta al gateway, o null si no hay que
 * reportar nada. Se llama solo con requests que el proxy NO reenvió (esas ya
 * las registra el gateway). Cuenta un GET o HEAD de un bot de la lista a una
 * página; no cuenta assets, internos de Next o Vercel, ni a Peaje mismo (el
 * gateway entregando un pago, leyendo llms.txt o sondeando con el
 * verificador).
 */
export function lecturaDeBot(input: { method: string; pathname: string; headers: Headers }): LecturaDeBot | null {
  const method = input.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return null
  const h = input.headers
  if (h.has(PEAJE_ORIGIN_HEADER) || h.has(PEAJE_FETCH_HEADER) || h.has(PEAJE_VERIFICADOR_HEADER)) return null
  const ua = h.get('user-agent')
  if (!ua || !tipoDeBot(ua)) return null
  const path = input.pathname
  if (!path.startsWith('/') || path.startsWith('/_next/') || path.startsWith('/_vercel/') || NO_ES_PAGINA.test(path)) return null
  return { path: path.slice(0, MAX_PATH_LECTURA), method, userAgent: ua.slice(0, MAX_UA_LECTURA) }
}

export function crearProxyRuntime(opciones: OpcionesProxyRuntime) {
  const base = opciones.base.replace(/\/+$/, '')
  const ttl = opciones.ttlMs ?? 60_000
  const fetchImpl = opciones.fetchImpl ?? fetch
  // Las fijas salen del paquete, nunca del manifiesto.
  const rutas = [...(opciones.fijas?.rutas ?? RUTAS_PROXY.map((r) => r.path))]
  const prefijos = [...(opciones.fijas?.prefijos ?? RUTAS_DINAMICAS.map((r) => r.prefijo))]
  const prefijosApi = prefijosApiValidos(opciones.prefijosApi ?? PREFIJOS_API_POR_DEFECTO)
  let cache: { at: number; patrones: Patron[] } = { at: 0, patrones: [] }
  let refrescando: Promise<void> | null = null

  async function refrescar(): Promise<void> {
    try {
      const res = await fetchImpl(`${base}/kit/manifest.json`, { signal: AbortSignal.timeout(5_000) })
      if (!res.ok) throw new Error(String(res.status))
      const m = (await res.json()) as Partial<ManifiestoProxy>
      // Del manifiesto solo se leen las rutas de API (`rutas` y `prefijos` se
      // ignoran), y solo las que tienen forma válida.
      const patrones = Array.isArray(m.patrones)
        ? m.patrones.filter((p): p is Patron => typeof p?.method === 'string' && typeof p?.path === 'string')
        : cache.patrones
      cache = { at: Date.now(), patrones }
    } catch {
      // Sin manifiesto seguimos con lo que había; se reintenta al vencer el TTL.
      cache = { ...cache, at: Date.now() }
    } finally {
      refrescando = null
    }
  }

  async function patrones(): Promise<Patron[]> {
    const vencido = Date.now() - cache.at >= ttl
    if (vencido) {
      refrescando ??= refrescar()
      // La primera vez esperamos; después el refresco corre al costado.
      if (cache.at === 0) await refrescando
    }
    return cache.patrones
  }

  return {
    /** Los prefijos de API efectivos, normalizados (para los avisos). */
    prefijosApi,
    /** Rutas de API con precio que este sitio no puede cobrar por falta de secreto. */
    async sinSecreto(): Promise<Patron[]> {
      if (opciones.secreto) return []
      return (await patrones()).filter((p) => patronPermitido(p.path, prefijosApi))
    },
    /** Rutas de API con precio que no se reenvían por caer fuera de `prefijosApi` o en un path reservado. */
    async fueraDePrefijos(): Promise<Patron[]> {
      return (await patrones()).filter((p) => patronReenviable(p.path) && !patronPermitido(p.path, prefijosApi))
    },
    /** Fuerza la carga del manifiesto (útil al arrancar o en tests). */
    cargar: () => (refrescando ??= refrescar()),
    /**
     * Si la request es un bot leyendo una página del sitio, le avisa al
     * gateway y devuelve la promesa del aviso (para `waitUntil`); si no, null.
     * El aviso nunca lanza ni demora la página: 3 s de tope y se descarta la
     * respuesta.
     */
    reportarLectura(input: { method: string; pathname: string; headers: Headers }): Promise<void> | null {
      const lectura = lecturaDeBot(input)
      if (!lectura) return null
      return fetchImpl(`${base}/kit/visita`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lectura),
        signal: AbortSignal.timeout(3_000),
      })
        .then((res) => res.body?.cancel())
        .catch(() => undefined)
    },
    /**
     * Decide si la request va al gateway. `method` y `pathname` de la request,
     * `search` con el `?` incluido, y los headers para cortar bucles.
     */
    async decidir(input: { method: string; pathname: string; search?: string; headers: Headers }): Promise<Decision> {
      const secreto = opciones.secreto || null
      // El gateway entregando una request ya pagada: pasa al handler del sitio.
      const prueba = input.headers.get(PEAJE_ORIGIN_HEADER)
      if (secreto && prueba && iguales(prueba, secreto)) return null
      const path = input.pathname
      const canon = pathCanonico(path).toLowerCase()
      const esFetchDePeaje = input.headers.get(PEAJE_FETCH_HEADER) !== null
      const fija = (rutas.includes(path) || rutas.some((r) => r.toLowerCase() === canon)) && !(canon === '/llms.txt' && esFetchDePeaje)
      const prefijo = prefijos.some((p) => path.startsWith(p) || canon.startsWith(p.toLowerCase()))
      let patron = false
      // Rutas de API: solo con secreto, solo bajo un prefijo declarado (la
      // request, no solo el patrón: `/api/*` no alcanza a `/api` pelado) y
      // nunca en un path reservado.
      if (!fija && !prefijo && secreto !== null && !esReservado(path) && prefijosApi.some((pre) => canon.startsWith(pre))) {
        const method = input.method.toUpperCase()
        patron = (await patrones()).some(
          (p) => p.method.toUpperCase() === method && patronPermitido(p.path, prefijosApi) && coincidePatron(p.path, path),
        )
      }
      if (!fija && !prefijo && !patron) return null
      return { destino: `${base}${path}${input.search ?? ''}` }
    },
  }
}

export type ProxyRuntime = ReturnType<typeof crearProxyRuntime>
