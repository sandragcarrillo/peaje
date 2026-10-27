'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import type { Dict } from '@/lib/i18n/dict'
import { pedirCitas } from './citas-cliente'
import { MOTORES_POR_DEFECTO, nombreMotor, type Celda, type Citas, type ErrorCitas, type RespuestaCitas } from './citas-tipos'
import { Seccion } from './seccion'

/**
 * "Cuando tus clientes preguntan, la IA recomienda a otros": tres preguntas
 * de compra hechas a ChatGPT, Perplexity, Claude y Gemini, si el sitio sale
 * citado y a quién citan en su lugar. Se carga sola (hasta ~70 s) mientras el
 * resto del resultado ya se ve. Si el gateway no puede, no se muestra ningún
 * número: solo una línea y el agente.
 */

type T = Dict['radar']

/** Un acento sutil por motor, de la paleta de la marca. */
const ACENTO: Record<string, string> = {
  chatgpt: 'var(--text)',
  perplexity: 'var(--accent)',
  claude: 'var(--lila)',
  gemini: 'var(--verde)',
}

/** "Otra medición del mismo dominio en curso": el gateway dice cuánto esperar; se reintenta una vez si es poco. */
const REINTENTO_MAX_S = 45

const esError = (r: RespuestaCitas): r is ErrorCitas => 'error' in r

function useCitas(dominio: string, locale: string): { r: RespuestaCitas | null; segundos: number } {
  const [r, setR] = useState<RespuestaCitas | null>(null)
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    let vivo = true
    const pedido = pedirCitas(dominio, locale)
    const tic = () => setSegundos(Math.max(0, Math.floor((Date.now() - pedido.desde) / 1000)))
    tic()
    const reloj = setInterval(tic, 1000)
    void (async () => {
      let res = await pedido.promesa
      const espera = esError(res) && res.error === 'unavailable' ? (res.retryAfterSeconds ?? 0) : 0
      if (vivo && espera > 0 && espera <= REINTENTO_MAX_S) {
        await new Promise((ok) => setTimeout(ok, espera * 1000))
        if (!vivo) return
        res = await pedirCitas(dominio, locale, { nuevo: true }).promesa
      }
      if (!vivo) return
      clearInterval(reloj)
      setR(res)
    })()
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [dominio, locale])
  return { r, segundos }
}

/** Cuántas veces (de las respondidas) sale citado, sumando motores. */
function proporcion(c: Citas): number | null {
  let citado = 0
  let total = 0
  for (const id of c.engines) {
    citado += c.coverage[id]?.cited ?? 0
    total += c.coverage[id]?.total ?? 0
  }
  return total > 0 ? citado / total : null
}

function tituloDe(c: Citas | null, t: T['citas']): string {
  const p = c ? proporcion(c) : null
  if (p === null) return t.tituloNeutro
  if (p >= 1) return t.tituloTe
  if (p >= 0.5) return t.tituloAVeces
  return t.tituloOtros
}

/** El botón al agente. `linea`: qué hace el agente con estas preguntas (solo cuando hay preguntas a la vista). */
function Cta({ dominio, usd, t, linea }: { dominio: string; usd: number; t: T['citas']; linea: boolean }) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center ${linea ? 'border-t border-border pt-5 sm:justify-between' : ''}`}
    >
      {linea ? <p className="max-w-xl text-sm">{t.agente}</p> : null}
      {/* plan=1: después del alta, /nuevo lleva directo al plan con el checkout. En el teléfono el texto puede ir en dos líneas. */}
      <Link
        href={`/nuevo?url=${encodeURIComponent(dominio)}&plan=1`}
        className="btn btn-primario w-full whitespace-normal text-center sm:w-auto sm:shrink-0"
      >
        {t.cta(usd)}
      </Link>
    </div>
  )
}

function Marca({ celda, t }: { celda: Celda | undefined; t: T['citas'] }) {
  const [signo, etiqueta, clase] = !celda
    ? ['–', t.marca.sinRespuesta, 'text-faint']
    : celda.cited
      ? ['✓', t.marca.citado, 'text-accent']
      : celda.mentioned
        ? ['◐', t.marca.mencionado, 'text-muted']
        : ['✗', t.marca.no, 'text-text']
  return (
    <span role="img" aria-label={etiqueta} title={etiqueta} className={`font-mono text-xs font-bold ${clase}`}>
      {signo}
    </span>
  )
}

function Punto({ id }: { id: string }) {
  return <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: ACENTO[id] ?? 'var(--faint)' }} />
}

function fechaCorta(iso: string | null, locale: string): string | null {
  const ms = iso ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(ms)) return null
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms)
}

export function SeccionCitas({ dominio, n, usd }: { dominio: string; n: string; usd: number }) {
  const { radar } = useDict()
  const t = radar.citas
  const locale = useLocale()
  const { r, segundos } = useCitas(dominio, locale)
  const datos = r && !esError(r) ? r : null

  return (
    <Seccion n={n} titulo={tituloDe(datos, t)}>
      {r?.ejemplo ? (
        // Solo con RADAR_CITAS_STUB en desarrollo: que nadie confunda estos datos con un resultado real.
        <p role="note" className="border-2 border-dashed border-text px-3 py-2 font-mono text-sm font-bold">
          {t.ejemplo}
        </p>
      ) : null}
      {!r ? (
        <div role="status" className="space-y-2">
          <p className="flex items-center gap-3 text-sm">
            <span aria-hidden className="radar-latido h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>
              {t.cargando(MOTORES_POR_DEFECTO.map(nombreMotor))}
              <span className="font-mono text-muted" aria-hidden>
                {' '}
                · {radar.vivo.segundos(segundos)}
              </span>
            </span>
          </p>
          <p className="pl-5 text-xs text-muted">{t.cargandoNota}</p>
        </div>
      ) : !datos ? (
        <>
          <p className="max-w-2xl text-sm">{esError(r) && r.error === 'budget' ? t.errorBudget : t.errorOtro}</p>
          <Cta dominio={dominio} usd={usd} t={t} linea={false} />
        </>
      ) : (
        <Resultado c={datos} dominio={dominio} usd={usd} t={t} locale={locale} />
      )}
    </Seccion>
  )
}

function Resultado({ c, dominio, usd, t, locale }: { c: Citas; dominio: string; usd: number; t: T['citas']; locale: string }) {
  const nombres = c.engines.map(nombreMotor)
  const fecha = fechaCorta(c.measuredAt, locale)
  return (
    <>
      <p className="max-w-2xl text-sm text-muted">{t.intro(c.questions.length, nombres)}</p>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {c.engines.map((id) => {
          const cob = c.coverage[id] ?? { cited: 0, total: 0 }
          return (
            <li key={id} className="radar-aparece space-y-2 border border-border bg-panel p-4">
              <p className="flex items-center gap-2 font-mono text-xs text-muted">
                <Punto id={id} />
                {nombreMotor(id)}
              </p>
              <p className="text-3xl font-bold tracking-tight">
                {cob.cited}
                <span className="text-muted">/{cob.total}</span>
              </p>
              <p className="text-xs text-muted">
                {cob.total > 0 ? t.cobertura(Math.round((cob.cited / cob.total) * 100)) : t.sinRespuestas}
              </p>
            </li>
          )
        })}
      </ul>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t.preguntas}</h3>
        <ul className="divide-y divide-border/60 text-sm">
          {c.questions.map((q, i) => (
            <li key={i} className="space-y-2 py-3">
              <p>{q.text}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1.5">
                {c.engines.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1.5 font-mono text-xs text-muted">
                    {nombreMotor(id)} <Marca celda={q.engines[id]} t={t} />
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <span>
            <span className="font-bold text-accent">✓</span> {t.marca.citado}
          </span>
          <span>
            <span className="font-bold">◐</span> {t.marca.mencionado}
          </span>
          <span>
            <span className="font-bold text-text">✗</span> {t.marca.no}
          </span>
        </p>
      </div>

      {c.citedInstead.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t.enTuLugar}</h3>
          <ul className="flex flex-wrap gap-2">
            {c.citedInstead.map((x) => (
              <li key={x.domain} className="inline-flex items-center gap-2 border border-border bg-bg px-2.5 py-1.5 font-mono text-xs">
                <span className="text-text">{x.domain}</span>
                <span className="text-muted">{t.veces(x.count)}</span>
                {x.kind ? (
                  <span className="border border-border px-1 py-0.5 text-[10px] leading-none text-muted">{t.kind[x.kind]}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Cta dominio={dominio} usd={usd} t={t} linea />
      {fecha ? <p className="text-xs text-muted">{t.fecha(fecha)}</p> : null}
    </>
  )
}
