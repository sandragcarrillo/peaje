import Link from 'next/link'
import type { AgentKind, QuienVisita } from '@peaje/db'
import { COBROS_VISIBLES, money } from '@/lib/config'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/**
 * Visitas de agentes: lo que el ledger no ve. Cada request que entró por el
 * gateway, pague o no, y cada página del sitio que leyó un bot (las reporta el
 * proxy del kit, ver POST /:slug/kit/visita), con quién fue (cliente de pago o
 * bot de respuesta) y por qué ruta. Es el contenido del reporte semanal de Pro.
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
  // `daily` solo trae los días con visitas: el gráfico muestra todos los de la
  // ventana (en UTC, como las fechas de `daily`), con 0 los que no tuvieron.
  const porFecha = new Map(stats.daily.map((x) => [x.date, x]))
  const diario = Array.from({ length: dias }, (_, i) => {
    const date = new Date(Date.now() - (dias - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    return porFecha.get(date) ?? { date, visits: 0, paid: 0 }
  })
  const base = `/t/${tenant.slug}/agentes-visitas`

  // Quién te visita: los tipos propios y, sacados de "Otros" por su
  // user-agent, los agentes con nombre (Ora, LinkedIn...). Otros queda para
  // lo que no se puede atribuir y se despliega con el detalle.
  const conNombre = stats.otros.filter((o) => o.tipo === 'agente')
  const sinNombre = stats.otros.filter((o) => o.tipo !== 'agente')
  const visitasSinNombre = sinNombre.reduce((n, o) => n + o.visits, 0)
  const quien = [
    ...stats.byKind
      .filter((k) => k.kind !== 'other')
      .map((k) => ({
        clave: k.kind as string,
        label: t.tipos[k.kind],
        visits: k.visits,
        noPagaron: COBROS_VISIBLES && (k.kind === 'mpp-client' || k.kind === 'x402-client') ? k.visits - k.paid : 0,
      })),
    ...conNombre.map((o) => ({ clave: `agente:${o.nombre}`, label: o.nombre ?? '', visits: o.visits, noPagaron: 0 })),
  ].sort((a, b) => b.visits - a.visits)
  const etiquetaOtro = (o: QuienVisita) =>
    o.tipo === 'navegador' ? t.otrosNavegador : o.tipo === 'sin-ua' ? t.otrosSinUa : o.tipo === 'script' ? t.otrosScript(o.nombre) : o.nombre

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.descripcion} />

      <div className="flex gap-2">
        {[7, 30].map((n) => (
          <Link
            key={n}
            href={n === 7 ? base : `${base}?dias=30`}
            aria-current={dias === n ? 'page' : undefined}
            className={`btn btn-secundario btn-chico ${dias === n ? 'border-text bg-panel' : 'text-muted hover:text-text'}`}
          >
            {n === 7 ? t.ventana7 : t.ventana30}
          </Link>
        ))}
      </div>

      {stats.totals.visits === 0 ? (
        <p className="text-sm text-muted">{t.vacio}</p>
      ) : (
        <>
          {/* Hasta mainnet solo las visitas: pagadas, ingresos y wallets son de cobros (ver COBROS_VISIBLES). */}
          <div className={`grid border border-border bg-bg ${COBROS_VISIBLES ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1'}`}>
            {(COBROS_VISIBLES
              ? [
                  [t.metricaVisitas, String(stats.totals.visits)],
                  [t.metricaPagadas, String(stats.totals.paid)],
                  [t.metricaIngresos, money(stats.totals.revenue)],
                  [t.metricaWallets, String(stats.agentWallets.length)],
                ]
              : [[t.metricaVisitas, String(stats.totals.visits)]]
            ).map(([label, valor], i) => (
              // En el celular van de a dos: divisor vertical en la columna izquierda y horizontal bajo la primera fila.
              <div key={label} className={`border-border p-6 ${COBROS_VISIBLES ? ['border-r border-b md:border-b-0', 'border-b md:border-r md:border-b-0', 'border-r', ''][i] : ''}`}>
                <span className="font-mono text-[10px] tracking-[0.02em] text-muted">{label}</span>
                <div className="mt-4 text-3xl font-bold">{valor}</div>
              </div>
            ))}
          </div>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Cabecera texto={t.porTipo} />
              <ul className="divide-y divide-border border border-border">
                {quien.map((q) => (
                  <li key={q.clave} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{q.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {q.visits}
                      {q.noPagaron > 0 ? (
                        <span className="ml-2 text-faint">· {q.noPagaron} {t.noPagaron}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
                {visitasSinNombre > 0 ? (
                  <li>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-panel-2 [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          {t.tipos.other}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="text-muted transition-transform group-open:rotate-180">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted">{visitasSinNombre}</span>
                      </summary>
                      <div className="border-t border-border bg-panel">
                        <p className="px-4 pt-2.5 pb-1 text-xs text-faint">{t.otrosNota}</p>
                        <ul className="divide-y divide-border">
                          {sinNombre.map((o) => (
                            <li key={`${o.tipo}:${o.nombre ?? ''}`} className="flex items-center justify-between gap-3 py-2 pr-4 pl-8 text-xs text-muted">
                              <span className="min-w-0 truncate">{etiquetaOtro(o)}</span>
                              <span className="shrink-0 font-mono">{o.visits}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Cabecera texto={t.porDia} />
              {/*
                Cada columna se estira al alto del gráfico y la barra mide su
                porcentaje contra el área de arriba de la fecha (antes la columna
                no tenía alto y todas las barras quedaban en 0). Con 30 días, la
                fecha sale cada 5 para que no se pisen. min-w-0: sin él, el ancho
                de la fecha (que ocupa lugar aunque esté invisible) no deja que
                las 30 columnas se achiquen y el gráfico se sale de su caja.
              */}
              <div className="flex h-44 items-stretch gap-1 border border-border px-3 pt-6 pb-3">
                {diario.map((x, i) => (
                  <div key={x.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${x.date}: ${x.visits}`}>
                    <div className="flex w-full flex-1 items-end border-b border-border">
                      <div className="relative flex w-full flex-col justify-end bg-border" style={{ height: `${(x.visits / maxDia) * 100}%` }}>
                        {/* Con 30 barras en el teléfono los números se pisan: ahí solo se ven desde sm. */}
                        {x.visits > 0 ? (
                          <span className={`absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted ${dias === 30 ? 'hidden sm:inline' : ''}`}>{x.visits}</span>
                        ) : null}
                        <div className="w-full bg-accent" style={{ height: `${!COBROS_VISIBLES ? 100 : x.visits ? (x.paid / x.visits) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] whitespace-nowrap text-faint ${dias === 7 || i % 5 === 0 || i === diario.length - 1 ? '' : 'invisible'}`}>
                      {x.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {COBROS_VISIBLES ? (
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
                    <span className="font-mono text-[10px] tracking-[0.02em] text-muted">{label}</span>
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
          ) : null}

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.rutas} />
            <div className="hidden grid-cols-12 gap-4 border border-border bg-panel-2 px-4 py-2 font-mono text-[10px] tracking-[0.02em] text-faint md:grid">
              <div className={COBROS_VISIBLES ? 'col-span-4' : 'col-span-10'}>{t.colRuta}</div>
              <div className="col-span-2 text-right">{t.colVisitas}</div>
              {COBROS_VISIBLES ? (
                <>
                  <div className="col-span-2 text-right">{t.colServidos}</div>
                  <div className="col-span-2 text-right">{t.colPagadas}</div>
                  <div className="col-span-2 text-right">{t.colIngresos}</div>
                </>
              ) : null}
            </div>
            <ul className="divide-y divide-border border border-border">
              {stats.topPaths.map((p) => (
                // En el celular, fila flex: 11 gaps de la grilla de 12 se comían la mitad del ancho.
                <li key={p.path} className="flex gap-4 px-4 py-2.5 text-sm md:grid md:grid-cols-12">
                  <div className={`${COBROS_VISIBLES ? 'col-span-4' : 'col-span-10'} min-w-0 flex-1 truncate font-mono text-xs`}>{p.path}</div>
                  <div className="col-span-2 shrink-0 text-right font-mono text-xs">{p.visits}</div>
                  {COBROS_VISIBLES ? (
                    <>
                      <div className="col-span-2 shrink-0 text-right font-mono text-xs">{p.served402}</div>
                      <div className="col-span-2 shrink-0 text-right font-mono text-xs">{p.paid}</div>
                      <div className="col-span-2 shrink-0 text-right font-mono text-xs">{money(p.revenue)}</div>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <Cabecera texto={t.noAtendida} />
            <p className="text-xs text-muted">{COBROS_VISIBLES ? t.noAtendidaNota : t.noAtendidaNotaSinCobros}</p>
            {(!COBROS_VISIBLES || stats.unpaidDemand.length === 0) && stats.notFound.length === 0 ? (
              <p className="text-sm text-muted">{t.noAtendidaVacio}</p>
            ) : (
              <div className={`grid grid-cols-1 gap-6 ${COBROS_VISIBLES ? 'md:grid-cols-2' : ''}`}>
                <div hidden={!COBROS_VISIBLES}>
                  <span className="font-mono text-[10px] tracking-[0.02em] text-muted">{t.noAtendidaMiradas}</span>
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {stats.unpaidDemand.map((p) => (
                      <li key={p.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
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
                  <span className="font-mono text-[10px] tracking-[0.02em] text-muted">{t.noAtendidaInexistentes}</span>
                  <ul className="mt-2 divide-y divide-border border border-border">
                    {stats.notFound.map((p) => (
                      <li key={p.path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
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
      <span className="font-mono text-[11px] tracking-[0.02em]">{texto}</span>
    </div>
  )
}
