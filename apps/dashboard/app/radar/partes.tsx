'use client'

import { track } from '@vercel/analytics'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MERCADOS, ciudadLimpia, mercadoDe, paisPorNombre } from '@peaje/shared/mercados'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { pedirCitas } from './citas-cliente'
import { MOTORES_POR_DEFECTO, nombreMotor } from './citas-tipos'
import { enviarReporte, registrarLead } from './correo-actions'
import { MedicionEnVivo } from './en-vivo'
import { leerRecarga, recargarUnaVez } from './recarga'
import { Seccion } from './seccion'

const rutaRadar = (dominio: string, medir: boolean, pais: string, ciudad = '') =>
  `/radar?d=${encodeURIComponent(dominio)}${pais ? `&p=${pais}${ciudad ? `&c=${encodeURIComponent(ciudad)}` : ''}` : ''}${medir ? '&medir=1' : ''}`

/** Valor del desplegable para "Otro país": ahí se escribe el nombre. */
const OTRO = 'otro'
/** "En varios países": se mide sin país. Vacío es que todavía no eligió. */
const VARIOS = 'varios'

/** El país de los clientes, para que la medición en vivo y el resultado lo encuentren sin pasarlo por cada enlace. */
export const COOKIE_PAIS = 'peaje_radar_pais'
const COOKIE_CIUDAD = 'peaje_radar_ciudad'

/**
 * Lista desplegable propia (no la del navegador): un botón con el valor y, al
 * abrir, las opciones debajo. Teclado: flechas, Enter, Escape.
 */
function Desplegable({
  etiqueta,
  vacio,
  valor,
  opciones,
  onChange,
  className,
}: {
  etiqueta: string
  /** Lo que se lee mientras no hay nada elegido. */
  vacio: string
  valor: string
  opciones: { valor: string; texto: string }[]
  onChange: (v: string) => void
  className: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(0)
  const caja = useRef<HTMLDivElement>(null)
  // Lo que va tecleando para saltar a un país ("c", "co"...): se borra si para de escribir.
  const tecleado = useRef({ texto: '', reloj: 0 })
  const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  // La opción enfocada siempre a la vista dentro de la lista.
  useEffect(() => {
    if (abierto) caja.current?.querySelector(`[data-indice="${foco}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [abierto, foco])
  // -1: nada elegido todavía; se muestra el texto de invitación.
  const actual = opciones.findIndex((o) => o.valor === valor)
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
          setFoco(Math.max(0, actual))
          setAbierto(!abierto)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierto(false)
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!abierto) {
              setFoco(Math.max(0, actual))
              setAbierto(true)
            } else setFoco((f) => (f + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length)
          } else if (e.key === 'Enter' && abierto) {
            e.preventDefault()
            elegir(foco)
          } else if (e.key.length === 1 && /\p{L}/u.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
            // Teclear letras lleva al primer país que empieza así: "c" a Chile, "co" a Colombia.
            // La misma letra repetida pasa al siguiente que empieza con ella.
            e.preventDefault()
            const t = tecleado.current
            window.clearTimeout(t.reloj)
            const letra = sinTildes(e.key)
            const repetida = t.texto !== '' && [...t.texto].every((c) => c === letra)
            t.texto = repetida ? t.texto : t.texto + letra
            t.reloj = window.setTimeout(() => (t.texto = ''), 700)
            const empieza = (i: number) => sinTildes(opciones[i]!.texto).startsWith(repetida ? letra : t.texto)
            const desde = abierto ? foco : Math.max(0, actual)
            const orden = opciones.map((_, i) => (desde + (repetida ? 1 : 0) + i) % opciones.length)
            const hallado = orden.find(empieza)
            if (hallado !== undefined) {
              setFoco(hallado)
              setAbierto(true)
            }
          }
        }}
        className={`${className} flex items-center justify-between gap-3 text-left font-sans`}
      >
        <span className={actual < 0 ? 'text-faint' : ''}>{actual < 0 ? vacio : opciones[actual]!.texto}</span>
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
              data-indice={i}
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
  const fuera = paisInicial !== '' && paisInicial !== VARIOS && !MERCADOS.some((m) => m.codigo === paisInicial)
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
    const codigo = pais === OTRO ? paisPorNombre(otroPais) : pais === VARIOS ? '' : pais
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

  // Hay un país elegido (de la lista u otro): ahí tiene sentido pedir la ciudad.
  const conPais = pais !== '' && pais !== VARIOS
  const campo =
    'w-full min-w-0 border border-border bg-bg px-3.5 py-2.5 font-mono text-base outline-none focus:border-text sm:text-sm'
  return (
    <form onSubmit={enviar} className="w-full space-y-3.5">
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
      {/* País y ciudad lado a lado: el formulario entero cabe sin bajar la página. */}
      <div className="grid items-start gap-3.5 sm:grid-cols-[3fr_2fr]">
      <div className={`space-y-1.5 ${conPais ? '' : 'sm:col-span-2'}`}>
        <span className="block text-sm font-medium">{d.pais}</span>
        <Desplegable
          etiqueta={d.pais}
          vacio={d.paisVacio}
          valor={pais}
          onChange={setPais}
          className={campo}
          opciones={[
            // En orden alfabético en el idioma de la página: ningún país va primero por ser el nuestro.
            ...MERCADOS.map((m) => ({ valor: m.codigo, texto: locale === 'es' ? m.es : m.en })).sort((a, b) => a.texto.localeCompare(b.texto, locale)),
            { valor: OTRO, texto: d.paisOtro },
            { valor: VARIOS, texto: d.paisVarios },
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
      {conPais ? (
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">
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
      </div>
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

/** Lo más que tardan las citas: la barra de espera llega al final ahí. */
const CITAS_MAX_S = 70
/** El mismo tope que citas-vista.tsx: si el gateway pide esperar menos que esto, la sección vuelve a preguntar. */
const CITAS_REINTENTO_MAX_S = 45
/** Las preguntas que hace el gateway: las tarjetas de espera tienen la misma forma que el resultado. */
const CITAS_PREGUNTAS = 3

/** Los mismos colores por motor que citas-vista.tsx, para que la espera y el resultado se vean iguales. */
const ACENTO_MOTOR: Record<string, string> = {
  chatgpt: 'var(--text)',
  perplexity: 'var(--accent)',
  claude: 'var(--lila)',
  gemini: 'var(--verde)',
}
const COLS_MOTORES: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

function PuntoMotor({ id }: { id: string }) {
  return <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: ACENTO_MOTOR[id] ?? 'var(--faint)' }} />
}

/** Un hueco gris donde va a ir un dato. Late suave salvo con prefers-reduced-motion. */
function Hueco({ className, retraso = 0 }: { className: string; retraso?: number }) {
  return <span className={`block bg-border/70 motion-safe:animate-pulse ${className}`} style={retraso ? { animationDelay: `${retraso}ms` } : undefined} />
}

/**
 * La sección de citas mientras llega la respuesta (hasta ~70 s). Dice qué
 * estamos haciendo, cuánto lleva y cuánto tarda; debajo, los motores y las
 * preguntas con la misma forma que el resultado, para que nada salte.
 */
function EsperaCitas({ n, segundos, mientras, pais, ciudad }: { n: string; segundos: number; mientras: 'puntaje' | 'midiendo'; pais: string; ciudad: string }) {
  const { radar } = useDict()
  const t = radar.espera
  const c = radar.citas
  const locale = useLocale()
  const mercado = mercadoDe(pais)
  const nombrePais = mercado ? (locale === 'es' ? mercado.es : mercado.en) : ''
  const motores = MOTORES_POR_DEFECTO
  const lento = segundos > CITAS_MAX_S
  const avance = Math.min(1, segundos / CITAS_MAX_S)
  return (
    <Seccion n={n} titulo={c.tituloNeutro}>
      {mercado ? <p className="text-sm text-muted">{c.mercadoDesde(ciudad ? `${ciudad}, ${nombrePais}` : nombrePais)}</p> : null}

      <div className="space-y-3 border border-border bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <p role="status" className="flex items-start gap-3 font-medium leading-6">
            <span aria-hidden className="radar-latido mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
            {t.titulo(motores.map(nombreMotor))}
          </p>
          <span aria-hidden className="shrink-0 font-mono text-sm leading-6 tabular-nums text-muted">
            {radar.vivo.segundos(segundos)}
          </span>
        </div>
        <p className="max-w-2xl text-sm text-muted">{t.que}</p>
        <div
          role="progressbar"
          aria-label={t.progreso}
          aria-valuemin={0}
          aria-valuemax={CITAS_MAX_S}
          aria-valuenow={Math.min(segundos, CITAS_MAX_S)}
          className="h-1 overflow-hidden rounded-full bg-border/70"
        >
          <div
            className={`h-full origin-left rounded-full bg-accent motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-linear ${lento ? 'motion-safe:animate-pulse' : ''}`}
            style={{ transform: `scaleX(${avance})` }}
          />
        </div>
        <p aria-live="polite" className="text-xs text-muted">
          {lento ? t.lento : `${t.tarda} ${mientras === 'puntaje' ? t.mientrasPuntaje : t.mientrasMidiendo}`}
        </p>
      </div>

      {/* Un tablero por motor, como en el resultado: el número y la barra de preguntas todavía vacíos. */}
      <ul aria-hidden className={`grid grid-cols-1 gap-3 ${COLS_MOTORES[Math.min(motores.length, 4)] ?? COLS_MOTORES[4]}`}>
        {motores.map((id, i) => (
          <li key={id} className="space-y-4 border border-border bg-panel p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <PuntoMotor id={id} />
              {nombreMotor(id)}
            </p>
            <div>
              <Hueco className="h-12 w-20" retraso={i * 150} />
              <Hueco className="mt-3 h-3.5 w-44 max-w-full" retraso={i * 150} />
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: CITAS_PREGUNTAS }, (_, k) => (
                <span key={k} className="h-1.5 flex-1 rounded-full bg-border" />
              ))}
            </div>
            <p className="hidden text-xs leading-4 sm:block sm:min-h-8" />
          </li>
        ))}
      </ul>

      {/* Las preguntas: el número de cada una a la vista y, por motor, el hueco del resultado y de a quién citó. */}
      <ol aria-hidden className="space-y-3">
        {Array.from({ length: CITAS_PREGUNTAS }, (_, i) => (
          <li key={i} className="border border-border">
            <div className="space-y-1 px-5 pt-5 pb-4">
              <p className="text-xs text-muted">{c.preguntaN(i + 1, CITAS_PREGUNTAS)}</p>
              <Hueco className="my-1 h-5 w-4/5" retraso={i * 200} />
            </div>
            <div className="hidden grid-cols-[9rem_13rem_1fr] gap-4 border-t border-border/60 px-5 py-2 text-xs text-faint sm:grid">
              <span>{c.colAsistente}</span>
              <span>{c.colResultado}</span>
              <span>{c.colFuentes}</span>
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {motores.map((id) => (
                <li key={id} className="grid grid-cols-1 gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[9rem_13rem_1fr] sm:items-center">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <PuntoMotor id={id} />
                    {nombreMotor(id)}
                  </span>
                  <Hueco className="h-3.5 w-24" retraso={i * 200} />
                  <Hueco className="h-3 w-3/5" retraso={i * 200} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Seccion>
  )
}

/**
 * Envuelve la sección de citas (citas-vista.tsx): mientras no hay respuesta
 * muestra EsperaCitas y deja la sección montada pero escondida, así pide lo
 * suyo desde ya. Las dos comparten el mismo pedido (citas-cliente.ts), sin
 * pedir dos veces. `mientras`: qué dice la espera que pasa más abajo.
 */
export function CitasConEspera({
  n,
  dominio,
  pais,
  ciudad,
  mientras,
  children,
}: {
  n: string
  dominio: string
  pais: string
  ciudad: string
  mientras: 'puntaje' | 'midiendo'
  children: React.ReactNode
}) {
  const locale = useLocale()
  // La misma clave que usa la sección: la ciudad solo cuenta con un país de la lista.
  const lugar = mercadoDe(pais) ? ciudad : ''
  const [listo, setListo] = useState(false)
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    let vivo = true
    setListo(false)
    const pedido = pedirCitas(dominio, locale, { pais, ciudad: lugar })
    const tic = () => setSegundos(Math.max(0, Math.floor((Date.now() - pedido.desde) / 1000)))
    tic()
    const reloj = setInterval(tic, 1000)
    void (async () => {
      const r = await pedido.promesa
      const espera = 'error' in r && r.error === 'unavailable' ? (r.retryAfterSeconds ?? 0) : 0
      if (vivo && espera > 0 && espera <= CITAS_REINTENTO_MAX_S) {
        // La sección vuelve a preguntar pasado ese tiempo; un momento después se toma ese mismo pedido.
        await new Promise((ok) => setTimeout(ok, espera * 1000 + 300))
        if (!vivo) return
        await pedirCitas(dominio, locale, { pais, ciudad: lugar }).promesa
      }
      if (!vivo) return
      clearInterval(reloj)
      setListo(true)
    })()
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [dominio, locale, pais, lugar])

  return (
    <>
      {listo ? null : <EsperaCitas n={n} segundos={segundos} mientras={mientras} pais={pais} ciudad={lugar} />}
      <div hidden={!listo}>{children}</div>
    </>
  )
}
