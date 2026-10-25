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
      className={`flex items-center gap-1 ${pending ? 'opacity-50' : ''}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => elegir(l)}
          aria-pressed={l === locale}
          className={`btn btn-secundario btn-chico btn-icono ${
            l === locale ? 'border-text bg-panel' : 'text-muted hover:text-text'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
