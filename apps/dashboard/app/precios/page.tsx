import type { Metadata } from 'next'
import Link from 'next/link'
import { ENLACE } from '../components/legal'
import { getDict } from '@/lib/i18n'
import { COBROS_VISIBLES } from '@/lib/config'
import { COSTOS_CREDITOS, CUPOS_FOUNDER, DIAS_REEMBOLSO, LIMITES, PRECIOS_USD } from '@peaje/db'

/**
 * Precios. Montos, cupos, prueba, límites y créditos salen de packages/db/src/planes.ts;
 * la comisión del 2% es la misma que dice la landing (sección `precio`).
 * Paddle pide precio y funciones visibles en el sitio para aprobar el dominio.
 */

const COMISION_PCT = 2

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.precios.metaTitulo, description: d.precios.metaDescripcion }
}

/**
 * Una tarjeta de plan. Las dos tienen la misma forma: nombre, precio, texto,
 * lista y, pegado al fondo, una nota y el botón. Así quedan parejas aunque
 * una lista sea más larga.
 */
function Plan({
  nombre,
  precio,
  antes,
  unidad,
  texto,
  incluye,
  nota,
  cta,
  destacado,
}: {
  nombre: string
  precio: string
  /** Precio tachado al lado (el normal, cuando se muestra el de fundador). */
  antes?: string
  unidad?: string
  texto: string
  incluye: string[]
  nota: string
  cta: React.ReactNode
  destacado?: boolean
}) {
  return (
    <div className={`flex h-full flex-col rounded-lg border bg-panel p-6 ${destacado ? 'border-accent' : 'border-border'}`}>
      <p className="etiqueta text-muted">{nombre}</p>
      <p className="mt-3 flex items-baseline gap-2 text-4xl font-semibold tabular-nums">
        {precio}
        {antes ? <span className="text-lg font-normal text-muted line-through">{antes}</span> : null}
        {unidad ? <span className="text-sm font-normal text-muted">{unidad}</span> : null}
      </p>
      <p className="mt-3 text-sm text-muted">{texto}</p>
      <ul className="mt-5 flex flex-col gap-2 text-sm">
        {incluye.map((x) => (
          <li key={x} className="flex gap-2.5">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto space-y-4 pt-6">
        <p className="border-t border-border pt-4 text-sm text-muted">{nota}</p>
        {cta}
      </div>
    </div>
  )
}

export default async function Precios() {
  const d = await getDict()
  const P = d.precios

  return (
    <div className="mx-auto max-w-4xl">
      <p className="etiqueta text-muted">{P.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold">{P.titulo}</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">{P.intro}</p>

      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2">
        <Plan
          nombre={P.gratisNombre}
          precio="US$0"
          texto={P.gratisTexto}
          incluye={P.gratisIncluye}
          nota={COBROS_VISIBLES ? P.kitComision(COMISION_PCT) : P.kitNota}
          cta={
            <Link href="/radar" className="btn btn-secundario btn-ancho">
              {P.ctaRadar}
            </Link>
          }
        />
        <Plan
          nombre={P.proNombre}
          precio={`US$${PRECIOS_USD.founder}`}
          antes={`US$${PRECIOS_USD.pro}`}
          unidad={P.alMes}
          texto={P.proTexto}
          incluye={[...P.proIncluye, P.limites(LIMITES.pro.preguntas, LIMITES.pro.creditos)]}
          nota={P.proNota(CUPOS_FOUNDER, PRECIOS_USD.pro)}
          cta={
            <Link href="/nuevo?plan=1" className="btn btn-primario btn-ancho">
              {P.ctaAgente}
            </Link>
          }
          destacado
        />
      </div>

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">{P.creditosTitulo}</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted">{P.creditosIntro(LIMITES.pro.creditos)}</p>
        <dl className="mt-4 max-w-xl divide-y divide-border border-y border-border text-sm">
          {P.creditosCostos(COSTOS_CREDITOS).map((c) => (
            <div key={c.que} className="flex items-baseline justify-between gap-4 py-2">
              <dt>{c.que}</dt>
              <dd className="etiqueta tabular-nums text-muted">{P.creditos(c.cuanto)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-2xl text-sm text-muted">{P.creditosGratis}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">{P.creditosRenuevan}</p>
      </section>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border p-5">
          <h2 className="text-base font-semibold">{P.pruebaTitulo(DIAS_REEMBOLSO)}</h2>
          <p className="mt-2 text-sm text-muted">{P.pruebaTexto(DIAS_REEMBOLSO)}</p>
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

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">{P.faqTitulo}</h2>
        <dl className="mt-2 divide-y divide-border">
          {P.faq({ pct: COMISION_PCT, dias: DIAS_REEMBOLSO }).map((f) => (
            <div key={f.p} className="py-4">
              <dt className="text-base font-semibold">{f.p}</dt>
              <dd className="mt-1.5 max-w-2xl text-sm text-muted">{f.r}</dd>
            </div>
          ))}
        </dl>
      </section>

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
