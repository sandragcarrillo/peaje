import 'server-only'
import { notFound } from 'next/navigation'
import { emailsAdmin, esEmailAdmin } from './admin'
import { getPrivyUserEmail } from './privy'
import { currentUserId } from './session'

/**
 * Para las páginas de /admin: sigue solo si la sesión es de un correo de
 * ADMIN_EMAILS (el verificado en Privy, no el que guarda un negocio). A
 * cualquier otro, con o sin sesión, le responde 404: la página no existe.
 */
export async function requireAdmin(): Promise<string> {
  const lista = process.env.ADMIN_EMAILS
  if (emailsAdmin(lista).size === 0) notFound()
  const userId = await currentUserId()
  if (!userId) notFound()
  const email = await getPrivyUserEmail(userId).catch((err: unknown) => {
    console.error('[admin] no se pudo leer el correo de la sesión en Privy', err)
    return null
  })
  if (!email || !esEmailAdmin(email, lista)) notFound()
  return email
}
