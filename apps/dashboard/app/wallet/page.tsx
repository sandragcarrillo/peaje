import { tipoWalletCobro } from '@peaje/db'
import { railLabel } from '@peaje/shared'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DireccionConLinks } from '@/app/t/[slug]/wallet'
import { Eyebrow } from '@/components/chrome'
import { COBROS_VISIBLES, money, shortWallet } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { listMyTenants } from '@/lib/session'
import { walletBalances } from '@/lib/walletops'

/**
 * Mi wallet, vista propia: la plata es de la PERSONA, no de un negocio, así
 * que vive fuera del dashboard por-negocio (mismo criterio que /agentes).
 *
 * Desde la migración a la app de Privy propia la wallet es del dueño (owner =
 * su DID): una por persona, compartida por sus negocios. Peaje no firma con
 * ella, así que acá no hay "enviar" (llega con la próxima actualización).
 * Un negocio de antes de la migración ve su wallet custodiada, sin enviar:
 * Peaje ya no mueve fondos de negocios (pagos directos, sin retiros).
 */
export default async function Wallet() {
  // Hasta mainnet la wallet existe pero no se muestra (ver COBROS_VISIBLES).
  if (!COBROS_VISIBLES) redirect('/negocios')
  const [tenants, d] = await Promise.all([listMyTenants(), getDict()])
  const tenant = tenants[0]
  if (!tenant) redirect('/acceder')
  const t = d.walletPropia

  const propia = tenants.find((n) => n.ownerWallet)?.ownerWallet ?? null
  if (propia) {
    const balances = await walletBalances(propia as `0x${string}`)
    return (
      <div className="space-y-8 py-2">
        <header>
          <Eyebrow dot>{`${d.dinero.eyebrow} / ${shortWallet(propia)}`}</Eyebrow>
          <h1 className="mt-2 text-2xl font-semibold">{d.dinero.miWallet}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t.explicacion}</p>
        </header>

        <section className="space-y-4 rounded-lg border border-border bg-panel p-5">
          <p className="text-sm font-medium">{t.tuWallet}</p>
          <DireccionConLinks address={propia} />
          <p className="text-xs text-muted">{t.mismaEnTodas}</p>
        </section>

        <section className="space-y-3">
          <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.saldos}</p>
          <div className="grid grid-cols-2 gap-4">
            {balances.map((b) => (
              <div key={b.network} className="rounded-lg border border-border bg-panel p-3">
                <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{railLabel(b.network)}</p>
                <p className="mt-1 text-xl tabular-nums">
                  {money(b.amount)} <span className="text-xs text-muted">{b.symbol}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">{t.enviarProximamente}</p>
        </section>

        <section className="space-y-3">
          <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.negociosTitulo}</p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
            {tenants.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm">{n.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {tipoWalletCobro(n) === 'propia' || !n.payoutWallet
                      ? t.negocioPropia
                      : t.negocioExterna(shortWallet(n.payoutWallet))}
                  </p>
                </div>
                <Link href={`/t/${n.slug}/ingresos#cobro`} className="btn btn-secundario btn-chico">
                  {t.cambiar}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  // Negocio de antes de la migración: la wallet que Peaje custodia para él.
  const address = tenant.custodialWallet as `0x${string}` | null
  if (!address) {
    return <p className="text-sm text-muted">{d.dinero.sinWalletNegocio}</p>
  }

  const balances = await walletBalances(address)
  const walletId = tenant.custodialWalletId

  return (
    <div className="space-y-8 py-2">
      <header>
        <Eyebrow dot>{`${d.dinero.eyebrow} / ${address.slice(0, 6)}…${address.slice(-4)}`}</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold">{d.dinero.miWallet}</h1>
        <p className="mt-2 text-sm text-muted">
          {walletId ? d.dinero.walletCustodiada : d.dinero.walletExterna}
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-border bg-panel p-5">
        <DireccionConLinks address={address} />
      </section>

      <section className="space-y-3">
        <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{d.dinero.saldos}</p>
        <div className="grid grid-cols-2 gap-4">
          {balances.map((b) => (
            <div key={b.network} className="rounded-lg border border-border bg-panel p-3">
              <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{railLabel(b.network)}</p>
              <p className="mt-1 text-xl tabular-nums">
                {money(b.amount)} <span className="text-xs text-muted">{b.symbol}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
