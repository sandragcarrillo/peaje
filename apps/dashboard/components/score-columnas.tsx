import { getDict } from '@/lib/i18n'
import { prevision, type OraScore } from '@/lib/ora'

/**
 * Las dos columnas del score: lo que un agente ya encuentra en el sitio y lo
 * que el kit de Peaje desbloquea, con los puntos que suma cada cosa. Las usan
 * el score del dashboard y el radar público.
 */
export async function ScoreColumnas({ score }: { score: OraScore }) {
  const d = await getDict()
  const bien: { id: string; name: string }[] = []
  for (const layer of score.layers) {
    for (const check of layer.checks) {
      if (check.status === 'pass') bien.push({ id: check.id, name: check.name })
    }
  }
  const arreglables = [...prevision(score).arreglables].sort(
    (a, b) => (b.check.estScoreGain ?? b.check.maxScore) - (a.check.estScoreGain ?? a.check.maxScore),
  )

  return (
    <div className="grid grid-cols-1 divide-y divide-border border-t border-border md:grid-cols-2 md:divide-x md:divide-y-0">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-bold">{d.panel.scoreCol1}</h2>
          <span className="border border-border bg-panel-2 px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-muted">
            {d.panel.scoreChecksOk(bien.length)}
          </span>
        </div>
        <div className="scroll-thin flex max-h-96 flex-col divide-y divide-border/60 overflow-y-auto pr-1 font-mono text-xs">
          {bien.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-faint" />
                <span className="truncate font-bold">{c.name}</span>
              </div>
              <span className="shrink-0 bg-panel-2 px-1.5 py-0.5 font-bold">PASS</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-panel p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-bold">{d.panel.scoreCol2}</h2>
          <span className="border border-border bg-panel-2 px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-muted">
            {d.panel.scoreChecksPend(arreglables.length)}
          </span>
        </div>
        {arreglables.length === 0 ? (
          <p className="font-mono text-sm text-accent">{d.panel.scoreTodoPasa}</p>
        ) : (
          <div className="scroll-thin flex max-h-96 flex-col divide-y divide-border/60 overflow-y-auto pr-1 font-mono text-xs">
            {arreglables.map((a) => (
              <div key={a.check.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-accent" />
                  <span className="truncate">{a.check.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold text-accent">
                    +{(a.check.estScoreGain ?? a.check.maxScore).toFixed(1)}
                  </span>
                  <span className="border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted">
                    {a.viaGateway ? 'gateway' : a.bloque}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
