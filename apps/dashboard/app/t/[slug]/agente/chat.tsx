'use client'

import type { AgentAction, AgentMessage, AgentMessageLink } from '@peaje/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { empezarDeNuevo, resolverAccion } from './actions'
import { novedadesChat } from './chat-novedades'

/** Chat con el agente Pro del negocio. El historial vive en la base (lo comparte Telegram). */
export function Chat({ slug, inicial, primerMensaje = null }: { slug: string; inicial: AgentMessage[]; primerMensaje?: string | null }) {
  const { miAgente: t, agenteReportes: r } = useDict()
  const [mensajes, setMensajes] = useState(inicial)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState<string | null>(null)
  const router = useRouter()
  const caja = useRef<HTMLDivElement>(null)

  // Baja solo la caja de mensajes: scrollIntoView también movía la página y
  // al abrir Mi agente la dejaba en medio, sobre el chat.
  useEffect(() => {
    const c = caja.current
    if (c) c.scrollTop = c.scrollHeight
  }, [mensajes.length, pending])

  // Trabajos en segundo plano (una página, una serie): mientras haya alguno,
  // se consulta cada 8 s y el aviso de "lista" entra al chat con su tarjeta.
  const [trabajando, setTrabajando] = useState(false)
  const [vuelta, setVuelta] = useState(0)
  const ultimaFecha = mensajes.filter((m) => !m.id.startsWith('tmp-')).at(-1)?.createdAt ?? null
  useEffect(() => {
    if (pending) return
    let vivo = true
    const id = setTimeout(
      async () => {
        try {
          const r = await novedadesChat(slug, ultimaFecha)
          if (!vivo) return
          if (r.mensajes.length) {
            setMensajes((ms) => [...ms, ...r.mensajes.filter((n) => !ms.some((m) => m.id === n.id))])
            router.refresh()
          }
          setTrabajando(r.pendientes)
          // Sigue consultando solo mientras haya trabajos (tope: 10 minutos).
          if (r.pendientes && vuelta < 75) setVuelta((v) => v + 1)
        } catch {
          // Sin novedades: el próximo mensaje vuelve a mirar.
        }
      },
      vuelta === 0 ? 1_500 : 8_000,
    )
    return () => {
      vivo = false
      clearTimeout(id)
    }
  }, [slug, pending, vuelta, ultimaFecha, router])

  const enviar = (valor: string) => {
    const limpio = valor.trim()
    if (!limpio || pending) return
    setError(null)
    setTexto('')
    const provisional: AgentMessage = { id: `tmp-${Date.now()}`, tenantId: '', role: 'user', text: limpio, actions: [], options: [], links: [], channel: 'dashboard', createdAt: new Date().toISOString() }
    setMensajes((m) => [...m, provisional])
    start(async () => {
      setEstado(null)
      try {
        const respuesta = await conversarEnVivo(slug, limpio, setEstado)
        setMensajes((m) => [...m, respuesta])
        // Pudo dejar un trabajo en segundo plano: se vuelve a mirar.
        setVuelta(0)
        // El agente pudo armar el plan, crear tareas o lanzar la medición: se vuelve a leer lo de abajo.
        router.refresh()
      } catch (e) {
        const msj = e instanceof Error ? e.message : String(e)
        setError(/fetch failed|ECONNREFUSED|gateway-unreachable/i.test(msj) ? t.sinGateway : msj)
      } finally {
        setEstado(null)
      }
    })
  }

  // ?m= (por ejemplo desde /pago/listo, "arma mi plan"): se manda una sola vez y
  // se saca de la URL para que recargar no lo repita.
  const mandado = useRef(false)
  useEffect(() => {
    if (!primerMensaje || mandado.current) return
    mandado.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('m')
    window.history.replaceState(window.history.state, '', url)
    enviar(primerMensaje)
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="border border-border">
      {/* En el celular, media pantalla: así el campo de texto queda a la vista junto a los mensajes. */}
      <div ref={caja} className="max-h-[50dvh] min-h-40 space-y-4 overflow-y-auto p-4 sm:max-h-[520px]">
        {mensajes.length === 0 ? <p className="text-sm text-muted">{t.chatVacio}</p> : null}
        {mensajes.map((m) => (
          <Mensaje key={m.id} slug={slug} mensaje={m} />
        ))}
        {(() => {
          const ultimo = mensajes[mensajes.length - 1]
          if (!ultimo || ultimo.role !== 'assistant' || !ultimo.options?.length || pending) return null
          return (
            <div className="flex flex-wrap gap-2">
              {ultimo.options.map((o) => (
                <button key={o} onClick={() => enviar(o)} className="btn btn-secundario btn-chico whitespace-normal">
                  {o}
                </button>
              ))}
            </div>
          )
        })()}
        {pending ? <p className="font-mono text-xs text-muted">{estado ?? t.pensando}</p> : null}
        {!pending && trabajando ? <p className="font-mono text-xs text-muted">{r.chatTrabajando}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 pt-3">
        {t.sugerencias.map((s) => (
          <button key={s} disabled={pending} onClick={() => enviar(s)} className="btn btn-secundario btn-chico whitespace-normal text-muted hover:text-text">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviar(texto)
        }}
        className="flex gap-2 p-4"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t.chatPlaceholder}
          maxLength={4000}
          // 16px en el celular: con menos, iOS hace zoom al enfocar el campo.
          className="min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-base outline-none focus:border-text sm:text-sm"
        />
        <button disabled={pending || !texto.trim()} className="btn btn-primario">
          {t.enviar}
        </button>
      </form>
      {mensajes.length > 0 ? (
        <div className="px-4 pb-3">
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await empezarDeNuevo(slug)
                setMensajes([])
              })
            }
            className="btn btn-secundario btn-chico"
          >
            {t.reiniciar}
          </button>
        </div>
      ) : null}
      {error ? <p className="px-4 pb-3 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function Mensaje({ slug, mensaje }: { slug: string; mensaje: AgentMessage }) {
  const [acciones, setAcciones] = useState<AgentAction[]>(mensaje.actions)
  const deUsuario = mensaje.role === 'user'
  return (
    <div className={deUsuario ? 'flex justify-end' : ''}>
      <div className={deUsuario ? 'max-w-[80%] break-words bg-panel-2 px-3 py-2 text-sm' : 'max-w-[92%] break-words text-sm'}>
        {deUsuario ? <p className="whitespace-pre-wrap leading-relaxed">{mensaje.text}</p> : <Texto texto={mensaje.text} />}
        {acciones.map((a) => (
          <Accion key={a.id} slug={slug} messageId={mensaje.id} accion={a} alCambiar={setAcciones} />
        ))}
        {mensaje.links?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {mensaje.links.map((l) => (
              <Tarjeta key={l.url} link={l} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Una tarjeta del agente: abre el reporte, la tarea o la página. Las del dashboard abren en la misma pestaña. */
function Tarjeta({ link }: { link: AgentMessageLink }) {
  let interna: string | null = null
  try {
    const u = new URL(link.url)
    if (u.pathname.startsWith('/t/')) interna = `${u.pathname}${u.search}${u.hash}`
  } catch {
    interna = null
  }
  const clase = 'btn btn-secundario btn-chico justify-start whitespace-normal text-left'
  const marca = <span aria-hidden className="font-mono text-xs text-muted">{link.kind === 'task' ? '▤' : link.kind === 'page' ? '↗' : '▦'}</span>
  return interna ? (
    <Link href={interna} className={clase}>
      {marca}
      {link.label}
    </Link>
  ) : (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={clase}>
      {marca}
      {link.label}
    </a>
  )
}

function Accion({ slug, messageId, accion, alCambiar }: { slug: string; messageId: string; accion: AgentAction; alCambiar: (a: AgentAction[]) => void }) {
  const { miAgente: t } = useDict()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const resolver = (aplicar: boolean) =>
    start(async () => {
      setError(null)
      try {
        alCambiar(await resolverAccion(slug, messageId, accion.id, aplicar))
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  return (
    <div className="mt-3 border border-border p-3">
      <p className="font-mono text-xs">{accion.summary}</p>
      {accion.status === 'pending' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t.propuesta}</span>
          <button disabled={pending} onClick={() => resolver(true)} className="btn btn-primario btn-chico">
            {t.aplicar}
          </button>
          <button disabled={pending} onClick={() => resolver(false)} className="btn btn-secundario btn-chico">
            {t.descartar}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">{accion.status === 'applied' ? t.aplicado : t.descartado}</p>
      )}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

/**
 * Markdown mínimo del agente: párrafos, listas con "- " o "1. ", **negrita** y
 * `código`. Sin HTML crudo: todo sale como elementos de React.
 */
function Texto({ texto }: { texto: string }) {
  const bloques = texto.split(/\n{2,}/)
  return (
    <div className="space-y-2 leading-relaxed">
      {bloques.map((b, i) => {
        const lineas = b.split('\n')
        if (lineas.every((l) => /^\s*(-|\*|\d+\.)\s+/.test(l))) {
          const ordenada = /^\s*\d+\./.test(lineas[0] ?? '')
          const items = lineas.map((l, j) => <li key={j}>{enLinea(l.replace(/^\s*(-|\*|\d+\.)\s+/, ''))}</li>)
          return ordenada ? <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol> : <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {enLinea(b)}
          </p>
        )
      })}
    </div>
  )
}

function enLinea(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) return <strong key={i}>{parte.slice(2, -2)}</strong>
    if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) return <code key={i} className="bg-panel-2 px-1 font-mono text-xs">{parte.slice(1, -1)}</code>
    return parte
  })
}

/**
 * Manda el mensaje y lee el stream del agente: cada `status` actualiza la
 * línea de "qué está haciendo"; `message` trae la respuesta guardada.
 */
async function conversarEnVivo(slug: string, texto: string, alEstado: (e: string) => void): Promise<AgentMessage> {
  const res = await fetch(`/t/${slug}/agente/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: texto }) })
  if (!res.body) throw new Error(`HTTP ${res.status}`)
  const lector = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let corte: number
    while ((corte = buffer.indexOf('\n\n')) !== -1) {
      const bloque = buffer.slice(0, corte)
      buffer = buffer.slice(corte + 2)
      const evento = /^event: (.+)$/m.exec(bloque)?.[1]?.trim() ?? 'message'
      const data = bloque
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n')
      if (evento === 'status') alEstado(data)
      else if (evento === 'error') throw new Error(data)
      else if (evento === 'message') return JSON.parse(data) as AgentMessage
    }
  }
  throw new Error('The agent did not answer. Try again.')
}
