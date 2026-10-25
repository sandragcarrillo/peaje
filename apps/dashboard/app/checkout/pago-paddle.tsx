'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { CONTACTO } from '@/lib/legal'
import { cargarPaddle, escucharPaddle, temaActual } from '@/lib/paddle-js'

const TXN = /^txn_[a-z0-9]+$/i

type Estado = 'sin_config' | 'sin_txn' | 'abriendo' | 'abierto' | 'completado' | 'cerrado' | 'error'

export function PagoPaddle({ token, environment }: { token: string | null; environment: 'sandbox' | 'production' }) {
  const { pago: t } = useDict()
  const locale = useLocale()
  const txn = useSearchParams().get('_ptxn')
  const valido = !!txn && TXN.test(txn)
  const [estado, setEstado] = useState<Estado>(!token ? 'sin_config' : !valido ? 'sin_txn' : 'abriendo')

  const abrir = async () => {
    if (!token || !txn || !valido) return
    setEstado('abriendo')
    try {
      const p = await cargarPaddle(token, environment)
      if (!p) throw new Error('Paddle.js did not load')
      // Abrir a mano manda sobre la apertura automática por _ptxn: así salen el tema y el idioma de Peaje.
      p.Checkout.open({ transactionId: txn, settings: { displayMode: 'overlay', variant: 'one-page', theme: temaActual(), locale } })
    } catch {
      setEstado('error')
    }
  }

  useEffect(() => {
    escucharPaddle((ev) => {
      if (ev.name === 'checkout.loaded') setEstado('abierto')
      else if (ev.name === 'checkout.completed') setEstado('completado')
      else if (ev.name === 'checkout.closed') setEstado((e) => (e === 'completado' ? e : 'cerrado'))
      else if (ev.name === 'checkout.error') setEstado('error')
    })
    void abrir()
    return () => escucharPaddle(null)
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [titulo, nota] =
    estado === 'sin_config'
      ? [t.sinConfig, t.sinConfigNota(CONTACTO)]
      : estado === 'sin_txn'
        ? [t.sinTxn, t.sinTxnNota]
        : estado === 'abierto'
          ? [t.abierto, t.abiertoNota]
          : estado === 'completado'
            ? [t.listo, t.listoNota]
            : estado === 'cerrado'
              ? [t.cerrado, t.cerradoNota]
              : estado === 'error'
                ? [t.error, t.errorNota]
                : [t.abriendo, t.abriendoNota]

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="space-y-3 border border-border p-6">
        <p className="font-mono text-xs text-muted">{t.eyebrow}</p>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted" role="status">
          {nota}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {estado === 'cerrado' || estado === 'error' ? (
            <button type="button" onClick={() => void abrir()} className="btn btn-primario">
              {t.reabrir}
            </button>
          ) : null}
          {estado === 'sin_txn' || estado === 'completado' || estado === 'sin_config' ? (
            <Link href="/negocios" className="btn btn-secundario">
              {t.irAlPanel}
            </Link>
          ) : null}
        </div>
      </div>
      <p className="text-center text-xs text-muted">{t.pie(CONTACTO)}</p>
    </div>
  )
}
