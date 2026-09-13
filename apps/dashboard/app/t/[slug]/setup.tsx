import Link from 'next/link'
import { getDict } from '@/lib/i18n'

export type PasoSetup = {
  n: number
  titulo: string
  descripcion: string
  href: string
  hecho: boolean
  estado: string
}

/**
 * Checklist de configuración, calcada del mock: tres pasos en grilla con
 * índice PASO 0n, estado [✓]/[ ], y el par de botones unidos abajo.
 * Desaparece sola cuando los tres pasos están.
 */
export async function SetupChecklist({ pasos, slug }: { pasos: PasoSetup[]; slug: string }) {
  const pendientes = pasos.filter((p) => !p.hecho)
  if (pendientes.length === 0) return null

  const d = await getDict()
  const siguiente = pendientes[0]!

  return (
    <div className="space-y-5 border border-border bg-bg p-6">
      <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-2 w-2 bg-accent" />
          <h3 className="text-lg font-semibold">{d.panel.setupTitulo}</h3>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
          ({d.panel.setupProgreso(pasos.length - pendientes.length, pasos.length)})
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-3">
        {pasos.map((p) => (
          <Link
            key={p.n}
            href={p.href}
            className={`flex items-start gap-3 border border-border p-3.5 transition-colors hover:border-text ${
              p.hecho ? 'bg-panel' : 'bg-bg'
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-4 w-4 items-center justify-center border ${
                p.hecho ? 'border-text bg-negro' : 'border-faint bg-panel-2'
              }`}
            >
              <span className={`h-1.5 w-1.5 ${p.hecho ? 'bg-accent' : 'bg-border'}`} />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {d.panel.pasoLabel(p.n)}
              </span>
              <span className={`mt-0.5 block font-mono text-xs ${p.hecho ? 'font-bold' : ''}`}>
                {p.titulo}
              </span>
              <span
                className={`mt-1 block font-mono text-[10px] tracking-[0.04em] ${
                  p.hecho ? 'text-accent' : 'text-muted'
                }`}
              >
                {p.estado}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2">
        <div className="inline-flex border border-text bg-bg p-0.5">
          <Link
            href={siguiente.href}
            className="flex items-center gap-2 bg-negro px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta"
          >
            <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
            {d.panel.setupContinuar}
          </Link>
          <Link
            href={`/t/${slug}/kit`}
            className="px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors hover:bg-panel-2"
          >
            KIT
          </Link>
        </div>
      </div>
    </div>
  )
}
