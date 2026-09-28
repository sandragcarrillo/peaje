import Link from 'next/link'
import type { AgentKind } from '@peaje/db'
import { money } from '@/lib/config'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/**
 * Visitas de agentes: lo que el ledger no ve. Cada request que entró por el
 * gateway, pague o no, con quién fue (cliente de pago o bot de respuesta) y
 * por qué ruta. Es el contenido del reporte semanal de Pro.
 */

const BOTS_RESPUESTA: AgentKind[] = ['openai-searchbot', 'perplexitybot', 'googlebot']

export default async function VisitasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ dias?: string }>
}) {
  const { slug } = await params
  const { dias: diasParam } = await searchParams
  const d = await getDict()
  const t = d.visitas
  const tenant = await requireTenant(slug)
  const dias = diasParam === '30' ? 30 : 7
  const stats = await store.visitStats(tenant.id, { days: dias })

  const bots = stats.byKind.filter((k) => BOTS_RESPUESTA.includes(k.kind))
  const maxDia = Math.max(1, ...stats.daily.map((x) => x.visits))
  const base = `/t/${tenant.slug}/agentes-visitas`

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.descripcion} />

      <div className="flex gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
        {[7, 30].map((n) => (
          <Link
            key={n}
            href={n === 7 ? base : `${base}?dias=30`}
            className={`border px-3 py-1.5 ${dias === n ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
          >
            {n === 7 ? t.ventana7 : t.ventana30}
          </Link>
        ))}
      </div>

      {stats.totals.visits === 0 ? (
        <p className="text-sm text-muted">{t.vacio}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 border border-border bg-bg md:grid-cols-4">
            {[
              [t.metricaVisitas, String(stats.totals.visits)],
              [t.metricaPagadas, String(stats.totals.paid)],
              [t.metricaIngresos, money(stats.totals.revenue)],
              [t.metricaWallets, String(stats.agentWallets.length)],
            ].map(([label, valor], i) => (
              <div key={label} className={`p-6 ${i < 3 ? 'border-b border-border md:border-r md:border-b-0' : ''} ${i === 1 ? 'border-r-0 md:border-r' : ''}`}>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
                <div className="mt-4 text-3xl font-bold">{valor}</div>
              </div>
            ))}
          </div>

          <section className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Cabecera texto={t.porTipo} />
              <ul className="divide-y divide-border border border-border">
                {stats.byKind.map((k) => (
                  <li key={k.kind} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{t.tipos[k.kind]}</span>
                    <span className="font-mono text-xs text-muted">
                      {k.visits}
                      {k.visits - k.paid > 0 && (k.kind === 'mpp-client' || k.kind === 'x402-client') ? (
                        <span className="ml-2 text-faint">· {k.visits - k.paid} {t.noPagaron}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Cabecera texto={t.porDia} />
              <div className="flex h-40 items-end gap-1 border border-border p-3">
                {stats.daily.map((x) => (
                  <div key={x.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${x.date}: ${x.visits}`}>
                    <div className="w-full bg-border" style={{ height: `${(x.visits / maxDia) * 100}%` }}>
                      <div className="w-full bg-accent" style={{ height: `${x.visits ? (x.paid / x.visits) * 100 : 0}%` }} />
                    </div>
                    <span className="font-mono text-[9px] text-faint">{x.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.embudo} />
            <p className="text-xs text-muted">{t.embudoNota}</p>
            <div className="grid grid-cols-3 border border-border bg-bg">
              {[
                [t.embudoServidos, stats.funnel.served402],
                [t.embudoIntentaron, stats.funnel.attempted],
                [t.embudoPagaron, stats.funnel.paid],
              ].map(([label, valor], i) => (
                <div key={String(label)} className={`p-5 ${i < 2 ? 'border-r border-border' : ''}`}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
                  <div className="mt-3 text-2xl font-bold">
                    {valor}
                    {i > 0 && stats.funnel.served402 > 0 ? (
                      <span className="ml-2 font-mono text-xs font-normal text-muted">{Math.round((Number(valor) / stats.funnel.served402) * 100)}%</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.rutas} />
            <div className="hidden grid-cols-12 gap-4 border border-border bg-panel-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint md:grid">
              <div className="col-span-4">{t.colRuta}</div>
              <div className="col-span-2 text-right">{t.colVisitas}</div>
              <div className="col-span-2 text-right">{t.colServidos}</div>
              <div className="col-span-2 text-right">{t.colPagadas}</div>
              <div className="col-span-2 text-right">{t.colIngresos}</div>
            </div>
            <ul className="divide-y divide-border border border-border">
              {stats.topPaths.map((p) => (
                <li key={p.path} className="grid grid-cols-12 gap-4 px-4 py-2.5 text-sm">
                  <div className="col-span-4 truncate font-mono text-xs">{p.path}</div>
                  <div className="col-span-2 text-right font-mono text-xs">{p.visits}</div>
                  <div className="col-span-2 text-right font-mono text-xs">{p.served402}</div>
                  <div className="col-span-2 text-right font-mono text-xs">{p.paid}</div>
                  <div className="col-span-2 text-right font-mono text-xs">{money(p.revenue)}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.noAtendida} />
            <p className="text-xs text-muted">{t.noAtendidaNota}</p>
            {stats.unpaidDemand.length === 0 && stats.notFound.length === 0 ? (
              <p className="text-sm text-muted">{t.noAtendidaVacio}</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.noAtendidaMiradas}</span>
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {stats.unpaidDemand.map((p) => (
                      <li key={p.path} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="truncate font-mono text-xs">{p.path}</span>
                        <span className="font-mono text-xs text-muted">
                          {p.priceUsd ? `${money(p.priceUsd)} · ` : ''}
                          {p.served402} × 402 · {p.agents} {t.noAtendidaAgentes}
                        </span>
                      </li>
                    ))}
                    {stats.unpaidDemand.length === 0 ? <li className="px-4 py-2.5 text-xs text-muted">{t.noAtendidaVacio}</li> : null}
                  </ul>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{t.noAtendidaInexistentes}</span>
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {stats.notFound.map((p) => (
                      <li key={p.path} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="truncate font-mono text-xs">{p.path}</span>
                        <span className="font-mono text-xs text-muted">{p.visits}</span>
                      </li>
                    ))}
                    {stats.notFound.length === 0 ? <li className="px-4 py-2.5 text-xs text-muted">{t.noAtendidaVacio}</li> : null}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.bots} />
            <p className="text-xs text-muted">{t.botsNota}</p>
            {bots.length === 0 ? (
              <p className="text-sm text-muted">{t.botsNinguno}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {bots.map((b) => (
                  <li key={b.kind} className="border border-border px-3 py-1.5 text-sm">
                    {t.tipos[b.kind]} <span className="font-mono text-xs text-muted">× {b.visits}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Cabecera({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-text/70 pt-2 pb-2">
      <span aria-hidden className="h-2 w-2 bg-text" />
      <span className="font-mono text-[11px] uppercase tracking-[0.12em]">{texto}</span>
    </div>
  )
}
