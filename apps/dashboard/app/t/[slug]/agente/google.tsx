'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { EstadoGoogle } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { conectarGoogle, elegirPropiedadGoogle, quitarGoogle } from './actions'

/** Cómo terminó la conexión: el gateway vuelve a Integraciones con ?google=<resultado> (apps/gateway/src/google/router.ts). */
type Resultado = 'connected' | 'permission' | 'cancelled' | 'failed' | 'expired' | 'pro'
const RESULTADOS: string[] = ['connected', 'permission', 'cancelled', 'failed', 'expired', 'pro']

/** 'sc-domain:ejemplo.com' → 'ejemplo.com'; 'https://ejemplo.com/' → 'https://ejemplo.com'. */
export const sitioLegible = (propiedad: string) => propiedad.replace(/^sc-domain:/, '').replace(/\/$/, '')

/** Google Search Console en Integraciones: conectar la cuenta, ver qué sitio lee, cambiarlo, desconectar. */
export function GooglePanel({ slug, estado }: { slug: string; estado: EstadoGoogle | null }) {
  const { miAgente: t } = useDict()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  // Al volver de Google: se muestra el resultado una vez y se limpia de la URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const r = url.searchParams.get('google')
    if (!r) return
    if (RESULTADOS.includes(r)) setResultado(r as Resultado)
    url.searchParams.delete('google')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [])
  if (!estado?.configured) return null
  const con = estado.connection

  // En la misma pestaña: Google vuelve directo acá.
  const conectar = () =>
    start(async () => {
      setError(null)
      setResultado(null)
      try {
        const { url } = await conectarGoogle(slug)
        window.location.assign(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  const correr = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null)
      setResultado(null)
      try {
        await fn()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

  const mensaje = !resultado
    ? null
    : {
        // Sin el sitio en la cuenta no hay "listo": abajo sale el aviso para elegir otro.
        connected: con?.property ? t.gsListo(sitioLegible(con.property)) : null,
        permission: t.gsFaltaPermiso,
        cancelled: t.gsCancelada,
        failed: t.gsNoConecto,
        expired: t.gsVencio,
        pro: null,
      }[resultado]

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
    <div className="space-y-4 border border-border p-4">
      {mensaje ? (
        <p role="status" className={`border-l-2 bg-panel-2 px-3 py-2 text-sm ${resultado === 'connected' ? 'border-l-accent' : 'border-l-red-600'}`}>
          {mensaje}
        </p>
      ) : null}
      <p className="text-sm text-muted">{t.gsIntro}</p>
      {con ? (
        <div className="space-y-3">
          {con.email ? <p className="text-sm">{t.gsCuenta(con.email)}</p> : null}
          {con.properties.length ? (
            <label className="block space-y-1 text-sm">
              <span className="text-muted">{t.gsSitio}</span>
              <select
                className="block w-full max-w-md border border-border bg-panel px-3 py-2 text-sm"
                value={con.property ?? ''}
                disabled={pending}
                onChange={(e) => e.target.value && correr(() => elegirPropiedadGoogle(slug, e.target.value))}
              >
                {!con.property ? <option value="">—</option> : null}
                {con.properties.map((p) => (
                  <option key={p.siteUrl} value={p.siteUrl}>
                    {sitioLegible(p.siteUrl)}
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
      {!con || con.lastError?.startsWith('reconnect') ? <p className="text-sm">{t.gsMarcar}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} onClick={conectar} className={con ? 'btn btn-secundario btn-chico' : 'btn btn-primario'}>
          {con ? t.gsOtraCuenta : t.gsConectar}
        </button>
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
