import { gatewayUrl, money, RAILS_LABEL } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { FooterStrip, PageHeader } from '@/components/chrome'
import { LinksPanel } from '../links'
import { RutasApiPanel } from '../rutas-api'
import { saldoTotal } from '@/lib/saldos'

export default async function Rutas({ params }: PageProps<'/t/[slug]/rutas'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [resources, routes, balance, d] = await Promise.all([
    store.listResources(tenant.id).catch(() => []),
    store.listRoutes(tenant.id).catch(() => []),
    saldoTotal(tenant),
    getDict(),
  ])
  const base = `${gatewayUrl}/${tenant.slug}`
  const dominio = (() => {
    try {
      return new URL(tenant.originUrl).origin
    } catch {
      return base
    }
  })()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`}
        titulo={d.panel.rutasTitulo}
        sub={d.panel.rutasDescripcion}
      />
      <LinksPanel slug={tenant.slug} resources={resources} base={base} />
      <RutasApiPanel slug={tenant.slug} routes={routes} dominio={dominio} />

      <FooterStrip
        items={[
          [d.panel.metricaRevenue, money(balance.revenue)],
          [d.panel.metricaRequests, String(balance.requestCount)],
          [d.panel.rieles, RAILS_LABEL],
        ]}
      />
    </div>
  )
}
