import Link from 'next/link'
import type { CitationRun } from '@peaje/db'
import { accesoPro } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { leerCitacion } from '@/lib/gateway'
import { getDict, getLocale } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { FormatosPanel } from '../citacion'
import { CandadoReporte, MarcoReporte } from '../reporte-marco'
import { armarHistorial, Competidores, Evolucion, HistorialPreguntas, RONDAS_HISTORIAL } from './historia'

/**
 * A quién cita la IA en lugar del negocio, contado como una sola historia:
 * arriba cómo va con cada asistente contra la medición anterior, después cada
 * pregunta en las últimas seis mediciones con quién salió en su lugar, los
 * sitios que más aparecen y los formatos que la IA eligió. Lo abre la tarjeta
 * "Ver a quién cita la IA".
 */
export default async function Citas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d, locale] = await Promise.all([requireTenant(slug), getDict(), getLocale()])
  const t = d.agenteReportes

  if (!accesoPro(tenant).activo) {
    return (
      <MarcoReporte slug={tenant.slug} d={d} titulo={t.ciTitulo} sub={t.ciSub}>
        <CandadoReporte slug={tenant.slug} d={d} />
      </MarcoReporte>
    )
  }

  // Todo sale de las filas guardadas; del gateway solo hacen falta los formatos.
  const [citacion, todas] = await Promise.all([leerCitacion(tenant.slug).catch(() => null), store.listCitationRuns(tenant.id, RONDAS_HISTORIAL).catch((): CitationRun[] => [])])
  const historial = armarHistorial(todas, locale)
  const raiz = dominioVerificable(tenant.originUrl)
  const formatos = citacion?.summary?.measuredAt ? citacion.summary.formats : undefined

  return (
    <MarcoReporte slug={tenant.slug} d={d} titulo={t.ciTitulo} sub={t.ciSub}>
      {historial.rondas.length === 0 ? (
        <div className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <p className="min-w-0 text-sm text-muted">{t.histCero}</p>
          <Link href={`/t/${tenant.slug}/agente`} className="btn btn-primario">
            {t.histCeroCta}
          </Link>
        </div>
      ) : (
        <>
          <Evolucion h={historial} d={d} />
          <HistorialPreguntas h={historial} d={d} raiz={raiz} />
          <Competidores h={historial} d={d} raiz={raiz} />
          {formatos ? <FormatosPanel datos={formatos} /> : null}
          <Link href={`/t/${tenant.slug}/agente/oportunidades`} className="btn btn-primario">
            {t.ciVerOportunidades}
          </Link>
        </>
      )}
    </MarcoReporte>
  )
}
