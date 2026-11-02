'use client'

import { useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { cambiarCobros } from './actions'

/** Prende o apaga los cobros de agentes del negocio (solo se muestra en mainnet). */
export function BotonCobros({ slug, activos }: { slug: string; activos: boolean }) {
  const t = useDict().dinero
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const prender = !activos

  function cambiar() {
    setError(null)
    empezar(async () => {
      const r = await cambiarCobros(slug, prender)
      if (!r.ok) setError(r.error)
    })
  }

  return (
    <div className="shrink-0 space-y-2">
      <button type="button" onClick={cambiar} disabled={pendiente} className={`btn btn-chico ${prender ? 'btn-primario' : 'btn-secundario'}`}>
        {pendiente ? (prender ? t.cobrosActivando : t.cobrosApagando) : prender ? t.cobrosActivar : t.cobrosApagar}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
