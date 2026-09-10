import { gatewayUrl } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { LinksPanel } from '../links'

export default async function Rutas({ params }: PageProps<'/t/[slug]/rutas'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [resources, d] = await Promise.all([
    store.listResources(tenant.id).catch(() => []),
    getDict(),
  ])
  const base = `${gatewayUrl}/${tenant.slug}`

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium">{d.panel.rutasTitulo}</h1>
        <p className="mt-2 text-sm text-muted">{d.panel.rutasDescripcion}</p>
      </header>
      <LinksPanel slug={tenant.slug} resources={resources} base={base} />
    </div>
  )
}
