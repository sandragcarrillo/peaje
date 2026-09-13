import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { cachedScore, scannableDomain } from '@/lib/ora'
import { tenantIfMine } from '@/lib/session'
import { store } from '@/lib/store'
import { Sidebar } from './sidebar'

/**
 * Frame de consola del negocio, calcado del diseño de Stitch (Business
 * Dashboard · Editorial Terminal): strip de estado a lo ancho, sidebar
 * pegado al borde con datos reales por ítem, y el workspace al lado.
 * El navbar de arriba se queda como está (pedido explícito).
 */
export default async function TenantLayout({ children, params }: LayoutProps<'/t/[slug]'>) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([tenantIfMine(slug), getDict()])

  if (!tenant) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">{d.panel.necesitasEntrar}</h1>
        <p className="mt-2 text-sm text-muted">
          {d.panel.soloEmailPre}
          <code className="font-mono">{slug}</code>
          {d.panel.soloEmailPost}
        </p>
        <Link
          href="/acceder"
          className="mt-6 inline-block rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-bg"
        >
          {d.panel.entrarConEmail}
        </Link>
      </div>
    )
  }

  const domain = scannableDomain(tenant.originUrl)
  const [balance, resources, score] = await Promise.all([
    store.balance(tenant.id),
    store.listResources(tenant.id).catch(() => []),
    domain ? cachedScore(domain) : Promise.resolve(null),
  ])

  return (
    <div className="mx-[calc(50%-50vw)] -mt-4 w-screen">
      <div className="flex w-full">
        <Sidebar
          slug={tenant.slug}
          name={tenant.name}
          valores={{
            score: score ? String(score.score) : '—',
            rutas: String(resources.length),
            retirar: `$${Number(balance.available).toFixed(2)}`,
          }}
          portalUrl={`${gatewayUrl}/${tenant.slug}/developers`}
        />
        <main className="min-w-0 flex-1 space-y-8 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  )
}
