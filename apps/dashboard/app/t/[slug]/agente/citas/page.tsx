import Link from 'next/link'
import type { CitationRun } from '@peaje/db'
import { accesoPro } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { SectionBar } from '@/components/chrome'
import { leerCitacion } from '@/lib/gateway'
import { getDict, getLocale } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { FormatosPanel } from '../citacion'
import { CandadoReporte, MarcoReporte } from '../reporte-marco'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

const esPropio = (dominio: string, raiz: string | null) => !!raiz && (dominio === raiz || dominio.endsWith(`.${raiz}`))

/** Las páginas (o dominios, si el motor no da páginas) que citó una respuesta, sin el sitio propio. */
function citadas(r: CitationRun, raiz: string | null): { domain: string; url: string | null; title: string | null }[] {
  const vistas = new Set<string>()
  const filas = r.pages.length ? r.pages.map((p) => ({ domain: p.domain, url: p.url, title: p.title })) : r.domains.map((d) => ({ domain: d, url: null, title: null }))
  return filas.filter((p) => {
    if (esPropio(p.domain, raiz)) return false
    const k = p.url ?? p.domain
    if (vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

/**
 * A quién cita la IA en lugar del negocio: la última ronda de medición
 * pregunta por pregunta y motor por motor, con las páginas que ganaron, más
 * los formatos que la IA eligió. Lo abre la tarjeta "Ver a quién cita la IA".
 */
export default async function Citas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d, locale] = await Promise.all([requireTenant(slug), getDict(), getLocale()])
  const t = d.agenteReportes

  if (!accesoPro(tenant).activo) {
    return (
      <MarcoReporte slug={tenant.slug} d={d} titulo={t.ciTitulo} sub={t.ciSub}>
        <CandadoReporte slug={tenant.slug} d={d} />
      </MarcoReporte>
    )
  }

  const [citacion, runs] = await Promise.all([leerCitacion(tenant.slug).catch(() => null), store.listCitationRuns(tenant.id, 1).catch((): CitationRun[] => [])])
  const s = citacion?.summary
  const raiz = dominioVerificable(tenant.originUrl)
  const nombre = (id: string) => s?.engines.find((e) => e.id === id)?.name ?? id
  const preguntas = [...new Set(runs.map((r) => r.promptText))]

  return (
    <MarcoReporte slug={tenant.slug} d={d} titulo={t.ciTitulo} sub={t.ciSub}>
      {!s?.measuredAt ? (
        <p className="text-sm text-muted">{t.ciSinMedir}</p>
      ) : (
        <>
          <div className="border border-border p-4">
            <p className="text-lg font-semibold">
              {t.ciCuota(pct(s.share))} {s.previousShare !== null ? <span className="text-sm font-normal text-muted">{t.ciAntes(pct(s.previousShare))}</span> : null}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              {t.ciMedido(new Date(s.measuredAt).toLocaleDateString(locale === 'es' ? 'es' : 'en', { day: 'numeric', month: 'long', year: 'numeric' }))} ·{' '}
              {s.byEngine.map((b) => `${nombre(b.engine)} ${b.cited}/${b.total}`).join(' · ')}
            </p>
          </div>

          {s.competitors.length ? (
            <section className="space-y-3">
              <SectionBar label={t.ciCompetidores} />
              <ul className="divide-y divide-border border border-border text-sm">
                {s.competitors.slice(0, 10).map((c) => (
                  <li key={c.domain} className="flex items-baseline justify-between gap-3 px-4 py-2">
                    <span className="font-medium">{c.domain}</span>
                    <span className="font-mono text-xs text-muted">{t.ciVeces(c.count)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionBar label={t.ciPorPregunta} meta={String(preguntas.length)} />
            <div className="space-y-3">
              {preguntas.map((q) => (
                <div key={q} className="border border-border p-4 text-sm">
                  <p className="font-medium">{q}</p>
                  <ul className="mt-3 space-y-2">
                    {runs
                      .filter((r) => r.promptText === q)
                      .map((r) => {
                        const ganaron = citadas(r, raiz)
                        const estado = r.error ? t.ciSinRespuesta : r.cited ? t.ciTeCita : r.mentioned ? t.ciTeNombra : t.ciNoApareces
                        return (
                          <li key={r.id} className="grid gap-1 md:grid-cols-[9rem_10rem_1fr]">
                            <span className="font-mono text-xs text-muted">{nombre(r.engine)}</span>
                            <span className={r.cited ? 'text-accent' : r.error ? 'text-muted' : ''}>{estado}</span>
                            <span className="min-w-0 text-muted">
                              {r.error ? null : ganaron.length ? (
                                <>
                                  {t.ciCito}:{' '}
                                  {ganaron.slice(0, 4).map((p, i) => (
                                    <span key={p.url ?? p.domain}>
                                      {i ? ', ' : ''}
                                      {p.url ? (
                                        <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.title ?? undefined} className="underline decoration-border underline-offset-2 hover:text-text">
                                          {p.domain}
                                        </a>
                                      ) : (
                                        p.domain
                                      )}
                                    </span>
                                  ))}
                                  {ganaron.length > 4 ? ` +${ganaron.length - 4}` : ''}
                                </>
                              ) : (
                                t.ciSinPaginas
                              )}
                            </span>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {s.formats ? <FormatosPanel datos={s.formats} /> : null}

          <Link href={`/t/${tenant.slug}/agente/oportunidades`} className="btn btn-primario">
            {t.ciVerOportunidades}
          </Link>
        </>
      )}
    </MarcoReporte>
  )
}
