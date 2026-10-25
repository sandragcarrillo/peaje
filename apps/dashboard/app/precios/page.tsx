import type { Metadata } from 'next'
import Link from 'next/link'
import { ENLACE } from '../components/legal'
import { getDict } from '@/lib/i18n'
import { CUPOS_FOUNDER, DIAS_PRUEBA, LIMITES, PRECIOS_USD } from '@peaje/db'

/**
 * Precios. Montos, cupos, prueba y límites salen de packages/db/src/planes.ts;
 * la comisión del 2% es la misma que dice la landing (sección `precio`).
 * Paddle pide precio y funciones visibles en el sitio para aprobar el dominio.
 */

const COMISION_PCT = 2

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.precios.metaTitulo, description: d.precios.metaDescripcion }
}

function Plan({
  nombre,
  precio,
  unidad,
  texto,
  children,
  destacado,
}: {
  nombre: string
  precio: string
  unidad?: string
  texto: string
  children?: React.ReactNode
  destacado?: boolean
}) {
  return (
    <div className={`flex flex-col rounded-lg border bg-panel p-5 ${destacado ? 'border-accent' : 'border-border'}`}>
      <p className="font-mono text-xs text-muted">{nombre}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">
        {precio}
        {unidad ? <span className="ml-1.5 text-sm font-normal text-muted">{unidad}</span> : null}
      </p>
      <p className="mt-3 text-sm text-muted">{texto}</p>
      {children}
    </div>
  )
}

export default async function Precios() {
  const d = await getDict()
  const P = d.precios

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-xs text-muted">{P.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold">{P.titulo}</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">{P.intro}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Plan nombre={P.radarNombre} precio={P.gratis} texto={P.radarTexto} />
        <Plan nombre={P.kitNombre} precio={P.gratis} texto={P.kitTexto}>
          <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
            {P.kitIncluye.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{P.kitComision(COMISION_PCT)}</p>
        </Plan>
        <Plan
          nombre={P.founderNombre}
          precio={`US$${PRECIOS_USD.founder}`}
          unidad={P.alMes}
          texto={P.founderTexto(CUPOS_FOUNDER)}
          destacado
        >
          <p className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted">
            {P.limites(LIMITES.founder.preguntas, LIMITES.founder.mensajes)}
          </p>
        </Plan>
        <Plan nombre={P.proNombre} precio={`US$${PRECIOS_USD.pro}`} unidad={P.alMes} texto={P.proTexto(CUPOS_FOUNDER)}>
          <p className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted">
            {P.limites(LIMITES.pro.preguntas, LIMITES.pro.mensajes)}
          </p>
        </Plan>
      </div>

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">{P.proIncluyeTitulo}</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-2 text-[15px] text-muted sm:grid-cols-2">
          {P.proIncluye.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden className="text-accent">›</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">{P.pruebaTitulo(DIAS_PRUEBA)}</h2>
          <p className="mt-2 text-sm text-muted">{P.pruebaTexto(DIAS_PRUEBA)}</p>
        </section>
        <section className="rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">{P.cobroTitulo}</h2>
          <p className="mt-2 text-sm text-muted">{P.cobroTexto}</p>
          <p className="mt-3 text-sm text-muted">
            {P.cobroEnlaces}{' '}
            <Link href="/terms" className={ENLACE}>
              {P.terminos}
            </Link>
            {' · '}
            <Link href="/reembolsos" className={ENLACE}>
              {P.reembolsos}
            </Link>
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/radar" className="btn btn-primario">
          {P.ctaRadar}
        </Link>
        <Link href="/nuevo" className="btn btn-secundario">
          {P.ctaRegistrar}
        </Link>
      </div>
    </div>
  )
}
