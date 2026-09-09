'use client'

import type { Withdrawal } from '@peaje/db'
import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { useState } from 'react'
import { money, shortWallet } from '@/lib/config'

export function RetirosPanel({
  disponible,
  porRed,
  wallet,
  historial,
}: {
  disponible: string
  porRed: { network: string; available: string }[]
  wallet: string | null
  historial: Withdrawal[]
}) {
  const [comingSoon, setComingSoon] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const puedeRetirar = Number(disponible) > 0 && Boolean(wallet)

  async function copiarWallet() {
    if (!wallet) return
    await navigator.clipboard.writeText(wallet)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <section>
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
        <p className="text-xs tracking-wide text-accent uppercase">Saldo disponible</p>
        <p className="mt-3 text-3xl font-medium tabular-nums">{money(disponible)}</p>
        {porRed.some((b) => Number(b.available) > 0) ? (
          <p className="mt-1 text-xs text-muted">
            {porRed
              .filter((b) => Number(b.available) > 0)
              .map(
                (b) =>
                  `${money(b.available)} en ${isNetworkId(b.network) ? NETWORKS[b.network].label : b.network}`,
              )
              .join(' · ')}
          </p>
        ) : null}

        {wallet ? (
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted">
              Cuenta: <span className="font-mono">{shortWallet(wallet)}</span>
            </span>
            <button
              type="button"
              onClick={copiarWallet}
              className="text-xs text-accent hover:underline"
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : (
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
            Configura tu wallet de retiro aquí abajo para poder retirar.
          </p>
        )}

        <button
          type="button"
          disabled={!puedeRetirar}
          onClick={() => setComingSoon(true)}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
        >
          Retirar
        </button>

        {comingSoon ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-panel p-3 text-sm">
            <span className="text-muted">
              Los retiros llegan pronto. Tu saldo sigue seguro y acumulándose.
            </span>
            <button
              onClick={() => setComingSoon(false)}
              className="ml-auto text-xs text-muted hover:text-text"
            >
              Cerrar
            </button>
          </div>
        ) : null}
      </div>

      {historial.length > 0 ? (
        <ul className="mt-5 space-y-1.5">
          {historial.map((w) => (
            <li key={w.id} className="flex items-center gap-3 font-mono text-xs text-muted">
              <Badge status={w.status} />
              <span>{money(w.amount)}</span>
              <span className="text-muted">
                {isNetworkId(w.network) ? NETWORKS[w.network].label : w.network}
              </span>
              <span>→ {shortWallet(w.toWallet)}</span>
              {w.txRef && isNetworkId(w.network) ? (
                <a
                  href={explorerTxUrl(w.network, w.txRef)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  tx
                </a>
              ) : null}
              <span className="ml-auto">
                {new Date(w.createdAt).toLocaleString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function Badge({ status }: { status: Withdrawal['status'] }) {
  const styles = {
    pending: 'text-yellow-400 border-yellow-400/40',
    confirmed: 'text-accent border-accent/40',
    failed: 'text-red-400 border-red-400/40',
  } as const
  const labels = { pending: 'pendiente', confirmed: 'confirmado', failed: 'falló' } as const
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
