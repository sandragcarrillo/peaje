import { nav } from './sections/nav'
import { landing } from './sections/landing'
import { acceso } from './sections/acceso'
import { mercado } from './sections/mercado'
import { agentes } from './sections/agentes'
import { panel } from './sections/panel'
import { dinero } from './sections/dinero'
import { kit } from './sections/kit'

/**
 * i18n mínima y tipada, sin librería ni rutas por idioma.
 *
 * El idioma vive en una cookie; el diccionario se arma de secciones que
 * declaran ambos idiomas juntas (`{ es: {...}, en: {...} }`), para que agregar
 * texto nuevo obligue a escribir las dos versiones y no se desincronicen.
 *
 * Por defecto inglés: el público de Peaje hoy es internacional.
 */

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'peaje_locale'

export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', es: 'ES' }

/** Cada sección declara los dos idiomas; el tipo sale del español. */
type Seccion<T> = { es: T; en: T }

const SECCIONES = { nav, landing, acceso, mercado, agentes, panel, dinero, kit }

export type Dict = {
  [K in keyof typeof SECCIONES]: (typeof SECCIONES)[K] extends Seccion<infer T> ? T : never
}

export function dictFor(locale: Locale): Dict {
  return Object.fromEntries(
    Object.entries(SECCIONES).map(([nombre, seccion]) => [nombre, seccion[locale]]),
  ) as Dict
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
