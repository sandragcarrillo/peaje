import Link from 'next/link'
import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { gatewayUrl, money, shortWallet } from '@/lib/config'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { cachedScore, prevision, scannableDomain } from '@/lib/ora'
import { GraficaRevenue } from './grafica'
import { SetupChecklist } from './setup'

export default async function Dashboard({ params }: PageProps<'/t/[slug]'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)

  const domain = scannableDomain(tenant.originUrl)
  const [balance, payments, porDia, resources, score] = await Promise.all([
    store.balance(tenant.id),
    store.listPayments(tenant.id, 10),
    store.dailyRevenue(tenant.id, 7),
    store.listResources(tenant.id).catch(() => []),
    domain ? cachedScore(domain) : Promise.resolve(null),
  ])

  const base = `${gatewayUrl}/${tenant.slug}`
  const kitAplicado = score !== null && prevision(score).arreglables.length === 0
  const pasos = [
    {
      n: 1,
      titulo: 'Mira tu score',
      descripcion: 'Qué tan listo está tu sitio para agentes, y a cuánto llega con Peaje.',
      href: `/t/${tenant.slug}/score`,
      hecho: domain === null || score !== null,
    },
    {
      n: 2,
      titulo: 'Ponle precio a tus links',
      descripcion: 'Agrega links o importa tu sitemap. Los agentes pagan por request.',
      href: `/t/${tenant.slug}/rutas`,
      hecho: resources.length > 0,
    },
    {
      n: 3,
      titulo: 'Haz que te encuentren',
      descripcion: 'Aplica el kit en tu web y verifica la integración.',
      href: `/t/${tenant.slug}/kit`,
      hecho: kitAplicado,
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          Los agentes consumen por <code className="font-mono text-text">{base}</code>
        </p>
      </header>

      <SetupChecklist pasos={pasos} />

      <div className="grid grid-cols-3 gap-4">
        <Metric label="Disponible" value={money(balance.available)} destacado />
        <Metric label="Requests pagados" value={String(balance.requestCount)} />
        <Metric label="Revenue total" value={money(balance.revenue)} />
      </div>

      <GraficaRevenue datos={porDia} dias={7} />

      <section>
        <h2 className="font-medium">Últimos pagos</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Todavía nadie paga.{' '}
            {resources.length === 0 ? (
              <>
                <Link href={`/t/${tenant.slug}/rutas`} className="text-accent underline">
                  Agrega tu primer link con precio
                </Link>{' '}
                y pruébalo con <code className="font-mono">npx mppx {base}/r/&lt;slug&gt;</code>
              </>
            ) : (
              <>
                Pruébalo con <code className="font-mono">npx mppx {base}/r/&lt;slug&gt;</code>
              </>
            )}
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 font-normal">Hora</th>
                <th className="pb-2 font-normal">Ruta</th>
                <th className="pb-2 font-normal">Agente</th>
                <th className="pb-2 font-normal">Red</th>
                <th className="pb-2 text-right font-normal">Monto</th>
                <th className="pb-2 text-right font-normal">Tx</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 text-muted">
                    {new Date(p.createdAt).toLocaleTimeString('es-CO', {
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
                        ver
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
