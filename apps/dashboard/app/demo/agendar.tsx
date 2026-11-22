'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CAL_EMBED_JS, type Agendador } from '@/lib/demo'
import { pedirDemo } from './actions'

/**
 * La tarjeta para agendar la demo, en dos pasos como la de revnu.com/book:
 * primero sitio, correo y qué quiere ver; después el calendario en la misma
 * tarjeta. Al continuar guarda sitio y correo como lead (pedirDemo, source
 * 'demo') y no manda correos: con Cal.com sigue el calendario, prellenado;
 * sin agendador, "Listo, lo tenemos" y San escribe a mano. Si no se pudo
 * guardar, queda el mailto. Con otro proveedor (Google Calendar, Calendly)
 * no hay nada que prellenar: un botón que lo abre.
 */

export type TextosAgendar = {
  pasoTitulo: string
  pasoTexto: string
  pasoTextoCorreo: string
  sitio: string
  sitioPlaceholder: string
  correo: string
  correoPlaceholder: string
  objetivo: string
  opcional: string
  objetivoPlaceholder: string
  faltaSitio: string
  faltaCorreo: string
  continuar: string
  escribir: string
  letraCal: string
  letraCorreo: string
  privacidad: string
  calTitulo: string
  calVolver: string
  calZona: string
  calEscribenos: string
  calCargando: string
  calFallo: string
  calAbrir: string
  enlaceTitulo: string
  enlaceTexto: string
  enlaceBoton: string
  correoListoTitulo: string
  correoListoTexto: string
  correoListoFin: string
  correoFallo: string
  correoAsunto: string
  correoSitio: string
  correoObjetivo: string
}

const CAMPO =
  'w-full min-w-0 rounded-md border border-border bg-bg px-3.5 py-2.5 text-base outline-none transition-colors focus:border-text sm:text-sm'
const TARJETA = 'rounded-xl border border-border bg-panel p-5 sm:p-7'
const ENLACE = 'text-text underline underline-offset-2 hover:text-accent'
const NAMESPACE = 'peaje-demo'
/** Si el calendario no aparece en este tiempo, se ofrece abrirlo en otra pestaña. */
const ESPERA_CAL_MS = 15_000

/** "https://www.Tusitio.com/precios" → "tusitio.com". Null si no parece un dominio. */
function dominio(entrada: string): string | null {
  const texto = entrada.trim().toLowerCase()
  if (!texto || texto.length > 200) return null
  try {
    const host = new URL(/^https?:\/\//.test(texto) ? texto : `https://${texto}`).hostname.replace(/^www\./, '')
    return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null
  } catch {
    return null
  }
}

function Flecha() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Externo() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Datos = { sitio: string; correo: string; objetivo: string }

export function Agendar({
  modo,
  t,
  contacto,
  locale,
}: {
  modo: Agendador
  t: TextosAgendar
  contacto: string
  locale: 'es' | 'en'
}) {
  const [paso, setPaso] = useState<'datos' | 'listo'>('datos')
  const [guardado, setGuardado] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [datos, setDatos] = useState<Datos>({ sitio: '', correo: '', objetivo: '' })
  const [error, setError] = useState<string | null>(null)
  const ids = useId()
  const tituloRef = useRef<HTMLHeadingElement>(null)

  // Al cambiar de paso, el foco va al título del paso nuevo (lectores de pantalla y teclado).
  useEffect(() => {
    if (paso === 'listo') tituloRef.current?.focus()
  }, [paso])

  const mailto = (d: Datos) => {
    const cuerpo = [`${t.correoSitio}: ${d.sitio}`, d.objetivo ? `${t.correoObjetivo}: ${d.objetivo}` : ''].filter(Boolean).join('\n')
    return `mailto:${contacto}?subject=${encodeURIComponent(t.correoAsunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  // Otro proveedor: no hay qué prellenar, así que no se piden datos.
  if (modo.tipo === 'enlace') {
    return (
      <section aria-labelledby={`${ids}-t`} className={TARJETA}>
        <h2 id={`${ids}-t`} className="text-xl font-semibold">
          {t.enlaceTitulo}
        </h2>
        <p className="mt-2 text-[15px] text-muted">{t.enlaceTexto}</p>
        <a href={modo.url} target="_blank" rel="noopener noreferrer" className="btn btn-primario btn-ancho mt-6 gap-2">
          {t.enlaceBoton}
          <Externo />
        </a>
        <p className="mt-4 text-sm text-muted">
          {t.calZona}{' '}
          <a href={`mailto:${contacto}?subject=${encodeURIComponent(t.correoAsunto)}`} className={ENLACE}>
            {t.calEscribenos}
          </a>
          .
        </p>
      </section>
    )
  }

  const conCorreo = modo.tipo === 'correo'

  async function continuar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return
    const form = new FormData(e.currentTarget)
    const sitio = dominio(String(form.get('sitio') ?? ''))
    const correo = String(form.get('correo') ?? '').trim()
    const objetivo = String(form.get('objetivo') ?? '').trim().slice(0, 500)
    if (!sitio) return setError(t.faltaSitio)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return setError(t.faltaCorreo)
    setError(null)
    const nuevos = { sitio, correo, objetivo }
    setDatos(nuevos)
    setEnviando(true)
    // Con calendario, guardar el lead no frena la reserva: si falla, igual se muestra Cal.com.
    const r = await pedirDemo({ sitio, correo, locale }).catch(() => ({ ok: false }))
    setEnviando(false)
    setGuardado(r.ok)
    setPaso('listo')
  }

  if (paso === 'datos') {
    return (
      <section aria-labelledby={`${ids}-t`} className={TARJETA}>
        <h2 id={`${ids}-t`} className="text-xl font-semibold">
          {t.pasoTitulo}
        </h2>
        <p className="mt-1.5 text-[15px] text-muted">{conCorreo ? t.pasoTextoCorreo : t.pasoTexto}</p>
        <form onSubmit={continuar} noValidate className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t.sitio}</span>
            <input
              name="sitio"
              defaultValue={datos.sitio}
              placeholder={t.sitioPlaceholder}
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              required
              className={CAMPO}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t.correo}</span>
            <input
              name="correo"
              type="email"
              defaultValue={datos.correo}
              placeholder={t.correoPlaceholder}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={CAMPO}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              {t.objetivo} <span className="font-normal text-muted">{t.opcional}</span>
            </span>
            <textarea
              name="objetivo"
              defaultValue={datos.objetivo}
              placeholder={t.objetivoPlaceholder}
              rows={3}
              maxLength={500}
              className={`${CAMPO} resize-y`}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={enviando} aria-busy={enviando} className="btn btn-primario btn-ancho gap-2">
            {conCorreo ? t.escribir : t.continuar}
            <Flecha />
          </button>
          <p className="text-xs leading-relaxed text-muted">
            {conCorreo ? t.letraCorreo : t.letraCal}{' '}
            <a href="/privacy" className={ENLACE}>
              {t.privacidad}
            </a>
          </p>
        </form>
      </section>
    )
  }

  if (conCorreo) {
    return (
      <section aria-labelledby={`${ids}-t`} className={TARJETA}>
        {guardado ? (
          <>
            <h2 id={`${ids}-t`} ref={tituloRef} tabIndex={-1} className="text-xl font-semibold outline-none">
              {t.correoListoTitulo}
            </h2>
            <p className="mt-2 text-[15px] text-muted">
              {t.correoListoTexto} <span className="break-all text-text">{datos.correo}</span> {t.correoListoFin}
            </p>
          </>
        ) : (
          <p ref={tituloRef as unknown as React.RefObject<HTMLParagraphElement>} tabIndex={-1} role="alert" className="text-[15px] text-muted outline-none">
            {t.correoFallo}{' '}
            <a href={mailto(datos)} className={`${ENLACE} break-all`}>
              {contacto}
            </a>
            .
          </p>
        )}
        <button type="button" onClick={() => setPaso('datos')} className="accion-texto mt-5">
          {t.calVolver}
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby={`${ids}-t`} className={`${TARJETA} px-3 sm:px-7`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2 sm:px-0">
        <h2 id={`${ids}-t`} ref={tituloRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t.calTitulo}
        </h2>
        <button type="button" onClick={() => setPaso('datos')} className="accion-texto">
          {t.calVolver}
        </button>
      </div>
      <CalEnLinea modo={modo} datos={datos} t={t} />
      <p className="mt-4 px-2 text-sm text-muted sm:px-0">
        {t.calZona}{' '}
        <a href={mailto(datos)} className={ENLACE}>
          {t.calEscribenos}
        </a>
        .
      </p>
    </section>
  )
}

type CalApi = ((...args: unknown[]) => void) & {
  loaded?: boolean
  ns: Record<string, (...args: unknown[]) => void>
  q?: unknown[]
}

/**
 * El snippet oficial de Cal.com (cal.com/docs, "inline embed"), reescrito
 * para correr desde el bundle: deja una cola en window.Cal y agrega embed.js
 * (app.cal.com, permitido en la CSP solo si el agendador es de Cal).
 */
function calCargado(): CalApi {
  const w = window as unknown as { Cal?: CalApi }
  if (w.Cal) return w.Cal
  const push = (api: { q: unknown[] }, args: unknown) => api.q.push(args)
  const cal = function (this: unknown, ...args: unknown[]) {
    const c = w.Cal as CalApi & { q: unknown[] }
    if (!c.loaded) {
      c.ns = {}
      c.q = c.q || []
      const script = document.createElement('script')
      script.src = CAL_EMBED_JS
      script.async = true
      document.head.appendChild(script)
      c.loaded = true
    }
    if (args[0] === 'init') {
      const api = function (...a: unknown[]) {
        push(api as unknown as { q: unknown[] }, a)
      } as unknown as ((...a: unknown[]) => void) & { q: unknown[] }
      api.q = api.q || []
      const namespace = args[1]
      if (typeof namespace === 'string') {
        c.ns[namespace] = c.ns[namespace] || api
        push(c.ns[namespace] as unknown as { q: unknown[] }, args)
        push(c, ['initNamespace', namespace])
      } else push(c, args)
      return
    }
    push(c, args)
  } as unknown as CalApi
  w.Cal = cal
  return cal
}

function CalEnLinea({ modo, datos, t }: { modo: Extract<Agendador, { tipo: 'cal' }>; datos: Datos; t: TextosAgendar }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'fallo'>('cargando')
  const id = `${NAMESPACE}-cal`
  const notas = [`${t.correoSitio}: ${datos.sitio}`, datos.objetivo].filter(Boolean).join('\n')

  // Mismo prellenado para el enlace de respaldo: las páginas de reserva de Cal leen email y notes de la URL.
  const respaldo = (() => {
    const url = new URL(`${modo.calOrigin}/${modo.calLink}`)
    url.searchParams.set('email', datos.correo)
    url.searchParams.set('notes', notas)
    return url.toString()
  })()

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const oscuro = document.documentElement.classList.contains('dark')
    const tema = oscuro ? 'dark' : 'light'
    const Cal = calCargado()
    Cal('init', NAMESPACE, { origin: modo.calOrigin })
    const api = Cal.ns[NAMESPACE]
    api('on', { action: 'linkReady', callback: () => setEstado('listo') })
    api('on', { action: 'linkFailed', callback: () => setEstado('fallo') })
    api('inline', {
      elementOrSelector: el,
      calLink: modo.calLink,
      config: {
        layout: 'month_view',
        theme: tema,
        email: datos.correo,
        notes: notas,
        'metadata[sitio]': datos.sitio,
      },
    })
    api('ui', { theme: tema, layout: 'month_view', hideEventTypeDetails: false })

    const script = document.querySelector<HTMLScriptElement>(`script[src="${CAL_EMBED_JS}"]`)
    const alFallar = () => setEstado('fallo')
    script?.addEventListener('error', alFallar)
    // Si linkReady no llegó pero el iframe está, se deja el calendario y se quita el aviso.
    const tope = window.setTimeout(
      () => setEstado((e) => (e === 'cargando' ? (el.querySelector('iframe') ? 'listo' : 'fallo') : e)),
      ESPERA_CAL_MS,
    )
    return () => {
      script?.removeEventListener('error', alFallar)
      window.clearTimeout(tope)
      el.replaceChildren()
    }
  }, [modo.calOrigin, modo.calLink, datos.correo, datos.sitio, notas])

  return (
    <div className="relative mt-4">
      {estado === 'cargando' ? (
        <p aria-live="polite" className="pointer-events-none absolute inset-x-0 top-8 text-center text-sm text-muted">
          {t.calCargando}
        </p>
      ) : null}
      {estado === 'fallo' ? (
        <div className="rounded-md border border-border p-5">
          <p className="text-sm text-muted">{t.calFallo}</p>
          <a href={respaldo} target="_blank" rel="noopener noreferrer" className="btn btn-primario mt-4 gap-2">
            {t.calAbrir}
            <Externo />
          </a>
        </div>
      ) : null}
      <div
        id={id}
        ref={contenedor}
        // className fijo: embed.js le agrega su propia clase y React la borraría al cambiarlo.
        hidden={estado === 'fallo'}
        className="min-h-[720px] w-full min-w-0 overflow-auto"
      />
    </div>
  )
}
