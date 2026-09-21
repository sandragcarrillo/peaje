import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { PageHeader } from '@/components/chrome'
import { RetirosPanel } from '../retiros'
import { WalletForm } from '../wallet'
import { saldoTotal, saldosPorRed } from '@/lib/saldos'
import { historialOnchain } from '@/lib/subgraph'
import { HistorialOnchainPanel } from './historial-onchain'

export default async function Retirar({ params }: PageProps<'/t/[slug]/retirar'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [balance, porRed, retiros, d, onchain] = await Promise.all([
    saldoTotal(tenant),
    saldosPorRed(tenant),
    store.listWithdrawals(tenant.id, 10),
    getDict(),
    historialOnchain(tenant.payoutWallet),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`}
        titulo={d.dinero.retirarTitulo}
        sub={d.dinero.retirarIntro}
      />
      <div className="space-y-3">
        <RetirosPanel
          slug={tenant.slug}
          disponible={balance.available}
          porRed={porRed}
          wallet={tenant.payoutWallet}
          historial={retiros}
        />
        <WalletForm slug={tenant.slug} wallet={tenant.payoutWallet} />
      </div>
      {onchain ? <HistorialOnchainPanel historial={onchain} d={d} locale={d.agentes.fechaLocale} /> : null}
    </div>
  )
}
