import { getDict } from '@/lib/i18n'
import { cachedScore, gradeDe, prevision, scannableDomain, type OraScore } from '@/lib/ora'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import Link from 'next/link'
import { BotonScore } from '../kit/partes'

/** Score, calcado del mock "Score · Editorial Terminal" de Stitch. */
export default async function Score({ params }: PageProps<'/t/[slug]/score'>) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const domain = scannableDomain(tenant.originUrl)
  const score = domain ? await cachedScore(domain) : null

  // El primer score que vemos queda como el "antes" del negocio.
  if (score && tenant.baselineScore === null) {
    await store.setBaselineScore(tenant.id, score.score).catch(() => {})
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          <span>{d.panel.scoreEyebrow}</span>
          {domain ? (
            <>
              <span className="text-border">/</span>
              <span className="font-bold text-accent">{domain}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-baseline">
          <h1 className="text-3xl font-bold tracking-tight">{d.panel.scoreTitulo}</h1>
          {score?.scannedAt ? (
            <div className="self-start border border-border bg-panel-2 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted md:self-auto">
              {d.panel.scoreAuditoria}: {score.scannedAt.slice(0, 19)}Z
            </div>
          ) : null}
        </div>
        <p className="border-b border-border pb-3 text-sm text-muted">{d.panel.scoreDescripcion}</p>
      </section>

      {!domain ? (
        <p className="border border-border bg-panel p-4 text-sm text-muted">
          {d.panel.scoreOriginLocal}
        </p>
      ) : !score ? (
        <div className="flex items-center justify-between gap-4 border border-border bg-panel p-4">
          <p className="text-sm text-muted">
            {d.panel.scorePendientePre}
            <strong className="text-text">{domain}</strong>
            {d.panel.scorePendientePost}
          </p>
          <BotonScore slug={tenant.slug} label={d.panel.correrScore} />
        </div>
      ) : (
        <Resultado slug={tenant.slug} score={score} baseline={tenant.baselineScore} />
      )}
    </>
  )
}

async function Resultado({
  slug,
  score,
  baseline,
}: {
  slug: string
  score: OraScore
  baseline: number | null
}) {
  const d = await getDict()
  const p = prevision(score)
  const mejora = baseline !== null && score.score > baseline ? score.score - baseline : null
  const margen = p.estimado - p.actual

  const bien: { id: string; name: string }[] = []
  for (const layer of score.layers) {
    for (const check of layer.checks) {
      if (check.status === 'pass') bien.push({ id: check.id, name: check.name })
    }
  }
  const arreglables = [...p.arreglables].sort(
    (a, b) => (b.check.estScoreGain ?? b.check.maxScore) - (a.check.estScoreGain ?? a.check.maxScore),
  )

  return (
    <section className="border border-border bg-bg">
      {/* Cinta superior de la card */}
      <div className="flex items-center justify-between border-b border-border bg-panel px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
          <span>SCORE · {score.domain}</span>
        </div>
        <span className="hidden md:block">{score.grade}</span>
      </div>

      {/* Lectura principal */}
      <div className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center lg:p-8">
        <div className="flex flex-wrap items-center gap-5 md:gap-8">
          <div className="text-6xl font-bold tracking-tight lg:text-[72px] lg:leading-[72px]">
            {p.actual}
          </div>
          <div className="flex max-w-xl flex-col gap-1.5">
            {mejora !== null ? (
              <>
                {/* La historia primero: cuánto mejoró el sitio con Peaje. */}
                <p className="text-xl font-semibold leading-snug sm:text-2xl">
                  {d.panel.scoreMejora(baseline!, score.score)}
                </p>
                <p className="text-sm text-muted">{d.panel.scoreMejoraNota(mejora)}</p>
              </>
            ) : null}
            {margen > 0 ? (
              <p className="mt-1 font-mono text-xs text-muted">
                <span className="font-bold">{d.panel.scoreConKit(p.estimado)} · {gradeDe(p.estimado)}</span>
                {' — '}
                <Link href={`/t/${slug}/kit`} className="text-accent hover:underline">
                  Kit →
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          <BotonScore slug={slug} label={d.panel.volverACorrerScore} />
        </div>
      </div>

      {/* Doble columna: lo que hay vs lo que falta */}
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
    </section>
  )
}
