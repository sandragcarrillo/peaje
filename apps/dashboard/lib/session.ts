import 'server-only'
import type { Tenant } from '@peaje/db'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { store } from './store'

const COOKIE = 'peaje_session'

// El prefijo versiona el formato: las cookies viejas (tenant-scoped) no validan.
function sign(privyUserId: string): string {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) throw new Error('Falta INTERNAL_API_SECRET')
  return createHmac('sha256', secret).update(`u:${privyUserId}`).digest('hex')
}

function packToken(privyUserId: string): string {
  return `${privyUserId}.${sign(privyUserId)}`
}

function unpackToken(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const privyUserId = token.slice(0, dot)
  const given = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(sign(privyUserId))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return privyUserId
}

/**
 * La sesión del dashboard identifica al USUARIO (privy_user_id), firmado con
 * INTERNAL_API_SECRET en una cookie httpOnly. Un usuario puede tener varios
 * negocios: el tenant se resuelve por slug y se valida que sea suyo. La
 * identidad la verifica Privy una sola vez al entrar; esta cookie es solo la
 * sesión local.
 */
export async function setSession(privyUserId: string) {
  const jar = await cookies()
  jar.set(COOKIE, packToken(privyUserId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
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
  if (!tenant) throw new Error('Sesión inválida para este negocio. Entra con tu email.')
  return tenant
}
