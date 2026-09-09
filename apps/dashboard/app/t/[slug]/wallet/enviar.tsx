'use client'

import { NETWORKS, isNetworkId } from '@peaje/shared'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { money, shortWallet } from '@/lib/config'
import { enviarFondos, type EnvioResultado } from '../actions'
import type { WalletBalance } from '@/lib/walletops'

export function EnviarPanel({
  slug,
  address,
  balances,
  custodiada,
}: {
  slug: string
  address: string
  balances: WalletBalance[]
  custodiada: boolean
}) {
  const router = useRouter()
  const [network, setNetwork] = useState(balances.find((b) => Number(b.amount) > 0)?.network ?? 'tempo')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [resultado, setResultado] = useState<EnvioResultado | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(address)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setResultado(null)
    setPending(true)
    try {
      const fd = new FormData()
      fd.set('network', network)
      fd.set('to', to)
      fd.set('amount', amount)
      const r = await enviarFondos(slug, fd)
      setResultado(r)
      if (r.ok) {
        setTo('')
        setAmount('')
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">{shortWallet(address)}</span>
          <button type="button" onClick={copiar} className="text-xs text-accent hover:underline">
            {copiado ? 'Copiada' : 'Copiar address'}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {balances.map((b) => (
            <div key={b.network} className="rounded-lg border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted">
                {isNetworkId(b.network) ? NETWORKS[b.network].label : b.network}
              </p>
              <p className="mt-1 text-xl tabular-nums">
                {money(b.amount)} <span className="text-xs text-muted">{b.symbol}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {custodiada ? (
        <form onSubmit={enviar} className="space-y-4 rounded-lg border border-border bg-panel p-5">
          <p className="text-sm font-medium">Enviar a otra wallet</p>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted">Red</span>
            <select
              value={network}
              onChange={(e) => {
                if (isNetworkId(e.target.value)) setNetwork(e.target.value)
              }}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              {balances.map((b) => (
                <option key={b.network} value={b.network}>
                  {isNetworkId(b.network) ? NETWORKS[b.network].label : b.network} ({b.symbol})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted">Address de destino</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              placeholder="0x…"
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-muted">Monto</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
          <p className="text-xs text-muted">
            El gas sale del mismo token de la red (no necesitas otro token para pagar fees).
          </p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar'}
          </button>

          {resultado ? (
            resultado.ok ? (
              <p className="text-sm text-accent">
                Enviado.{' '}
                <a href={resultado.explorerUrl} target="_blank" rel="noreferrer" className="underline">
                  ver tx
                </a>
              </p>
            ) : (
              <p className="text-sm text-red-400">{resultado.error}</p>
            )
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
