'use client'

import type { AgentAction, AgentMessage, AgentMessageLink } from '@peaje/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { LogoMark } from '@/app/components/logo'
import { useDict, useLocale } from '@/lib/i18n/client'
import { resolverAccion } from './actions'
import { novedadesChat } from './chat-novedades'

/**
 * Chat con el agente Pro del negocio, en su propia página (/t/[slug]/chat).
 * El historial vive en la base (lo comparte Telegram). Sin mensajes, la
 * portada: la pregunta grande, el campo y sugerencias para empezar. Con
 * mensajes, la conversación ocupa la página y el campo queda abajo.
 */
export function Chat({ slug, inicial, primerMensaje = null }: { slug: string; inicial: AgentMessage[]; primerMensaje?: string | null }) {
  const { miAgente: t, agenteReportes: r } = useDict()
  const [mensajes, setMensajes] = useState(inicial)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [estado, setEstado] = useState<string | null>(null)
  const router = useRouter()
  const caja = useRef<HTMLDivElement>(null)
  // Si la persona subió a leer, una respuesta nueva no la baja de golpe: aparece el aviso.
  const [abajo, setAbajo] = useState(true)
  const [hayNueva, setHayNueva] = useState(false)

  const bajar = () => {
    const c = caja.current
    if (c) c.scrollTop = c.scrollHeight
    setHayNueva(false)
  }
  useEffect(() => {
    if (abajo) bajar()
    else setHayNueva(true)
    // Solo cuando cambia la cantidad de mensajes o el estado de espera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensajes.length, pending])
  // El contenido crece después de pintar (las horas aparecen al montar, las
  // tarjetas cargan): si estaba abajo, sigue abajo.
  const contenido = useRef<HTMLDivElement>(null)
  const abajoRef = useRef(abajo)
  abajoRef.current = abajo
  useEffect(() => {
    const el = contenido.current
    if (!el) return
    const observador = new ResizeObserver(() => {
      if (abajoRef.current && caja.current) caja.current.scrollTop = caja.current.scrollHeight
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [mensajes.length === 0])

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
    setAbajo(true)
    const provisional: AgentMessage = { id: `tmp-${Date.now()}`, tenantId: '', role: 'user', text: limpio, actions: [], options: [], links: [], channel: 'dashboard', createdAt: new Date().toISOString() }
    setMensajes((m) => [...m, provisional])
    start(async () => {
      setEstado(null)
      try {
        const respuesta = await conversarEnVivo(slug, limpio, setEstado)
        setMensajes((m) => [...m, respuesta])
        // Pudo dejar un trabajo en segundo plano: se vuelve a mirar.
        setVuelta(0)
        // El agente pudo armar el plan, crear tareas o lanzar la medición: se vuelve a leer el resto del panel.
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

  const campo = <Campo texto={texto} setTexto={setTexto} enviar={enviar} pending={pending} grande={mensajes.length === 0} />

  // Portada: todavía no hay conversación.
  if (mensajes.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-14rem)] flex-col items-center justify-center gap-8 py-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <LogoMark className="h-12 w-12 text-accent" />
          <h1 className="text-2xl font-semibold sm:text-3xl">{t.chatHeroTitulo}</h1>
          <p className="max-w-md text-sm text-muted">{t.chatHeroSub}</p>
        </div>
        <div className="w-full max-w-2xl">
          {campo}
          <div className="mt-3 flex flex-wrap gap-2">
            {t.chatAtajos.map((a) => (
              <button key={a.label} disabled={pending} onClick={() => enviar(a.texto)} className="btn btn-secundario btn-chico gap-2 rounded-full">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-full max-w-2xl flex-col items-center gap-3">
          <p className="font-mono text-[11px] tracking-[0.02em] text-faint">{t.chatEmpezarCon}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {t.sugerencias.map((x) => (
              <button key={x} disabled={pending} onClick={() => enviar(x)} className="btn btn-secundario btn-chico gap-2 whitespace-normal text-muted hover:text-text">
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {x}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    )
  }

  const ultimo = mensajes[mensajes.length - 1]
  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] min-h-[24rem] w-full max-w-3xl flex-col">
      {/* Sin "empezar de nuevo": el historial es uno solo (panel, Telegram, Slack, MCP) y el agente lee solo los últimos 20 mensajes. */}
      <div className="border-b border-border pb-3">
        <h1 className="text-lg font-semibold">{t.chatTitulo}</h1>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={caja}
          onScroll={(e) => {
            const c = e.currentTarget
            const enElFondo = c.scrollHeight - c.scrollTop - c.clientHeight < 40
            setAbajo(enElFondo)
            if (enElFondo) setHayNueva(false)
          }}
          className="scroll-thin h-full overflow-y-auto py-5 pr-1"
        >
          <div ref={contenido} className="space-y-6">
            {mensajes.map((m) => (
              <Mensaje key={m.id} slug={slug} mensaje={m} />
            ))}
            {ultimo && ultimo.role === 'assistant' && ultimo.options?.length && !pending ? (
              <div className="flex flex-wrap gap-2 pl-7">
                {ultimo.options.map((o) => (
                  <button key={o} onClick={() => enviar(o)} className="btn btn-secundario btn-chico whitespace-normal">
                    {o}
                  </button>
                ))}
              </div>
            ) : null}
            {pending ? <p className="pl-7 font-mono text-xs text-muted">{estado ?? t.pensando}</p> : null}
            {!pending && trabajando ? <p className="pl-7 font-mono text-xs text-muted">{r.chatTrabajando}</p> : null}
          </div>
        </div>
        {hayNueva ? (
          <button onClick={bajar} className="btn btn-secundario btn-chico absolute bottom-3 left-1/2 -translate-x-1/2 gap-2 rounded-full bg-panel shadow-lg">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t.chatNuevaRespuesta} ↓
          </button>
        ) : null}
      </div>

      {campo}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

/**
 * El campo para escribirle al agente: Enter envía, Shift + Enter hace una
 * línea nueva. Una línea de acento arriba lo marca como lo principal de la página.
 */
function Campo({ texto, setTexto, enviar, pending, grande }: { texto: string; setTexto: (v: string) => void; enviar: (v: string) => void; pending: boolean; grande: boolean }) {
  const { miAgente: t } = useDict()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar(texto)
      }}
      className="relative rounded-xl border border-border bg-panel shadow-lg shadow-black/10"
    >
      <span aria-hidden className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            enviar(texto)
          }
        }}
        placeholder={t.chatPlaceholder}
        maxLength={4000}
        rows={grande ? 3 : 2}
        // 16px en el celular: con menos, iOS hace zoom al enfocar el campo.
        className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base outline-none placeholder:text-faint sm:text-sm"
      />
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
        <span className="hidden font-mono text-[11px] text-faint sm:inline">{t.chatAyudaTeclas}</span>
        <button disabled={pending || !texto.trim()} className="btn btn-primario btn-chico ml-auto">
          {t.enviar}
        </button>
      </div>
    </form>
  )
}

/** La hora del mensaje en la zona del navegador. Solo después de montar: el servidor no sabe la zona. */
function Hora({ fecha }: { fecha: string }) {
  const locale = useLocale()
  const [hora, setHora] = useState<string | null>(null)
  useEffect(() => {
    setHora(new Date(fecha).toLocaleTimeString(locale === 'es' ? 'es-CO' : 'en-US', { hour: 'numeric', minute: '2-digit' }))
  }, [fecha, locale])
  return hora ? <span className="font-mono text-[11px] text-faint">{hora}</span> : null
}

function Mensaje({ slug, mensaje }: { slug: string; mensaje: AgentMessage }) {
  const [acciones, setAcciones] = useState<AgentAction[]>(mensaje.actions)
  const deUsuario = mensaje.role === 'user'
  if (deUsuario) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] break-words rounded-xl border border-border bg-panel-2 px-4 py-2.5 text-sm sm:max-w-[75%]">
          <p className="whitespace-pre-wrap leading-relaxed">{mensaje.text}</p>
        </div>
        <Hora fecha={mensaje.createdAt} />
      </div>
    )
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <LogoMark className="h-5 w-5 text-accent" />
        <span className="font-mono text-xs font-bold text-accent">Peaje</span>
        <Hora fecha={mensaje.createdAt} />
      </div>
      <div className="max-w-[92%] break-words pl-7 text-sm">
        <Texto texto={mensaje.text} />
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
