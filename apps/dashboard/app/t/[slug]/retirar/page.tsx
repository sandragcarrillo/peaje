import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { RetirosPanel } from '../retiros'
import { WalletForm } from '../wallet'

export default async function Retirar({ params }: PageProps<'/t/[slug]/retirar'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [balance, porRed, retiros, d] = await Promise.all([
    store.balance(tenant.id),
    store.balanceByNetwork(tenant.id),
    store.listWithdrawals(tenant.id, 10),
    getDict(),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">{d.dinero.retirarTitulo}</h1>
        <p className="mt-2 text-sm text-muted">{d.dinero.retirarIntro}</p>
      </header>
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
    </div>
  )
}
