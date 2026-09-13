'use client'

import type { Withdrawal } from '@peaje/db'
import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { money, shortWallet } from '@/lib/config'
import { useDict } from '@/lib/i18n/client'
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
  const d = useDict()
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
      setError(e instanceof Error ? e.message : d.dinero.errorRetiro)
    } finally {
      setEnCurso(null)
    }
  }

  return (
    <section className="space-y-4">
      {/* Hero: saldo disponible (mock Withdraw de Stitch) */}
      <div className="border border-border bg-panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {d.dinero.saldoDisponible}
          </span>
          <div className="flex items-center gap-2 self-start border border-border bg-bg px-2.5 py-1 font-mono text-[10px] text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span>MPP · 402</span>
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline">
          <span className="text-5xl font-bold tracking-tight tabular-nums">{money(disponible)}</span>
          <span className="font-mono text-xs text-muted">TEMPO + ARC</span>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          {wallet ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {d.dinero.cuenta}: <span className="text-text">{shortWallet(wallet)}</span>
              </span>
              <button
                type="button"
                onClick={copiarWallet}
                className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase text-text hover:bg-panel-2"
              >
                {copiado ? d.dinero.copiado : `[${d.dinero.copiar}]`}
              </button>
            </>
          ) : (
            <span className="text-xs text-muted">{d.dinero.configuraWallet}</span>
          )}
        </div>
      </div>

      {/* Una fila de retiro por red con saldo */}
      {redesConSaldo.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {redesConSaldo.map((b) => {
            const label = isNetworkId(b.network) ? NETWORKS[b.network].label : b.network
            const symbol = isNetworkId(b.network) ? NETWORKS[b.network].tokenSymbol : ''
            return (
              <div
                key={b.network}
                className="flex flex-col justify-between gap-4 border border-border bg-bg p-4 transition-colors hover:bg-panel sm:p-5 md:flex-row md:items-center"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="font-mono text-sm font-bold">
                    {money(b.available)} {symbol}
                  </span>
                  <span className="inline-flex w-fit items-center gap-1.5 border border-border bg-panel-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {label}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!wallet || enCurso !== null}
                  onClick={() => retirarDe(b.network)}
                  className="border border-text bg-negro px-4 py-2 font-mono text-xs font-bold uppercase text-white transition-colors hover:bg-tinta disabled:opacity-40"
                >
                  {enCurso === b.network ? d.dinero.enviando : d.dinero.retirar}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      {estado ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-panel p-3 text-sm">
            <Badge status={estado.status} />
            <span className="text-muted">
              {estado.status === 'pending'
                ? d.dinero.esperandoConfirmacion
                : estado.status === 'confirmed'
                  ? d.dinero.enviadosA(money(estado.amount), shortWallet(estado.toWallet))
                  : d.dinero.transferenciaFallo}
            </span>
            {estado.explorerUrl ? (
              <a
                href={estado.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-accent hover:underline"
              >
                {d.dinero.verTx}
              </a>
            ) : null}
          </div>
        ) : null}

      {error ? (
        <p className="border border-red-400/40 bg-panel p-3 text-sm text-red-600">{error}</p>
      ) : null}

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
                {new Date(w.createdAt).toLocaleString(d.dinero.fechaLocale, {
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
  const d = useDict()
  const styles = {
    pending: 'text-amber-700 border-amber-600/50',
    confirmed: 'text-accent border-accent/40',
    failed: 'text-red-600 border-red-400/40',
  } as const
  const labels = {
    pending: d.dinero.estadoPendiente,
    confirmed: d.dinero.estadoConfirmado,
    failed: d.dinero.estadoFallo,
  } as const
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
