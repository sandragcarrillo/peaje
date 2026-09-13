import { redirect } from 'next/navigation'
import { getDict } from '@/lib/i18n'
import { findMerchantWalletId } from '@/lib/privy'
import { currentTenant } from '@/lib/session'
import { walletBalances } from '@/lib/walletops'
import { Eyebrow } from '@/components/chrome'
import { EnviarPanel } from './enviar'

/**
 * Mi wallet, vista propia: la plata es de la PERSONA, no de un negocio, así
 * que vive fuera del dashboard por-negocio (mismo criterio que /agentes).
 * El popover del navbar y sus botones de enviar/ver llegan acá.
 */
export default async function Wallet() {
  const [tenant, d] = await Promise.all([currentTenant(), getDict()])
  if (!tenant) redirect('/acceder')

  const address = tenant.payoutWallet as `0x${string}` | null
  if (!address) {
    return <p className="text-sm text-muted">{d.dinero.sinWalletNegocio}</p>
  }

  const [balances, walletId] = await Promise.all([
    walletBalances(address),
    findMerchantWalletId(address),
  ])

  return (
    <div className="space-y-8 py-2">
      <header>
        <Eyebrow dot>{`${d.dinero.eyebrow} / ${address.slice(0, 6)}…${address.slice(-4)}`}</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold">{d.dinero.miWallet}</h1>
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
