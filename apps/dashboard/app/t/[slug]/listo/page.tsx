import Link from 'next/link'
import { getDict, getLocale } from '@/lib/i18n'
import { cachedScore, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { barras, leer, type Barra } from '@/app/radar/datos'
import { textoDe } from '@/app/radar/textos'
import { BotonScore } from '../kit/partes'

/**
 * Lo primero que ve el dueño después del alta: cómo ve la IA su sitio. El
 * puntaje, las tres preguntas (te encuentran, te usan, te compran) y las tres
 * fallas que más pesan. Nada de saldo, wallet ni endpoint: eso está en
 * Ingresos y en el kit.
 */
export default async function Listo({ params }: PageProps<'/t/[slug]/listo'>) {
  const { slug } = await params
  const [tenant, d, locale] = await Promise.all([requireTenant(slug), getDict(), getLocale()])
  const t = d.acceso
  const domain = scannableDomain(tenant.originUrl)
  const score = domain ? await cachedScore(domain) : null

  // Igual que en Puntaje: el primer score que vemos queda como el "antes".
  if (score && tenant.baselineScore === null) {
    await store.setBaselineScore(tenant.id, score.score).catch(() => {})
  }

  if (!domain) {
    return <p className="border border-border bg-panel p-4 text-sm text-muted">{d.panel.scoreOriginLocal}</p>
  }

  if (!score) {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.listoTitulo(domain)}</h1>
        <div className="flex flex-col justify-between gap-4 border border-border bg-panel p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-muted">{t.listoSinPuntaje(domain)}</p>
          <BotonScore slug={tenant.slug} label={t.medirAhora} />
        </div>
      </section>
    )
  }

  const l = leer(score)
  const frenos = [...l.arreglables, ...l.otras].slice(0, 3)

  return (
    <section className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.listoTitulo(domain)}</h1>
        <p className="text-sm text-muted">{t.listoSub}</p>
      </div>

      <div className="space-y-8 border border-border bg-panel p-6 lg:p-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <p className="shrink-0 text-6xl font-bold tracking-tight lg:text-[72px] lg:leading-[72px]">
            {l.actual}
            <span className="text-2xl font-semibold text-muted">/{l.max}</span>
          </p>
          <ul className="w-full space-y-3">
            {barras(score).map((b) => (
              <FilaBarra key={b.clave} barra={b} etiqueta={t.barras[b.clave]} sinMedir={t.sinMedirBarra} />
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <h2 className="text-sm font-semibold">{t.loQueFrena}</h2>
          {frenos.length > 0 ? (
            <ul className="divide-y divide-border/60 text-sm">
              {frenos.map((f) => (
                <li key={f.check.id} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                    <span>{textoDe(f.check, locale).titulo}</span>
                  </span>
                  {f.puntos > 0 ? (
                    <span className="shrink-0 font-mono text-xs font-bold text-accent">{d.radar.puntos(f.puntos)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.nadaGrave}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/t/${tenant.slug}/kit`} className="btn btn-primario">
            {t.verComoArreglarlo}
          </Link>
          <Link href={`/t/${tenant.slug}/agente`} className="text-sm text-muted underline underline-offset-4 hover:text-text">
            {t.irAMiAgente}
          </Link>
        </div>
      </div>
    </section>
  )
}

function FilaBarra({ barra, etiqueta, sinMedir }: { barra: Barra; etiqueta: string; sinMedir: string }) {
  const pct = barra.max > 0 ? Math.round((barra.puntos / barra.max) * 100) : null
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{etiqueta}</span>
        <span className="font-mono text-xs text-muted">{pct === null ? sinMedir : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-border">
        {pct !== null ? <div className="h-full bg-accent" style={{ width: `${pct}%` }} /> : null}
      </div>
    </li>
  )
}
