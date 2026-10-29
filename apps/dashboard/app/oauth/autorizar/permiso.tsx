'use client'

import { useState, useTransition } from 'react'
import { LogoMark } from '@/app/components/logo'
import { Logo, marcaDe } from '@/components/logos'
import { useDict } from '@/lib/i18n/client'
import { permitirConexion, rechazarConexion } from './actions'

/**
 * El permiso en sí: qué herramienta pide, qué va a poder hacer, a qué negocio
 * y adónde vuelve la persona. El nombre lo eligió la herramienta al
 * registrarse, por eso también se muestra el destino real de la vuelta.
 */
export function Permiso({
  pedido,
  herramienta,
  destino,
  negocios,
}: {
  pedido: string
  herramienta: string
  destino: string
  negocios: { slug: string; nombre: string; sitio: string }[]
}) {
  const { oauth: t } = useDict()
  const [slug, setSlug] = useState(negocios[0]!.slug)
  const [error, setError] = useState<string | null>(null)
  const [yendo, setYendo] = useState(false)
  const [pending, start] = useTransition()
  const marca = marcaDe(herramienta)

  const responder = (accion: () => Promise<{ url: string } | { error: string }>) =>
    start(async () => {
      setError(null)
      const r = await accion()
      if ('url' in r) {
        setYendo(true)
        window.location.assign(r.url)
        return
      }
      setError(r.error === 'negocio' ? t.problemaNegocio : t.problemaCliente)
    })

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#17161a]">
          <LogoMark className="h-6 w-6 text-accent" />
        </span>
        <span aria-hidden className="text-muted">
          ⇄
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-panel">
          {marca ? <Logo marca={marca} className="h-6 w-6" /> : <span className="font-mono text-sm">{herramienta.slice(0, 1).toUpperCase()}</span>}
        </span>
      </div>

      <div className="space-y-2">
        <span className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.eyebrow}</span>
        <h1 className="text-xl font-bold tracking-tight">{t.titulo(herramienta)}</h1>
      </div>

      <div className="space-y-2 text-sm">
        <p>{t.puede}</p>
        <ul className="space-y-1">
          {t.poderes.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-accent">›</span>
              {p}
            </li>
          ))}
        </ul>
        <p className="text-muted">{t.noPuede}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.negocio}</legend>
        {negocios.map((n) => (
          <label key={n.slug} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${slug === n.slug ? 'border-accent' : 'border-border'}`}>
            <input type="radio" name="negocio" value={n.slug} checked={slug === n.slug} onChange={() => setSlug(n.slug)} className="accent-accent" />
            <span className="min-w-0">
              <span className="block font-medium">{n.nombre}</span>
              <span className="block truncate text-xs text-muted">{n.sitio}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending || yendo} className="btn btn-primario" onClick={() => responder(() => permitirConexion(pedido, slug))}>
          {yendo ? t.yendo : t.permitir}
        </button>
        <button type="button" disabled={pending || yendo} className="btn btn-secundario" onClick={() => responder(() => rechazarConexion(pedido))}>
          {t.cancelar}
        </button>
      </div>

      <p className="text-xs text-muted">
        {t.vuelve(destino)} {t.desconectar}
      </p>
    </div>
  )
}
