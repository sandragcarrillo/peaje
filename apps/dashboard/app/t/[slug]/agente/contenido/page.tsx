import Link from 'next/link'
import type { AgentTask, CitationRun, TaskFollowup } from '@peaje/db'
import { accesoPro, COSTOS_CREDITOS } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { BuscarOportunidades } from '../reporte-cliente'
import { armarPipeline } from './etapas'
import { Pipeline } from './pipeline'

/** Rondas de citación que se leen para encontrar la última medición de cada pregunta. */
const RONDAS = 8

/**
 * Contenido: el pipeline de las páginas que prepara el agente Pro. Lista a la
 * izquierda con tipo, estado y prioridad; a la derecha la elegida con sus
 * etapas y la evidencia, las instrucciones y el borrador. Todo sale de las
 * tareas de contenido, sus seguimientos y las rondas de citación guardadas.
 */
export default async function Contenido({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ id?: string | string[] }> }) {
  const [{ slug }, { id }] = await Promise.all([params, searchParams])
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.contenido
  const cabecera = <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.sub} />

  if (!accesoPro(tenant).activo) {
    return (
      <div className="space-y-8">
        {cabecera}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-border p-4">
          <p className="max-w-xl text-sm text-muted">{t.bloqueado}</p>
          <Link href={`/t/${tenant.slug}/agente#plan`} className="btn btn-primario">
            {t.bloqueadoCta}
          </Link>
        </div>
      </div>
    )
  }

  const [tareas, seguimientos, runs] = await Promise.all([
    store.listTasks(tenant.id).catch((): AgentTask[] => []),
    store.listFollowups(tenant.id, 500).catch((): TaskFollowup[] => []),
    store.listCitationRuns(tenant.id, RONDAS).catch((): CitationRun[] => []),
  ])
  const piezas = armarPipeline(tareas, seguimientos, runs, dominioVerificable(tenant.originUrl))

  return (
    <div className="space-y-8">
      {cabecera}
      {piezas.length === 0 ? (
        <div className="space-y-4 border border-dashed border-border p-4">
          <p className="text-sm text-muted">{t.vacio}</p>
          <BuscarOportunidades slug={tenant.slug} />
        </div>
      ) : (
        <Pipeline slug={tenant.slug} piezas={piezas} inicial={typeof id === 'string' ? id : null} creditosPagina={COSTOS_CREDITOS.pagina} />
      )}
    </div>
  )
}
