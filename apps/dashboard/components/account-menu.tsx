'use client'

import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import Link from 'next/link'
import { useState } from 'react'
import { resumenWallet, type ResumenWallet } from '@/app/t/[slug]/actions'
import { money, shortWallet } from '@/lib/config'
import { useDict } from '@/lib/i18n/client'

/**
 * Menú de cuenta: se abre desde el email en el navbar. Arriba la wallet
 * (balance, enviar/recibir, actividad) y abajo el submenu de navegación
 * personal (Mis negocios, Mis agentes). La vista completa vive en /wallet.
 */
export function AccountMenu({ slug, email }: { slug: string; email: string }) {
  const d = useDict()
  const nav = useDict().nav
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ResumenWallet | null>(null)
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState<'resumen' | 'recibir'>('resumen')
  const [copiado, setCopiado] = useState(false)

  async function toggle() {
    const siguiente = !open
    setOpen(siguiente)
    setModo('resumen')
    if (siguiente && !data) {
      setCargando(true)
      try {
        setData(await resumenWallet(slug))
      } finally {
        setCargando(false)
      }
    }
  }

  async function copiar() {
    if (!data) return
    await navigator.clipboard.writeText(data.address)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  const total = data ? data.balances.reduce((s, b) => s + Number(b.amount), 0) : 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="flex max-w-56 items-center gap-1.5 truncate text-sm text-muted hover:text-text"
      >
        <span className="truncate">{email}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={d.dinero.cerrar}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border bg-panel p-5 text-text shadow-xl shadow-black/40">
            {cargando || !data ? (
              <p className="py-8 text-center text-sm text-muted">
                {cargando ? d.dinero.cargando : d.dinero.sinWallet}
              </p>
            ) : modo === 'recibir' ? (
              <div className="space-y-4">
                <p className="text-sm font-medium">{d.dinero.recibir}</p>
                <p className="break-all rounded-lg border border-border bg-bg p-3 font-mono text-xs">
                  {data.address}
                </p>
                <p className="text-xs text-muted">{d.dinero.notaRecibir}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copiar}
                    className="flex-1 rounded-lg bg-text px-3 py-2 text-sm font-medium text-bg"
                  >
                    {copiado ? d.dinero.copiada : d.dinero.copiarAddress}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('resumen')}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
                  >
                    {d.dinero.volver}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <nav className="border-b border-border pb-2">
                  <Link
                    href="/negocios"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-text"
                  >
                    {nav.negocios}
                  </Link>
                  <Link
                    href="/agentes"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-text"
                  >
                    {nav.agentes}
                  </Link>
                </nav>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted">{shortWallet(data.address)}</span>
                  <button type="button" onClick={copiar} className="text-xs text-accent hover:underline">
                    {copiado ? d.dinero.copiada : d.dinero.copiar}
                  </button>
                </div>

                <div>
                  <p className="text-3xl font-medium tabular-nums">{money(total)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {data.balances
                      .map((b) => `${money(b.amount)} ${b.symbol} · ${isNetworkId(b.network) ? NETWORKS[b.network].label : b.network}`)
                      .join('  ·  ')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/wallet"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-text px-3 py-2.5 text-center text-sm font-medium text-bg"
                  >
                    {d.dinero.enviar}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setModo('recibir')}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm text-text hover:border-accent"
                  >
                    {d.dinero.recibir}
                  </button>
                </div>

                {data.retiros.length > 0 ? (
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      {d.dinero.actividadReciente}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {data.retiros.map((w) => (
                        <li key={w.id} className="flex items-center gap-2 font-mono text-xs text-muted">
                          <span
                            className={
                              w.status === 'confirmed'
                                ? 'text-accent'
                                : w.status === 'failed'
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                            }
                          >
                            ●
                          </span>
                          <span>{d.dinero.retiroItem(money(w.amount))}</span>
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
                            {new Date(w.createdAt).toLocaleDateString(d.dinero.fechaLocale, {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link
                  href="/wallet"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg border border-border px-3 py-2 text-center text-sm text-muted hover:border-accent hover:text-text"
                >
                  {d.dinero.verWalletCompleta}
                </Link>

              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function IconoWallet() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}
