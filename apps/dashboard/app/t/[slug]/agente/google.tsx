'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { EstadoGoogle } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { conectarGoogle, elegirPropiedadGoogle, quitarGoogle } from './actions'

/** Google Search Console en Integraciones: conectar la cuenta, ver qué sitio lee, cambiarlo, desconectar. Mismo patrón que Slack. */
export function GooglePanel({ slug, estado }: { slug: string; estado: EstadoGoogle | null }) {
  const { miAgente: t } = useDict()
  const [enlace, setEnlace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  // Al volver de Google, la página relee el estado y muestra la cuenta conectada.
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && router.refresh()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [router])
  if (!estado?.configured) return null
  const con = estado.connection

  // La pestaña se abre en el gesto del usuario (si no, el navegador la bloquea) y se le pone el enlace cuando llega.
  const conectar = () => {
    const ventana = window.open('', '_blank')
    start(async () => {
      setError(null)
      try {
        const { url } = await conectarGoogle(slug)
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
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

  const aviso = !con
    ? null
    : con.lastError?.startsWith('reconnect')
      ? t.gsReconectar
      : con.lastError?.startsWith('no-property')
        ? t.gsSinAcceso
        : con.lastError
          ? t.gsFallo
          : !con.property
            ? t.gsSinSitio
            : null
  const dias = con?.lastUsedAt ? Math.floor((Date.now() - Date.parse(con.lastUsedAt)) / 86_400_000) : null

  return (
    <div className="space-y-3 border border-border p-4">
      <p className="text-sm text-muted">{t.gsIntro}</p>
      {con ? (
        <div className="space-y-3">
          {con.email ? <p className="text-sm">{t.gsCuenta(con.email)}</p> : null}
          {con.properties.length ? (
            <label className="block space-y-1 text-sm">
              <span className="text-muted">{t.gsSitio}</span>
              <select
                className="block w-full max-w-md border border-border bg-panel px-3 py-2 font-mono text-xs"
                value={con.property ?? ''}
                disabled={pending}
                onChange={(e) => e.target.value && correr(() => elegirPropiedadGoogle(slug, e.target.value))}
              >
                {!con.property ? <option value="">—</option> : null}
                {con.properties.map((p) => (
                  <option key={p.siteUrl} value={p.siteUrl}>
                    {p.siteUrl}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {aviso ? <p className="text-sm text-red-600">{aviso}</p> : null}
          {!aviso && dias !== null ? <p className="text-xs text-muted">{t.gsUltima(dias)}</p> : null}
          {!aviso && con.property ? <p className="text-xs text-muted">{t.gsPrueba}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {enlace ? (
          <a href={enlace} target="_blank" rel="noreferrer" className="btn btn-primario">
            {t.gsAbrir}
          </a>
        ) : (
          <button disabled={pending} onClick={conectar} className={con ? 'btn btn-secundario btn-chico' : 'btn btn-primario'}>
            {con ? t.gsOtraCuenta : t.gsConectar}
          </button>
        )}
        {con ? (
          <button disabled={pending} onClick={() => correr(() => quitarGoogle(slug))} className="btn btn-secundario btn-chico hover:text-red-600">
            {t.gsQuitar}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
