'use server'

import { redirect } from 'next/navigation'
import { clearSession } from '@/lib/session'

/**
 * Salir como acción de servidor: al terminar, Next vuelve a renderizar el
 * layout sin sesión en la misma navegación. Con el enlace GET de antes, el
 * router reusaba el layout cacheado y la persona seguía viendo su cuenta
 * hasta recargar.
 */
export async function salir(): Promise<never> {
  await clearSession()
  redirect('/')
}
