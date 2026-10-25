import Link from 'next/link'
import type { AgentTask } from '@peaje/db'
import { accesoPro } from '@peaje/db'
import { SectionBar } from '@/components/chrome'
import { leerCitacion } from '@/lib/gateway'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { CandadoReporte, MarcoReporte } from '../reporte-marco'
import { BuscarOportunidades } from '../reporte-cliente'
import { ordenarOportunidades } from '../reportes'

/**
 * Oportunidades de contenido: las tareas de contenido abiertas, ordenadas por
 * evidencia, con el porqué, el formato que conviene y un link a cada una. Lo
 * abre la tarjeta "Ver oportunidades" del agente. Sugerencias nuevas: el botón
 * corre la misma búsqueda que Mi agente (con su límite de una cada 10 min).
 */
export default async function Oportunidades({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.agenteReportes
  const m = d.miAgente

  if (!accesoPro(tenant).activo) {
    return (
      <MarcoReporte slug={tenant.slug} d={d} titulo={t.opTitulo} sub={t.opSub}>
        <CandadoReporte slug={tenant.slug} d={d} />
      </MarcoReporte>
    )
  }

  const [tareas, citacion] = await Promise.all([
    store.listTasks(tenant.id, { statuses: ['open', 'in_progress'] }).catch((): AgentTask[] => []),
    leerCitacion(tenant.slug).catch(() => null),
  ])
  const lista = ordenarOportunidades(tareas, citacion)
  const formatos = citacion?.summary.formats?.formats.slice(0, 3) ?? []

  return (
    <MarcoReporte slug={tenant.slug} d={d} titulo={t.opTitulo} sub={t.opSub}>
      <BuscarOportunidades slug={tenant.slug} />

      {formatos.length ? (
        <section className="space-y-3">
          <SectionBar label={t.opFormatosGanan} />
          <ul className="divide-y divide-border border border-border text-sm">
            {formatos.map((f) => (
              <li key={f.format} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium">{m.fmtNombres[f.format] ?? f.format}</span>
                  <span className="text-muted"> · {m.fmtPara[f.format]}</span>
                </span>
                <span className="font-mono text-xs text-muted">{t.opCitas(f.citations)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/t/${tenant.slug}/agente/citas`} className="inline-block text-sm underline decoration-border underline-offset-2 hover:decoration-text">
            {t.opVerCitas}
          </Link>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionBar label={t.opTitulo} meta={String(lista.length)} />
        {lista.length === 0 ? <p className="text-sm text-muted">{t.opVacio}</p> : null}
        <ol className="space-y-3">
          {lista.map((o, i) => (
            <li key={o.tarea.id} className="border border-border p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                <Link href={`/t/${tenant.slug}/agente/tareas/${o.tarea.id}`} className="font-medium hover:underline">
                  {o.tarea.title}
                </Link>
              </div>
              {o.noCitado || o.modelo || o.serie || o.tarea.status === 'in_progress' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.noCitado ? <Senal texto={t.opNoCitado} fuerte /> : null}
                  {o.modelo ? <Senal texto={t.opConEjemplo} /> : null}
                  {o.serie ? <Senal texto={t.opSerie} /> : null}
                  {o.tarea.status === 'in_progress' ? <Senal texto={t.opEnCurso} /> : null}
                </div>
              ) : null}
              <dl className="mt-3 grid gap-2 md:grid-cols-[9rem_1fr]">
                <dt className="text-xs text-muted">{t.opPorQue}</dt>
                <dd>{o.tarea.summary || m.porQueGenerico[o.tarea.kind]}</dd>
                {o.formato ? (
                  <>
                    <dt className="text-xs text-muted">{t.opFormato}</dt>
                    <dd>
                      <span className="font-medium">{m.fmtNombres[o.formato] ?? o.formato}</span>
                      {m.fmtRasgos[o.formato]?.length ? <span className="text-muted">. {t.opComo}: {m.fmtRasgos[o.formato]!.join(' · ')}</span> : null}
                    </dd>
                  </>
                ) : null}
                {o.modelo ? (
                  <>
                    <dt className="text-xs text-muted">{t.opImitar}</dt>
                    <dd className="truncate">
                      <a href={o.modelo} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-2 hover:decoration-text">
                        {o.modelo}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted">{o.conBorrador ? (o.pendientes ? t.opFaltan(o.pendientes) : t.opBorradorListo) : t.opSinBorrador}</span>
                <Link href={`/t/${tenant.slug}/agente/tareas/${o.tarea.id}`} className="btn btn-secundario btn-chico">
                  {t.opAbrir}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </MarcoReporte>
  )
}

function Senal({ texto, fuerte }: { texto: string; fuerte?: boolean }) {
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${fuerte ? 'border-text text-text' : 'border-border text-muted'}`}>{texto}</span>
}
