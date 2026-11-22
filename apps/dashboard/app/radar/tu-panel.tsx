'use client'

import Link from 'next/link'
import { useDict } from '@/lib/i18n/client'
import type { Dict } from '@/lib/i18n/dict'
import { useCitasListas } from './citas-vista'
import { esErrorCitas, nombreMotor, type Celda, type Citas } from './citas-tipos'
import { Seccion } from './seccion'

/**
 * "Así se vería tu panel": al final del resultado del Radar, el panel del
 * negocio en chico y en solo lectura, con datos del propio sitio. Las tareas
 * salen de lo que el Radar ya encontró y siguen las reglas del agente
 * (apps/gateway/src/tareas/generar.ts y prioridad.ts):
 *
 *   fix      el Radar encontró cosas que el kit agrega            puntaje 90
 *   mención  pregunta sin cita donde la IA cita medios o listas   72 + citas, tope 80, máx. 2
 *   página   pregunta sin cita: publicar la página que responde   75 (con borrador)
 *
 * Se muestran las tres de más puntaje, sin repetir pregunta si hay otra
 * opción. Las citas no se piden de nuevo: se leen del resultado que ya trajo
 * SeccionCitas (useCitasListas). Cada botón lleva al registro y nada más.
 */

type T = Dict['radarPanel']
type M = Dict['miAgente']

type Impacto = 'high' | 'medium' | 'low'
type Esfuerzo = 'small' | 'medium' | 'large'

type Vista = {
  clave: string
  kind: 'fix' | 'content'
  pie: 'fix' | 'mencion' | 'pagina'
  score: number
  impact: Impacto
  effort: Esfuerzo
  titulo: string
  porQue: string
  /** La pregunta de la que sale, para no mostrar dos tareas de la misma si hay otra. */
  pregunta: string | null
  /** Lo que el Radar encontró, en una lista corta bajo la razón. */
  detalle?: string[]
}

/** Como en generar.ts: cuántas "que te nombren" a la vez. */
const MAX_MENCIONES = 2
/** Como en partes.tsx del panel: las tres primeras a la vista. */
const VISIBLES = 3

type SinCita = { pregunta: string; motores: string[]; medios: { dominio: string; citas: number }[]; citas: number }

/**
 * Las preguntas donde ningún asistente citó el sitio, con los medios y listas
 * que sí citaron (los `publisher` del Radar), como preguntasSinCita del gateway.
 * Una respuesta que cita dos páginas del mismo medio cuenta una vez.
 */
function preguntasSinCita(c: Citas, dominio: string): SinCita[] {
  const propio = (d: string) => d === dominio || d.endsWith(`.${dominio}`)
  const medios = c.citedInstead.filter((x) => x.kind === 'publisher').map((x) => x.domain)
  const medioDe = (d: string) => medios.find((m) => d === m || d.endsWith(`.${m}`)) ?? null
  const salida: SinCita[] = []
  for (const q of c.questions) {
    const respondidas = c.engines.map((id) => [id, q.engines[id]] as const).filter((x): x is readonly [string, Celda] => !!x[1])
    if (respondidas.length === 0 || respondidas.some(([, celda]) => celda.cited)) continue
    const cuenta = new Map<string, number>()
    for (const [, celda] of respondidas) {
      const contados = new Set<string>()
      for (const s of celda.sources) {
        const m = propio(s) ? null : medioDe(s)
        if (!m || contados.has(m)) continue
        contados.add(m)
        cuenta.set(m, (cuenta.get(m) ?? 0) + 1)
      }
    }
    const lista = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([d, n]) => ({ dominio: d, citas: n }))
    salida.push({ pregunta: q.text, motores: respondidas.map(([id]) => nombreMotor(id)), medios: lista, citas: lista.reduce((n, x) => n + x.citas, 0) })
  }
  return salida.sort((a, b) => b.citas - a.citas)
}

function armarTareas(t: T, faltan: string[], c: Citas | null, dominio: string): Vista[] {
  const todas: Vista[] = []
  if (faltan.length > 0) {
    todas.push({
      clave: 'fix:kit',
      kind: 'fix',
      pie: 'fix',
      score: 90,
      impact: 'high',
      effort: 'small',
      titulo: t.fixTitulo,
      porQue: t.fixPorQue(faltan.length),
      pregunta: null,
      detalle: [...faltan.slice(0, 2), ...(faltan.length > 2 ? [t.yMas(faltan.length - 2)] : [])],
    })
  }
  if (c) {
    const sin = preguntasSinCita(c, dominio)
    for (const m of sin.filter((x) => x.medios.length > 0).slice(0, MAX_MENCIONES)) {
      todas.push({
        clave: `mencion:${m.pregunta}`,
        kind: 'content',
        pie: 'mencion',
        score: Math.min(80, 72 + m.citas),
        impact: 'high',
        effort: 'medium',
        titulo: t.mencionTitulo(m.pregunta),
        porQue: t.mencionPorQue(m.medios.slice(0, 3).map((x) => x.dominio)),
        pregunta: m.pregunta,
      })
    }
    for (const p of sin) {
      todas.push({
        clave: `pagina:${p.pregunta}`,
        kind: 'content',
        pie: 'pagina',
        score: 75,
        impact: 'high',
        effort: 'small',
        titulo: t.paginaTitulo(p.pregunta),
        porQue: t.paginaPorQue(p.motores),
        pregunta: p.pregunta,
      })
    }
  }
  // Orden del agente (a igual puntaje, la mención antes que la página: así está en el arreglo).
  const orden = todas.map((v, i) => ({ v, i })).sort((a, b) => b.v.score - a.v.score || a.i - b.i)
  const elegidas: typeof orden = []
  const usadas = new Set<string>()
  for (const x of orden) {
    if (elegidas.length >= VISIBLES) break
    if (x.v.pregunta && usadas.has(x.v.pregunta)) continue
    elegidas.push(x)
    if (x.v.pregunta) usadas.add(x.v.pregunta)
  }
  // Si no alcanzan preguntas distintas, se completa con las que quedaron.
  for (const x of orden) {
    if (elegidas.length >= VISIBLES) break
    if (!elegidas.includes(x)) elegidas.push(x)
  }
  return elegidas.sort((a, b) => b.v.score - a.v.score || a.i - b.i).map((x) => x.v)
}

export function TuPanel({
  dominio,
  n,
  usd,
  faltan,
  pais = '',
  ciudad = '',
}: {
  dominio: string
  /** Número de la sección en el Radar ("03"). */
  n: string
  usd: number
  /** Lo que le falta al sitio y el kit agrega, ya en texto (títulos de "Lo que falta"). */
  faltan: string[]
  /** Los mismos que recibe SeccionCitas: con ellos se encuentra su resultado. */
  pais?: string
  ciudad?: string
}) {
  const { radarPanel: t, miAgente: m } = useDict()
  const r = useCitasListas(dominio, pais, ciudad)
  const citas = r && !esErrorCitas(r) ? r : null
  const fallo = r !== null && citas === null
  const tareas = armarTareas(t, faltan, citas, dominio)
  const registro = `/nuevo?url=${encodeURIComponent(dominio)}&plan=1`

  return (
    <Seccion n={n} titulo={t.titulo}>
      <p className="max-w-2xl text-sm text-muted">{t.intro(dominio)}</p>

      {/* El panel en chico: una carcasa y adentro la pantalla, como se ve al entrar. */}
      <div className="rounded-[14px] border border-border bg-panel p-1.5">
        <div className="overflow-hidden rounded-[10px] border border-border bg-bg">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <span className="min-w-0 truncate font-mono text-xs text-muted">{dominio}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-faint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t.soloLectura}
            </span>
          </div>

          <div className="grid gap-6 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <section className="min-w-0 space-y-3">
              <div className="flex items-baseline gap-2.5">
                <h3 className="text-lg font-semibold tracking-tight">{m.tareas}</h3>
                {r !== null && tareas.length > 0 ? (
                  <span className="text-sm text-muted">
                    {tareas.length} {m.grupoAbiertas.toLowerCase()}
                  </span>
                ) : null}
              </div>
              {r !== null && tareas.length === 0 ? <p className="text-sm text-muted">{fallo ? t.sinCitasTareas : t.vacio}</p> : null}
              <ul className="space-y-3">
                {tareas.map((x, i) => (
                  <Tarjeta key={x.clave} v={x} m={m} t={t} primera={i === 0 && tareas.length > 1} href={registro} />
                ))}
                {r === null ? (
                  <li role="status" className="flex items-center gap-3 rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted">
                    <span aria-hidden className="radar-latido h-2 w-2 shrink-0 rounded-full bg-accent" />
                    {t.esperandoTareas}
                  </li>
                ) : null}
              </ul>
              {fallo && tareas.length > 0 ? <p className="text-sm text-muted">{t.sinCitasTareas}</p> : null}
            </section>

            <PorAsistente c={citas} esperando={r === null} m={m} t={t} />
          </div>
        </div>
      </div>

      {/* La única acción principal del bloque. */}
      <div className="space-y-2">
        <Link href={registro} className="btn btn-primario w-full whitespace-normal text-center sm:w-auto">
          {t.cta}
        </Link>
        <p className="text-xs text-muted">{t.ctaPrecio(usd)}</p>
      </div>
    </Seccion>
  )
}

/** La tarjeta de una tarea, como en el panel (agente/partes.tsx), con una sola acción: ir al registro. */
function Tarjeta({ v, m, t, primera, href }: { v: Vista; m: M; t: T; primera: boolean; href: string }) {
  const meta = [m.tipos[v.kind] ?? v.kind, m.impacto[v.impact], m.esfuerzo[v.effort]]
  return (
    <li className="tarjeta space-y-3 p-3.5 text-sm sm:p-4">
      <div className="space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {primera ? <span className="font-medium text-accent">{m.primeroEsta}</span> : null}
          {meta.map((x, i) => (
            <span key={x} className="flex items-center gap-2">
              {i > 0 || primera ? <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-faint" /> : null}
              {x}
            </span>
          ))}
        </p>
        <h4 className="text-balance break-words text-base font-semibold leading-snug">{v.titulo}</h4>
        <p className="max-w-[65ch] break-words text-muted">{v.porQue}</p>
        {v.detalle?.length ? (
          <ul className="space-y-1 pt-1 text-xs text-muted">
            {v.detalle.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <span aria-hidden className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-faint" />
                <span className="min-w-0 break-words">{d}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {/* Al pie, como en las acciones del panel: qué te deja el agente a la izquierda, el botón a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
        <p className="min-w-0 text-xs text-muted">{t.pie[v.pie]}</p>
        <Link href={href} className="btn btn-secundario btn-chico btn-suave">
          {t.hacer}
        </Link>
      </div>
    </li>
  )
}

type Estado = 'cita' | 'nombra' | 'no' | 'sin-respuesta'

const estadoDe = (celda: Celda | undefined): Estado => (!celda ? 'sin-respuesta' : celda.cited ? 'cita' : celda.mentioned ? 'nombra' : 'no')

/** Las mismas marcas del historial del panel (agente/citas/historia.tsx): cuatro formas, el verde solo para "te cita". */
function Marca({ estado, etiqueta }: { estado: Estado; etiqueta: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0" role="img" aria-label={etiqueta}>
      <title>{etiqueta}</title>
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

/** Las citas por asistente, como "Cómo vas" del panel: "ChatGPT, 0 de 3 respuestas" y una marca por pregunta. */
function PorAsistente({ c, esperando, m, t }: { c: Citas | null; esperando: boolean; m: M; t: T }) {
  const { radar } = useDict()
  const nombreEstado: Record<Estado, string> = {
    cita: radar.citas.marca.citado,
    nombra: radar.citas.marca.mencionado,
    no: radar.citas.marca.no,
    'sin-respuesta': radar.citas.marca.sinRespuesta,
  }
  return (
    <section className="tarjeta min-w-0 self-start p-3.5 sm:p-4">
      <h3 className="text-base font-semibold tracking-tight">{m.citTitulo}</h3>
      {esperando ? (
        <p role="status" className="mt-2 flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="radar-latido h-2 w-2 shrink-0 rounded-full bg-accent" />
          {t.citasEsperando}
        </p>
      ) : !c ? (
        <p className="mt-2 text-sm text-muted">{t.citasError}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">{t.citasSub(c.questions.length)}</p>
          <ul className="mt-3 divide-y divide-border">
            {[...c.engines, ...c.failed].map((id) => {
              const cob = c.coverage[id]
              const contesto = c.engines.includes(id) && cob && cob.total > 0
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted">{nombreMotor(id)}</p>
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {contesto ? t.valor(cob.cited, cob.total) : <span className="text-sm font-normal text-muted">{t.sinRespuesta}</span>}
                    </p>
                  </div>
                  {contesto ? (
                    <span className="flex shrink-0 items-center gap-1">
                      {c.questions.map((q, i) => {
                        const e = estadoDe(q.engines[id])
                        return <Marca key={i} estado={e} etiqueta={t.marca(nombreMotor(id), i + 1, nombreEstado[e])} />
                      })}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
