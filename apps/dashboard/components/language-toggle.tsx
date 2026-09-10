'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cambiarIdioma } from '@/lib/i18n/actions'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/dict'

/** Selector de idioma del navbar. Guarda la preferencia en una cookie. */
export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function elegir(siguiente: Locale) {
    if (siguiente === locale) return
    startTransition(async () => {
      await cambiarIdioma(siguiente)
      router.refresh()
    })
  }

  return (
    <div
      className={`flex items-center rounded-full border border-border ${pending ? 'opacity-50' : ''}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => elegir(l)}
          aria-pressed={l === locale}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            l === locale ? 'bg-text text-bg' : 'text-muted hover:text-text'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
