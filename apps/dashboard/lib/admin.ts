/**
 * Quién abre los paneles internos (/admin/*): los correos de ADMIN_EMAILS,
 * separados por coma, contra el correo verificado de la sesión (Privy). Sin
 * la variable no entra nadie. El chequeo con la sesión está en admin-server.ts;
 * esto es la parte pura, para los tests.
 */

/** Los correos de la lista, en minúsculas y sin espacios. */
export function emailsAdmin(valor: string | undefined): Set<string> {
  return new Set(
    (valor ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@')),
  )
}

export function esEmailAdmin(email: string | null | undefined, valor: string | undefined): boolean {
  if (!email) return false
  return emailsAdmin(valor).has(email.trim().toLowerCase())
}
