'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { medirDominio } from './actions'
import { enviarReporte, registrarLead } from './correo-actions'

const rutaRadar = (dominio: string, medir: boolean) =>
  `/radar?d=${encodeURIComponent(dominio)}${medir ? '&medir=1' : ''}`

/**
 * El formulario del hero: correo + sitio. Guarda el lead (y la cookie que
 * habilita medir) y abre el resultado. `medir` pide una medición nueva aunque
 * el dominio ya tenga puntaje (viene de "Volver a medir").
 */
export function Formulario({
  dominioInicial,
  correoInicial,
  medir = false,
}: {
  dominioInicial: string
  correoInicial: string
  medir?: boolean
}) {
  const { radar: d } = useDict()
  const locale = useLocale()
  const router = useRouter()
  const [email, setEmail] = useState(correoInicial)
  const [sitio, setSitio] = useState(dominioInicial)
  const [consiente, setConsiente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const correo = email.trim()
    const dominio = sitio.trim()
    if (!correo) return setError(d.faltaCorreo)
    if (!dominio) return setError(d.faltaSitio)
    setEnviando(true)
    try {
      const r = await registrarLead({ email: correo, dominio, consiente, locale })
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.push(rutaRadar(dominio, medir))
    } catch {
      setError(d.fallo)
    } finally {
      setEnviando(false)
    }
  }

  const campo =
    'w-full min-w-0 border border-border bg-bg px-4 py-3 font-mono text-sm outline-none focus:border-text'
  return (
    <form onSubmit={enviar} className="w-full max-w-xl space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{d.correo}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={d.correoPlaceholder}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className={campo}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{d.sitio}</span>
        <input
          value={sitio}
          onChange={(e) => setSitio(e.target.value)}
          placeholder={d.placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
          className={campo}
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={consiente}
          onChange={(e) => setConsiente(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>{d.consentimiento}</span>
      </label>
      <button
        disabled={enviando}
        className="btn btn-primario btn-ancho"
      >
        {enviando ? d.enviando : d.boton}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-muted">{d.letraChica}</p>
    </form>
  )
}

/**
 * Corre la medición. Con `auto` arranca sola (el visitante ya dejó su correo).
 * Sin correo, "Volver a medir" lleva al formulario con el dominio puesto.
 */
export function Medir({ dominio, auto = false, conCorreo }: { dominio: string; auto?: boolean; conCorreo: boolean }) {
  const { radar: d } = useDict()
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'corriendo'>(auto ? 'corriendo' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const arrancado = useRef(false)

  async function medir() {
    setEstado('corriendo')
    setError(null)
    const r = await medirDominio(dominio).catch(() => ({ ok: false as const, error: d.fallo }))
    if (!r.ok) {
      setError(r.error ?? d.fallo)
      setEstado('idle')
      return
    }
    // El reporte por correo sale aparte: si falla, el resultado igual se ve.
    void enviarReporte(dominio).catch(() => {})
    // Sin `medir=1` en la URL: recargar la página no vuelve a medir.
    router.replace(rutaRadar(dominio, false))
    router.refresh()
    setEstado('idle')
  }

  useEffect(() => {
    if (!auto || arrancado.current) return
    arrancado.current = true
    void medir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (auto) {
    return (
      <div className="border border-border bg-panel p-5 text-sm">
        {estado === 'corriendo' ? (
          <p className="flex items-center gap-3 text-muted">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-accent" />
            {d.midiendo}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-red-600">{error ?? d.fallo}</p>
            <button onClick={medir} className="btn btn-secundario btn-chico">
              {d.volverAMedir}
            </button>
          </div>
        )}
      </div>
    )
  }
  if (!conCorreo) {
    return (
      <Link href={rutaRadar(dominio, true)} className="btn btn-secundario btn-chico">
        {d.volverAMedir}
      </Link>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={estado === 'corriendo'}
        onClick={medir}
        className="btn btn-secundario btn-chico"
      >
        {estado === 'corriendo' ? d.midiendo : d.volverAMedir}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

/**
 * "Mándame el informe": con correo en la cookie llama a enviarReporte; sin
 * correo (llegó por un enlace compartido) pide el correo, lo guarda como lead
 * y el reporte sale solo desde registrarLead. Confirma en la misma línea.
 */
export function MandarInforme({ dominio, conCorreo }: { dominio: string; conCorreo: boolean }) {
  const { radar: d } = useDict()
  const locale = useLocale()
  const [estado, setEstado] = useState<'idle' | 'pidiendo' | 'enviando' | 'listo'>('idle')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function mandar(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    if (!conCorreo && estado !== 'pidiendo') {
      setEstado('pidiendo')
      return
    }
    setEstado('enviando')
    try {
      if (conCorreo) {
        const ok = await enviarReporte(dominio)
        if (!ok) throw new Error('no enviado')
      } else {
        if (!email.trim()) {
          setError(d.faltaCorreo)
          setEstado('pidiendo')
          return
        }
        const r = await registrarLead({ email: email.trim(), dominio, consiente: false, locale })
        if (!r.ok) {
          setError(r.error)
          setEstado('pidiendo')
          return
        }
      }
      setEstado('listo')
    } catch {
      setError(d.informeFallo)
      setEstado(conCorreo ? 'idle' : 'pidiendo')
    }
  }

  if (estado === 'listo') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
        {d.informeListo}
      </p>
    )
  }

  if (estado === 'pidiendo' || (estado === 'enviando' && !conCorreo)) {
    return (
      <form onSubmit={mandar} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[22rem]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="informe-correo">
            {d.correo}
          </label>
          <input
            id="informe-correo"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder={d.correoPlaceholder}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full min-w-0 border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
          />
          <button type="submit" disabled={estado === 'enviando'} className="btn btn-secundario shrink-0">
            {estado === 'enviando' ? d.enviando : d.informeEnviar}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => void mandar()} disabled={estado === 'enviando'} className="btn btn-secundario">
        {estado === 'enviando' ? d.enviando : d.informe}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
