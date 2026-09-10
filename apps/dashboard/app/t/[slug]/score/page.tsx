import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { cachedScore, gradeDe, prevision, scannableDomain, type OraScore } from '@/lib/ora'
import { BotonScore } from '../kit/partes'

export default async function Score({ params }: PageProps<'/t/[slug]/score'>) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const domain = scannableDomain(tenant.originUrl)
  const score = domain ? await cachedScore(domain) : null

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">{d.panel.scoreTitulo}</h1>
        <p className="mt-2 text-sm text-muted">{d.panel.scoreDescripcion}</p>
      </header>

      {!domain ? (
        <p className="rounded-lg border border-border bg-panel p-4 text-sm text-muted">
          {d.panel.scoreOriginLocal}
        </p>
      ) : !score ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-panel p-4">
          <p className="text-sm text-muted">
            {d.panel.scorePendientePre}
            <strong className="text-text">{domain}</strong>
            {d.panel.scorePendientePost}
          </p>
          <BotonScore slug={tenant.slug} label={d.panel.correrScore} />
        </div>
      ) : (
        <Resultado slug={tenant.slug} score={score} />
      )}
    </div>
  )
}

async function Resultado({ slug, score }: { slug: string; score: OraScore }) {
  const d = await getDict()
  const p = prevision(score)

  const bien: { id: string; name: string }[] = []
  for (const layer of score.layers) {
    for (const check of layer.checks) {
      if (check.status === 'pass') bien.push({ id: check.id, name: check.name })
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{score.domain}</p>
            <p className="mt-2 flex items-center gap-3">
              <span className="text-5xl">{p.actual}</span>
              <span className="rounded border border-border px-2 py-0.5 font-mono text-sm">
                {score.grade}
              </span>
              <span className="text-muted">→</span>
              <span className="text-5xl text-accent">~{p.estimado}</span>
              <span className="rounded border border-accent/50 px-2 py-0.5 font-mono text-sm text-accent">
                {gradeDe(p.estimado)}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted">{d.panel.scoreComparativa}</p>
          </div>
          <BotonScore slug={slug} label={d.panel.volverACorrerScore} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="font-medium text-green-400">{d.panel.scoreBien}</h2>
          <p className="mt-1 text-xs text-muted">{d.panel.scoreChecksPasando(bien.length)}</p>
          <div className="relative mt-3">
            <ul className="scroll-thin max-h-96 space-y-1.5 overflow-y-auto pr-2">
              {bien.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  {c.name}
                </li>
              ))}
            </ul>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bg to-transparent" />
          </div>
        </section>

        <section>
          <h2 className="font-medium text-red-400">{d.panel.scoreMejoras}</h2>
          <p className="mt-1 text-xs text-muted">
            {d.panel.scoreChecksAtacados(p.arreglables.length)}
          </p>
          <div className="relative mt-3">
            <ul className="scroll-thin max-h-96 space-y-1.5 overflow-y-auto pr-2">
              {p.arreglables
                .sort(
                  (a, b) =>
                    (b.check.estScoreGain ?? b.check.maxScore) -
                    (a.check.estScoreGain ?? a.check.maxScore),
                )
                .map((a) => (
                  <li key={a.check.id} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    <span className="flex-1">{a.check.name}</span>
                    <span className="font-mono text-xs text-muted">
                      +{(a.check.estScoreGain ?? a.check.maxScore).toFixed(1)}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                      {a.viaGateway ? 'gateway' : a.bloque}
                    </span>
                  </li>
                ))}
            </ul>
            {p.arreglables.length > 0 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bg to-transparent" />
            ) : null}
          </div>
          {p.arreglables.length === 0 ? (
            <p className="mt-3 text-sm text-accent">{d.panel.scoreTodoPasa}</p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
