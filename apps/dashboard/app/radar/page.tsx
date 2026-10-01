import Link from 'next/link'
import { ScoreColumnas } from '@/components/score-columnas'
import { getDict } from '@/lib/i18n'
import { cachedScore, gradeDe, prevision } from '@/lib/ora'
import { dominioDeRadar } from './dominio'
import { Buscador, Medir } from './partes'

/**
 * Radar público: cualquier dominio, sin cuenta. El mismo score del dashboard
 * (Ora) y la previsión de hasta dónde llega con el kit de Peaje.
 */
export default async function Radar({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const [{ d: entrada }, dict] = await Promise.all([searchParams, getDict()])
  const t = dict.radar
  const dominio = dominioDeRadar(entrada)
  const score = dominio ? await cachedScore(dominio) : null
  const p = score ? prevision(score) : null
  const margen = p ? p.estimado - p.actual : 0

  return (
    <div className="space-y-8 py-6">
      <header className="space-y-4">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted">{t.eyebrow}</p>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{t.titulo}</h1>
        <p className="max-w-xl text-sm text-muted">{t.texto}</p>
        <Buscador inicial={dominio ?? entrada ?? ''} />
        {entrada && !dominio ? <p className="text-sm text-red-600">{t.invalido}</p> : null}
      </header>

      {dominio && !score ? <Medir key={dominio} dominio={dominio} auto /> : null}

      {dominio && score && p ? (
        <section className="border border-border bg-bg">
          <div className="flex items-center justify-between border-b border-border bg-panel px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
              <span>RADAR · {score.domain}</span>
            </div>
            <Medir dominio={dominio} />
          </div>

          <div className="flex flex-col justify-between gap-8 p-6 md:flex-row md:items-center lg:p-8">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted">{t.hoy}</p>
                <p className="text-6xl font-bold tracking-tight lg:text-[72px] lg:leading-[72px]">{p.actual}</p>
                <p className="mt-1 font-mono text-xs text-muted">{gradeDe(p.actual)}</p>
              </div>
              {margen > 0 ? (
                <>
                  <span aria-hidden className="pb-6 text-3xl text-border">→</span>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.14em] text-accent">{t.conPeaje}</p>
                    <p className="text-6xl font-bold tracking-tight text-accent lg:text-[72px] lg:leading-[72px]">~{p.estimado}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{gradeDe(p.estimado)}</p>
                  </div>
                </>
              ) : null}
            </div>
            <div className="max-w-sm space-y-3">
              <p className="text-sm">{margen > 0 ? t.sube(margen) : t.yaAlto}</p>
              <p className="text-xs text-muted">{t.ctaTexto}</p>
              <Link
                href={`/nuevo?url=${encodeURIComponent(dominio)}`}
                className="inline-flex items-center gap-2 border border-text bg-text px-5 py-2.5 font-mono text-xs font-bold tracking-[0.1em] text-bg"
              >
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {t.cta} →
              </Link>
            </div>
          </div>

          <ScoreColumnas score={score} />
          <p className="border-t border-border px-6 py-4 text-xs text-muted">{t.nota}</p>
        </section>
      ) : null}
    </div>
  )
}
