import { textoDe, textoOk } from '@/app/radar/textos'
import { getDict, getLocale } from '@/lib/i18n'
import { prevision, type OraCheck, type OraScore } from '@/lib/ora'

/**
 * Las dos columnas del score: lo que un agente ya encuentra en el sitio y lo
 * que el kit de Peaje desbloquea, con los puntos que suma cada cosa. Las usan
 * Inicio del negocio (plegadas). Los nombres salen en palabras del dueño, en
 * su idioma (los mismos textos del Radar), no los ids en inglés de Ora.
 */
export async function ScoreColumnas({ score }: { score: OraScore }) {
  const [d, locale] = await Promise.all([getDict(), getLocale()])
  const bien: OraCheck[] = []
  for (const layer of score.layers) {
    for (const check of layer.checks) {
      if (check.status === 'pass' && !bien.some((b) => b.id === check.id)) bien.push(check)
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
        <div className="scroll-thin flex max-h-96 flex-col divide-y divide-border/60 overflow-y-auto pr-1 text-sm">
          {bien.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-faint" />
                <span>{textoOk(c, locale)}</span>
              </div>
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
          <div className="scroll-thin flex max-h-96 flex-col divide-y divide-border/60 overflow-y-auto pr-1 text-sm">
            {arreglables.map((a) => (
              <div key={a.check.id} className="flex items-start justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                  <span>{textoDe(a.check, locale).titulo}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">
                    +{(a.check.estScoreGain ?? a.check.maxScore).toFixed(1)}
                  </span>
                  {a.viaGateway ? <span className="font-mono text-[10px] text-muted">{d.radar.loPonePeaje}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
