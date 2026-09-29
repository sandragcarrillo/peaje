'use client'

import type { AgentAction, AgentMessage } from '@peaje/db'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { empezarDeNuevo, resolverAccion } from './actions'

/** Chat con el agente Pro del negocio. El historial vive en la base (lo comparte Telegram). */
export function Chat({ slug, inicial }: { slug: string; inicial: AgentMessage[] }) {
  const { miAgente: t } = useDict()
  const [mensajes, setMensajes] = useState(inicial)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState<string | null>(null)
  const router = useRouter()
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'nearest' })
  }, [mensajes.length, pending])

  const enviar = (valor: string) => {
    const limpio = valor.trim()
    if (!limpio || pending) return
    setError(null)
    setTexto('')
    const provisional: AgentMessage = { id: `tmp-${Date.now()}`, tenantId: '', role: 'user', text: limpio, actions: [], options: [], channel: 'dashboard', createdAt: new Date().toISOString() }
    setMensajes((m) => [...m, provisional])
    start(async () => {
      setEstado(null)
      try {
        const respuesta = await conversarEnVivo(slug, limpio, setEstado)
        setMensajes((m) => [...m, respuesta])
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

  return (
    <div className="border border-border">
      <div className="max-h-[520px] min-h-40 space-y-4 overflow-y-auto p-4">
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
                <button key={o} onClick={() => enviar(o)} className="rounded-full border border-text/60 px-3 py-1.5 text-sm hover:bg-panel-2">
                  {o}
                </button>
              ))}
            </div>
          )
        })()}
        {pending ? <p className="font-mono text-xs text-muted">{estado ?? t.pensando}</p> : null}
        <div ref={fin} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 pt-3">
        {t.sugerencias.map((s) => (
          <button key={s} disabled={pending} onClick={() => enviar(s)} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-text disabled:opacity-50">
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
          className="flex-1 rounded-none border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-text"
        />
        <button disabled={pending || !texto.trim()} className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
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
            className="text-xs text-muted underline hover:text-text disabled:opacity-50"
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
      <div className={deUsuario ? 'max-w-[80%] bg-panel-2 px-3 py-2 text-sm' : 'max-w-[92%] text-sm'}>
        {deUsuario ? <p className="whitespace-pre-wrap leading-relaxed">{mensaje.text}</p> : <Texto texto={mensaje.text} />}
        {acciones.map((a) => (
          <Accion key={a.id} slug={slug} messageId={mensaje.id} accion={a} alCambiar={setAcciones} />
        ))}
      </div>
    </div>
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
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted">{t.propuesta}</span>
          <button disabled={pending} onClick={() => resolver(true)} className="rounded-lg bg-text px-3 py-1 text-xs font-medium text-bg disabled:opacity-50">
            {t.aplicar}
          </button>
          <button disabled={pending} onClick={() => resolver(false)} className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-50">
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
