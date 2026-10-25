import type { Metadata } from 'next'
import { Documento } from '../components/legal'
import { getDict, getLocale } from '@/lib/i18n'
import { ACTUALIZADA_EN, ACTUALIZADA_ES } from '@/lib/legal'
import { ReembolsosEn } from './en'
import { ReembolsosEs } from './es'

// La prosa vive en un componente por idioma (es.tsx rige, en.tsx es la
// traducción); acá solo se elige según la cookie de idioma.

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.legal.reembolsosTitulo, description: d.legal.reembolsosMeta }
}

export default async function Reembolsos() {
  const [locale, d] = await Promise.all([getLocale(), getDict()])
  return (
    <Documento
      titulo={d.legal.reembolsosTitulo}
      actualizadaLabel={d.legal.actualizada}
      actualizada={locale === 'es' ? ACTUALIZADA_ES : ACTUALIZADA_EN}
    >
      {locale === 'es' ? <ReembolsosEs /> : <ReembolsosEn />}
    </Documento>
  )
}
