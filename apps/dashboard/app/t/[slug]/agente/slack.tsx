'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { EstadoSlack } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { conectarSlack, quitarSlack } from './actions'

/** Slack en "Mi agente": agregar la app, ver los canales conectados, desconectar. Mismo patrón que Telegram. */
export function SlackPanel({ slug, estado }: { slug: string; estado: EstadoSlack | null }) {
  const { miAgente: t } = useDict()
  const [enlace, setEnlace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  // Al volver de Slack, la página relee el estado y muestra el canal conectado.
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && router.refresh()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [router])
  if (!estado) return null

  // La pestaña se abre en el gesto del usuario (si no, el navegador la bloquea) y se le pone el enlace cuando llega.
  const agregar = () => {
    const ventana = window.open('', '_blank')
    start(async () => {
      setError(null)
      try {
        const { url } = await conectarSlack(slug)
        if (ventana) ventana.location.href = url
        else setEnlace(url)
      } catch (e) {
        ventana?.close()
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }
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
      <p className="text-sm text-muted">{t.slIntro}</p>
      {!estado.configured ? <p className="text-xs text-muted">{t.slSinApp}</p> : null}
      {estado.links.length ? (
        <ul className="space-y-1">
          {estado.links.map((l) => {
            const equipo = l.teamName ?? l.teamId
            return (
              <li key={`${l.teamId}:${l.channelId}`} className="flex flex-wrap items-center gap-3 text-sm">
                <span>{l.direct ? t.slDirecto(equipo) : t.slCanal(equipo)}</span>
                <a href={l.url} target="_blank" rel="noreferrer" className="btn btn-secundario btn-chico">
                  {t.slVerCanal}
                </a>
                <button
                  disabled={pending}
                  onClick={() => correr(() => quitarSlack(slug, { teamId: l.teamId, channelId: l.channelId }))}
                  className="btn btn-secundario btn-chico hover:text-red-600"
                >
                  {t.slQuitar}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {enlace ? (
          <a href={enlace} target="_blank" rel="noreferrer" className="btn btn-primario">
            {t.slAbrir}
          </a>
        ) : (
          <button disabled={pending} onClick={agregar} className="btn btn-primario">
            {estado.links.length ? t.slOtro : t.slAgregar}
          </button>
        )}
        {estado.links.length > 1 ? (
          <button disabled={pending} onClick={() => correr(() => quitarSlack(slug))} className="btn btn-secundario btn-chico hover:text-red-600">
            {t.slQuitarTodo}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">{t.slNota}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
