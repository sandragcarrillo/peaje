import type { Metadata } from 'next'
import Link from 'next/link'
import { articulos, fechaCorta } from '@/lib/blog'
import { getDict, getLocale } from '@/lib/i18n'
import { Portada } from './portada'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.blog.titulo, description: d.blog.descripcion, alternates: { canonical: 'https://usepeaje.com/blog' } }
}

/**
 * Portada del blog, como x.ai/news: el artículo más nuevo grande (fecha,
 * título, bajada y "Leer más" a la izquierda, la portada a la derecha) y el
 * resto en tarjetas de cuatro columnas con categoría y fecha. Cada quien ve
 * los artículos de su idioma; si no hay ninguno en el suyo, ve todos.
 */
export default async function Blog() {
  const [d, locale, todos] = await Promise.all([getDict(), getLocale(), articulos()])
  const t = d.blog
  const propios = todos.filter((a) => a.idioma === locale)
  const lista = propios.length > 0 ? propios : todos

  if (lista.length === 0) {
    return (
      <section className="py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t.titulo}</h1>
        <p className="mt-3 text-sm text-muted">{t.vacio}</p>
      </section>
    )
  }

  const [primero, ...resto] = lista as [(typeof lista)[number], ...typeof lista]
  return (
    <div className="space-y-16 py-6">
      <h1 className="sr-only">{t.titulo}</h1>

      <article lang={primero.idioma} className="grid items-center gap-8 md:grid-cols-[2fr_3fr] md:gap-12">
        <div className="space-y-6">
          <p className="text-sm text-muted">
            <time dateTime={primero.fecha}>{fechaCorta(primero.fecha, locale)}</time>
          </p>
          <h2 className="text-4xl leading-[1.05] font-medium tracking-tight lg:text-5xl">
            <Link href={`/blog/${primero.slug}`}>{primero.titulo}</Link>
          </h2>
          {primero.descripcion ? <p className="text-lg leading-7">{primero.descripcion}</p> : null}
          <Link
            href={`/blog/${primero.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-text px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-85"
          >
            {t.leerMas}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
        <Link href={`/blog/${primero.slug}`} tabIndex={-1} className="block">
          <Portada texto={primero.tituloPortada} n={primero.portada} icono={primero.iconoPortada} grande />
        </Link>
      </article>

      {resto.length > 0 ? (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {resto.map((a) => (
            <li key={a.slug} lang={a.idioma}>
              <Link href={`/blog/${a.slug}`} className="group block space-y-3">
                <Portada texto={a.tituloPortada} n={a.portada} icono={a.iconoPortada} />
                <p className="flex items-center gap-2 text-sm text-muted">
                  {a.categoria ? (
                    <>
                      <span>{a.categoria}</span>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  <time dateTime={a.fecha}>{fechaCorta(a.fecha, locale)}</time>
                </p>
                <p className="leading-snug group-hover:underline group-hover:underline-offset-4">{a.titulo}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
