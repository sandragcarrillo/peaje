import Link from 'next/link'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { MarcoReporte } from '../../reporte-marco'
import { CopiarTexto, PaginaMarkdown } from '../../reporte-cliente'
import { borradorDe, direccionDe, instruccionesDe, pendientesDe } from '../../reportes'

const pre = 'overflow-x-auto whitespace-pre-wrap break-words bg-panel-2 px-3 py-2 font-mono text-xs'

/**
 * Una tarea completa: el porqué, el borrador de la página como se va a ver y
 * las instrucciones para el coding agent del dueño. Lo abre la tarjeta de una
 * página o tarea en el chat, Telegram o Slack.
 */
export default async function Tarea({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.agenteReportes
  const m = d.miAgente
  const tarea = await store.getTask(tenant.id, decodeURIComponent(id)).catch(() => null)

  if (!tarea) {
    return (
      <MarcoReporte slug={tenant.slug} d={d} titulo={t.taNoEncontrada}>
        <Link href={`/t/${tenant.slug}/agente/oportunidades`} className="text-sm underline decoration-border underline-offset-2 hover:decoration-text">
          {t.taVerOportunidades}
        </Link>
      </MarcoReporte>
    )
  }

  const borrador = borradorDe(tarea)
  const faltan = borrador ? pendientesDe(borrador) : []
  const direccion = direccionDe(tarea)

  return (
    <MarcoReporte slug={tenant.slug} d={d} titulo={tarea.title}>
      <dl className="grid gap-2 border border-border p-4 text-sm md:grid-cols-[10rem_1fr]">
        <dt className="text-xs text-muted">{t.taEstado}</dt>
        <dd>
          <span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-muted">{m.tipos[tarea.kind] ?? tarea.kind}</span>
          {m.estados[tarea.status] ?? tarea.status}
          {tarea.note ? <span className="text-muted"> · {tarea.note}</span> : null}
        </dd>
        <dt className="text-xs text-muted">{t.taPorQue}</dt>
        <dd>{tarea.summary || m.porQueGenerico[tarea.kind]}</dd>
        {direccion ? (
          <>
            <dt className="text-xs text-muted">{t.taDireccion}</dt>
            <dd className="break-all font-mono text-xs">{direccion}</dd>
          </>
        ) : null}
      </dl>

      {faltan.length ? (
        <div className="border border-border p-4 text-sm">
          <p className="font-medium">{t.taFaltan}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t.taFaltanNota}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <CopiarTexto texto={tarea.body} />
        <Link href={`/t/${tenant.slug}/agente/oportunidades`} className="btn btn-secundario btn-chico">
          {t.taVerOportunidades}
        </Link>
      </div>

      {borrador ? (
        <section className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.1em] text-muted">{t.taPagina}</p>
          <div className="border border-border p-5">
            <PaginaMarkdown texto={borrador} />
          </div>
        </section>
      ) : null}

      <details className="border border-border p-4" open={!borrador}>
        <summary className="cursor-pointer text-sm">{t.taInstrucciones}</summary>
        <pre className={`${pre} mt-3`}>{instruccionesDe(tarea)}</pre>
      </details>
    </MarcoReporte>
  )
}
