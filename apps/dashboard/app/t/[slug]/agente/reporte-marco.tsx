import Link from 'next/link'
import { PageHeader } from '@/components/chrome'
import type { Dict } from '@/lib/i18n'

/** El marco de los reportes que abre una tarjeta del agente: volver, título, bajada. */
export function MarcoReporte({ slug, d, titulo, sub, children }: { slug: string; d: Dict; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href={`/t/${slug}/agente`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="shrink-0">
            <path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {d.agenteReportes.volver}
        </Link>
        <PageHeader titulo={titulo} sub={sub} />
      </div>
      {children}
    </div>
  )
}

/** Sin Pro: el reporte no se arma; se ofrece ver los planes en Mi agente. */
export function CandadoReporte({ slug, d }: { slug: string; d: Dict }) {
  return (
    <div className="tarjeta flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <p className="min-w-0 text-sm text-muted">{d.agenteReportes.bloqueado}</p>
      <Link href={`/t/${slug}/agente#plan`} className="btn btn-primario">
        {d.agenteReportes.bloqueadoCta}
      </Link>
    </div>
  )
}
