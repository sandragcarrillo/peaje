import type { CSSProperties } from 'react'
import type { MensajeChat } from '@/lib/i18n/sections/landing'
import { LogoMark } from './logo'

/**
 * Conversación de ejemplo con el agente de Peaje en Telegram (hero de la
 * landing). Solo ejemplo.com / example.com; números ilustrativos.
 *
 * Componente de servidor, sin JS: el primer intercambio (pregunta y
 * respuesta) llega visible en el HTML, así la caja nunca se ve vacía. El resto
 * entra mensaje a mensaje con animaciones CSS que arrancan con el primer
 * pintado (globals.css, `.chat-msg` y `.chat-escribiendo`); antes de cada
 * mensaje del agente sale "escribiendo…". Todo el texto está en el DOM desde
 * el principio, así lectores de pantalla, buscadores y agentes lo leen
 * completo, y la altura final queda reservada: no hay salto de diseño. Con
 * movimiento reducido se ve todo de una.
 */

/** Mensajes que ya vienen visibles: el primer intercambio. */
const VISIBLES_AL_CARGAR = 2
/** Pausa para leer el primer intercambio antes de que siga la conversación. */
const INICIO_MS = 1600
const ESCRIBIENDO_MS = 1000
const PAUSA_DUENO_MS = 450
const PAUSA_TRAS_MENSAJE_MS = 650

/** Gris del chrome del chat (cabecera y remitentes): 5:1 sobre el panel de tinta. */
const CHROME = 'text-[#9a958c]'

type Paso = { aparece: number; escribe?: { desde: number; dura: number } }

/** Cuándo aparece cada mensaje y cuándo se ve el "escribiendo…" antes de los del agente. */
function lineaDeTiempo(mensajes: MensajeChat[]): Paso[] {
  let t = INICIO_MS
  return mensajes.map((m, i) => {
    if (i < VISIBLES_AL_CARGAR) return { aparece: 0 }
    let escribe: Paso['escribe']
    if (m.de === 'agente') {
      escribe = { desde: t, dura: ESCRIBIENDO_MS }
      t += ESCRIBIENDO_MS
    } else {
      t += PAUSA_DUENO_MS
    }
    const aparece = t
    t += PAUSA_TRAS_MENSAJE_MS
    return { aparece, escribe }
  })
}

type Props = {
  mensajes: MensajeChat[]
  ejemplo: string
  negocio: string
  bot: string
  subtitulo: string
  tu: string
}

export function ChatEjemplo({ mensajes, ejemplo, negocio, bot, subtitulo, tu }: Props) {
  const pasos = lineaDeTiempo(mensajes)

  return (
    <aside
      aria-label={`${ejemplo}: ${bot} · ${negocio}`}
      className="isla-tinta overflow-hidden border border-border bg-bg text-text"
    >
      {/* Cabecera tipo chat: el bot y el negocio, sin logos de terceros. */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tinta-suave">
            <LogoMark className="h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold">{bot}</p>
            <p className={`etiqueta ${CHROME}`}>
              {subtitulo} · {negocio}
            </p>
          </div>
        </div>
        <span className="etiqueta shrink-0 border border-border px-1.5 py-0.5 text-muted">{ejemplo}</span>
      </div>

      <div aria-live="off" className="space-y-3 px-4 py-5">
        {mensajes.map((m, i) => {
          const agente = m.de === 'agente'
          const paso = pasos[i]
          const entra = paso && paso.aparece > 0
          return (
            <div key={i} className={`relative flex ${agente ? 'justify-start' : 'justify-end'}`}>
              {paso?.escribe ? (
                <p
                  aria-hidden
                  className="chat-escribiendo pointer-events-none absolute top-0 left-0 flex items-center gap-1.5 rounded-[6px] border border-border bg-panel px-3 py-2.5"
                  style={{ '--desde': `${paso.escribe.desde}ms`, '--dura': `${paso.escribe.dura}ms` } as CSSProperties}
                >
                  <span className="chat-punto" />
                  <span className="chat-punto [animation-delay:150ms]" />
                  <span className="chat-punto [animation-delay:300ms]" />
                </p>
              ) : null}
              <div
                data-entra={entra ? '' : undefined}
                style={entra ? ({ '--aparece': `${paso.aparece}ms` } as CSSProperties) : undefined}
                className={`chat-msg max-w-[85%] space-y-2 ${agente ? '' : 'items-end text-right'}`}
              >
                <p className={`etiqueta ${CHROME}`}>{agente ? bot : tu}</p>
                <p
                  className={`rounded-[6px] px-3 py-2 text-sm leading-snug ${
                    agente ? 'border border-border bg-panel text-left' : 'bg-crema text-left text-tinta'
                  }`}
                >
                  {m.texto}
                </p>
                {m.tarjeta ? (
                  <p className="flex items-center justify-between gap-4 border border-border bg-tinta-suave px-3 py-2 text-left text-sm">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-accent" />
                      {m.tarjeta.titulo}
                    </span>
                    <span className="etiqueta shrink-0 whitespace-nowrap font-bold text-accent">{m.tarjeta.accion} →</span>
                  </p>
                ) : null}
                {m.chip ? (
                  <p className="etiqueta inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-muted">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {m.chip}
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
