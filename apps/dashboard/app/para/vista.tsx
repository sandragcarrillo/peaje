import type { Metadata } from 'next'
import Link from 'next/link'
import { Cuerpo } from '../blog/cuerpo'
import { CtaInicio } from '../components/cta-inicio'
import { type Idioma, type PaginaPara, RUTA, paginasPara } from '@/lib/para'
import { para } from '@/lib/i18n/sections/para'
import { fechaCorta } from '@/lib/markdown'

/**
 * Las vistas de las páginas por tipo de negocio, compartidas por /para
 * (español) y /for (inglés). Calcadas de las comparativas: el cuerpo se pinta
 * con el renderizador del blog, cada página cruza su par de idioma por
 * hreflang y lleva JSON-LD de Article, FAQPage y BreadcrumbList; el índice,
 * CollectionPage.
 */

const BASE = 'https://usepeaje.com'
const OTRO: Record<Idioma, Idioma> = { es: 'en', en: 'es' }
const OG = [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Peaje: Get found by AI agents' }]

const urlDe = (idioma: Idioma, slug?: string) => `${BASE}${RUTA[idioma]}${slug ? `/${slug}` : ''}`

function JsonLd({ datos }: { datos: unknown }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD armado acá, sin datos de usuarios
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, '\\u003c') }}
    />
  )
}

function Flecha({ hacia = 'afuera' }: { hacia?: 'afuera' | 'atras' | 'derecha' }) {
  const d = hacia === 'atras' ? 'M19 12H5M11 18l-6-6 6-6' : hacia === 'derecha' ? 'M5 12h14M13 6l6 6-6 6' : 'M7 17 17 7M8 7h9v9'
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d={d} />
    </svg>
  )
}

function Botones({ idioma }: { idioma: Idioma }) {
  const t = para[idioma]
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
      <Link href="/radar" className="btn btn-primario gap-1.5 whitespace-normal">
        {t.ctaPrimario}
        <Flecha />
      </Link>
      <Link href="/precios" className="btn btn-secundario gap-1.5 whitespace-normal">
        {t.ctaSecundario}
        <Flecha />
      </Link>
    </div>
  )
}

function Cierre({ idioma }: { idioma: Idioma }) {
  const t = para[idioma]
  return (
    <aside className="mt-16 space-y-4 border border-border bg-panel p-6 text-center sm:p-8">
      <p className="text-2xl font-medium tracking-tight">{t.cierreTitulo}</p>
      <p className="mx-auto max-w-md text-sm text-muted">{t.cierreTexto}</p>
      {/* El cierre de las páginas públicas (cta-inicio.tsx), en el idioma de la URL. */}
      <CtaInicio locale={idioma} className="pt-3" />
    </aside>
  )
}

/* ------------------------------------------------------------------ índice */

export function metadataIndice(idioma: Idioma): Metadata {
  const t = para[idioma]
  const url = urlDe(idioma)
  return {
    title: t.metaTitulo,
    description: t.metaDescripcion,
    alternates: { canonical: url, languages: { [idioma]: url, [OTRO[idioma]]: urlDe(OTRO[idioma]) } },
    openGraph: { type: 'website', url, title: t.metaTitulo, description: t.metaDescripcion, siteName: 'Peaje', locale: idioma === 'es' ? 'es_ES' : 'en_US', images: OG },
  }
}

export async function Indice({ idioma }: { idioma: Idioma }) {
  const t = para[idioma]
  const lista = await paginasPara(idioma)
  const revisado = lista.map((c) => c.revisado).sort().at(-1)
  const url = urlDe(idioma)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t.titulo,
        description: t.metaDescripcion,
        url,
        inLanguage: idioma,
        publisher: { '@type': 'Organization', name: 'Peaje', url: BASE },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: lista.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.titulo, url: urlDe(idioma, c.slug) })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.inicio, item: BASE },
          { '@type': 'ListItem', position: 2, name: t.titulo, item: url },
        ],
      },
    ],
  }

  return (
    <div lang={idioma} className="mx-auto max-w-3xl py-6">
      <header className="space-y-5">
        <h1 className="text-4xl leading-tight font-medium tracking-tight sm:text-5xl">{t.titulo}</h1>
        <p className="max-w-2xl text-lg leading-7 text-muted">{t.intro}</p>
        {revisado ? <p className="text-sm text-muted">{t.revisadas(fechaCorta(revisado, idioma))}</p> : null}
      </header>

      <ul className="mt-12 border-t border-border">
        {lista.map((c) => (
          <li key={c.slug} className="border-b border-border">
            <Link href={`${RUTA[idioma]}/${c.slug}`} className="group flex items-start justify-between gap-6 py-6">
              <span className="min-w-0 space-y-2">
                <span className="block text-xl font-medium tracking-tight group-hover:underline group-hover:underline-offset-4">{c.corto}</span>
                {c.descripcion ? <span className="block text-sm leading-6 text-muted">{c.descripcion}</span> : null}
              </span>
              <span className="mt-1.5 text-muted transition-transform group-hover:translate-x-0.5">
                <Flecha hacia="derecha" />
                <span className="sr-only">{t.leer}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Cierre idioma={idioma} />
      <JsonLd datos={ld} />
    </div>
  )
}

/* ------------------------------------------------------------------ página */

export function metadataPara(c: PaginaPara): Metadata {
  const url = urlDe(c.idioma, c.slug)
  return {
    title: c.titulo,
    description: c.descripcion || undefined,
    alternates: {
      canonical: url,
      ...(c.traduccion ? { languages: { [c.idioma]: url, [OTRO[c.idioma]]: urlDe(OTRO[c.idioma], c.traduccion) } } : {}),
    },
    openGraph: {
      type: 'article',
      url,
      title: c.titulo,
      description: c.descripcion || undefined,
      publishedTime: c.fecha,
      modifiedTime: c.revisado,
      locale: c.idioma === 'es' ? 'es_ES' : 'en_US',
      siteName: 'Peaje',
      images: OG,
    },
  }
}

export function VistaPara({ c }: { c: PaginaPara }) {
  const t = para[c.idioma]
  const url = urlDe(c.idioma, c.slug)
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: c.titulo,
        description: c.descripcion || undefined,
        datePublished: c.fecha,
        dateModified: c.revisado,
        inLanguage: c.idioma,
        mainEntityOfPage: url,
        url,
        author: { '@type': 'Organization', name: 'Peaje', url: BASE },
        publisher: { '@type': 'Organization', name: 'Peaje', url: BASE, logo: { '@type': 'ImageObject', url: `${BASE}/icon.svg` } },
      },
      ...(c.faq.length > 0
        ? [
            {
              '@type': 'FAQPage',
              url,
              inLanguage: c.idioma,
              mainEntity: c.faq.map((x) => ({ '@type': 'Question', name: x.p, acceptedAnswer: { '@type': 'Answer', text: x.r } })),
            },
          ]
        : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.inicio, item: BASE },
          { '@type': 'ListItem', position: 2, name: t.titulo, item: urlDe(c.idioma) },
          { '@type': 'ListItem', position: 3, name: c.corto, item: url },
        ],
      },
    ],
  }

  return (
    <article lang={c.idioma} className="mx-auto max-w-3xl py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted">
        <Link href={RUTA[c.idioma]} className="-my-2.5 inline-flex items-center gap-2 py-2.5 hover:text-text">
          <Flecha hacia="atras" />
          {t.volver}
        </Link>
        <p>
          {t.revisado}: <time dateTime={c.revisado}>{fechaCorta(c.revisado, c.idioma)}</time>
        </p>
      </div>

      <header className="mt-14 space-y-5 text-center">
        <h1 className="text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl">{c.titulo}</h1>
        {c.descripcion ? <p className="mx-auto max-w-2xl text-lg leading-7 text-muted">{c.descripcion}</p> : null}
        <Botones idioma={c.idioma} />
      </header>

      <div className="mt-14">
        <Cuerpo markdown={c.cuerpo} />
      </div>

      <Cierre idioma={c.idioma} />
      <JsonLd datos={ld} />
    </article>
  )
}
