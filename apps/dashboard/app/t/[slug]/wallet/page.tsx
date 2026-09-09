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
  const tenant = await requireTenant(slug)
  const address = tenant.payoutWallet as `0x${string}` | null

  if (!address) {
    return <p className="text-sm text-muted">Este negocio no tiene wallet configurada.</p>
  }

  const [balances, walletId] = await Promise.all([
    walletBalances(address),
    findMerchantWalletId(address),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">Mi wallet</h1>
        <p className="mt-2 text-sm text-muted">
          {walletId
            ? 'Tu cuenta Peaje. Acá llegan tus retiros; desde acá mandas fondos a donde quieras.'
            : 'Tu wallet de retiro es externa: los fondos ya llegan a una cuenta que manejas tú.'}
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
