import type { Dict } from '@/lib/i18n'
import { ASISTENTES, citadas } from './muestra'
import { Ejemplo, EstadoTexto, Marca, Marco, Punto, type Estado } from './piezas'

/**
 * La pieza del hero: una respuesta del Radar con su forma real (la pregunta,
 * qué hizo cada asistente y a quién citó, cómo vas por asistente y a quién
 * cita la IA en tu lugar), con un negocio de ejemplo rotulado como ejemplo.
 * Al cargar, cada asistente "contesta" en orden una sola vez (CSS, sin JS);
 * con movimiento reducido se ve el estado final.
 */

const MS_PRIMERO = 900
const MS_ENTRE = 800

export function MuestraRadar({ d }: { d: Dict }) {
  const t = d.landing
  const c = d.radar.citas
  const p = d.radarPanel
  const nombreEstado: Record<Estado, string> = { cita: c.marca.citado, nombra: c.marca.mencionado, no: c.marca.no }
  const cito: Record<string, string> = { chatgpt: t.muestraCitoChatgpt, claude: t.muestraCitoClaude }
  const total = t.muestraPreguntas.length
  const finRespuestas = MS_PRIMERO + MS_ENTRE * ASISTENTES.length
  const maximo = Math.max(...t.muestraEnTuLugar.map((x) => x.veces))

  return (
    <figure className="text-left">
      <Marco
        barra={
          <>
            <span className="flex min-w-0 items-center gap-2.5 text-xs text-muted">
              <span aria-hidden className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-border" />
                <span className="h-2 w-2 rounded-full bg-border" />
                <span className="h-2 w-2 rounded-full bg-border" />
              </span>
              <span className="truncate">
                Radar <span className="text-faint">·</span> <span className="font-mono">{t.muestraDominio}</span>
              </span>
            </span>
            <Ejemplo texto={t.ejemplo} />
          </>
        }
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_18.5rem]">
          {/* La pregunta y lo que contestó cada asistente. */}
          <div className="min-w-0 p-4 sm:p-7">
            <p className="text-xs text-muted">{c.preguntaN(1, total)}</p>
            <p className="mt-1.5 max-w-[34ch] text-xl leading-snug font-medium tracking-[-0.01em] text-balance sm:text-2xl">{t.muestraPreguntas[0]}</p>

            <div className="mt-6 overflow-hidden rounded-[10px] border border-border">
              <div className="hidden grid-cols-[8.5rem_13.5rem_1fr] gap-4 border-b border-border bg-panel px-4 py-2 text-xs text-faint sm:grid">
                <span>{c.colAsistente}</span>
                <span>{c.colResultado}</span>
                <span>{c.colFuentes}</span>
              </div>
              <ul className="divide-y divide-border">
                {ASISTENTES.map((a, i) => {
                  const estado = a.respuestas[0]!
                  const ms = MS_PRIMERO + MS_ENTRE * i
                  return (
                    <li
                      key={a.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[8.5rem_13.5rem_1fr]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <Punto id={a.id} />
                        <span className="truncate">{a.nombre}</span>
                      </span>
                      {/* El latido y el resultado ocupan la misma celda: uno sale y el otro entra en --d. */}
                      <span className="grid justify-items-end sm:justify-items-start">
                        <span
                          aria-hidden
                          className="muestra-espera flex items-center gap-2 text-sm text-muted [grid-area:1/1]"
                          style={{ '--d': `${ms}ms` } as React.CSSProperties}
                        >
                          <span className="radar-latido h-2 w-2 shrink-0 rounded-full bg-accent" />
                          {t.muestraPreguntando}
                        </span>
                        <span className="muestra-llega [grid-area:1/1]" style={{ '--d': `${ms}ms` } as React.CSSProperties}>
                          <EstadoTexto estado={estado} etiqueta={nombreEstado[estado]} />
                        </span>
                      </span>
                      <span
                        className="muestra-llega col-span-2 min-w-0 text-sm leading-5 text-muted sm:col-span-1"
                        style={{ '--d': `${ms + 120}ms` } as React.CSSProperties}
                      >
                        <span className="text-faint sm:hidden">{c.colFuentes}: </span>
                        {cito[a.id] ?? ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-semibold">{c.enTuLugar}</h3>
              <ul className="mt-3 space-y-2.5">
                {t.muestraEnTuLugar.map((x, i) => (
                  <li key={x.quien} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">{x.quien}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{c.vecesCitado(x.veces)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-border/60" aria-hidden>
                      <div
                        className="muestra-barra h-1 rounded-full bg-text/70"
                        style={{ width: `${Math.round((x.veces / maximo) * 100)}%`, '--d': `${finRespuestas + 150 * i}ms` } as React.CSSProperties}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Cómo vas, por asistente, como en el panel. */}
          <aside className="border-t border-border bg-panel/70 p-4 sm:p-7 lg:border-t-0 lg:border-l">
            <h3 className="text-base font-semibold tracking-tight">{d.miAgente.citTitulo}</h3>
            <p className="mt-1 text-xs leading-5 text-muted">{p.citasSub(total)}</p>
            <ul className="mt-4 divide-y divide-border">
              {ASISTENTES.map((a, i) => (
                <li
                  key={a.id}
                  className="muestra-llega flex items-center justify-between gap-3 py-3 first:pt-0"
                  style={{ '--d': `${MS_PRIMERO + MS_ENTRE * i + 200}ms` } as React.CSSProperties}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted">{a.nombre}</p>
                    <p className="mt-0.5 font-semibold tabular-nums">{p.valor(citadas(a.respuestas), a.respuestas.length)}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1">
                    {a.respuestas.map((e, j) => (
                      <Marca key={j} estado={e} etiqueta={p.marca(a.nombre, j + 1, nombreEstado[e])} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="muestra-llega mt-4 flex items-start gap-2.5 border-t border-border pt-4 text-sm"
              style={{ '--d': `${finRespuestas + 300}ms` } as React.CSSProperties}
            >
              <span aria-hidden className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {t.muestraAgente}
            </p>
          </aside>
        </div>
      </Marco>
      <figcaption className="mt-4 text-center text-xs text-muted">{t.ejemploNota}</figcaption>
    </figure>
  )
}
