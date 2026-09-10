'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isLocale, LOCALE_COOKIE } from './dict'

/** Cambia el idioma. La cookie dura un año y no es httpOnly a propósito. */
export async function cambiarIdioma(locale: string) {
  if (!isLocale(locale)) return
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
