import type { Metadata } from 'next'
import Link from 'next/link'
import { getDict } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.nav.noEncontradaTitulo, robots: { index: false } }
}

/**
 * 404 de todo el sitio, dentro del layout (nav y pie quedan). El "404" va en
 * puntos, la misma textura de la marca, y un solo camino: de vuelta al inicio.
 */
export default async function NoEncontrada() {
  const d = await getDict()

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <p aria-hidden className="cuatrocientos select-none text-[clamp(7rem,22vw,15rem)] leading-none font-extrabold tracking-tight">
        404
      </p>
      <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">{d.nav.noEncontradaTitulo}</h1>
      <p className="mt-3 max-w-md text-sm text-muted">{d.nav.noEncontradaTexto}</p>
      <Link href="/" className="btn btn-primario mt-8">
        {d.nav.volverInicio}
      </Link>
    </div>
  )
}
