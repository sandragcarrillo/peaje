import { accesoPro } from '@peaje/db'
import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { leerBilling } from '@/lib/gateway'
import { getDict, getLocale } from '@/lib/i18n'
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
          className="btn btn-primario mt-6"
        >
          {d.panel.entrarConEmail}
        </Link>
      </div>
    )
  }

  const domain = scannableDomain(tenant.originUrl)
  const acceso = accesoPro(tenant)
  const [balance, resources, score, billing, locale] = await Promise.all([
    store.balance(tenant.id),
    store.listResources(tenant.id).catch(() => []),
    domain ? cachedScore(domain) : Promise.resolve(null),
    // El saldo del mes lo lleva el gateway. Si no contesta, el menú sale sin saldo, sin aviso de error.
    acceso.activo && acceso.plan !== 'regalo' ? leerBilling(tenant.slug).catch(() => null) : Promise.resolve(null),
    getLocale(),
  ])
  // Solo en desarrollo: PANEL_SALDO_STUB="470/500" pinta un saldo de ejemplo sin gateway, para ver el menú. Fuera de desarrollo se ignora.
  const ejemplo = process.env.NODE_ENV === 'development' ? process.env.PANEL_SALDO_STUB?.match(/^(\d+)\/(\d+)$/) : null
  const uso = ejemplo
    ? { remaining: Number(ejemplo[1]), credits: Number(ejemplo[2]), renewsAt: new Date(Date.now() + 9 * 86_400_000).toISOString() }
    : (billing as { usage?: { credits?: unknown; remaining?: unknown; renewsAt?: unknown } } | null)?.usage
  const renueva = typeof uso?.renewsAt === 'string' && !Number.isNaN(Date.parse(uso.renewsAt)) ? new Date(uso.renewsAt) : null
  const saldo =
    acceso.plan === 'regalo' && tenant.regalo
      ? { titulo: d.panel.saldoRegaloTitulo, valor: d.panel.saldoRegalo(tenant.regalo.informes, tenant.regalo.respuestas), nota: null, parte: null }
      : typeof uso?.remaining === 'number' && typeof uso.credits === 'number' && uso.credits > 0
        ? {
            titulo: d.panel.saldoTitulo,
            valor: d.panel.saldoDe(uso.remaining, uso.credits),
            nota: renueva ? d.panel.saldoRenueva(new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(renueva)) : null,
            parte: Math.max(0, Math.min(1, uso.remaining / uso.credits)),
          }
        : null

  return (
    // -mb-20: come el aire de abajo del layout raíz, para que el menú lateral llegue hasta el pie sin una franja suelta.
    <div className="mx-[calc(50%-50vw)] -mt-4 -mb-20 w-screen">
      <div className="flex min-h-dvh w-full">
        <Sidebar
          slug={tenant.slug}
          name={tenant.name}
          valores={{
            score: score ? String(score.score) : undefined,
            rutas: resources.length > 0 ? String(resources.length) : undefined,
            ingresos: Number(balance.revenue) > 0 ? `${Number(balance.revenue).toFixed(2)}` : undefined,
          }}
          pro={acceso.activo}
          saldo={saldo}
          portalUrl={`${gatewayUrl}/${tenant.slug}/developers`}
        />
        <main className="panel-negocio min-w-0 flex-1 px-4 py-6 sm:p-6 lg:p-10">
          {/* Columna centrada con ancho tope. Una página con mucho contenido (Contenido) pide todo el ancho con data-ancho. */}
          <div className="mx-auto max-w-5xl space-y-8 has-[[data-ancho]]:max-w-none">{children}</div>
        </main>
      </div>
    </div>
  )
}
