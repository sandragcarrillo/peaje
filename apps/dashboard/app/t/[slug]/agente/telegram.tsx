'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { EstadoReportes, EstadoTelegram } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { conectarTelegram, quitarTelegram } from './actions'
import { ReportesChats } from './programados'

/**
 * Conectar Telegram en un clic: la pestaña se abre en el gesto del usuario (si
 * no, el navegador la bloquea) y se le pone el enlace de un solo uso cuando
 * llega. Si igual la bloquea, `enlace` queda para mostrar un botón de respaldo.
 * Lo usan este panel y /pago/listo.
 */
export function useConectarTelegram(slug: string) {
  const [enlace, setEnlace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const conectar = () => {
    const ventana = window.open('', '_blank')
    start(async () => {
      setError(null)
      try {
        const { url } = await conectarTelegram(slug)
        if (ventana) ventana.location.href = url
        else setEnlace(url)
      } catch (e) {
        ventana?.close()
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }
  return { conectar, enlace, error, setError, pending, start }
}

export function TelegramPanel({ slug, estado, reportes }: { slug: string; estado: EstadoTelegram | null; reportes?: EstadoReportes | null }) {
  const { miAgente: t } = useDict()
  const { conectar, enlace, error, setError, pending, start } = useConectarTelegram(slug)
  const router = useRouter()
  // Al volver de Telegram, la página relee el estado y muestra "Conectado".
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && router.refresh()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [router])
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
          <a href={enlace} target="_blank" rel="noreferrer" className="btn btn-primario whitespace-normal">
            {t.tgAbrir}
          </a>
        ) : (
          <button disabled={pending} onClick={conectar} className="btn btn-primario whitespace-normal">
            {estado.links.length ? t.tgOtro : t.tgConectar}
          </button>
        )}
        {estado.links.length ? (
          <button disabled={pending} onClick={() => correr(() => quitarTelegram(slug))} className="btn btn-secundario btn-chico hover:text-red-600">
            {t.tgDesconectar}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">{t.tgNota}</p>
      <ReportesChats slug={slug} datos={reportes ?? null} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
