import Link from 'next/link'
import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { gatewayUrl, money, shortWallet } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { cachedScore, prevision, scannableDomain } from '@/lib/ora'
import { GraficaRevenue } from './grafica'
import { SetupChecklist } from './setup'

export default async function Dashboard({ params }: PageProps<'/t/[slug]'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)

  const domain = scannableDomain(tenant.originUrl)
  const [balance, payments, porDia, resources, score, d] = await Promise.all([
    store.balance(tenant.id),
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
    },
    {
      n: 2,
      titulo: d.panel.paso2Titulo,
      descripcion: d.panel.paso2Descripcion,
      href: `/t/${tenant.slug}/rutas`,
      hecho: resources.length > 0,
    },
    {
      n: 3,
      titulo: d.panel.paso3Titulo,
      descripcion: d.panel.paso3Descripcion,
      href: `/t/${tenant.slug}/kit`,
      hecho: kitAplicado,
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">{d.panel.dashboardTitulo}</h1>
        <p className="mt-2 text-sm text-muted">
          {d.panel.consumenPor} <code className="font-mono text-text">{base}</code>
        </p>
      </header>

      <SetupChecklist pasos={pasos} />

      <div className="grid grid-cols-3 gap-4">
        <Metric label={d.panel.metricaDisponible} value={money(balance.available)} destacado />
        <Metric label={d.panel.metricaRequests} value={String(balance.requestCount)} />
        <Metric label={d.panel.metricaRevenue} value={money(balance.revenue)} />
      </div>

      <GraficaRevenue datos={porDia} dias={7} />

      <section>
        <h2 className="font-medium">{d.panel.ultimosPagos}</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {d.panel.nadiePaga}{' '}
            {resources.length === 0 ? (
              <>
                <Link href={`/t/${tenant.slug}/rutas`} className="text-accent underline">
                  {d.panel.agregaPrimerLink}
                </Link>{' '}
                {d.panel.yPruebaCon}{' '}
                <code className="font-mono">npx mppx {base}/r/&lt;slug&gt;</code>
              </>
            ) : (
              <>
                {d.panel.pruebaCon}{' '}
                <code className="font-mono">npx mppx {base}/r/&lt;slug&gt;</code>
              </>
            )}
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 font-normal">{d.panel.colHora}</th>
                <th className="pb-2 font-normal">{d.panel.colRuta}</th>
                <th className="pb-2 font-normal">{d.panel.colAgente}</th>
                <th className="pb-2 font-normal">{d.panel.colRed}</th>
                <th className="pb-2 text-right font-normal">{d.panel.colMonto}</th>
                <th className="pb-2 text-right font-normal">{d.panel.colTx}</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 text-muted">
                    {new Date(p.createdAt).toLocaleTimeString(d.panel.formatoFecha, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2">{p.path}</td>
                  <td className="py-2 text-muted">{shortWallet(p.agentWallet)}</td>
                  <td className="py-2 text-muted">
                    {isNetworkId(p.network) ? NETWORKS[p.network].label : p.network}
                  </td>
                  <td className="py-2 text-right">{money(p.amount)}</td>
                  <td className="py-2 text-right">
                    {isNetworkId(p.network) ? (
                      <a
                        href={explorerTxUrl(p.network, p.receiptRef)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {d.panel.verTx}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl ${destacado ? 'text-accent' : ''}`}>{value}</p>
    </div>
  )
}
