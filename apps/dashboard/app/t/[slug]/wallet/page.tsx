import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { findMerchantWalletId } from '@/lib/privy'
import { walletBalances } from '@/lib/walletops'
import { EnviarPanel } from './enviar'

/**
 * Mi wallet: la cuenta Peaje del merchant (custodiada por Privy). Saldos por
 * red y envío de fondos a cualquier address externa, para que la plata no
 * quede atrapada dentro de Peaje.
 */
export default async function Wallet({ params }: PageProps<'/t/[slug]/wallet'>) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const address = tenant.payoutWallet as `0x${string}` | null

  if (!address) {
    return <p className="text-sm text-muted">{d.dinero.sinWalletNegocio}</p>
  }

  const [balances, walletId] = await Promise.all([
    walletBalances(address),
    findMerchantWalletId(address),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">{d.dinero.miWallet}</h1>
        <p className="mt-2 text-sm text-muted">
          {walletId ? d.dinero.walletCustodiada : d.dinero.walletExterna}
        </p>
      </header>

      <EnviarPanel
        slug={tenant.slug}
        address={address}
        balances={balances}
        custodiada={walletId !== null}
      />
    </div>
  )
}
