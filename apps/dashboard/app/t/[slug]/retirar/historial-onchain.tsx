import { explorerTxUrl, NETWORKS, SETTLEMENT_CONTRACTS } from '@peaje/shared'
import { microMoney, shortWallet } from '@/lib/config'
import type { HistorialOnchain } from '@/lib/subgraph'
import type { getDict } from '@/lib/i18n'

type Dict = Awaited<ReturnType<typeof getDict>>

export function HistorialOnchainPanel({ historial, d, locale }: { historial: HistorialOnchain; d: Dict; locale: string }) {
  const contrato = SETTLEMENT_CONTRACTS.arbitrum
  const explorer = NETWORKS.arbitrum.testnet.explorerUrl

  return (
    <section className="border border-border bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{d.dinero.onchainTitulo}</p>
        {contrato ? (
          <a
            href={`${explorer}/address/${contrato}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-muted hover:text-text"
          >
            {d.dinero.onchainContrato} ↗
          </a>
        ) : null}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">{d.dinero.onchainIntro}</p>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        {[
          [d.dinero.onchainRecibido, historial.recibido],
          [d.dinero.onchainFees, historial.fees],
          [d.dinero.onchainRetirado, historial.retirado],
        ].map(([label, valor]) => (
          <div key={label}>
            <p className="text-xl tabular-nums">{microMoney(valor)}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {historial.movimientos.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{d.dinero.onchainVacio}</p>
      ) : (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {historial.movimientos.map((m) => (
            <li key={m.txHash + m.tipo} className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className={m.tipo === 'pago' ? 'text-accent' : 'text-muted'}>
                {m.tipo === 'pago' ? d.dinero.onchainPago : d.dinero.onchainRetiro}
              </span>
              <span className="tabular-nums">{microMoney(m.monto)}</span>
              <span className="text-muted">{m.tipo === 'pago' ? '←' : '→'} {shortWallet(m.contraparte)}</span>
              <a
                href={explorerTxUrl('arbitrum', m.txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                tx
              </a>
              <span className="ml-auto text-muted">
                {new Date(m.fecha).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
