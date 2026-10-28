'use client'

import { track } from '@vercel/analytics'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import type { Dict } from '@/lib/i18n/dict'
import { PASOS_SONDA, type EventoSonda, type Hallazgo, type PasoSonda, type Tono } from '@/lib/radar/sondas-tipos'
import { medirDominio } from './actions'
import { pedirCitas } from './citas-cliente'
import { enviarReporte } from './correo-actions'
import { leerRecarga, recargarUnaVez } from './recarga'
import { marcarRevelado, useMenosMovimiento } from './revelado'

/**
 * La caja de "Hoy" mientras Ora mide: un contador de segundos, las tres
 * preguntas del dueño y lo que van encontrando las sondas del server
 * (app/api/radar/sondas), una línea a la vez. Los pasos se marcan cuando su
 * sonda termina de verdad; si Ora sigue después, se dice que falta el puntaje.
 * Al terminar abre el resultado, que revela el número (revelado.tsx).
 */

type T = Dict['radar']
type EstadoPaso = 'pendiente' | 'revisando' | 'listo' | 'sin-datos'
type Linea = { clave: number; tono: Tono; hallazgo: Hallazgo }

/** Desde acá se avisa que tarda más de lo normal. */
const LENTO_S = 45
/** Entre una línea y la siguiente, para que se lean de a una. */
const PAUSA_MS = 260

const rutaRadar = (dominio: string) => `/radar?d=${encodeURIComponent(dominio)}`

export function textoHallazgo(h: Hallazgo, t: T): string {
  const x = t.hallazgo
  switch (h.id) {
    case 'sitio':
      return h.estado === 'inalcanzable' ? x.sitioInalcanzable : x.sitioBloqueado(h.status)
    case 'robots':
      if (h.estado === 'bloquea') return h.todos ? x.robotsBloqueaTodos : h.todosIa ? x.robotsBloqueaIa : x.robotsBloquea(h.bots)
      return h.estado === 'abierto' ? x.robotsAbierto : h.estado === 'sin-archivo' ? x.robotsSinArchivo : x.nose.robots
    case 'sitemap':
      return h.estado === 'ok' ? x.sitemapOk(h.paginas) : h.estado === 'falta' ? x.sitemapFalta : x.nose.sitemap
    case 'llms':
      return h.estado === 'ok' ? x.llmsOk : h.estado === 'falta' ? x.llmsFalta : x.nose.llms
    case 'mcp':
      return h.estado === 'ok' ? x.mcpOk : h.estado === 'falta' ? x.mcpFalta : x.nose.mcp
    case 'openapi':
      return h.estado === 'ok' ? x.openapiOk : h.estado === 'falta' ? x.openapiFalta : x.nose.openapi
    case 'jsonld':
      if (h.estado === 'ok') return x.jsonldOk(h.tipos)
      return h.estado === 'invalido' ? x.jsonldInvalido : h.estado === 'falta' ? x.jsonldFalta : x.nose.jsonld
    case 'precios':
      return {
        'pricing-md': x.preciosMd,
        datos: x.preciosDatos,
        pagina: x.preciosPagina,
        falta: x.preciosFalta,
        nose: x.nose.precios,
      }[h.estado]
    case 'pagos':
      return h.estado === 'ok' ? x.pagosOk(h.metodos) : h.estado === 'falta' ? x.pagosFalta : x.nose.pagos
  }
}

function MarcaPaso({ estado, t }: { estado: EstadoPaso; t: T }) {
  const etiqueta = t.vivo.estado[estado]
  return (
    <span role="img" aria-label={etiqueta} title={etiqueta} className="flex h-5 w-4 shrink-0 items-center justify-center">
      {estado === 'listo' ? (
        <span aria-hidden className="font-mono text-sm font-bold text-accent">✓</span>
      ) : estado === 'revisando' ? (
        <span aria-hidden className="radar-latido h-2 w-2 rounded-full bg-accent" />
      ) : estado === 'sin-datos' ? (
        <span aria-hidden className="h-px w-2.5 bg-faint" />
      ) : (
        <span aria-hidden className="h-2 w-2 rounded-full border border-faint" />
      )}
    </span>
  )
}

const SIGNO: Record<Tono, string> = { bien: '✓', falta: '✗', nota: '·' }
const COLOR: Record<Tono, string> = { bien: 'text-accent', falta: 'text-text', nota: 'text-faint' }

export function MedicionEnVivo({ dominio }: { dominio: string }) {
  const { radar: t } = useDict()
  const locale = useLocale()
  const router = useRouter()
  const menosMovimiento = useMenosMovimiento()

  const [segundos, setSegundos] = useState(0)
  const [pasos, setPasos] = useState<Record<PasoSonda, EstadoPaso>>({ encuentran: 'pendiente', usan: 'pendiente', compran: 'pendiente' })
  const [lineas, setLineas] = useState<Linea[]>([])
  const [sondasListas, setSondasListas] = useState(false)
  const [ora, setOra] = useState<'corriendo' | 'error'>('corriendo')
  const [error, setError] = useState<string | null>(null)

  const arrancado = useRef(false)
  const inicio = useRef(0)
  const cola = useRef<EventoSonda[]>([])
  const procesando = useRef(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clave = useRef(0)
  const pausa = useRef(PAUSA_MS)
  pausa.current = menosMovimiento ? 0 : PAUSA_MS

  // Los eventos se aplican en orden; cada hallazgo deja una pausa corta antes del siguiente.
  function aplicar(e: EventoSonda) {
    if (e.tipo === 'paso') setPasos((p) => ({ ...p, [e.paso]: e.estado }))
    else if (e.tipo === 'hallazgo') setLineas((l) => [...l, { clave: clave.current++, tono: e.tono, hallazgo: e.hallazgo }])
    else {
      setSondasListas(true)
      // Si el flujo se cortó antes, lo que no terminó no se marca como revisado.
      setPasos((p) => {
        const q = { ...p }
        for (const k of PASOS_SONDA) if (q[k] === 'pendiente' || q[k] === 'revisando') q[k] = 'sin-datos'
        return q
      })
    }
  }

  function siguiente() {
    const e = cola.current.shift()
    if (!e) {
      procesando.current = false
      return
    }
    procesando.current = true
    aplicar(e)
    if (e.tipo === 'hallazgo' && pausa.current > 0) reloj.current = setTimeout(siguiente, pausa.current)
    else siguiente()
  }

  function encolar(e: EventoSonda) {
    cola.current.push(e)
    if (!procesando.current) siguiente()
  }

  async function leerSondas() {
    try {
      const res = await fetch('/api/radar/sondas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dominio }),
      })
      if (!res.ok || !res.body) throw new Error(`sondas: ${res.status}`)
      const lector = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let resto = ''
      for (;;) {
        const { value, done } = await lector.read()
        if (done) break
        resto += value
        let i: number
        while ((i = resto.indexOf('\n')) >= 0) {
          const linea = resto.slice(0, i).trim()
          resto = resto.slice(i + 1)
          if (!linea) continue
          try {
            const e = JSON.parse(linea) as EventoSonda
            if (e.tipo !== 'fin') encolar(e)
          } catch {
            // línea rota: se salta
          }
        }
      }
    } catch (err) {
      console.error('[radar] las sondas no respondieron', err)
    }
    encolar({ tipo: 'fin' })
  }

  async function medir() {
    setOra('corriendo')
    setError(null)
    inicio.current = Date.now()
    setSegundos(0)
    let r: { ok: boolean; error?: string }
    try {
      r = await medirDominio(dominio)
    } catch (err) {
      // La acción lanzó: casi siempre es un deploy nuevo. Una recarga lo arregla (la URL ya pide medir).
      console.error('[radar] medirDominio lanzó', err)
      if (recargarUnaVez('medir', { dominio })) return
      r = { ok: false, error: t.fallo }
    }
    if (!r.ok) {
      setError(r.error ?? t.fallo)
      setOra('error')
      return
    }
    // Evento de Vercel Web Analytics (sin el dominio ni el correo).
    track('radar_measured')
    // El reporte por correo sale aparte: si falla, el resultado igual se ve.
    void enviarReporte(dominio).catch((err: unknown) => console.error('[radar] enviarReporte lanzó', err))
    marcarRevelado(dominio)
    // Sin `medir=1` en la URL: recargar la página no vuelve a medir.
    router.replace(rutaRadar(dominio))
    router.refresh()
  }

  useEffect(() => {
    if (arrancado.current) return
    arrancado.current = true
    inicio.current = Date.now()
    leerRecarga('medir') // si venimos de una recarga por deploy, se limpia: la URL ya pide medir
    // En paralelo con Ora: las citas (la sección del resultado retoma este pedido) y las sondas.
    pedirCitas(dominio, locale)
    void leerSondas()
    void medir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ora !== 'corriendo') return
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [ora])

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current)
    },
    [],
  )

  return (
    <div className="space-y-5 border border-border bg-panel p-5 sm:p-6">
      <p className="font-mono text-sm">
        <span className="font-bold text-text">{t.vivo.titulo}</span>
        <span className="text-muted" aria-hidden>
          {' '}
          {/* El contador no se parte entre el número y la "s" en el teléfono. */}
          <span className="whitespace-nowrap">· {t.vivo.segundos(segundos)}</span>
        </span>
      </p>

      <ol className="space-y-3 text-sm">
        {PASOS_SONDA.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <MarcaPaso estado={pasos[p]} t={t} />
            <span className={pasos[p] === 'pendiente' ? 'text-muted' : ''}>
              <span className="font-semibold">{t.vivo.pasos[p].pregunta}</span>{' '}
              <span className="text-muted">{t.vivo.pasos[p].que}</span>
            </span>
          </li>
        ))}
        {sondasListas && ora === 'corriendo' ? (
          <li className="radar-aparece flex items-start gap-3">
            <MarcaPaso estado="revisando" t={t} />
            <span className="font-semibold">{t.vivo.calculando}</span>
          </li>
        ) : null}
      </ol>

      {lineas.length > 0 ? (
        <ul aria-live="polite" className="space-y-2 border-t border-border pt-4 text-sm">
          {lineas.map((l) => (
            <li key={l.clave} className="radar-aparece flex items-start gap-3">
              <span
                role="img"
                aria-label={t.vivo.tono[l.tono]}
                className={`flex h-5 w-4 shrink-0 justify-center font-mono font-bold ${COLOR[l.tono]}`}
              >
                {SIGNO[l.tono]}
              </span>
              <span className={l.tono === 'nota' ? 'text-muted' : ''}>{textoHallazgo(l.hallazgo, t)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        {ora === 'corriendo' ? (
          <>
            {segundos >= LENTO_S ? <p className="radar-aparece border-l-2 border-accent pl-3">{t.vivo.lento}</p> : null}
            <p className="text-muted">{t.vivo.dejaAbierta}</p>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-red-600">{error ?? t.fallo}</p>
            <button type="button" onClick={() => void medir()} className="btn btn-secundario btn-chico">
              {t.volverAMedir}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
