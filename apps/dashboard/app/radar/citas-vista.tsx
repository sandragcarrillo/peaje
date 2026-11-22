'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import type { Dict } from '@/lib/i18n/dict'
import { pedirCitas } from './citas-cliente'
import { mercadoDe } from '@peaje/shared/mercados'
import { MOTORES_POR_DEFECTO, nombreMotor, type Celda, type Citas, type ErrorCitas, type RespuestaCitas } from './citas-tipos'
import { Seccion } from './seccion'

/**
 * "Cuando tus clientes preguntan, la IA recomienda a otros": tres preguntas
 * de compra hechas a ChatGPT y Claude (ASISTENTES_MEDIDOS), si el sitio sale
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

function useCitas(dominio: string, locale: string, pais: string, ciudad: string): { r: RespuestaCitas | null; segundos: number } {
  const [r, setR] = useState<RespuestaCitas | null>(null)
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    let vivo = true
    setR(null)
    const pedido = pedirCitas(dominio, locale, { pais, ciudad })
    const tic = () => setSegundos(Math.max(0, Math.floor((Date.now() - pedido.desde) / 1000)))
    tic()
    const reloj = setInterval(tic, 1000)
    void (async () => {
      let res = await pedido.promesa
      const espera = esError(res) && res.error === 'unavailable' ? (res.retryAfterSeconds ?? 0) : 0
      if (vivo && espera > 0 && espera <= REINTENTO_MAX_S) {
        await new Promise((ok) => setTimeout(ok, espera * 1000))
        if (!vivo) return
        res = await pedirCitas(dominio, locale, { nuevo: true, pais, ciudad }).promesa
      }
      if (!vivo) return
      clearInterval(reloj)
      setR(res)
    })()
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [dominio, locale, pais, ciudad])
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
      {/* El precio va debajo del botón, con "al mes": el botón dice qué pasa, la línea dice cuánto cuesta. */}
      <div className="space-y-2 sm:shrink-0 sm:text-right">
        <Link href={`/nuevo?url=${encodeURIComponent(dominio)}&plan=1`} className="btn btn-primario w-full whitespace-normal text-center sm:w-auto">
          {t.cta}
        </Link>
        <p className="text-xs text-muted">{t.ctaPrecio(usd)}</p>
      </div>
    </div>
  )
}

/** El resultado de una pregunta en un motor, dicho con palabras. */
function Estado({ celda, t }: { celda: Celda | undefined; t: T['citas'] }) {
  const trazo = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
  const [etiqueta, clase, icono] = !celda
    ? [t.marca.sinRespuesta, 'text-faint', <svg key="i" {...trazo}><path d="M6 12h12" strokeDasharray="2 4" /></svg>]
    : celda.cited
      ? [t.marca.citado, 'font-medium text-accent', <svg key="i" {...trazo}><path d="M5 12.5 10 17l9-10" /></svg>]
      : celda.mentioned
        ? [t.marca.mencionado, 'text-text', <svg key="i" {...trazo}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" /></svg>]
        : [t.marca.no, 'text-muted', <svg key="i" {...trazo}><path d="M7 7l10 10M17 7 7 17" /></svg>]
  return (
    <span className={`flex items-center gap-2 text-sm ${clase}`}>
      <span className="shrink-0">{icono}</span>
      {etiqueta}
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

export function SeccionCitas({
  dominio,
  n,
  usd,
  pais = '',
  ciudad = '',
}: {
  dominio: string
  n: string
  usd: number
  /** País elegido en el formulario ('' es sin país). */
  pais?: string
  /** Ciudad dentro de ese país, si la puso. */
  ciudad?: string
}) {
  const { radar } = useDict()
  const t = radar.citas
  const locale = useLocale()
  const mercado = mercadoDe(pais)
  const nombrePais = mercado ? (locale === 'es' ? mercado.es : mercado.en) : ''
  const { r, segundos } = useCitas(dominio, locale, pais, mercado ? ciudad : '')
  const datos = r && !esError(r) ? r : null

  return (
    <Seccion n={n} titulo={tituloDe(datos, t)}>
      {/* El país se elige en el formulario de entrada: acá solo se dice desde dónde se preguntó. */}
      {mercado ? <p className="text-sm text-muted">{t.mercadoDesde(ciudad ? `${ciudad}, ${nombrePais}` : nombrePais)}</p> : null}
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
                <span className="whitespace-nowrap">· {radar.vivo.segundos(segundos)}</span>
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

const COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

function Resultado({ c, dominio, usd, t, locale }: { c: Citas; dominio: string; usd: number; t: T['citas']; locale: string }) {
  const nombres = c.engines.map(nombreMotor)
  const fecha = fechaCorta(c.measuredAt, locale)
  const todos = [...c.engines, ...c.failed]
  const propio = (d: string) => d === dominio || d.endsWith(`.${dominio}`)
  const grupos = [
    { clave: 'competitor', titulo: t.grupoCompetencia, nota: t.grupoCompetenciaNota, items: c.citedInstead.filter((x) => x.kind === 'competitor') },
    { clave: 'publisher', titulo: t.grupoMedios, nota: t.grupoMediosNota, items: c.citedInstead.filter((x) => x.kind === 'publisher') },
    { clave: 'otros', titulo: t.grupoOtros, nota: null, items: c.citedInstead.filter((x) => !x.kind) },
  ].filter((g) => g.items.length > 0)
  const maximo = Math.max(1, ...c.citedInstead.map((x) => x.count))
  return (
    <>
      <p className="max-w-2xl text-sm text-muted">{t.intro(c.questions.length, nombres)}</p>

      {/* Un tablero por motor, a todo el ancho: el número y un tramo por pregunta. */}
      <ul className={`grid grid-cols-1 gap-3 ${COLS[Math.min(todos.length, 4)] ?? COLS[4]}`}>
        {c.engines.map((id) => {
          const cob = c.coverage[id] ?? { cited: 0, total: 0 }
          // El tramo a medio tono es "te nombra, sin enlace" y el punteado "no contestó": se dicen debajo de la barra.
          const nombradas = c.questions.filter((q) => q.engines[id] && !q.engines[id]!.cited && q.engines[id]!.mentioned).length
          const sinRespuesta = c.questions.filter((q) => !q.engines[id]).length
          return (
            <li key={id} className="radar-aparece space-y-4 border border-border bg-panel p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Punto id={id} />
                {nombreMotor(id)}
              </p>
              <div>
                <p className="text-5xl font-bold leading-none tracking-tight tabular-nums">
                  {cob.cited}
                  <span className="text-2xl font-semibold text-muted"> {t.deTotal(cob.total)}</span>
                </p>
                <p className="mt-2 text-sm text-muted">{t.teCitaEn(cob.total)}</p>
              </div>
              {/* Misma estructura en todas: la barra siempre en el mismo lugar y, debajo, una sola línea de nota (o su hueco). */}
              <div className="flex gap-1.5" aria-hidden>
                {c.questions.map((q, i) => {
                  const celda = q.engines[id]
                  return (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${!celda ? 'border border-dashed border-border' : celda.cited ? 'bg-accent' : celda.mentioned ? 'bg-accent/40' : 'bg-border'}`}
                    />
                  )
                })}
              </div>
              {/* El hueco solo se reserva cuando las tarjetas van lado a lado; apiladas, una tarjeta sin nota no deja aire abajo. */}
              <p className={`text-xs leading-4 text-muted sm:min-h-8 ${nombradas + sinRespuesta === 0 ? 'hidden sm:block' : ''}`}>
                {[
                  nombradas > 0 ? t.teNombraEn(nombradas) : null,
                  sinRespuesta > 0 ? t.sinRespuestaEn(sinRespuesta) : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
            </li>
          )
        })}
        {c.failed.map((id) => (
          <li key={id} className="space-y-4 border border-dashed border-border p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted">
              <Punto id={id} />
              {nombreMotor(id)}
            </p>
            <div>
              <p className="text-lg font-semibold">{t.noContesto}</p>
              <p className="mt-2 text-sm text-muted">{t.noContestoNota}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Cada pregunta con lo que hizo cada motor y a quién citó: ahí se ve quién ocupó el lugar. */}
      <ol className="space-y-3">
        {c.questions.map((q, i) => (
          <li key={i} className="border border-border">
            <div className="space-y-1 px-5 pt-5 pb-4">
              <p className="text-xs text-muted">{t.preguntaN(i + 1, c.questions.length)}</p>
              <p className="max-w-3xl text-lg font-medium leading-snug">{q.text}</p>
            </div>
            {/* Tres columnas alineadas en todas las preguntas: quién, qué pasó y a quién citó. Los títulos, una vez por tarjeta. */}
            <div className="hidden grid-cols-[9rem_13rem_1fr] gap-4 border-t border-border/60 px-5 py-2 text-xs text-faint sm:grid">
              <span>{t.colAsistente}</span>
              <span>{t.colResultado}</span>
              <span>{t.colFuentes}</span>
            </div>
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {c.engines.map((id) => {
                const celda = q.engines[id]
                const ajenos = (celda?.sources ?? []).filter((d) => !propio(d))
                return (
                  <li key={id} className={`grid grid-cols-1 gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[9rem_13rem_1fr] sm:items-center ${celda?.cited ? 'bg-accent/[0.06]' : ''}`}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Punto id={id} />
                      {nombreMotor(id)}
                    </span>
                    <Estado celda={celda} t={t} />
                    <span className="min-w-0 break-words font-mono text-xs leading-5 text-muted">
                      {celda?.cited ? <span className="text-accent">{dominio}</span> : null}
                      {celda?.cited && ajenos.length > 0 ? ', ' : null}
                      {ajenos.slice(0, 4).join(', ')}
                      {ajenos.length > 4 ? <span className="font-sans"> {t.yMas(ajenos.length - 4)}</span> : null}
                      {celda && !celda.cited && ajenos.length === 0 ? <span className="font-sans text-faint">{t.sinFuentes}</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      {grupos.length > 0 ? (
        <div className="space-y-5 border-t border-border pt-6">
          <h3 className="text-lg font-semibold">{t.enTuLugar}</h3>
          <div className={`grid gap-x-10 gap-y-6 ${grupos.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {grupos.map((g) => (
              <div key={g.clave} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">{g.titulo}</p>
                  {g.nota ? <p className="mt-0.5 text-xs text-muted">{g.nota}</p> : null}
                </div>
                <ul className="space-y-2">
                  {g.items.map((x) => (
                    <li key={x.domain} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 break-all font-mono text-xs">{x.domain}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{t.vecesCitado(x.count)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-border/60" aria-hidden>
                        <div className="h-1 rounded-full bg-text/70" style={{ width: `${Math.round((x.count / maximo) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Cta dominio={dominio} usd={usd} t={t} linea />
      {fecha ? <p className="text-xs text-muted">{t.fecha(fecha)}</p> : null}
    </>
  )
}
