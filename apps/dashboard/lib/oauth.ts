import 'server-only'
import { randomBytes } from 'node:crypto'
import type { OauthClient } from '@peaje/db'
import { hashApiKey } from '@peaje/shared'
import { gatewayUrl } from './config'
import { store } from './store'

/**
 * La mitad del inicio de sesión del MCP que vive en el dashboard: revisar el
 * pedido de una herramienta (/oauth/autorizar) y, con el permiso del dueño,
 * crear el código de un solo uso que la herramienta canjea en el gateway
 * (apps/gateway/src/oauth.ts). El issuer es el gateway.
 */

const emisor = () => gatewayUrl.replace(/\/$/, '')

export type Pedido = { cliente: OauthClient; redirectUri: string; state: string | null; codeChallenge: string; resource: string | null }

/**
 * Un pedido que no se puede atender. Sin cliente o con un redirect que no es
 * suyo se muestra el problema en la página: mandar a la persona a una URL
 * no registrada sería abrirle la puerta a cualquiera. Lo demás vuelve a la
 * herramienta con el error de OAuth.
 */
export type Revision = { ok: true; pedido: Pedido } | { ok: false; problema: 'cliente' | 'redirect' } | { ok: false; volver: string }

/** Exacto, salvo el puerto en la propia máquina (RFC 8252: las apps de escritorio lo eligen al abrir). */
export function redirectRegistrado(registrados: string[], uri: string): boolean {
  if (registrados.includes(uri)) return true
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) return false
  return registrados.some((r) => {
    try {
      const x = new URL(r)
      return x.protocol === 'http:' && x.hostname === u.hostname && x.pathname === u.pathname && x.search === u.search
    } catch {
      return false
    }
  })
}

/** La URL de vuelta a la herramienta con un parámetro más, sin perder los suyos. */
function vuelta(redirectUri: string, campos: Record<string, string | null>): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(campos)) if (v) u.searchParams.set(k, v)
  u.searchParams.set('iss', emisor())
  return u.toString()
}

const recursoNuestro = (r: string) => {
  const sin = r.replace(/\/$/, '')
  return sin === emisor() || sin === `${emisor()}/_owner/mcp`
}

export async function revisarPedido(p: Record<string, string | undefined>): Promise<Revision> {
  const cliente = p.client_id ? await store.getOauthClient(p.client_id).catch(() => null) : null
  if (!cliente) return { ok: false, problema: 'cliente' }
  const redirectUri = p.redirect_uri ?? (cliente.redirectUris.length === 1 ? cliente.redirectUris[0] : undefined)
  if (!redirectUri || !redirectRegistrado(cliente.redirectUris, redirectUri)) return { ok: false, problema: 'redirect' }
  const state = p.state ?? null
  const error = (codigo: string, descripcion: string) => ({ ok: false as const, volver: vuelta(redirectUri, { error: codigo, error_description: descripcion, state }) })
  if (p.response_type !== 'code') return error('unsupported_response_type', 'Only response_type=code is supported.')
  // S256 de 32 bytes en base64url: 43 caracteres.
  if (p.code_challenge_method !== 'S256' || !p.code_challenge || !/^[A-Za-z0-9_-]{43}$/.test(p.code_challenge)) {
    return error('invalid_request', 'PKCE with code_challenge_method=S256 is required.')
  }
  const resource = p.resource ?? null
  if (resource && !recursoNuestro(resource)) return error('invalid_target', 'Unknown resource.')
  return { ok: true, pedido: { cliente, redirectUri, state, codeChallenge: p.code_challenge, resource } }
}

/** Lo que vuelve a la herramienta cuando el dueño dice que no. */
export const rechazo = (pedido: Pedido) => vuelta(pedido.redirectUri, { error: 'access_denied', error_description: 'The owner did not allow the connection.', state: pedido.state })

/** Con el permiso del dueño: el código (5 minutos, un solo uso) y la URL de vuelta a la herramienta. */
export async function permiso(pedido: Pedido, tenantId: string, privyUserId: string): Promise<string> {
  const code = `peaje_oac_${randomBytes(32).toString('hex')}`
  await store.createOauthCode({
    codeHash: await hashApiKey(code),
    clientId: pedido.cliente.id,
    tenantId,
    privyUserId,
    redirectUri: pedido.redirectUri,
    codeChallenge: pedido.codeChallenge,
    resource: pedido.resource,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  })
  return vuelta(pedido.redirectUri, { code, state: pedido.state })
}

/** Dónde vuelve la persona, para mostrarlo: el host de la web o el nombre de la app. */
export function destinoVisible(redirectUri: string): string {
  try {
    const u = new URL(redirectUri)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.host : u.protocol.slice(0, -1)
  } catch {
    return redirectUri
  }
}
