import { cookies } from 'next/headers'
import { dictFor, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Dict, type Locale } from './dict'

/**
 * Cara server de la i18n. Lo que no depende de `next/headers` vive en
 * `./dict`, para que los componentes cliente puedan importarlo sin arrastrar
 * código de servidor al bundle del browser.
 */

export * from './dict'

/** Idioma actual, leído de la cookie. Server components. */
export async function getLocale(): Promise<Locale> {
  const valor = (await cookies()).get(LOCALE_COOKIE)?.value
  return valor && isLocale(valor) ? valor : DEFAULT_LOCALE
}

/** Diccionario del idioma actual. Server components. */
export async function getDict(): Promise<Dict> {
  return dictFor(await getLocale())
}
