import type { Metadata } from 'next'
import Link from 'next/link'
import { CUPOS_FOUNDER, PRECIOS_USD } from '@peaje/db'
import { ENLACE } from '../components/legal'
import { getDict, getLocale } from '@/lib/i18n'
import { agendador } from '@/lib/demo'
import { CONTACTO } from '@/lib/legal'
import { Agendar, type TextosAgendar } from './agendar'

/**
 * Agenda una demo. Una sola URL; el idioma sale de la cookie, como /precios.
 * Referencia: revnu.com/book (22 nov 2026), con el flujo de dos pasos en una
 * tarjeta. El agendador sale de NEXT_PUBLIC_DEMO_URL (lib/demo.ts).
 */

const URL_DEMO = 'https://usepeaje.com/demo'

export async function generateMetadata(): Promise<Metadata> {
  const [d, locale] = await Promise.all([getDict(), getLocale()])
  return {
    title: d.demo.metaTitulo,
    description: d.demo.metaDescripcion,
    alternates: { canonical: '/demo' },
    openGraph: {
      type: 'website',
      url: URL_DEMO,
      title: d.demo.metaTitulo,
      description: d.demo.metaDescripcion,
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      siteName: 'Peaje',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Peaje: Get found by AI agents' }],
    },
  }
}

function Marca({ si }: { si: boolean }) {
  return si ? (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
    </svg>
  )
}

export default async function Demo() {
  const [d, locale] = await Promise.all([getDict(), getLocale()])
  const D = d.demo
  const faq = D.faq({ founder: PRECIOS_USD.founder, pro: PRECIOS_USD.pro, cupos: CUPOS_FOUNDER })
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    url: URL_DEMO,
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
  }

  // Solo textos: al componente cliente no le pasan funciones.
  const textos: TextosAgendar = {
    pasoTitulo: D.pasoTitulo,
    pasoTexto: D.pasoTexto,
    pasoTextoCorreo: D.pasoTextoCorreo,
    sitio: D.sitio,
    sitioPlaceholder: D.sitioPlaceholder,
    correo: D.correo,
    correoPlaceholder: D.correoPlaceholder,
    objetivo: D.objetivo,
    opcional: D.opcional,
    objetivoPlaceholder: D.objetivoPlaceholder,
    faltaSitio: D.faltaSitio,
    faltaCorreo: D.faltaCorreo,
    continuar: D.continuar,
    escribir: D.escribir,
    letraCal: D.letraCal,
    letraCorreo: D.letraCorreo,
    privacidad: D.privacidad,
    calTitulo: D.calTitulo,
    calVolver: D.calVolver,
    calZona: D.calZona,
    calEscribenos: D.calEscribenos,
    calCargando: D.calCargando,
    calFallo: D.calFallo,
    calAbrir: D.calAbrir,
    enlaceTitulo: D.enlaceTitulo,
    enlaceTexto: D.enlaceTexto,
    enlaceBoton: D.enlaceBoton,
    correoListoTitulo: D.correoListoTitulo,
    correoListoTexto: D.correoListoTexto,
    correoListoFin: D.correoListoFin,
    correoFallo: D.correoFallo,
    correoAsunto: D.correoAsunto,
    correoSitio: D.correoSitio,
    correoObjetivo: D.correoObjetivo,
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* En pantalla ancha: texto y agenda a la izquierda, la tarjeta fija a la derecha. En el teléfono la tarjeta va después del titular. */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-14">
        <header className="min-w-0 lg:col-start-1 lg:row-start-1">
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">{D.titulo}</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{D.intro}</p>
          <p className="mt-4 max-w-xl text-[15px] text-muted">
            {D.sinLlamadaA}{' '}
            <Link href="/radar" className={ENLACE}>
              {D.sinLlamadaEnlace}
            </Link>{' '}
            {D.sinLlamadaB}
          </p>
        </header>

        <div className="min-w-0 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Agendar modo={agendador()} t={textos} contacto={CONTACTO} locale={locale} />
        </div>

        <section aria-labelledby="demo-agenda" className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h2 id="demo-agenda" className="text-xl font-semibold">
            {D.agendaTitulo}
          </h2>
          <ol className="mt-5 divide-y divide-border border-y border-border">
            {D.agenda.map((x, i) => (
              <li key={x.titulo} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-5">
                <span aria-hidden className="pt-0.5 text-sm font-semibold tabular-nums text-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{x.titulo}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{x.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-20 grid gap-10 border-t border-border pt-10 sm:grid-cols-2 sm:gap-12">
        <section aria-labelledby="demo-para">
          <h2 id="demo-para" className="text-xl font-semibold">
            {D.paraTitulo}
          </h2>
          <ul className="mt-5 space-y-3.5">
            {D.para.map((x) => (
              <li key={x} className="flex gap-3 text-[15px] leading-relaxed">
                <Marca si />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="demo-no-para">
          <h2 id="demo-no-para" className="text-xl font-semibold">
            {D.noParaTitulo}
          </h2>
          <ul className="mt-5 space-y-3.5">
            {D.noPara.map((x) => (
              <li key={x} className="flex gap-3 text-[15px] leading-relaxed text-muted">
                <Marca si={false} />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="demo-sin-llamada" className="mt-16 rounded-xl border border-border bg-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 id="demo-sin-llamada" className="text-xl font-semibold">
              {D.sinLlamadaTitulo}
            </h2>
            <p className="mt-2 text-[15px] text-muted">{D.sinLlamadaTexto}</p>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link href="/precios" className={ENLACE}>
                {D.verPrecios}
              </Link>
              <Link href={locale === 'es' ? '/comparar' : '/compare'} className={ENLACE}>
                {D.verComparar}
              </Link>
            </p>
          </div>
          <Link href="/radar" className="btn btn-primario shrink-0 whitespace-normal text-center">
            {D.ctaRadar}
          </Link>
        </div>
      </section>

      <section aria-labelledby="demo-faq" className="mt-16 border-t border-border pt-8">
        <h2 id="demo-faq" className="text-xl font-semibold">
          {D.faqTitulo}
        </h2>
        <dl className="mt-2 divide-y divide-border">
          {faq.map((f) => (
            <div key={f.p} className="py-4">
              <dt className="text-base font-semibold">{f.p}</dt>
              <dd className="mt-1.5 max-w-2xl text-[15px] text-muted">{f.r}</dd>
            </div>
          ))}
        </dl>
      </section>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD de las preguntas de la demo, sin datos de usuarios
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />
    </div>
  )
}
