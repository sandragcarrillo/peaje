'use client'

import { railLabel } from '@peaje/shared'
import Link from 'next/link'
import { useState } from 'react'
import { resumenWallet, type ResumenWallet } from '@/app/t/[slug]/actions'
import { COBROS_VISIBLES, money, shortWallet } from '@/lib/config'
import { useDict } from '@/lib/i18n/client'

/**
 * Menú de cuenta: se abre desde el email en el navbar. Arriba la wallet
 * (balance, recibir, ingresos) y abajo el submenu de navegación
 * personal (Mis negocios). El agente vive dentro de cada negocio (Mi agente).
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
    if (siguiente && !data && COBROS_VISIBLES) {
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
  const conSaldo = data ? data.balances.filter((b) => Number(b.amount) > 0) : []

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="btn btn-secundario btn-chico max-w-56 gap-1.5"
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
          <div className={`absolute right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-panel text-text shadow-xl shadow-black/40 ${COBROS_VISIBLES ? 'w-80 p-5' : 'w-56 p-2'}`}>
            {!COBROS_VISIBLES ? (
              // Hasta mainnet la wallet existe pero no se muestra (ver COBROS_VISIBLES).
              <nav>
                <Link
                  href="/negocios"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-2 hover:text-text"
                >
                  {nav.negocios}
                </Link>
              </nav>
            ) : cargando || !data ? (
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
                    className="btn btn-primario btn-chico flex-1"
                  >
                    {copiado ? d.dinero.copiada : d.dinero.copiarAddress}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('resumen')}
                    className="btn btn-secundario btn-chico"
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
                </nav>

                <p className="text-sm font-medium">{nav.wallet}</p>
                <div className="-mt-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted">{shortWallet(data.address)}</span>
                  <button type="button" onClick={copiar} className="btn btn-secundario btn-chico">
                    {copiado ? d.dinero.copiada : d.dinero.copiar}
                  </button>
                </div>

                <div>
                  <p className="text-3xl font-medium tabular-nums">{money(total)}</p>
                  {/* Solo lo que hay: una línea por moneda y red con saldo. */}
                  {conSaldo.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {conSaldo.map((b) => (
                        <li key={`${b.network}-${b.symbol}`} className="flex justify-between gap-3">
                          <span>{b.symbol} · {railLabel(b.network)}</span>
                          <span className="tabular-nums text-text">{money(b.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* Sin enviar ni retiros: cada pago llega directo a la dirección de cobro. */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModo('recibir')}
                    className="btn btn-secundario btn-chico"
                  >
                    {d.dinero.recibir}
                  </button>
                  <Link
                    href={`/t/${slug}/ingresos`}
                    onClick={() => setOpen(false)}
                    className="btn btn-secundario btn-chico"
                  >
                    {d.dinero.verIngresos}
                  </Link>
                </div>

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
