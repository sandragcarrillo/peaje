'use client'

import { useEffect, useRef, useState } from 'react'
import type { MensajeChat } from '@/lib/i18n/sections/landing'
import { LogoMark } from './logo'

/**
 * Conversación de ejemplo con el agente de Peaje en Telegram (hero de la
 * landing). Solo ejemplo.com / example.com; números ilustrativos.
 *
 * Animación: arranca al entrar en pantalla y corre una sola vez. Antes de cada
 * mensaje del agente sale "escribiendo…"; los del dueño aparecen más rápido.
 * Todo el texto está en el DOM desde el principio (solo transparente hasta que
 * aparece), así lectores de pantalla, buscadores y agentes lo leen completo, y
 * la altura final queda reservada: no hay salto de diseño. Sin JS o con
 * movimiento reducido se ve todo de una (CSS en globals.css, `.chat-msg`).
 */

const ESCRIBIENDO_MS = 1000
const PAUSA_DUENO_MS = 450
const PAUSA_TRAS_MENSAJE_MS = 650

type Props = {
  mensajes: MensajeChat[]
  ejemplo: string
  negocio: string
  bot: string
  subtitulo: string
  tu: string
  escribiendo: string
}

export function ChatEjemplo({ mensajes, ejemplo, negocio, bot, subtitulo, tu, escribiendo }: Props) {
  const caja = useRef<HTMLDivElement>(null)
  // null = todavía no arrancó (todo oculto por CSS hasta que haya JS); n = mensajes visibles.
  const [visibles, setVisibles] = useState<number | null>(null)
  const [tecleando, setTecleando] = useState<number | null>(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibles(mensajes.length)
      return
    }
    setVisibles(0)
    const relojes: ReturnType<typeof setTimeout>[] = []
    const correr = () => {
      let t = 250
      mensajes.forEach((m, i) => {
        if (m.de === 'agente') {
          relojes.push(setTimeout(() => setTecleando(i), t))
          t += ESCRIBIENDO_MS
        } else {
          t += PAUSA_DUENO_MS
        }
        relojes.push(
          setTimeout(() => {
            setTecleando(null)
            setVisibles(i + 1)
          }, t),
        )
        t += PAUSA_TRAS_MENSAJE_MS
      })
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          obs.disconnect()
          correr()
        }
      },
      { threshold: 0.35 },
    )
    obs.observe(el)
    return () => {
      obs.disconnect()
      relojes.forEach(clearTimeout)
    }
  }, [mensajes])

  // Antes de hidratar (`null`) el CSS ya los oculta con data-espera; sin JS, <noscript> los muestra.
  const oculto = (i: number) => (visibles === null ? 'espera' : i >= visibles ? 'true' : 'false')

  return (
    <aside
      aria-label={`${ejemplo}: ${bot} · ${negocio}`}
      className="isla-tinta overflow-hidden border border-border bg-bg text-text"
    >
      <noscript>
        <style>{`.chat-msg{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Cabecera tipo chat: el bot y el negocio, sin logos de terceros. */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tinta-suave">
            <LogoMark className="h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold">{bot}</p>
            <p className="truncate font-mono text-[11px] text-muted">
              {subtitulo} · {negocio}
            </p>
          </div>
        </div>
        <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted">{ejemplo}</span>
      </div>

      <div ref={caja} aria-live="off" className="space-y-3 px-4 py-5">
        {mensajes.map((m, i) => {
          const agente = m.de === 'agente'
          return (
            <div key={i} className={`relative flex ${agente ? 'justify-start' : 'justify-end'}`}>
              {agente && tecleando === i ? (
                <p className="chat-escribiendo absolute top-0 left-0 flex items-center gap-1.5 rounded-[6px] border border-border bg-panel px-3 py-2.5">
                  <span className="sr-only">{escribiendo}</span>
                  <span aria-hidden className="chat-punto" />
                  <span aria-hidden className="chat-punto [animation-delay:150ms]" />
                  <span aria-hidden className="chat-punto [animation-delay:300ms]" />
                </p>
              ) : null}
              <div
                data-oculto={oculto(i)}
                className={`chat-msg max-w-[85%] space-y-2 ${agente ? '' : 'items-end text-right'}`}
              >
                <p className="font-mono text-[10px] text-muted">{agente ? bot : tu}</p>
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
                    <span className="shrink-0 whitespace-nowrap font-mono text-xs font-bold text-accent">{m.tarjeta.accion} →</span>
                  </p>
                ) : null}
                {m.chip ? (
                  <p className="inline-flex items-center gap-1.5 border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
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
