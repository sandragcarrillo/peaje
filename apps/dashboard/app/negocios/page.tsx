import Link from 'next/link'
import { redirect } from 'next/navigation'
import { money, RAILS_LABEL } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { listMyTenants } from '@/lib/session'
import { store } from '@/lib/store'
import { saldoTotal } from '@/lib/saldos'

/**
 * Mis negocios, calcado del mock de Stitch: header de workspace, barra de
 * cuatro métricas agregadas y una card por negocio con sus números reales.
 * El negocio de la sesión actual va resaltado.
 */
export default async function Negocios() {
  const [tenants, d] = await Promise.all([listMyTenants(), getDict()])
  if (tenants.length === 0) redirect('/acceder')

  const datos = await Promise.all(
    tenants.map(async (t) => {
      const [balance, resources] = await Promise.all([
        saldoTotal(t),
        store.listResources(t.id).catch(() => []),
      ])
      return { t, balance, links: resources.length }
    }),
  )

  const totalCobrado = datos.reduce((s, x) => s + Number(x.balance.revenue), 0)
  const totalLinks = datos.reduce((s, x) => s + x.links, 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      {/* Header del workspace */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-panel p-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{d.acceso.tusNegocios}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{d.acceso.eligeNegocio}</p>
        </div>
        <Link
          href="/nuevo"
          className="flex shrink-0 items-center gap-2 self-start border border-text bg-negro px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta md:self-auto"
        >
          <span className="text-accent">+</span>
          {d.acceso.registrarOtro}
        </Link>
      </section>

      {/* Barra de métricas agregadas */}
      <section className="grid grid-cols-2 divide-x divide-border border border-border bg-bg lg:grid-cols-4">
        <div className="flex flex-col p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {d.acceso.negociosRegistrados}
          </span>
          <span className="mt-2 text-3xl font-bold tabular-nums">
            {String(tenants.length).padStart(2, '0')}
          </span>
          <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
            100% {d.acceso.negociosOperativos}
          </span>
        </div>
        <div className="flex flex-col p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {d.acceso.negociosCobrado}
          </span>
          <span className="mt-2 text-3xl font-bold text-accent tabular-nums">
            {money(totalCobrado)}
          </span>
          <span className="mt-1 font-mono text-[10px] text-muted">MPP · 402</span>
        </div>
        <div className="flex flex-col p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {d.acceso.negociosLinks}
          </span>
          <span className="mt-2 text-3xl font-bold tabular-nums">{totalLinks}</span>
          <span className="mt-1 font-mono text-[10px] text-muted">402</span>
        </div>
        <div className="flex flex-col p-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {d.acceso.negociosPayouts}
          </span>
          <span className="mt-2 text-3xl font-bold tabular-nums">100%</span>
          <span className="mt-1 font-mono text-[10px] text-muted">{RAILS_LABEL}</span>
        </div>
      </section>

      {/* Una card por negocio, con números reales */}
      <div className="space-y-4">
        {datos.map(({ t, balance, links }) => {
          return (
            <article key={t.id} className="border border-border bg-panel p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">{t.name}</h2>
                <span className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  ID: {t.slug}
                </span>
                <span className="flex items-center gap-1.5 border border-accent/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {d.acceso.negociosOnline}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-muted">{t.originUrl}</p>

              <div className="mt-4 grid grid-cols-1 divide-y divide-border border border-border bg-bg sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {d.acceso.negociosDisponible}
                  </span>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">
                    {money(balance.available)}
                  </p>
                </div>
                <div className="p-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {d.acceso.negociosRequests}
                  </span>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">{balance.requestCount}</p>
                </div>
                <div className="p-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {d.acceso.negociosLinks}
                  </span>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums">{links}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Link
                  href={`/t/${t.slug}`}
                  className="flex items-center gap-2 border border-text bg-negro px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-tinta"
                >
                  {d.acceso.negociosAbrir}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      <p className="border border-border bg-panel-2 p-4 font-mono text-[11px] text-muted">
        {d.acceso.negociosPista}
      </p>
    </div>
  )
}
