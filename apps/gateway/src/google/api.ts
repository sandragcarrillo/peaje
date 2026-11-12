import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { GoogleConnection, GoogleProperty } from '@peaje/db'
import { env } from '../env.js'

/**
 * Cliente mínimo de Google para leer el Search Console de un negocio: OAuth
 * (código → refresh token cifrado), propiedades, rendimiento, inspección de
 * URL y sitemaps. Solo lectura (webmasters.readonly). Sin las tres variables
 * (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_KEY) la integración
 * está apagada: el dashboard no muestra la tarjeta.
 *
 * Referencias (verificadas el 2026-11-11):
 *   OAuth        https://developers.google.com/identity/protocols/oauth2/web-server
 *   scopes       https://developers.google.com/webmaster-tools/v1/how-tos/authorizing
 *   rendimiento  https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 *   inspección   https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
 *   propiedades  https://developers.google.com/webmaster-tools/v1/sites
 *   cuotas       https://developers.google.com/webmaster-tools/limits (inspección: 2.000/día por propiedad)
 *
 * Con la app en "Testing" Google vence los refresh tokens a los 7 días; para
 * que la conexión dure, la app tiene que estar publicada ("In production").
 */

export const SCOPE_CONSOLA = 'https://www.googleapis.com/auth/webmasters.readonly'
/** openid y email: solo para mostrar con qué cuenta se conectó. */
export const SCOPES = ['openid', 'email', SCOPE_CONSOLA] as const

const v = (k: string) => process.env[k]?.trim() || ''
export const clientId = () => v('GOOGLE_CLIENT_ID')
const clientSecret = () => v('GOOGLE_CLIENT_SECRET')
export const configurado = () => !!(clientId() && clientSecret() && v('GOOGLE_TOKEN_KEY'))
const base = () => env.publicUrl.replace(/\/$/, '')
export const redirectUri = () => v('GOOGLE_REDIRECT_URL') || `${base()}/google/oauth/callback`
export const urlInstalar = (state: string) => `${base()}/google/install?state=${encodeURIComponent(state)}`

/** Errores con un código que el agente y el dashboard entienden. */
export class ErrorGoogle extends Error {
  constructor(
    readonly codigo: 'reconnect' | 'no-property' | 'not-configured' | 'google',
    message: string,
  ) {
    super(message)
  }
}

// ---- cifrado del refresh token y firma del state ----

const llave = (uso: string) => createHash('sha256').update(`${uso}:${v('GOOGLE_TOKEN_KEY')}`, 'utf8').digest()

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', llave('token'), iv)
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.')
}

export function descifrar(guardado: string): string {
  const [ver, iv, tag, ct] = guardado.split('.')
  if (ver !== 'v1' || !iv || !tag || !ct) throw new Error('google token: formato desconocido')
  const d = createDecipheriv('aes-256-gcm', llave('token'), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
}

export type Estado = { tenantId: string; idioma: 'es' | 'en'; vence: number }

/** State firmado: a qué negocio va la conexión, en qué idioma y hasta cuándo vale. Sin tabla. */
export function firmarEstado(tenantId: string, idioma: 'es' | 'en', ahora = Date.now()): string {
  const cuerpo = Buffer.from(JSON.stringify({ t: tenantId, l: idioma, e: ahora + 30 * 60_000, n: randomBytes(9).toString('base64url') })).toString('base64url')
  return `${cuerpo}.${createHmac('sha256', llave('state')).update(cuerpo).digest('base64url')}`
}

export function leerEstado(state: string, ahora = Date.now()): Estado | null {
  const [cuerpo, firma] = state.split('.')
  if (!cuerpo || !firma) return null
  const esperada = Buffer.from(createHmac('sha256', llave('state')).update(cuerpo).digest('base64url'))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as { t?: unknown; l?: unknown; e?: unknown }
    if (typeof d.t !== 'string' || typeof d.e !== 'number' || d.e < ahora) return null
    return { tenantId: d.t, idioma: d.l === 'es' ? 'es' : 'en', vence: d.e }
  } catch {
    return null
  }
}

// ---- OAuth ----

/** prompt=consent: Google entrega el refresh token también cuando la cuenta ya había aceptado. */
export function urlAutorizar(state: string): string {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`
}

type RespuestaToken = { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string; id_token?: string; error?: string; error_description?: string }

async function pedirToken(params: Record<string, string>): Promise<RespuestaToken> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }).toString(),
    signal: AbortSignal.timeout(15_000),
  })
  return (await res.json().catch(() => ({ error: `http_${res.status}` }))) as RespuestaToken
}

export type Canje = { accessToken: string; refreshToken: string | null; scope: string; email: string | null; expiraEn: number }

export async function canjearCodigo(codigo: string): Promise<Canje> {
  const r = await pedirToken({ code: codigo, grant_type: 'authorization_code', redirect_uri: redirectUri() })
  if (!r.access_token) throw new ErrorGoogle('google', r.error_description ?? r.error ?? 'sin access_token')
  return { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, scope: r.scope ?? '', email: emailDelIdToken(r.id_token), expiraEn: r.expires_in ?? 3600 }
}

/** El id_token llega directo de Google por TLS en la respuesta del token: basta leer el email. */
function emailDelIdToken(idToken?: string): string | null {
  const cuerpo = idToken?.split('.')[1]
  if (!cuerpo) return null
  try {
    const email = (JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as { email?: unknown }).email
    return typeof email === 'string' ? email : null
  } catch {
    return null
  }
}

/** Revoca el acceso en Google (al desconectar). Si falla, la fila se borra igual. */
export async function revocar(refreshTokenEnc: string): Promise<void> {
  const token = descifrar(refreshTokenEnc)
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}

const accesos = new Map<string, { token: string; vence: number }>()

/** Para tests: olvida los access tokens guardados. */
export const olvidarAccesos = () => accesos.clear()

/** Un access token vigente para la conexión, refrescado con el refresh token si hace falta. */
export async function tokenDeAcceso(con: GoogleConnection, ahora = Date.now()): Promise<string> {
  const guardado = accesos.get(con.tenantId)
  if (guardado && guardado.vence > ahora + 60_000) return guardado.token
  if (!configurado()) throw new ErrorGoogle('not-configured', 'Google no está configurado en el gateway')
  const r = await pedirToken({ refresh_token: descifrar(con.refreshTokenEnc), grant_type: 'refresh_token' })
  if (!r.access_token) {
    // invalid_grant: la persona quitó el acceso, cambió la contraseña o el token venció.
    if (r.error === 'invalid_grant') throw new ErrorGoogle('reconnect', 'Google ya no acepta esta conexión: hay que volver a conectar la cuenta')
    throw new ErrorGoogle('google', r.error_description ?? r.error ?? 'Google no dio un access token')
  }
  accesos.set(con.tenantId, { token: r.access_token, vence: ahora + (r.expires_in ?? 3600) * 1000 })
  return r.access_token
}

/** Llama a una API de Google con el token. Un 401 tira el token guardado y reintenta una vez. */
async function llamar<T>(con: GoogleConnection, url: string, cuerpo?: unknown, reintento = true): Promise<T> {
  const token = await tokenDeAcceso(con)
  const res = await fetch(url, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 401 && reintento) {
    accesos.delete(con.tenantId)
    return llamar(con, url, cuerpo, false)
  }
  const datos = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } }
  if (!res.ok) {
    const mensaje = datos.error?.message ?? `Google respondió ${res.status}`
    // 403 con la propiedad: la cuenta perdió el acceso a ese sitio en Search Console.
    throw new ErrorGoogle(res.status === 403 ? 'no-property' : 'google', mensaje.slice(0, 300))
  }
  return datos
}

// ---- Search Console ----

/** Las propiedades que ve la cuenta, sin las no verificadas (esas no dan datos). */
export async function listarPropiedades(accessToken: string): Promise<GoogleProperty[]> {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new ErrorGoogle('google', `Search Console respondió ${res.status} al listar los sitios`)
  const d = (await res.json()) as { siteEntry?: { siteUrl?: string; permissionLevel?: string }[] }
  return (d.siteEntry ?? [])
    .filter((s): s is { siteUrl: string; permissionLevel: string } => typeof s.siteUrl === 'string' && typeof s.permissionLevel === 'string')
    .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
    .map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }))
}

/**
 * La propiedad del negocio entre las de la cuenta: primero la de dominio
 * (cubre www, http y subdominios), después la de prefijo con https y www o
 * sin www, y al final http. null si la cuenta no tiene el sitio.
 */
export function elegirPropiedad(propiedades: GoogleProperty[], dominio: string | null): string | null {
  if (!dominio) return null
  const host = dominio.toLowerCase().replace(/^www\./, '')
  const urls = new Set(propiedades.map((p) => p.siteUrl))
  const candidatas = [`sc-domain:${host}`, `https://${dominio}/`, `https://www.${host}/`, `https://${host}/`, `http://www.${host}/`, `http://${host}/`]
  const exacta = candidatas.find((c) => urls.has(c))
  if (exacta) return exacta
  // Un subdominio (tienda.ejemplo.com) lo cubre la propiedad de dominio del padre.
  return propiedades.find((p) => p.siteUrl.startsWith('sc-domain:') && host.endsWith(`.${p.siteUrl.slice('sc-domain:'.length)}`))?.siteUrl ?? null
}

/** Si una URL cae dentro de la propiedad (la API de inspección lo exige). */
export function urlEnPropiedad(url: string, propiedad: string): boolean {
  try {
    const u = new URL(url)
    if (propiedad.startsWith('sc-domain:')) {
      const d = propiedad.slice('sc-domain:'.length)
      return u.hostname === d || u.hostname.endsWith(`.${d}`)
    }
    return url.startsWith(propiedad)
  } catch {
    return false
  }
}

const sitio = (propiedad: string) => `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propiedad)}`

export type Fila = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
export type Filtro = { dimension: 'query' | 'page'; operator: 'contains'; expression: string }

/** Rendimiento en la Búsqueda de Google (tipo web, que incluye AI Overviews y AI Mode sin separarlos). Fechas en hora del Pacífico. */
export async function rendimiento(
  con: GoogleConnection,
  propiedad: string,
  q: { desde: string; hasta: string; dimensiones: ('query' | 'page')[]; filas?: number; filtros?: Filtro[] },
): Promise<Fila[]> {
  const d = await llamar<{ rows?: Fila[] }>(con, `${sitio(propiedad)}/searchAnalytics/query`, {
    startDate: q.desde,
    endDate: q.hasta,
    dimensions: q.dimensiones,
    type: 'web',
    dataState: 'all',
    rowLimit: q.filas ?? 250,
    ...(q.filtros?.length ? { dimensionFilterGroups: [{ groupType: 'and', filters: q.filtros }] } : {}),
  })
  return d.rows ?? []
}

export type Inspeccion = {
  inspectionResultLink?: string
  indexStatusResult?: {
    verdict?: string
    coverageState?: string
    robotsTxtState?: string
    indexingState?: string
    lastCrawlTime?: string
    pageFetchState?: string
    googleCanonical?: string
    userCanonical?: string
    sitemap?: string[]
    referringUrls?: string[]
  }
}

export async function inspeccionar(con: GoogleConnection, propiedad: string, url: string, idioma: 'es' | 'en'): Promise<Inspeccion> {
  const d = await llamar<{ inspectionResult?: Inspeccion }>(con, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    inspectionUrl: url,
    siteUrl: propiedad,
    languageCode: idioma === 'es' ? 'es' : 'en-US',
  })
  return d.inspectionResult ?? {}
}

export type Sitemap = { path?: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; errors?: string | number; warnings?: string | number }

export async function sitemaps(con: GoogleConnection, propiedad: string): Promise<Sitemap[]> {
  const d = await llamar<{ sitemap?: Sitemap[] }>(con, `${sitio(propiedad)}/sitemaps`)
  return d.sitemap ?? []
}
