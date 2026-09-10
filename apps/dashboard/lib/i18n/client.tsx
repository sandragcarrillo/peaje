'use client'

import { createContext, useContext } from 'react'
import { dictFor, DEFAULT_LOCALE, type Dict, type Locale } from './dict'

/**
 * El diccionario para client components. El layout (server) lee la cookie y
 * siembra el provider; los componentes cliente leen con `useDict()`.
 */

const Ctx = createContext<{ locale: Locale; d: Dict }>({
  locale: DEFAULT_LOCALE,
  d: dictFor(DEFAULT_LOCALE),
})

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <Ctx.Provider value={{ locale, d: dictFor(locale) }}>{children}</Ctx.Provider>
}

export function useDict(): Dict {
  return useContext(Ctx).d
}

export function useLocale(): Locale {
  return useContext(Ctx).locale
}
