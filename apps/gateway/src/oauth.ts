import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { OauthClient, OauthTokens, Tenant } from '@peaje/db'
import { hashApiKey } from '@peaje/shared'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import { store } from './store.js'

/**
 * Inicio de sesión (OAuth 2.1) del MCP del dueño, como lo pide la spec de MCP
 * (2025-06-18 y 2025-11-25): la app de Claude y ChatGPT solo agregan
 * conectores así, y Claude Code, Cursor y Codex lo usan si el servidor
 * responde 401 sin clave.
 *
 * El gateway es el servidor de autorización y el recurso a la vez (el issuer
 * es su propio origen, así también lo encuentran los clientes que no leen los
 * metadatos del recurso). La pantalla de permiso no vive acá: es
 * usepeaje.com/oauth/autorizar, donde el dueño ya inicia sesión con Privy y
 * elige el negocio; esa página crea el código y este archivo lo canjea.
 *
 * Clientes públicos con PKCE (S256 obligatorio) o confidenciales con secreto.
 * Token de acceso de 1 hora; el de refresco dura 90 días y rota en cada uso
 * (reusar uno viejo corta la conexión). Todo se guarda solo como hash.
 */

export const PREFIJO_ACCESO = 'peaje_oat_'
export const PREFIJO_REFRESCO = 'peaje_ort_'
export const PREFIJO_CODIGO = 'peaje_oac_'
const PREFIJO_CLIENTE = 'peaje_cli_'
const PREFIJO_SECRETO = 'peaje_cls_'
const ACCESO_S = 60 * 60
const REFRESCO_S = 90 * 24 * 60 * 60
const SCOPE = 'peaje'

const emisor = () => env.publicUrl.replace(/\/$/, '')
const panel = () => env.dashboardUrl.replace(/\/$/, '')
export const recursoMcp = () => `${emisor()}/_owner/mcp`
export const metadataDelRecurso = () => `${emisor()}/.well-known/oauth-protected-resource/_owner/mcp`

/** El ícono de Peaje (192×192) para los clientes que lo muestran: el MCP lo declara como data URI. */
export const ICONO_PNG = readFileSync(new URL('../assets/peaje-icono.png', import.meta.url))
export const ICONO_DATA_URI = `data:image/png;base64,${ICONO_PNG.toString('base64')}`

/** El header del 401: le dice a la herramienta dónde iniciar sesión. */
export function desafio(tokenInvalido: boolean): string {
  return `Bearer ${tokenInvalido ? 'error="invalid_token", ' : ''}resource_metadata="${metadataDelRecurso()}"`
}

function metadataDelServidor() {
  return {
    issuer: emisor(),
    authorization_endpoint: `${panel()}/oauth/autorizar`,
    token_endpoint: `${emisor()}/oauth/token`,
    registration_endpoint: `${emisor()}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [SCOPE],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${panel()}/precios`,
  }
}

/** RFC 9728. La raíz describe el origen; la variante con path, el MCP. */
function metadataRecurso(recurso: string) {
  return {
    resource: recurso,
    authorization_servers: [emisor()],
    bearer_methods_supported: ['header'],
    scopes_supported: [SCOPE],
    resource_name: 'Peaje',
  }
}

// ---- tokens ----

const aleatorio = (prefijo: string) => `${prefijo}${randomBytes(32).toString('hex')}`

export async function emitirTokens(ahora = Date.now()): Promise<{ acceso: string; refresco: string; hashes: OauthTokens }> {
  const acceso = aleatorio(PREFIJO_ACCESO)
  const refresco = aleatorio(PREFIJO_REFRESCO)
  return {
    acceso,
    refresco,
    hashes: {
      accessHash: await hashApiKey(acceso),
      accessExpiresAt: new Date(ahora + ACCESO_S * 1000).toISOString(),
      refreshHash: await hashApiKey(refresco),
      refreshExpiresAt: new Date(ahora + REFRESCO_S * 1000).toISOString(),
    },
  }
}

/** PKCE S256: base64url(sha256(verifier)) tiene que ser el challenge del código. */
export function pkceValido(verifier: string | undefined, challenge: string): boolean {
  if (!verifier || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  const calculado = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const esperado = Buffer.from(challenge)
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado)
}

/**
 * El negocio de un token de acceso vigente. El dueño tiene que seguir siendo
 * quien dio el permiso: si el negocio cambió de cuenta, el token deja de servir.
 */
export async function tenantDeAcceso(token: string): Promise<Tenant | null> {
  const ahora = new Date()
  const grant = await store.getOauthGrantByAccessHash(await hashApiKey(token), ahora.toISOString())
  if (!grant) return null
  const tenant = await store.getTenantById(grant.tenantId)
  if (!tenant || tenant.privyUserId !== grant.privyUserId) return null
  // "Última vez" en Integraciones: una escritura cada 10 minutos basta.
  if (!grant.lastUsedAt || ahora.getTime() - Date.parse(grant.lastUsedAt) > 10 * 60_000) {
    void store.touchOauthGrant(grant.id, ahora.toISOString()).catch(() => {})
  }
  return tenant
}

// ---- registro de clientes (RFC 7591) ----

/**
 * https para cualquier host; http solo a la propia máquina (RFC 8252); los
 * esquemas propios de apps (cursor://, vscode://) sí. Nada que ejecute ni lea
 * archivos, y sin fragmento.
 */
export function redirectValido(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 500) return false
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return false
  }
  if (u.hash) return false
  const esquema = u.protocol.slice(0, -1).toLowerCase()
  if (['javascript', 'data', 'file', 'vbscript', 'blob', 'about', 'ftp', 'ws', 'wss'].includes(esquema)) return false
  if (esquema === 'http') return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  return true
}

// Cada registro es una fila: 30 por hora por IP alcanzan para cualquier persona.
const registros = new Map<string, number[]>()
function puedeRegistrar(ip: string, ahora = Date.now()): boolean {
  const hora = 60 * 60_000
  const recientes = (registros.get(ip) ?? []).filter((t) => ahora - t < hora)
  if (recientes.length >= 30) return false
  recientes.push(ahora)
  registros.set(ip, recientes)
  if (registros.size > 5000) for (const [k, v] of registros) if (!v.some((t) => ahora - t < hora)) registros.delete(k)
  return true
}

const ipDe = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'desconocida'

function errorOauth(c: Context, status: 400 | 401 | 429, error: string, descripcion: string) {
  c.header('Cache-Control', 'no-store')
  return c.json({ error, error_description: descripcion }, status)
}

// ---- canje en /oauth/token ----

/** Los parámetros del token endpoint: form-urlencoded como manda OAuth, JSON por si acaso. */
async function parametros(c: Context): Promise<Record<string, string>> {
  const tipo = c.req.header('content-type') ?? ''
  if (tipo.includes('application/json')) {
    const j = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(j).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  }
  const form = await c.req.parseBody().catch(() => ({}))
  return Object.fromEntries(Object.entries(form).filter(([, v]) => typeof v === 'string')) as Record<string, string>
}

/** client_secret_basic, client_secret_post o público (solo client_id). */
async function clienteQuePide(c: Context, p: Record<string, string>): Promise<OauthClient | null> {
  let id = p.client_id
  let secreto = p.client_secret
  const basic = c.req.header('authorization')
  if (basic?.startsWith('Basic ')) {
    const par = Buffer.from(basic.slice(6), 'base64').toString()
    const i = par.indexOf(':')
    id = decodeURIComponent(i < 0 ? par : par.slice(0, i))
    secreto = i < 0 ? '' : decodeURIComponent(par.slice(i + 1))
  }
  if (!id) return null
  const cliente = await store.getOauthClient(id)
  if (!cliente) return null
  if (!cliente.secretHash) return cliente
  if (!secreto) return null
  const dado = Buffer.from(await hashApiKey(secreto))
  const guardado = Buffer.from(cliente.secretHash)
  return dado.length === guardado.length && timingSafeEqual(dado, guardado) ? cliente : null
}

function respuestaDeTokens(c: Context, t: { acceso: string; refresco: string }) {
  c.header('Cache-Control', 'no-store')
  c.header('Pragma', 'no-cache')
  return c.json({ access_token: t.acceso, token_type: 'Bearer', expires_in: ACCESO_S, refresh_token: t.refresco, scope: SCOPE })
}

export const oauthRouter = new Hono()

// Los clientes que corren en un navegador (el inspector de MCP) leen esto desde otro origen.
oauthRouter.use('/.well-known/oauth-*', cors({ origin: '*', allowMethods: ['GET'] }))
oauthRouter.use('/oauth/*', cors({ origin: '*', allowMethods: ['POST'], allowHeaders: ['Content-Type', 'Authorization'] }))

oauthRouter.get('/.well-known/oauth-authorization-server', (c) => c.json(metadataDelServidor()))
oauthRouter.get('/.well-known/oauth-protected-resource', (c) => c.json(metadataRecurso(emisor())))
oauthRouter.get('/.well-known/oauth-protected-resource/_owner/mcp', (c) => c.json(metadataRecurso(recursoMcp())))
oauthRouter.get('/favicon.ico', (c) => c.body(new Uint8Array(ICONO_PNG), 200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }))

oauthRouter.post('/oauth/register', async (c) => {
  if (!puedeRegistrar(ipDe(c))) return errorOauth(c, 429, 'too_many_requests', 'Too many registrations from this address. Try again in an hour.')
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return errorOauth(c, 400, 'invalid_client_metadata', 'Send the client metadata as JSON.')
  const uris = body.redirect_uris
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every(redirectValido)) {
    return errorOauth(c, 400, 'invalid_redirect_uri', 'redirect_uris must be 1 to 10 https URLs, loopback http URLs or app schemes, without fragments.')
  }
  const metodo = typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none'
  if (!['none', 'client_secret_post', 'client_secret_basic'].includes(metodo)) {
    return errorOauth(c, 400, 'invalid_client_metadata', 'token_endpoint_auth_method must be none, client_secret_post or client_secret_basic.')
  }
  const nombre = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 80) : 'MCP client'
  const secreto = metodo === 'none' ? null : aleatorio(PREFIJO_SECRETO)
  const cliente = await store.createOauthClient({
    id: aleatorio(PREFIJO_CLIENTE).slice(0, PREFIJO_CLIENTE.length + 32),
    name: nombre,
    redirectUris: uris as string[],
    secretHash: secreto ? await hashApiKey(secreto) : null,
  })
  return c.json(
    {
      client_id: cliente.id,
      client_id_issued_at: Math.floor(Date.parse(cliente.createdAt) / 1000),
      client_name: cliente.name,
      redirect_uris: cliente.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: metodo,
      scope: SCOPE,
      ...(secreto ? { client_secret: secreto, client_secret_expires_at: 0 } : {}),
    },
    201,
  )
})

oauthRouter.post('/oauth/token', async (c) => {
  const p = await parametros(c)
  const cliente = await clienteQuePide(c, p)
  if (!cliente) return errorOauth(c, 401, 'invalid_client', 'Unknown client or wrong client secret.')
  const ahora = new Date()

  if (p.grant_type === 'authorization_code') {
    if (!p.code) return errorOauth(c, 400, 'invalid_request', 'Missing code.')
    const codigo = await store.consumeOauthCode(await hashApiKey(p.code), ahora.toISOString())
    if (!codigo || codigo.clientId !== cliente.id) return errorOauth(c, 400, 'invalid_grant', 'The code is invalid, expired or already used.')
    if (p.redirect_uri && p.redirect_uri !== codigo.redirectUri) return errorOauth(c, 400, 'invalid_grant', 'redirect_uri does not match the authorization request.')
    if (!pkceValido(p.code_verifier, codigo.codeChallenge)) return errorOauth(c, 400, 'invalid_grant', 'code_verifier does not match the code challenge.')
    const tenant = await store.getTenantById(codigo.tenantId)
    if (!tenant || tenant.privyUserId !== codigo.privyUserId) return errorOauth(c, 400, 'invalid_grant', 'The business is no longer available to this account.')
    const t = await emitirTokens(ahora.getTime())
    await store.createOauthGrant({ clientId: cliente.id, tenantId: tenant.id, privyUserId: codigo.privyUserId, ...t.hashes })
    return respuestaDeTokens(c, t)
  }

  if (p.grant_type === 'refresh_token') {
    if (!p.refresh_token) return errorOauth(c, 400, 'invalid_request', 'Missing refresh_token.')
    const t = await emitirTokens(ahora.getTime())
    const r = await store.rotateOauthGrant(await hashApiKey(p.refresh_token), t.hashes, ahora.toISOString())
    if (!r || 'reuso' in r) return errorOauth(c, 400, 'invalid_grant', 'The refresh token is invalid, expired or revoked.')
    // De otro cliente: alguien lo sacó de donde no debía. Se corta la conexión.
    if (r.grant.clientId !== cliente.id) {
      await store.revokeOauthGrant(r.grant.tenantId, r.grant.id, ahora.toISOString())
      return errorOauth(c, 400, 'invalid_grant', 'The refresh token belongs to another client.')
    }
    return respuestaDeTokens(c, t)
  }

  return errorOauth(c, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.')
})
