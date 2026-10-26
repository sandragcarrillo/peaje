import type { Locale } from '@/lib/i18n'
import type { OraCheck } from '@/lib/ora'
import { sinArchivo, textoDeChequeo, textoDeChequeoOk, textoLlano } from '@/lib/radar/chequeos'

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

/**
 * Lo mismo para la lista de arreglos del radar: título sin archivo ni
 * protocolo. Si el id es nuevo, el nombre de Ora sin la recomendación técnica
 * (trae código y nombres de API que al dueño no le dicen nada).
 */
export function textoLlanoDe(check: OraCheck, locale: Locale): { titulo: string; detalle: string } {
  return textoLlano(check.id, locale) ?? { titulo: sinArchivo(check.name), detalle: '' }
}

/**
 * Ora da por buenos los chequeos de permisos de robots.txt cuando el sitio no
 * tiene robots.txt (sin archivo, todo está permitido). Es correcto, pero el
 * texto "pueden leer tu sitio (robots.txt)" hacía creer que el archivo existe.
 */
const SIN_ROBOTS: Record<string, Record<Locale, string>> = {
  'robots-ai-policy-quality': {
    es: 'Los buscadores con IA pueden leer tu sitio: no tienes robots.txt, y sin ese archivo nada los bloquea',
    en: 'AI search engines can read your site: you have no robots.txt, and without that file nothing blocks them',
  },
  'robots-agent-user-policy': {
    es: 'Los agentes que actúan por tus clientes pueden entrar: no tienes robots.txt, y sin ese archivo nada los bloquea',
    en: 'Agents acting for your customers can get in: you have no robots.txt, and without that file nothing blocks them',
  },
}

/** La versión "esto ya lo haces" de un check que pasa. */
export function textoOk(check: OraCheck & { details?: string }, locale: Locale): string {
  const sinRobots = SIN_ROBOTS[check.id]
  if (sinRobots && /no robots\.txt (\(http|found)|robots\.txt not found/i.test(check.details ?? '')) return sinRobots[locale]
  return textoDeChequeoOk(check.id, locale) ?? check.name
}
