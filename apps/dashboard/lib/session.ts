import 'server-only'
import type { Tenant } from '@peaje/db'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { store } from './store'

const COOKIE = 'peaje_session'
const DURACION_S = 60 * 60 * 24 * 30

// El prefijo versiona el formato. v3 (oct 2026): firma con SESSION_SECRET y
// lleva emisión y vencimiento dentro de lo firmado. Las cookies v2 (sin
// prefijo, firmadas con INTERNAL_API_SECRET) dejan de validar.
const PREFIJO = 'v3'

let avisado = false

function secreto(): string {
  const propio = process.env.SESSION_SECRET
  if (propio) return propio
  // Fallback solo para que un deploy sin SESSION_SECRET no deje a todos
  // afuera. Las cookies viejas igual dejan de validar por el prefijo v3.
  const interno = process.env.INTERNAL_API_SECRET
  if (!interno) throw new Error('Falta SESSION_SECRET')
  if (!avisado) {
    console.warn('[session] falta SESSION_SECRET: firmando sesiones con INTERNAL_API_SECRET. Configúralo.')
    avisado = true
  }
  return interno
}

type Carga = { u: string; iat: number; exp: number }

function firmar(cuerpo: string): string {
  return createHmac('sha256', secreto()).update(`${PREFIJO}.${cuerpo}`).digest('base64url')
}

export function packToken(privyUserId: string, ahora = Math.floor(Date.now() / 1000)): string {
  const carga: Carga = { u: privyUserId, iat: ahora, exp: ahora + DURACION_S }
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url')
  return `${PREFIJO}.${cuerpo}.${firmar(cuerpo)}`
}

export function unpackToken(token: string, ahora = Math.floor(Date.now() / 1000)): string | null {
  const partes = token.split('.')
  if (partes.length !== 3 || partes[0] !== PREFIJO) return null
  const [, cuerpo, firma] = partes as [string, string, string]
  const dada = Buffer.from(firma)
  const esperada = Buffer.from(firmar(cuerpo))
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return null
  try {
    const carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as Partial<Carga>
    if (typeof carga.u !== 'string' || typeof carga.exp !== 'number' || typeof carga.iat !== 'number') return null
    if (carga.exp <= ahora || carga.iat > ahora + 60) return null
    return carga.u
  } catch {
    return null
  }
}

/**
 * La sesión del dashboard identifica al USUARIO (privy_user_id), firmada con
 * SESSION_SECRET en una cookie httpOnly que vence a los 30 días (el
 * vencimiento va firmado, no depende del navegador). Un usuario puede tener
 * varios negocios: el tenant se resuelve por slug y se valida que sea suyo.
 * La identidad la verifica Privy una sola vez al entrar; esta cookie es solo
 * la sesión local.
 */
export async function setSession(privyUserId: string) {
  const jar = await cookies()
  jar.set(COOKIE, packToken(privyUserId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_S,
  })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** privy_user_id de la cookie actual, o null. */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  return unpackToken(token)
}

/** Todos los negocios del usuario logueado, más reciente primero. */
export async function listMyTenants(): Promise<Tenant[]> {
  const userId = await currentUserId()
  if (!userId) return []
  return store.listTenantsByPrivyUserId(userId)
}

/** El negocio más reciente del usuario (para header y landing), o null. */
export async function currentTenant(): Promise<Tenant | null> {
  return (await listMyTenants())[0] ?? null
}

/** El tenant del slug si es del usuario logueado; null si no hay sesión o no es suyo. */
export async function tenantIfMine(slug: string): Promise<Tenant | null> {
  const userId = await currentUserId()
  if (!userId) return null
  const tenant = await store.getTenantBySlug(slug)
  if (!tenant || tenant.privyUserId !== userId) return null
  return tenant
}

/** Igual que tenantIfMine pero lanza si no corresponde. Para server actions. */
export async function requireTenant(slug: string): Promise<Tenant> {
  const tenant = await tenantIfMine(slug)
  if (!tenant) throw new Error('This session does not have access to that business. Sign in with your email.')
  return tenant
}
