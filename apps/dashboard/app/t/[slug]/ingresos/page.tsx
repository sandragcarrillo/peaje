import { tipoWalletCobro } from '@peaje/db'
import { PageHeader } from '@/components/chrome'
import { microMoney, money, shortWallet } from '@/lib/config'
import { getDict } from '@/lib/i18n'
import { armarIngresos } from '@/lib/ingresos'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { WalletForm } from '../wallet'

/**
 * Ingresos: lo que el negocio recibió, pago por pago. Con PeajeSettlementV3
 * y el split de Tempo cada pago llega a la dirección de cobro en la misma
 * transacción, así que no hay saldo ni retiros: solo la lista, con la tx, el
 * neto y la dirección a la que llegó.
 */
export default async function Ingresos({ params }: PageProps<'/t/[slug]/ingresos'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [payments, balance, d] = await Promise.all([
    store.listPayments(tenant.id, 100),
    store.balance(tenant.id),
    getDict(),
  ])
  const t = d.dinero
  const ingresos = armarIngresos(payments, balance)
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(t.fechaLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.ingresosTitulo} sub={t.ingresosIntro} />

      {!tenant.payoutWallet ? (
        <section className="border border-accent bg-panel p-5">
          <p className="text-sm font-medium">{t.sinDireccionTitulo}</p>
          <p className="mt-1 text-sm text-muted">{t.sinDireccion}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-border bg-bg p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{t.totalRecibido}</p>
          <p className="my-2 text-4xl font-bold tracking-tight tabular-nums">{money(ingresos.recibido)}</p>
          <p className="border-t border-border pt-3 font-mono text-[11px] text-muted">{t.totalRecibidoPie}</p>
        </div>
        <div className="border border-border bg-bg p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{t.pagosCuenta}</p>
          <p className="my-2 text-4xl font-bold tracking-tight tabular-nums">{ingresos.pagos}</p>
        </div>
        <div className="border border-border bg-bg p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{d.panel.metricaCobro}</p>
          <p className="my-2 font-mono text-lg">{tenant.payoutWallet ? shortWallet(tenant.payoutWallet) : d.panel.metricaCobroFalta}</p>
        </div>
      </div>

      <WalletForm slug={tenant.slug} wallet={tenant.payoutWallet} ownerWallet={tenant.ownerWallet} tipo={tipoWalletCobro(tenant)} />

      <section className="border border-border bg-bg">
        <h2 className="border-b border-border p-5 text-lg font-semibold">{t.listaTitulo}</h2>
        {ingresos.lista.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t.listaVacia}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-panel font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-3 font-bold">{t.colFecha}</th>
                  <th className="px-5 py-3 font-bold">{t.colRuta}</th>
                  <th className="px-5 py-3 font-bold">{t.colRed}</th>
                  <th className="px-5 py-3 font-bold">{t.colLlegoA}</th>
                  <th className="px-5 py-3 text-right font-bold">{t.colNeto}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {ingresos.lista.map((p) => (
                  <tr key={p.id} className="hover:bg-panel-2">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{fecha(p.fecha)}</td>
                    <td className="px-5 py-3 break-all">{p.ruta}</td>
                    <td className="whitespace-nowrap px-5 py-3">{p.red}</td>
                    <td className="whitespace-nowrap px-5 py-3" title={p.llegoA ?? undefined}>
                      {p.llegoA ? shortWallet(p.llegoA) : <span className="text-muted">{t.antesDelCambio}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <span className="font-bold">{microMoney(p.neto)}</span>
                      {p.reembolsado ? <span className="ml-2 text-muted" title={t.reembolsadoPorPeaje}>{t.reembolsado}</span> : null}
                      {p.txUrl ? (
                        <a href={p.txUrl} target="_blank" rel="noreferrer" className="ml-3 text-accent hover:underline">
                          {t.verTx}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ingresos.hayAnteriores ? <p className="border-t border-border p-5 text-xs text-muted">{t.notaAnteriores}</p> : null}
      </section>
    </div>
  )
}
