import type { Locale } from '@/lib/i18n'
import type { OraCheck } from '@/lib/ora'
import { textoDeChequeo, textoDeChequeoOk } from '@/lib/radar/chequeos'

/**
 * Texto en palabras del dueño para cada check del radar. Si Ora agrega un
 * check que todavía no está en `chequeos.ts`, cae al nombre de Ora.
 */
export function textoDe(check: OraCheck, locale: Locale): { titulo: string; detalle: string } {
  return (
    textoDeChequeo(check.id, locale) ?? {
      titulo: check.name,
      detalle: check.recommendation ?? check.description ?? '',
    }
  )
}

/** La versión "esto ya lo haces" de un check que pasa. */
export function textoOk(check: OraCheck, locale: Locale): string {
  return textoDeChequeoOk(check.id, locale) ?? check.name
}

/** Para usar el título dentro de una frase ("Lo primero: no hay..."), sin romper siglas. */
export function enFrase(titulo: string): string {
  const [a, b] = titulo
  if (!a || !b || b !== b.toLowerCase()) return titulo
  return a.toLowerCase() + titulo.slice(1)
}
