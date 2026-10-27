'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SALIO } from '@/lib/salida'
import { clearSession } from '@/lib/session'

/**
 * Salir como acción de servidor: al terminar, Next vuelve a renderizar el
 * layout sin sesión en la misma navegación. Con el enlace GET de antes, el
 * router reusaba el layout cacheado y la persona seguía viendo su cuenta
 * hasta recargar.
 *
 * La sesión de Privy no se puede cerrar desde aquí (vive en el navegador):
 * queda la marca COOKIE_SALIO y /acceder o /nuevo la cierran al abrir.
 */
export async function salir(): Promise<never> {
  await clearSession()
  const jar = await cookies()
  jar.set(COOKIE_SALIO, '1', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
  redirect('/')
}
