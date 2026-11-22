import type { Metadata } from 'next'
import Link from 'next/link'
import { COSTOS_CREDITOS, CUPOS_FOUNDER, DIAS_REEMBOLSO, LIMITES, PAQUETE_MENSUAL, PRECIOS_USD, REGALO } from '@peaje/db'
import { CtaInicio } from '../components/cta-inicio'
import { ENLACE } from '../components/legal'
import { dictFor, type Locale } from '@/lib/i18n/dict'
import type { DatosFaq } from '@/lib/i18n/sections/faq'
import { CONTACTO } from '@/lib/legal'

/**
 * Preguntas frecuentes, una URL por idioma: /preguntas (es) y /faq (en). La
 * página sale en su idioma aunque la cookie diga otro, como los artículos del
 * blog, y cada una apunta a la otra con hreflang. Lleva JSON-LD FAQPage con
 * las mismas preguntas que se ven.
 */

const BASE = 'https://usepeaje.com'
const RUTA: Record<Locale, string> = { es: '/preguntas', en: '/faq' }

const DATOS: DatosFaq = {
  founder: PRECIOS_USD.founder,
  pro: PRECIOS_USD.pro,
  cupos: CUPOS_FOUNDER,
  creditos: LIMITES.pro.creditos,
  dias: DIAS_REEMBOLSO,
  regaloInformes: REGALO.informes,
  regaloRespuestas: REGALO.respuestas,
  paginas: PAQUETE_MENSUAL.paginas,
  informes: PAQUETE_MENSUAL.informes,
  respuestas: PAQUETE_MENSUAL.respuestas,
  preguntas: LIMITES.pro.preguntas,
  costos: COSTOS_CREDITOS,
}

export function metadataFaq(locale: Locale): Metadata {
  const t = dictFor(locale).faq
  const url = `${BASE}${RUTA[locale]}`
  return {
    title: t.metaTitulo,
    description: t.metaDescripcion,
    alternates: {
      canonical: url,
      languages: { es: `${BASE}${RUTA.es}`, en: `${BASE}${RUTA.en}`, 'x-default': `${BASE}${RUTA.en}` },
    },
    openGraph: {
      type: 'website',
      url,
      title: t.metaTitulo,
      description: t.metaDescripcion,
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      siteName: 'Peaje',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Peaje: Get found by AI agents' }],
    },
  }
}

export function PaginaFaq({ locale }: { locale: Locale }) {
  const t = dictFor(locale).faq
  const preguntas = t.preguntas(DATOS)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    url: `${BASE}${RUTA[locale]}`,
    mainEntity: preguntas.map((q) => ({
      '@type': 'Question',
      name: q.p,
      acceptedAnswer: { '@type': 'Answer', text: q.r },
    })),
  }

  return (
    <article lang={locale} className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{t.titulo}</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        {t.intro}{' '}
        <a href={`mailto:${CONTACTO}`} className={ENLACE}>
          {t.contacto}
        </a>
        .
      </p>

      <dl className="mt-10 divide-y divide-border border-y border-border">
        {preguntas.map((q) => (
          <div key={q.p} className="py-6">
            <dt className="text-lg font-semibold text-balance">{q.p}</dt>
            <dd className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
              <p>{q.r}</p>
              {q.enlace ? (
                <p className="mt-3">
                  <Link href={q.enlace.href} className={ENLACE}>
                    {q.enlace.texto}
                  </Link>
                </p>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {/* El cierre de las páginas públicas (cta-inicio.tsx), en el idioma de la URL. */}
      <CtaInicio locale={locale} alinear="inicio" className="mt-12" />

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD de las preguntas, sin datos de usuarios
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />
    </article>
  )
}
