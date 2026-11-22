'use client'

import { track } from '@vercel/analytics'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MERCADOS, ciudadLimpia, mercadoDe, paisPorNombre } from '@peaje/shared/mercados'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { enviarReporte, registrarLead } from './correo-actions'
import { MedicionEnVivo } from './en-vivo'
import { leerRecarga, recargarUnaVez } from './recarga'

const rutaRadar = (dominio: string, medir: boolean, pais: string, ciudad = '') =>
  `/radar?d=${encodeURIComponent(dominio)}${pais ? `&p=${pais}${ciudad ? `&c=${encodeURIComponent(ciudad)}` : ''}` : ''}${medir ? '&medir=1' : ''}`

/** Valor del desplegable para "Otro país": ahí se escribe el nombre. */
const OTRO = 'otro'

/** El país de los clientes, para que la medición en vivo y el resultado lo encuentren sin pasarlo por cada enlace. */
export const COOKIE_PAIS = 'peaje_radar_pais'
const COOKIE_CIUDAD = 'peaje_radar_ciudad'

/**
 * Lista desplegable propia (no la del navegador): un botón con el valor y, al
 * abrir, las opciones debajo. Teclado: flechas, Enter, Escape.
 */
function Desplegable({
  etiqueta,
  valor,
  opciones,
  onChange,
  className,
}: {
  etiqueta: string
  valor: string
  opciones: { valor: string; texto: string }[]
  onChange: (v: string) => void
  className: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(0)
  const caja = useRef<HTMLDivElement>(null)
  const actual = Math.max(0, opciones.findIndex((o) => o.valor === valor))
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const elegir = (i: number) => {
    onChange(opciones[i]!.valor)
    setAbierto(false)
  }
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiqueta}
        onClick={() => {
          setFoco(actual)
          setAbierto(!abierto)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierto(false)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!abierto) {
              setFoco(actual)
              setAbierto(true)
            } else setFoco((f) => (f + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length)
          } else if (e.key === 'Enter' && abierto) {
            e.preventDefault()
            elegir(foco)
          }
        }}
        className={`${className} flex items-center justify-between gap-3 text-left font-sans`}
      >
        <span>{opciones[actual]!.texto}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={`shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierto ? (
        <ul role="listbox" aria-label={etiqueta} className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-border bg-panel py-1 shadow-lg">
          {opciones.map((o, i) => (
            <li
              key={o.valor || 'varios'}
              role="option"
              aria-selected={i === actual}
              onMouseEnter={() => setFoco(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(i)
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === foco ? 'bg-panel-2 text-text' : 'text-muted'}`}
            >
              {o.texto}
              {i === actual ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-accent">
                  <path d="M5 12.5 10 17l9-10" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

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
  paisInicial = '',
  ciudadInicial = '',
  medir = false,
}: {
  dominioInicial: string
  correoInicial: string
  /** El país ya elegido o el de la visita, si es uno de la lista; '' es varios países. */
  paisInicial?: string
  ciudadInicial?: string
  medir?: boolean
}) {
  const { radar: d } = useDict()
  const locale = useLocale()
  const router = useRouter()
  const [email, setEmail] = useState(correoInicial)
  const [sitio, setSitio] = useState(dominioInicial)
  // Un país que no está en la lista llega como "Otro" con su nombre escrito.
  const fuera = paisInicial !== '' && !MERCADOS.some((m) => m.codigo === paisInicial)
  const [pais, setPais] = useState(fuera ? OTRO : paisInicial)
  const [otroPais, setOtroPais] = useState(() => {
    const m = fuera ? mercadoDe(paisInicial) : null
    return m ? (locale === 'es' ? m.es : m.en) : ''
  })
  const [ciudad, setCiudad] = useState(ciudadInicial)
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
    // "Otro": el nombre que escribió tiene que ser un país que reconozcamos.
    const codigo = pais === OTRO ? paisPorNombre(otroPais) : pais
    if (codigo === null) return setError(d.paisNoReconocido)
    const lugar = codigo ? (ciudadLimpia(ciudad) ?? '') : ''
    if (codigo && ciudad.trim() && !lugar) return setError(d.ciudadInvalida)
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
    // Evento de Vercel Web Analytics (sin el correo ni el dominio).
    track('radar_email_saved', { from: 'form' })
    // Un año: es el país de sus clientes, no cambia de una visita a otra.
    document.cookie = `${COOKIE_PAIS}=${codigo}; path=/; max-age=31536000; samesite=lax`
    document.cookie = `${COOKIE_CIUDAD}=${encodeURIComponent(lugar)}; path=/; max-age=31536000; samesite=lax`
    router.push(rutaRadar(dominio, medir, codigo, lugar))
    setEnviando(false)
  }

  const campo =
    'w-full min-w-0 border border-border bg-bg px-4 py-3 font-mono text-base outline-none focus:border-text sm:text-sm'
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
      <div className="space-y-1.5">
        <span className="block text-sm font-medium">{d.pais}</span>
        <Desplegable
          etiqueta={d.pais}
          valor={pais}
          onChange={setPais}
          className={campo}
          opciones={[
            ...MERCADOS.map((m) => ({ valor: m.codigo, texto: locale === 'es' ? m.es : m.en })),
            { valor: OTRO, texto: d.paisOtro },
            { valor: '', texto: d.paisVarios },
          ]}
        />
        {pais === OTRO ? (
          <input
            value={otroPais}
            onChange={(e) => setOtroPais(e.target.value)}
            placeholder={d.paisOtroPlaceholder}
            aria-label={d.paisOtro}
            autoComplete="country-name"
            className={`${campo} font-sans`}
          />
        ) : null}
        <span className="block text-xs text-muted">{d.paisNota}</span>
      </div>
      {pais !== '' ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            {d.ciudad} <span className="font-normal text-muted">{d.opcional}</span>
          </span>
          <input
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            placeholder={d.ciudadPlaceholder}
            autoComplete="address-level2"
            className={`${campo} font-sans`}
          />
          <span className="block text-xs text-muted">{d.ciudadNota}</span>
        </label>
      ) : null}
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
    <Link href={rutaRadar(dominio, true, '')} className="btn btn-secundario btn-chico">
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
    track('radar_email_saved', { from: 'report' })
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
            className="w-full min-w-0 border border-border bg-bg px-3 py-2 font-mono text-base outline-none focus:border-text sm:text-sm"
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
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <button type="button" onClick={() => void mandar()} disabled={estado === 'enviando'} className="btn btn-secundario">
        {estado === 'enviando' ? d.enviando : d.informe}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {recargada && !error ? <Recargada texto={d.recargada} /> : null}
    </div>
  )
}
