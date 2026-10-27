/**
 * Origen de primer contacto (first touch) de quien llega a usepeaje.com.
 *
 * proxy.ts deja la cookie `peaje_origen` en la primera navegación que trae
 * algo con qué atribuir, en este orden:
 *   1. `?ref=comunidad`                                   → "comunidad"
 *   2. `?utm_source=x&utm_medium=y&utm_campaign=z`        → "x/y/z" ("x/-/z" sin medium)
 *   3. el host del referrer externo, sin "www."           → "linkedin.com"
 * Usepeaje.com (y sus subdominios) y el propio host no cuentan como referrer.
 * Sin nada de eso no se deja cookie: la siguiente visita con origen la deja.
 * Una vez puesta no se pisa.
 *
 * El radar y el alta leen la cookie en el server (registrarLead,
 * registrarNegocio) y la guardan con el lead y con el negocio
 * (acquisition_source). /admin/origenes cuenta por este valor.
 *
 * Funciones puras: las usan el proxy, las acciones y los tests.
 */

export const COOKIE_ORIGEN = 'peaje_origen'
/** 90 días. */
export const DURACION_ORIGEN_S = 60 * 60 * 24 * 90
/** Largo máximo de cada parte (ref, source, medium, campaign o host). */
export const MAX_PARTE = 60

/** Hosts que nunca son un origen externo, aunque lleguen como referrer. */
const PROPIOS = ['usepeaje.com']

/**
 * Una parte en minúsculas, solo [a-z0-9._-], hasta MAX_PARTE caracteres. Los
 * acentos se pierden ("Café" → "cafe") y cualquier otro carácter pasa a guion
 * ("Platanus Hack" → "platanus-hack"). Null si no queda nada.
 */
export function limpiarParte(valor: string | null | undefined): string | null {
  if (!valor) return null
  const limpio = valor
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, MAX_PARTE)
    .replace(/[-.]+$/, '')
  return limpio || null
}

const sinWww = (host: string) => host.toLowerCase().replace(/^www\./, '')

/** Host del referrer sin "www.", o null si falta, no se entiende o es del propio sitio. */
export function hostDeReferrer(referer: string | null | undefined, hostPropio?: string | null): string | null {
  if (!referer) return null
  let host: string
  try {
    host = sinWww(new URL(referer).hostname)
  } catch {
    return null
  }
  if (!host) return null
  if (hostPropio && host === sinWww(hostPropio)) return null
  if (PROPIOS.some((p) => host === p || host.endsWith(`.${p}`))) return null
  return limpiarParte(host)
}

/**
 * El origen de una visita: ref, después utm_source (con medium y campaign),
 * después el referrer externo. Null si no hay nada que atribuir.
 */
export function origenDeVisita(entrada: {
  searchParams: URLSearchParams
  referer?: string | null
  /** El host de la request (usepeaje.com, un preview, localhost): su propio referrer no cuenta. */
  hostPropio?: string | null
}): string | null {
  const q = entrada.searchParams
  const ref = limpiarParte(q.get('ref'))
  if (ref) return ref

  const source = limpiarParte(q.get('utm_source'))
  if (source) {
    const medium = limpiarParte(q.get('utm_medium'))
    const campaign = limpiarParte(q.get('utm_campaign'))
    if (campaign) return `${source}/${medium ?? '-'}/${campaign}`
    if (medium) return `${source}/${medium}`
    return source
  }

  return hostDeReferrer(entrada.referer, entrada.hostPropio)
}

const PARTE = `[a-z0-9._-]{1,${MAX_PARTE}}`
const FORMATO = new RegExp(`^${PARTE}(/${PARTE}){0,2}$`)

/**
 * El valor de la cookie si tiene el formato que deja el proxy; null si no.
 * La cookie es httpOnly pero el navegador la deja editar: se valida antes de guardarla.
 */
export function origenValido(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.trim()
  return v.length <= 3 * MAX_PARTE + 2 && FORMATO.test(v) ? v : null
}

/**
 * Una navegación de documento (lo que abre la persona), no un fetch, un
 * script, un beacon de analítica ni un pedido RSC del router de Next. Solo
 * ahí se deja la cookie.
 */
export function esNavegacion(method: string, headers: Headers): boolean {
  if (method !== 'GET') return false
  if (headers.has('rsc') || headers.has('next-router-prefetch') || headers.has('next-action')) return false
  const destino = headers.get('sec-fetch-dest')
  if (destino) return destino === 'document'
  return (headers.get('accept') ?? '').includes('text/html')
}
