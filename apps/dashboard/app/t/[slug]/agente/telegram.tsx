'use client'

import { useState, useTransition } from 'react'
import type { EstadoTelegram } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { conectarTelegram, quitarTelegram } from './actions'

export function TelegramPanel({ slug, estado }: { slug: string; estado: EstadoTelegram | null }) {
  const { miAgente: t } = useDict()
  const [enlace, setEnlace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!estado) return null
  const correr = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null)
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  return (
    <div className="space-y-3 border border-border p-4">
      <p className="text-sm text-muted">{t.tgIntro}</p>
      {!estado.configured ? <p className="text-xs text-muted">{t.tgSinBot}</p> : null}
      {estado.links.map((l) => (
        <p key={l.linkedAt} className="text-sm">
          {t.tgConectado(l.username ?? '')}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {enlace ? (
          <a href={enlace} target="_blank" rel="noreferrer" className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg">
            {t.tgAbrir}
          </a>
        ) : (
          <button disabled={pending} onClick={() => correr(async () => setEnlace((await conectarTelegram(slug)).url))} className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
            {t.tgConectar}
          </button>
        )}
        {estado.links.length ? (
          <button disabled={pending} onClick={() => correr(() => quitarTelegram(slug))} className="text-xs text-muted underline hover:text-text">
            {t.tgDesconectar}
          </button>
        ) : null}
      </div>
      {enlace ? <p className="text-xs text-muted">{t.tgNota}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
