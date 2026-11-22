import type { CitationRun } from '@peaje/db'
import { ASISTENTES_MEDIDOS, MOTORES_MEDIDOS } from '@peaje/shared/asistentes'
import { Tope } from '@/components/tope'
import type { Dict } from '@/lib/i18n'

/**
 * El historial de mediciones: cómo le fue al negocio ronda por ronda, por
 * asistente y por pregunta, y quién salió en su lugar. Sale de citation_runs
 * (append-only), que guarda una fila por pregunta y motor en cada ronda. Todo
 * se dice como "X de N respuestas" y por asistente: lo que contesta la IA
 * cambia entre corridas y mezclar asistentes esconde cuál se mueve.
 */

export const RONDAS_HISTORIAL = 6

/** Cuántos sitios se nombran debajo de cada pregunta antes de decir "y N más". */
const SITIOS_POR_LINEA = 3

type Estado = 'cita' | 'nombra' | 'no' | 'sin-respuesta' | 'sin-medir'

type Ronda = { id: string; fecha: string; cuando: number; runs: CitationRun[] }

export type Historial = {
  /** De la más vieja a la más nueva. */
  rondas: Ronda[]
  /** Los asistentes de la última ronda, en el orden en que Peaje los nombra. */
  motores: { id: string; nombre: string }[]
  /** Las preguntas de la última ronda primero; después las que solo están en rondas viejas. */
  preguntas: string[]
}

const nombreMotor = (id: string): string => {
  const i = (MOTORES_MEDIDOS as readonly string[]).indexOf(id)
  return i >= 0 ? ASISTENTES_MEDIDOS[i]! : id
}

const ordenMotor = (id: string): number => {
  const i = (MOTORES_MEDIDOS as readonly string[]).indexOf(id)
  return i >= 0 ? i : MOTORES_MEDIDOS.length
}

/** `runs` viene de store.listCitationRuns: de la más nueva a la más vieja. */
export function armarHistorial(runs: CitationRun[], locale: string): Historial {
  const ids = [...new Set(runs.map((r) => r.roundId))].slice(0, RONDAS_HISTORIAL)
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short' })
  const rondas = ids
    .map((id) => {
      const rs = runs.filter((r) => r.roundId === id)
      const cuando = Math.min(...rs.map((r) => new Date(r.runAt).getTime()))
      return { id, cuando, fecha: fmt.format(new Date(cuando)).replace('.', ''), runs: rs }
    })
    .reverse()
  const ultima = rondas.at(-1)?.runs ?? []
  const motores = [...new Set(ultima.map((r) => r.engine))].sort((a, b) => ordenMotor(a) - ordenMotor(b)).map((id) => ({ id, nombre: nombreMotor(id) }))
  const preguntas = [...new Set([...ultima, ...rondas.slice(0, -1).reverse().flatMap((r) => r.runs)].map((r) => r.promptText))]
  return { rondas, motores, preguntas }
}

const esPropio = (dominio: string, raiz: string | null) => !!raiz && (dominio === raiz || dominio.endsWith(`.${raiz}`))

/**
 * Los sitios que citó una respuesta, sin el propio: uno por dominio, con el
 * enlace a la primera página citada de ese dominio (si el motor dio páginas).
 */
function citadas(r: CitationRun, raiz: string | null): { domain: string; url: string | null; title: string | null }[] {
  const vistas = new Set<string>()
  const filas = r.pages.length ? r.pages.map((p) => ({ domain: p.domain, url: p.url, title: p.title })) : r.domains.map((d) => ({ domain: d, url: null, title: null }))
  return filas.filter((p) => {
    if (esPropio(p.domain, raiz) || vistas.has(p.domain)) return false
    vistas.add(p.domain)
    return true
  })
}

/** Citadas sobre respondidas de un asistente en una ronda. `hechas` cuenta también las que fallaron. */
function cuenta(ronda: Ronda, motor: string): { citadas: number; total: number; hechas: number } {
  const rs = ronda.runs.filter((r) => r.engine === motor)
  const ok = rs.filter((r) => !r.error)
  return { citadas: ok.filter((r) => r.cited).length, total: ok.length, hechas: rs.length }
}

function estadoDe(ronda: Ronda, motor: string, pregunta: string): Estado {
  const r = ronda.runs.find((x) => x.engine === motor && x.promptText === pregunta)
  if (!r) return 'sin-medir'
  if (r.error) return 'sin-respuesta'
  return r.cited ? 'cita' : r.mentioned ? 'nombra' : 'no'
}

/** Entre 5 y 9 días se dice "la semana pasada"; si no, "la medición anterior". */
const esSemanal = (a: Ronda, b: Ronda): boolean => {
  const dias = (b.cuando - a.cuando) / 86_400_000
  return dias >= 5 && dias <= 9
}

/**
 * La marca de una respuesta. Cuatro formas distintas (no solo color) y el
 * verde solo para "te cita". Dibujadas, con su texto para lectores de pantalla.
 */
function Marca({ estado, etiqueta }: { estado: Estado; etiqueta?: string }) {
  const a11y = etiqueta ? ({ role: 'img', 'aria-label': etiqueta } as const) : ({ 'aria-hidden': true } as const)
  if (estado === 'sin-medir')
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
        {etiqueta ? <span className="sr-only">{etiqueta}</span> : null}
      </span>
    )
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0" {...a11y}>
      {etiqueta ? <title>{etiqueta}</title> : null}
      {estado === 'cita' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="var(--accent)" />
          <path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="var(--accent-text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : estado === 'nombra' ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--text)" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.5" fill="var(--text)" />
        </>
      ) : estado === 'no' ? (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--faint)" strokeWidth="1.5" />
      ) : (
        <path d="M3 8h10" fill="none" stroke="var(--faint)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2.5" />
      )}
    </svg>
  )
}

/** Una barra por ronda: el alto es citadas sobre respondidas. Sin respuesta, un guion; sin medir, hueco. */
function Barras({ puntos, etiqueta }: { puntos: { citadas: number; total: number; hechas: number }[]; etiqueta: string }) {
  return (
    <div role="img" aria-label={etiqueta} className="flex h-9 shrink-0 items-end gap-1">
      {puntos.map((p, i) => {
        const ultima = i === puntos.length - 1
        if (p.total === 0) {
          return (
            <span key={i} className="flex h-full w-3 items-end justify-center">
              {p.hechas > 0 ? <span className="mb-px block w-full border-t border-dashed border-faint" /> : null}
            </span>
          )
        }
        return (
          <span key={i} className="relative block h-full w-3 overflow-hidden rounded-[3px] bg-panel-2">
            <span className={`absolute inset-x-0 bottom-0 rounded-[3px] bg-accent ${ultima ? '' : 'opacity-55'}`} style={{ height: `${Math.round((p.citadas / p.total) * 100)}%` }} />
          </span>
        )
      })}
    </div>
  )
}

/**
 * Cómo va cada asistente, por separado: el valor de la última medición en
 * grande, el cambio contra la anterior en palabras y la serie en barras.
 */
export function Evolucion({ h, d }: { h: Historial; d: Dict }) {
  const t = d.agenteReportes
  const ultima = h.rondas.at(-1)
  if (!ultima) return null
  const previa = h.rondas.at(-2)
  const semanal = previa ? esSemanal(previa, ultima) : false
  const fechas = h.rondas.length > 1 ? t.histRango(h.rondas[0]!.fecha, ultima.fecha) : t.histMedido(ultima.fecha)

  return (
    <section className="tarjeta min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t.histEvoTitulo}</h2>
        <span className="text-sm tabular-nums text-faint">{fechas}</span>
      </div>
      <p className="mt-1 max-w-[68ch] text-sm text-muted">{t.histEvoSub}</p>

      <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {h.motores.map((m) => {
          const puntos = h.rondas.map((r) => cuenta(r, m.id))
          const hoy = puntos.at(-1)!
          const antes = previa ? puntos.at(-2)! : null
          const fallaron = hoy.hechas - hoy.total
          let cambio: string | null = null
          if (antes && hoy.total > 0) {
            if (antes.hechas === 0) cambio = t.histAntesSinMedir
            else if (antes.total === 0) cambio = t.histAntesSinRespuesta
            else if (antes.total !== hoy.total) cambio = t.histAntes(antes.citadas, antes.total)
            else if (hoy.citadas > antes.citadas) cambio = t.histMas(hoy.citadas - antes.citadas, semanal)
            else if (hoy.citadas < antes.citadas) cambio = t.histMenos(antes.citadas - hoy.citadas, semanal)
            else cambio = t.histIgual(semanal)
          }
          const detalle = h.rondas
            .map((r, i) => {
              const p = puntos[i]!
              return p.total > 0 ? t.histBarra(r.fecha, p.citadas, p.total) : p.hechas > 0 ? t.histBarraSin(r.fecha) : t.histBarraSinMedir(r.fecha)
            })
            .join('. ')
          return (
            <li key={m.id} className="flex min-w-0 items-end gap-4 border-t border-border pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">{m.nombre}</p>
                {hoy.total > 0 ? (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                    <span className="text-3xl font-semibold tracking-tight">{hoy.citadas}</span>
                    <span className="text-sm text-muted">{t.histDe(hoy.total)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t.histSinRespuesta}</p>
                )}
                {cambio ? <p className="mt-1 text-sm text-muted">{cambio}</p> : null}
                {hoy.total > 0 && fallaron > 0 ? <p className="mt-0.5 text-sm text-faint">{t.histFallaron(fallaron)}</p> : null}
              </div>
              <Barras puntos={puntos} etiqueta={`${m.nombre}. ${detalle}`} />
            </li>
          )
        })}
      </ul>

      {h.rondas.length === 1 ? <p className="mt-5 text-sm text-muted">{t.histUnaRonda}</p> : null}
    </section>
  )
}

/** A quién citó cada asistente en la última medición para una pregunta, sin el sitio propio. */
function QuienCito({ h, pregunta, raiz, d, className }: { h: Historial; pregunta: string; raiz: string | null; d: Dict; className?: string }) {
  const t = d.agenteReportes
  const ultima = h.rondas.at(-1)
  const lineas = h.motores.flatMap((m) => {
    const r = ultima?.runs.find((x) => x.engine === m.id && x.promptText === pregunta)
    return r ? [{ m, r }] : []
  })
  if (lineas.length === 0) return null
  return (
    <ul className={`space-y-1 text-xs text-muted ${className ?? ''}`}>
      {lineas.map(({ m, r }) => {
        if (r.error) return <li key={m.id}>{t.histNoContesto(m.nombre)}</li>
        const ganaron = citadas(r, raiz)
        if (ganaron.length === 0) return <li key={m.id}>{r.cited ? t.histSoloTu(m.nombre) : t.histSinPaginas(m.nombre)}</li>
        return (
          <li key={m.id} className="min-w-0 [overflow-wrap:anywhere]">
            {t.histCito(m.nombre)}{' '}
            {ganaron.slice(0, SITIOS_POR_LINEA).map((p, i) => (
              <span key={p.url ?? p.domain}>
                {i ? ', ' : ''}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.title ?? undefined} className="text-text underline decoration-border underline-offset-2 hover:decoration-text">
                    {p.domain}
                  </a>
                ) : (
                  <span className="text-text">{p.domain}</span>
                )}
              </span>
            ))}
            {ganaron.length > SITIOS_POR_LINEA ? t.histYMas(ganaron.length - SITIOS_POR_LINEA) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Cada pregunta en las últimas rondas, con a quién citó cada asistente la
 * última vez. Primero las preguntas donde el negocio apareció alguna vez, con
 * una marca por asistente y ronda; las que nunca, juntas y sin marcas, porque
 * veinte filas de círculos vacíos no dicen nada.
 */
export function HistorialPreguntas({ h, d, raiz }: { h: Historial; d: Dict; raiz: string | null }) {
  const t = d.agenteReportes
  if (h.rondas.length === 0 || h.preguntas.length === 0) return null
  const texto: Record<Estado, string> = { cita: t.histCita, nombra: t.histNombra, no: t.histNo, 'sin-respuesta': t.histNoRespondio, 'sin-medir': t.histSinMedir }
  // Columnas que se encogen hasta 2.25rem: seis rondas caben en una tarjeta a 375 px sin scroll.
  const columnas = { gridTemplateColumns: `4.5rem repeat(${h.rondas.length}, minmax(2.25rem, 3.25rem))` }
  const leyenda: Estado[] = ['cita', 'nombra', 'no', 'sin-respuesta']
  const aparece = (q: string) => h.rondas.some((r) => h.motores.some((m) => ['cita', 'nombra'].includes(estadoDe(r, m.id, q))))
  const conAlgo = h.preguntas.filter(aparece)
  const nunca = h.preguntas.filter((q) => !aparece(q))

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t.histTablaTitulo}</h2>
        <p className="mt-1 max-w-[68ch] text-sm text-muted">{t.histTablaSub(h.rondas.length)}</p>
      </div>

      {conAlgo.length > 0 ? (
        <div className="space-y-3">
          <ul aria-label={t.histLeyenda} className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            {leyenda.map((e) => (
              <li key={e} className="flex items-center gap-1.5">
                <Marca estado={e} />
                {texto[e]}
              </li>
            ))}
          </ul>
          <ul className="space-y-3">
            {conAlgo.map((q) => (
              <li key={q} className="tarjeta min-w-0 p-4 sm:p-5">
                <p className="text-sm font-medium">{q}</p>
                {/* Las fechas van dentro de cada tarjeta, pegadas a sus marcas. El scroll es solo un respaldo si un nombre de asistente no cabe. */}
                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-fit space-y-2">
                    <div aria-hidden className="grid items-center text-[11px] tabular-nums text-faint" style={columnas}>
                      <span />
                      {h.rondas.map((r) => (
                        <span key={r.id} className="text-center">
                          {r.fecha}
                        </span>
                      ))}
                    </div>
                    {h.motores.map((m) => (
                      <div key={m.id} className="grid items-center" style={columnas}>
                        <span className="truncate text-xs text-muted">{m.nombre}</span>
                        {h.rondas.map((r) => {
                          const e = estadoDe(r, m.id, q)
                          return (
                            <span key={r.id} className="flex h-5 items-center justify-center">
                              <Marca estado={e} etiqueta={t.histMarca(m.nombre, r.fecha, texto[e])} />
                            </span>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <QuienCito h={h} pregunta={q} raiz={raiz} d={d} className="mt-3 border-t border-border pt-3" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {nunca.length > 0 ? (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold">{conAlgo.length > 0 ? t.histNuncaTitulo(nunca.length) : t.histNuncaTodas(nunca.length)}</h3>
            <p className="mt-0.5 text-xs text-muted">{t.histNuncaSub(h.rondas.length)}</p>
          </div>
          <Tope visibles={5} mas={t.histVerMas(Math.max(0, nunca.length - 5))} menos={t.histVerMenos} className="tarjeta divide-y divide-border">
            {nunca.map((q) => (
              <li key={q} className="min-w-0 px-4 py-3">
                <p className="text-sm">{q}</p>
                <QuienCito h={h} pregunta={q} raiz={raiz} d={d} className="mt-1.5" />
              </li>
            ))}
          </Tope>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Los sitios que más salieron en lugar del negocio en la última medición: se
 * cuenta una vez por respuesta que no lo citó. Misma cuenta que el resumen del
 * gateway, hecha aquí sobre las mismas filas.
 */
export function Competidores({ h, d, raiz }: { h: Historial; d: Dict; raiz: string | null }) {
  const t = d.agenteReportes
  const conteo = new Map<string, number>()
  for (const r of h.rondas.at(-1)?.runs ?? []) {
    if (r.error || r.cited) continue
    for (const dom of new Set(r.domains)) if (!esPropio(dom, raiz)) conteo.set(dom, (conteo.get(dom) ?? 0) + 1)
  }
  const filas = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (filas.length === 0) return null
  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t.ciCompetidores}</h2>
        <p className="mt-1 text-sm text-muted">{t.ciCompetidoresSub}</p>
      </div>
      <ul className="tarjeta divide-y divide-border text-sm">
        {filas.map(([dominio, n]) => (
          <li key={dominio} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{dominio}</span>
            <span className="shrink-0 tabular-nums text-muted">{t.ciVeces(n)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
