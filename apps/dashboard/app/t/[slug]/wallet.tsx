'use client'

import type { TipoWalletCobro } from '@peaje/db'
import { NETWORK_IDS, NETWORKS } from '@peaje/shared'
import { useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { guardarWallet } from './actions'

/** Un explorer por cadena (Arbitrum USDC y USDG comparten), en el orden de NETWORK_IDS. */
const EXPLORERS = [
  ...new Map(
    NETWORK_IDS.map((id) => {
      const label = NETWORKS[id].label.split(' · ')[0] ?? NETWORKS[id].label
      return [NETWORKS[id].testnet.explorerUrl, label] as const
    }),
  ).entries(),
].map(([url, label]) => ({ url, label }))

/** Address completa, copiar y links a los explorers de las redes donde cobramos. */
export function DireccionConLinks({ address }: { address: string }) {
  const t = useDict().walletPropia
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(address)
    setCopiada(true)
    setTimeout(() => setCopiada(false), 1500)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <code className="break-all font-mono text-sm text-text">{address}</code>
        <button type="button" onClick={copiar} className="btn btn-secundario btn-chico">
          {copiada ? t.copiada : t.copiar}
        </button>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>{t.verEn}</span>
        {EXPLORERS.map((e) => (
          <a
            key={e.url}
            href={`${e.url}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            {e.label}
          </a>
        ))}
      </p>
    </div>
  )
}

/**
 * Dónde cobra el negocio: su wallet de Privy (del dueño, no custodial) o una
 * dirección propia que pegó. Reemplaza al viejo "cambiar wallet de retiro".
 */
export function WalletForm({
  slug,
  wallet,
  ownerWallet,
  tipo,
}: {
  slug: string
  wallet: string | null
  ownerWallet: string | null
  tipo: TipoWalletCobro
}) {
  const t = useDict().walletPropia
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function guardar(formData: FormData) {
    setError(null)
    setAviso(null)
    startTransition(async () => {
      const r = await guardarWallet(slug, formData)
      if (r.ok) {
        setAbierto(false)
        setAviso(`${t.guardado} ${t.yaCobrado}`)
      } else {
        setError(r.error)
      }
    })
  }

  const explicacion =
    tipo === 'propia' ? t.explicacion : tipo === 'custodiada' ? t.explicacionCustodiada : t.explicacionExterna

  return (
    <section id="cobro" className="space-y-4 border border-border bg-panel p-5">
      <div>
        <h2 className="text-sm font-medium">{t.titulo}</h2>
        {tipo !== 'ninguna' ? <p className="mt-1 text-xs text-muted">{explicacion}</p> : null}
      </div>

      {wallet ? <DireccionConLinks address={wallet} /> : <p className="text-sm text-muted">{t.sinWallet}</p>}

      {abierto ? (
        <form action={guardar} className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">{t.propiaTitulo}</p>
          <p className="text-xs text-muted">{t.propiaAyuda}</p>
          <input
            name="wallet"
            defaultValue={tipo === 'externa' ? (wallet ?? '') : ''}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} className="btn btn-primario">
              {pending ? t.guardando : t.guardar}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="btn btn-secundario">
              {t.cancelar}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAbierto(true)} className="btn btn-secundario btn-chico">
            {t.usarPropia}
          </button>
          {tipo === 'externa' && ownerWallet ? (
            <form action={guardar}>
              <input type="hidden" name="wallet" value="" />
              <button disabled={pending} className="btn btn-secundario btn-chico">
                {pending ? t.guardando : t.volverAMiWallet}
              </button>
            </form>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {aviso ? <p className="text-sm text-accent">{aviso}</p> : null}
    </section>
  )
}
