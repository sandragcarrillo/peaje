import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { gatewayUrl, money, shortWallet, RAILS_LABEL } from '@/lib/config'
import { TerminalBuffer } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { cachedScore, prevision, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { GraficaRevenue } from './grafica'
import { SetupChecklist } from './setup'
import { saldoTotal } from '@/lib/saldos'

/** Panel del negocio, calcado del mock "Business Dashboard" de Stitch. */
export default async function Dashboard({ params }: PageProps<'/t/[slug]'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)

  const domain = scannableDomain(tenant.originUrl)
  const [balance, payments, porDia, resources, score, d] = await Promise.all([
    saldoTotal(tenant),
    store.listPayments(tenant.id, 10),
    store.dailyRevenue(tenant.id, 7),
    store.listResources(tenant.id).catch(() => []),
    domain ? cachedScore(domain) : Promise.resolve(null),
    getDict(),
  ])

  const base = `${gatewayUrl}/${tenant.slug}`
  const kitAplicado = score !== null && prevision(score).arreglables.length === 0
  const pasos = [
    {
      n: 1,
      titulo: d.panel.paso1Titulo,
      descripcion: d.panel.paso1Descripcion,
      href: `/t/${tenant.slug}/score`,
      hecho: domain === null || score !== null,
      estado: score ? `${d.panel.setupListo} (${score.score}/100)` : d.panel.setupPendiente,
    },
    {
      n: 2,
      titulo: d.panel.paso2Titulo,
      descripcion: d.panel.paso2Descripcion,
      href: `/t/${tenant.slug}/rutas`,
      hecho: resources.length > 0,
      estado:
        resources.length > 0
          ? `${d.panel.setupListo} (${resources.length})`
          : d.panel.setupPendiente,
    },
    {
      n: 3,
      titulo: d.panel.paso3Titulo,
      descripcion: d.panel.paso3Descripcion,
      href: `/t/${tenant.slug}/kit`,
      hecho: kitAplicado,
      estado: kitAplicado ? d.panel.setupListo : d.panel.setupPendiente,
    },
  ]

  const metricas = [
    {
      n: 1,
      label: d.panel.metricaDisponible,
      valor: money(balance.available),
      pie: [d.panel.subDisponible, RAILS_LABEL] as const,
      vivo: true,
    },
    {
      n: 2,
      label: d.panel.metricaRequests,
      valor: String(balance.requestCount),
      pie: [d.panel.subRequests, 'MPP'] as const,
      vivo: false,
    },
    {
      n: 3,
      label: d.panel.metricaRevenue,
      valor: money(balance.revenue),
      pie: [d.panel.subRevenue, '402'] as const,
      vivo: false,
    },
  ]

  return (
    <>
      {/* Header del workspace */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
        <div>
          <div className="mb-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            {d.panel.consola} // {tenant.slug}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{d.panel.dashboardTitulo}</h1>
          <p className="mt-1.5 font-mono text-xs text-muted">
            MPP: {d.panel.estadoActivo} · GATEWAY: {base}
          </p>
        </div>
      </div>

      <SetupChecklist pasos={pasos} slug={tenant.slug} />

      {/* Tres cards de métrica con pie técnico */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {metricas.map((m) => (
          <div key={m.n} className="border border-border bg-bg p-6">
            <div className="mb-4 flex items-start justify-between">
              <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                {m.label}
              </span>
              <span aria-hidden className={`h-2 w-2 ${m.vivo ? 'bg-accent' : 'bg-border'}`} />
            </div>
            <div className="my-2 text-4xl font-bold tracking-tight">{m.valor}</div>
            <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[11px]">
              <span className="text-muted">{m.pie[0]}</span>
              <span className="font-bold">{m.pie[1]}</span>
            </div>
          </div>
        ))}
      </div>

      <GraficaRevenue datos={porDia} dias={7} />

      {/* Ledger de pagos */}
      <div className="border border-border bg-bg">
        <div className="flex flex-col justify-between gap-2 border-b border-border p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold">{d.panel.ultimosPagos}</h3>
          </div>
          <span className="border border-border bg-panel-2 px-2 py-1 font-mono text-[10px] tracking-[0.04em] text-muted">
            {d.panel.filtro402}
          </span>
        </div>

        {payments.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            {d.panel.nadiePaga} <code className="font-mono">npx mppx {base}/r/&lt;slug&gt;</code>
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-panel font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    <th className="px-6 py-3 font-bold">{d.panel.colHora}</th>
                    <th className="px-6 py-3 font-bold">{d.panel.colRuta}</th>
                    <th className="px-6 py-3 font-bold">{d.panel.colAgente}</th>
                    <th className="px-6 py-3 font-bold">{d.panel.colRed}</th>
                    <th className="px-6 py-3 text-right font-bold">{d.panel.colMonto}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {payments.slice(0, 6).map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-panel-2">
                      <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                        {new Date(p.createdAt).toLocaleTimeString(d.panel.formatoFecha, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-bold">[GET]</span>{' '}
                        <span className="break-all">{p.path}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span className="border border-border bg-panel-2 px-1.5 py-0.5">
                          {shortWallet(p.agentWallet)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span className="flex items-center gap-1.5 uppercase">
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 ${p.network === 'tempo' ? 'bg-accent' : 'bg-faint'}`}
                          />
                          {isNetworkId(p.network) ? NETWORKS[p.network].label : p.network}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-right font-bold">
                        {isNetworkId(p.network) ? (
                          <a
                            href={explorerTxUrl(p.network, p.receiptRef)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-accent"
                          >
                            {money(p.amount)}
                          </a>
                        ) : (
                          money(p.amount)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-panel p-4 font-mono text-[10px] tracking-[0.04em] text-muted">
              {d.panel.mostrando(Math.min(6, payments.length), balance.requestCount)}
            </div>
          </>
        )}
      </div>

      <TerminalBuffer
        label={`TERMINAL // ${d.panel.ultimosPagos}`}
        lineas={payments.slice(0, 5).map((p) => {
          const hora = new Date(p.createdAt).toLocaleTimeString(d.panel.formatoFecha, {
            hour: '2-digit',
            minute: '2-digit',
          })
          const red = isNetworkId(p.network) ? NETWORKS[p.network].label : p.network
          return `[${hora}] +${money(p.amount)} · ${p.path} · ${red} · ${shortWallet(p.agentWallet)}`
        })}
      />
    </>
  )
}
