import Link from 'next/link'
import { PageHeader } from '@/components/chrome'
import type { Dict } from '@/lib/i18n'

/** El marco de los reportes que abre una tarjeta del agente: volver, título, bajada. */
export function MarcoReporte({ slug, d, titulo, sub, children }: { slug: string; d: Dict; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <Link href={`/t/${slug}/agente`} className="font-mono text-[11px] tracking-[0.1em] text-muted hover:text-text">
        ← {d.agenteReportes.volver}
      </Link>
      <PageHeader eyebrow={`${d.agenteReportes.eyebrow} / ${slug}`} titulo={titulo} sub={sub} />
      {children}
    </div>
  )
}

/** Sin Pro: el reporte no se arma; se ofrece ver los planes en Mi agente. */
export function CandadoReporte({ slug, d }: { slug: string; d: Dict }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-border p-4">
      <p className="text-sm text-muted">{d.agenteReportes.bloqueado}</p>
      <Link href={`/t/${slug}/agente#plan`} className="btn btn-primario">
        {d.agenteReportes.bloqueadoCta}
      </Link>
    </div>
  )
}
