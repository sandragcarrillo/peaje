import Link from 'next/link'
import { getDict } from '@/lib/i18n'

export type PasoSetup = {
  n: number
  titulo: string
  descripcion: string
  href: string
  hecho: boolean
}

/**
 * Checklist de configuración. Aparece en el Dashboard mientras falte algo;
 * cuando los tres pasos están, desaparece solo.
 */
export async function SetupChecklist({ pasos }: { pasos: PasoSetup[] }) {
  const pendientes = pasos.filter((p) => !p.hecho)
  if (pendientes.length === 0) return null

  const actual = pendientes[0]!.n
  const d = await getDict()

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <h2 className="font-medium">{d.panel.setupTitulo}</h2>
      <p className="mt-1 text-xs text-muted">
        {d.panel.setupProgreso(pasos.length - pendientes.length, pasos.length)}
      </p>
      <ol className="mt-4 space-y-3">
        {pasos.map((p) => (
          <li key={p.n} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                p.hecho
                  ? 'border-accent/40 text-accent'
                  : p.n === actual
                    ? 'border-accent bg-accent text-black'
                    : 'border-border text-muted'
              }`}
            >
              {p.hecho ? '✓' : p.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${p.hecho ? 'text-muted line-through' : ''}`}>{p.titulo}</p>
              {!p.hecho ? <p className="text-xs text-muted">{p.descripcion}</p> : null}
            </div>
            {!p.hecho ? (
              <Link
                href={p.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  p.n === actual
                    ? 'bg-accent text-black'
                    : 'border border-border text-muted hover:text-text'
                }`}
              >
                {p.n === actual ? d.panel.setupContinuar : d.panel.setupIr}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
