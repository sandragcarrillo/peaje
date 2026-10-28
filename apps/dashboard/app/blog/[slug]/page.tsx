import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { articulo, fechaCorta } from '@/lib/blog'
import { dictFor } from '@/lib/i18n/dict'
import { Cuerpo } from '../cuerpo'

const BASE = 'https://usepeaje.com'

export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const a = await articulo((await params).slug)
  if (!a) return {}
  const url = `${BASE}/blog/${a.slug}`
  return {
    title: a.titulo,
    description: a.descripcion || undefined,
    // Con traducción, cada versión apunta a la otra (hreflang) para que el buscador sirva la del idioma de quien busca.
    alternates: {
      canonical: url,
      ...(a.traduccion ? { languages: { [a.idioma]: url, [a.idioma === 'es' ? 'en' : 'es']: `${BASE}/blog/${a.traduccion}` } } : {}),
    },
    openGraph: {
      type: 'article',
      url,
      title: a.titulo,
      description: a.descripcion || undefined,
      publishedTime: a.fecha,
      modifiedTime: a.actualizado,
      locale: a.idioma === 'es' ? 'es_ES' : 'en_US',
      siteName: 'Peaje',
      // El openGraph propio tapa la imagen de app/opengraph-image.png: se repite acá.
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Peaje: Get found by AI agents' }],
    },
  }
}

/**
 * Un artículo, como x.ai/news/grok-voice-3: arriba "Volver" y la fecha; el
 * título centrado con su bajada y los dos botones; el texto en una columna; y
 * un cierre con los mismos botones. Los textos de la página van en el idioma
 * del artículo, no en el de quien lo abre. Lleva JSON-LD de Article para que
 * los buscadores y la IA sepan qué es, quién lo publica y cuándo.
 */
export default async function ArticuloBlog({ params }: PageProps<'/blog/[slug]'>) {
  const a = await articulo((await params).slug)
  if (!a) notFound()
  const t = dictFor(a.idioma).blog
  const url = `${BASE}/blog/${a.slug}`
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.titulo,
    description: a.descripcion || undefined,
    datePublished: a.fecha,
    dateModified: a.actualizado,
    inLanguage: a.idioma,
    mainEntityOfPage: url,
    url,
    author: { '@type': 'Organization', name: 'Peaje', url: BASE },
    publisher: { '@type': 'Organization', name: 'Peaje', url: BASE, logo: { '@type': 'ImageObject', url: `${BASE}/icon.svg` } },
  }

  return (
    <article lang={a.idioma} className="mx-auto max-w-3xl py-6">
      <div className="flex items-center justify-between gap-4 text-sm text-muted">
        <Link href="/blog" className="-my-2.5 inline-flex items-center gap-2 py-2.5 hover:text-text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {t.volver}
        </Link>
        <time dateTime={a.fecha}>{fechaCorta(a.fecha, a.idioma)}</time>
      </div>

      <header className="mt-14 space-y-5 text-center">
        <h1 className="text-4xl leading-tight font-medium tracking-tight sm:text-5xl">{a.titulo}</h1>
        {a.descripcion ? <p className="mx-auto max-w-2xl text-lg leading-7 text-muted">{a.descripcion}</p> : null}
        <Botones t={t} />
      </header>

      <div className="mt-14">
        <Cuerpo markdown={a.cuerpo} />
      </div>

      <aside className="mt-16 space-y-4 border border-border bg-panel p-6 text-center sm:p-8">
        <p className="text-2xl font-medium tracking-tight">{t.cierreTitulo}</p>
        <p className="mx-auto max-w-md text-sm text-muted">{t.cierreTexto}</p>
        <Botones t={t} />
      </aside>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD del artículo, sin datos de usuarios
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />
    </article>
  )
}

function Botones({ t }: { t: ReturnType<typeof dictFor>['blog'] }) {
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

function Flecha() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}

