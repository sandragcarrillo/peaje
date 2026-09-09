'use client'

import type { Withdrawal } from '@peaje/db'
import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { money, shortWallet } from '@/lib/config'
import { estadoRetiro, retirar, type RetiroEstado } from './actions'

export function RetirosPanel({
  slug,
  disponible,
  porRed,
  wallet,
  historial,
}: {
  slug: string
  disponible: string
  porRed: { network: string; available: string }[]
  wallet: string | null
  historial: Withdrawal[]
}) {
  const router = useRouter()
  const [copiado, setCopiado] = useState(false)
  const [enCurso, setEnCurso] = useState<string | null>(null) // red del retiro en curso
  const [estado, setEstado] = useState<RetiroEstado | null>(null)
  const [error, setError] = useState<string | null>(null)

  const redesConSaldo = porRed.filter((b) => Number(b.available) > 0)

  async function copiarWallet() {
    if (!wallet) return
    await navigator.clipboard.writeText(wallet)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function retirarDe(network: string) {
    setError(null)
    setEnCurso(network)
    setEstado(null)
    try {
      const fd = new FormData()
      fd.set('network', network)
      let actual = await retirar(slug, fd)
      setEstado(actual)
      // Polling hasta confirmación on-chain (el gateway consulta la chain).
      for (let i = 0; i < 20 && actual.status === 'pending'; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        actual = await estadoRetiro(slug, actual.id)
        setEstado(actual)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el retiro. Reintenta.')
    } finally {
      setEnCurso(null)
    }
  }

  return (
    <section>
      <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
        <p className="text-xs tracking-wide text-accent uppercase">Saldo disponible</p>
        <p className="mt-3 text-3xl font-medium tabular-nums">{money(disponible)}</p>

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

        {redesConSaldo.length === 0 ? (
          <button
            type="button"
            disabled
            className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black opacity-40"
          >
            Retirar
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            {redesConSaldo.map((b) => {
              const label = isNetworkId(b.network) ? NETWORKS[b.network].label : b.network
              const symbol = isNetworkId(b.network) ? NETWORKS[b.network].tokenSymbol : ''
              return (
                <button
                  key={b.network}
                  type="button"
                  disabled={!wallet || enCurso !== null}
                  onClick={() => retirarDe(b.network)}
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
                >
                  {enCurso === b.network
                    ? 'Enviando…'
                    : `Retirar ${money(b.available)} (${symbol} en ${label})`}
                </button>
              )
            })}
          </div>
        )}

        {estado ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-panel p-3 text-sm">
            <Badge status={estado.status} />
            <span className="text-muted">
              {estado.status === 'pending'
                ? 'Transferencia enviada, esperando confirmación on-chain…'
                : estado.status === 'confirmed'
                  ? `${money(estado.amount)} enviados a ${shortWallet(estado.toWallet)}`
                  : 'La transferencia falló. Tu saldo sigue intacto, reintenta.'}
            </span>
            {estado.explorerUrl ? (
              <a
                href={estado.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-accent hover:underline"
              >
                ver tx
              </a>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-red-400/40 bg-panel p-3 text-sm text-red-400">
            {error}
          </p>
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
