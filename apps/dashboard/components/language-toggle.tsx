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
    <div className={`inline-flex items-center rounded-full border border-border p-0.5 ${pending ? 'opacity-50' : ''}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => elegir(l)}
          aria-pressed={l === locale}
          className={`etiqueta rounded-full px-2 py-0.5 text-xs transition-colors ${
            l === locale ? 'bg-text font-bold text-bg' : 'text-muted hover:text-text'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
