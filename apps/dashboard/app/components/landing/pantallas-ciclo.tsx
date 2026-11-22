import type { Dict } from '@/lib/i18n'
import { ASISTENTES, citadas, historialDe } from './muestra'
import { Ejemplo, Icono, ICONOS, Marca, Marco, Punto, type Estado } from './piezas'

/**
 * Las cuatro pantallas del ciclo del home, una por paso, armadas en el
 * servidor con las piezas del panel: cómo vas por asistente, la tarjeta de
 * una tarea, la lista de tareas con su estado y el historial de una pregunta.
 * Negocio de ejemplo, rotulado como tal en la barra de cada marco.
 */

const primeraMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Barra({ d, titulo }: { d: Dict; titulo: string }) {
  return (
    <>
      <span className="min-w-0 truncate text-xs text-muted">
        {titulo} <span className="text-faint">·</span> <span className="font-mono">{d.landing.muestraDominio}</span>
      </span>
      <Ejemplo texto={d.landing.ejemplo} />
    </>
  )
}

function estadosDe(d: Dict): Record<Estado, string> {
  const m = d.radar.citas.marca
  return { cita: m.citado, nombra: m.mencionado, no: m.no }
}

/** Paso 1: en cuántas respuestas sales, por asistente y por pregunta. */
export function PantallaMide({ d }: { d: Dict }) {
  const t = d.landing
  const p = d.radarPanel
  const nombreEstado = estadosDe(d)
  return (
    <Marco barra={<Barra d={d} titulo={d.miAgente.citTitulo} />}>
      <div className="space-y-5 p-4 sm:p-6">
        <ul className="grid gap-3 sm:grid-cols-2">
          {ASISTENTES.map((a) => (
            <li key={a.id} className="tarjeta p-4">
              <p className="flex items-center gap-2 text-sm text-muted">
                <Punto id={a.id} />
                {a.nombre}
              </p>
              <p className="mt-2 text-3xl leading-none font-semibold tracking-tight tabular-nums">
                {citadas(a.respuestas)}
                <span className="text-base font-medium text-muted"> {d.radar.citas.deTotal(a.respuestas.length)}</span>
              </p>
              <div className="mt-3 flex gap-1.5" aria-hidden>
                {a.respuestas.map((e, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${e === 'cita' ? 'bg-accent' : e === 'nombra' ? 'bg-accent/40' : 'bg-border'}`} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div>
          <p className="text-xs text-muted">{t.pantallaPreguntas}</p>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {t.muestraPreguntas.map((q, i) => (
              <li key={q} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0 text-sm leading-5">{q}</span>
                <span className="flex shrink-0 gap-1">
                  {ASISTENTES.map((a) => {
                    const e = a.respuestas[i] ?? 'no'
                    return <Marca key={a.id} estado={e} etiqueta={p.marca(a.nombre, i + 1, nombreEstado[e])} />
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Marco>
  )
}

/** Paso 2: la tarjeta de una tarea, como en el panel. */
export function PantallaTarea({ d }: { d: Dict }) {
  const t = d.landing
  const m = d.miAgente
  const p = d.radarPanel
  const pregunta = t.muestraPreguntas[0]!
  const meta = [m.tipos.content, m.impacto.high, m.esfuerzo.small]
  return (
    <Marco barra={<Barra d={d} titulo={m.tareas} />}>
      <div className="space-y-3 p-4 sm:p-6">
        <div className="tarjeta space-y-3 p-4 text-sm">
          <div className="space-y-1.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="font-medium text-accent">{m.primeroEsta}</span>
              {meta.map((x) => (
                <span key={x} className="flex items-center gap-2">
                  <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-faint" />
                  {x}
                </span>
              ))}
            </p>
            <p className="text-base leading-snug font-semibold text-balance break-words">{p.paginaTitulo(pregunta)}</p>
            <p className="max-w-[60ch] break-words text-muted">{p.paginaPorQue(ASISTENTES.map((a) => a.nombre))}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
            <p className="min-w-0 text-xs text-muted">{p.pie.pagina}</p>
            {/* Es un ejemplo: tiene la forma del botón del panel, pero no lleva a ningún lado. */}
            <span aria-hidden className="btn btn-secundario btn-chico btn-suave pointer-events-none">
              {p.hacer}
            </span>
          </div>
        </div>
        <div className="tarjeta space-y-1.5 p-4 text-sm opacity-70">
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {m.tipos.content}
            <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-faint" />
            {m.impacto.high}
          </p>
          <p className="leading-snug font-semibold text-balance break-words">{p.mencionTitulo(pregunta)}</p>
        </div>
      </div>
    </Marco>
  )
}

/** Paso 3: las tareas con su estado, de "en curso" a "verificada". */
export function PantallaHace({ d }: { d: Dict }) {
  const t = d.landing
  const m = d.miAgente
  return (
    <Marco barra={<Barra d={d} titulo={m.tareas} />}>
      <ul className="space-y-3 p-4 sm:p-6">
        {t.pantallaTareas.map((x) => (
          <li key={x.titulo} className="tarjeta flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="leading-snug font-semibold text-balance break-words">{x.titulo}</p>
              <p className="text-xs text-muted">{x.nota}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium ${
                x.estado === 'verified'
                  ? 'bg-accent text-accent-text'
                  : x.estado === 'done'
                    ? 'border border-border text-text'
                    : 'border border-dashed border-border text-muted'
              }`}
            >
              {x.estado === 'verified' ? (
                <svg aria-hidden viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONOS.check} />
                </svg>
              ) : x.estado === 'done' ? (
                <svg aria-hidden viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4.75V8l2 1.5" />
                </svg>
              ) : (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              )}
              {primeraMayuscula(m.estados[x.estado] ?? x.estado)}
            </span>
          </li>
        ))}
      </ul>
    </Marco>
  )
}

/** Paso 4: la misma pregunta, medición por medición. */
export function PantallaVuelve({ d }: { d: Dict }) {
  const t = d.landing
  const p = d.radarPanel
  const nombreEstado = estadosDe(d)
  return (
    <Marco barra={<Barra d={d} titulo={d.miAgente.citTitulo} />}>
      <div className="space-y-4 p-4 sm:p-6">
        {t.muestraPreguntas.slice(0, 2).map((q, i) => (
          <div key={q} className="tarjeta p-4">
            <p className="text-sm leading-5 font-medium">{q}</p>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,4.75rem))] items-center gap-x-2 gap-y-2.5 text-xs">
              <span />
              {t.pantallaRondas.map((r) => (
                <span key={r} className="text-center leading-4 text-faint">
                  {r}
                </span>
              ))}
              {ASISTENTES.map((a) => (
                <div key={a.id} className="contents">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
                    <Punto id={a.id} />
                    <span className="truncate">{a.nombre}</span>
                  </span>
                  {historialDe(i, a.id).map((e, j) => (
                    <span key={j} className="flex justify-center">
                      <Marca estado={e} etiqueta={`${p.marca(a.nombre, i + 1, nombreEstado[e])} (${t.pantallaRondas[j]})`} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="flex items-start gap-2 text-xs leading-5 text-muted">
          <Icono d={ICONOS.vuelta} className="mt-px h-4 w-4" />
          {t.pantallaHistorialNota}
        </p>
      </div>
    </Marco>
  )
}
