'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { enviarReporte, registrarLead } from './correo-actions'
import { MedicionEnVivo } from './en-vivo'
import { leerRecarga, recargarUnaVez } from './recarga'

const rutaRadar = (dominio: string, medir: boolean) =>
  `/radar?d=${encodeURIComponent(dominio)}${medir ? '&medir=1' : ''}`

/** El aviso después de una recarga por deploy nuevo (ver recarga.ts). */
function Recargada({ texto }: { texto: string }) {
  return <p className="border-l-2 border-accent pl-3 text-sm">{texto}</p>
}

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
  const [recargada, setRecargada] = useState(false)

  // Volvió de una recarga por deploy nuevo: lo que escribió sigue ahí.
  useEffect(() => {
    const g = leerRecarga('hero')
    if (!g) return
    if (g.email) setEmail(g.email)
    if (g.dominio) setSitio(g.dominio)
    if (g.consiente) setConsiente(true)
    setRecargada(true)
  }, [])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setRecargada(false)
    const correo = email.trim()
    const dominio = sitio.trim()
    if (!correo) return setError(d.faltaCorreo)
    if (!dominio) return setError(d.faltaSitio)
    setEnviando(true)
    let r: Awaited<ReturnType<typeof registrarLead>>
    try {
      r = await registrarLead({ email: correo, dominio, consiente, locale })
    } catch (err) {
      // La acción lanzó (no devolvió ok: false): casi siempre un deploy nuevo. Se recarga una vez.
      console.error('[radar] registrarLead lanzó', err)
      if (recargarUnaVez('hero', { email: correo, dominio, consiente })) return
      setError(d.fallo)
      setEnviando(false)
      return
    }
    if (!r.ok) {
      setError(r.error)
      setEnviando(false)
      return
    }
    router.push(rutaRadar(dominio, medir))
    setEnviando(false)
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
      {recargada && !error ? <Recargada texto={d.recargada} /> : null}
      <p className="text-xs text-muted">{d.letraChica}</p>
    </form>
  )
}

/**
 * Corre la medición. Con `auto` arranca sola (el visitante ya dejó su correo)
 * y muestra la medición en vivo (en-vivo.tsx). Sin `auto`, "Volver a medir"
 * abre la misma pantalla con `medir=1`: con correo mide en vivo, sin correo
 * lleva al formulario con el dominio puesto (la página decide, como siempre).
 */
export function Medir({ dominio, auto = false }: { dominio: string; auto?: boolean; conCorreo: boolean }) {
  const { radar: d } = useDict()
  if (auto) return <MedicionEnVivo dominio={dominio} />
  return (
    <Link href={rutaRadar(dominio, true)} className="btn btn-secundario btn-chico">
      {d.volverAMedir}
    </Link>
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
  const [recargada, setRecargada] = useState(false)

  // Volvió de una recarga por deploy nuevo: se abre igual que antes, con el correo puesto.
  useEffect(() => {
    const g = leerRecarga('informe')
    if (!g) return
    if (g.email) setEmail(g.email)
    if (!conCorreo) setEstado('pidiendo')
    setRecargada(true)
  }, [conCorreo])

  /** La acción lanzó (no devolvió un resultado): casi siempre un deploy nuevo. true si recargó. */
  function trasExcepcion(err: unknown): boolean {
    console.error('[radar] la acción del informe lanzó', err)
    return recargarUnaVez('informe', { email: email.trim() })
  }

  async function mandar(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    setRecargada(false)
    if (!conCorreo && estado !== 'pidiendo') {
      setEstado('pidiendo')
      return
    }
    setEstado('enviando')
    if (conCorreo) {
      let ok: boolean
      try {
        ok = await enviarReporte(dominio)
      } catch (err) {
        if (trasExcepcion(err)) return
        ok = false
      }
      if (!ok) {
        setError(d.informeFallo)
        setEstado('idle')
        return
      }
      setEstado('listo')
      return
    }
    if (!email.trim()) {
      setError(d.faltaCorreo)
      setEstado('pidiendo')
      return
    }
    let r: Awaited<ReturnType<typeof registrarLead>>
    try {
      r = await registrarLead({ email: email.trim(), dominio, consiente: false, locale })
    } catch (err) {
      if (trasExcepcion(err)) return
      setError(d.informeFallo)
      setEstado('pidiendo')
      return
    }
    if (!r.ok) {
      setError(r.error)
      setEstado('pidiendo')
      return
    }
    setEstado('listo')
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
        {recargada && !error ? <Recargada texto={d.recargada} /> : null}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={() => void mandar()} disabled={estado === 'enviando'} className="btn btn-secundario">
        {estado === 'enviando' ? d.enviando : d.informe}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {recargada && !error ? <Recargada texto={d.recargada} /> : null}
    </div>
  )
}
