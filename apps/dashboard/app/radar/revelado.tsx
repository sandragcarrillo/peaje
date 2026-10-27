'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * El puntaje recién medido se revela: el número cuenta de 0 al puntaje en
 * menos de un segundo, después aparece la nota y al final lo que puede llegar
 * a ser con Peaje. Solo justo después de una medición en esta pestaña (la
 * medición deja la marca en sessionStorage); un enlace compartido o una
 * recarga muestran los valores finales. Con prefers-reduced-motion, nada se mueve.
 */

const CLAVE = 'peaje-radar-revelar'
const CUENTA_MS = 800
const FASE_NOTA_MS = CUENTA_MS + 80
const FASE_PEAJE_MS = CUENTA_MS + 480

/** La medición lo llama justo antes de abrir el resultado. */
export function marcarRevelado(dominio: string): void {
  try {
    sessionStorage.setItem(CLAVE, dominio)
  } catch {
    // sin sessionStorage: el resultado sale sin animación
  }
}

function suscribirMovimiento(avisar: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

/** prefers-reduced-motion, sin desacuerdo entre server y cliente (en el server: sin preferencia). */
export function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

type Estado = { animar: boolean; fase: number; progreso: number }
const FINAL: Estado = { animar: false, fase: 2, progreso: 1 }
const Ctx = createContext<Estado>(FINAL)

export function Revelado({ dominio, children }: { dominio: string; children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>(FINAL)
  // Se decide una sola vez: en StrictMode el efecto corre dos veces y la marca ya no está la segunda.
  const decidido = useRef<boolean | null>(null)

  useLayoutEffect(() => {
    if (decidido.current === null) {
      let marcado = false
      try {
        marcado = sessionStorage.getItem(CLAVE) === dominio
        if (marcado) sessionStorage.removeItem(CLAVE)
      } catch {
        marcado = false
      }
      decidido.current = marcado && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    if (!decidido.current) {
      setEstado(FINAL)
      return
    }
    // Antes de pintar: el número arranca en 0, sin parpadeo del valor final.
    setEstado({ animar: true, fase: 0, progreso: 0 })
    const t0 = performance.now()
    let cuadro = 0
    const avanzar = (ahora: number) => {
      // El primer cuadro puede traer una marca anterior a t0: sin el tope de abajo el número arrancaba en -1.
      const p = Math.min(1, Math.max(0, (ahora - t0) / CUENTA_MS))
      setEstado((e) => ({ ...e, progreso: p }))
      if (p < 1) cuadro = requestAnimationFrame(avanzar)
    }
    cuadro = requestAnimationFrame(avanzar)
    const nota = setTimeout(() => setEstado((e) => ({ ...e, fase: 1 })), FASE_NOTA_MS)
    const peaje = setTimeout(() => setEstado({ ...FINAL, animar: true }), FASE_PEAJE_MS)
    return () => {
      cancelAnimationFrame(cuadro)
      clearTimeout(nota)
      clearTimeout(peaje)
    }
  }, [dominio])

  return <Ctx.Provider value={estado}>{children}</Ctx.Provider>
}

/** El número: cuenta mientras se revela, el valor exacto el resto del tiempo. */
export function Cuenta({ valor }: { valor: number }) {
  const { animar, progreso } = useContext(Ctx)
  if (!animar || progreso >= 1) return <>{valor}</>
  const suave = 1 - Math.pow(1 - progreso, 3)
  return <>{Math.round(valor * suave)}</>
}

/** Aparece (fade) cuando el revelado llega a su fase. Ocupa su lugar desde el principio: nada salta. */
export function Fase({
  desde,
  children,
  className = '',
  como: Etiqueta = 'div',
}: {
  desde: 1 | 2
  children: React.ReactNode
  className?: string
  como?: 'div' | 'p' | 'span'
}) {
  const { animar, fase } = useContext(Ctx)
  const oculto = animar && fase < desde
  // La transición va solo al aparecer: al ocultarse (el primer cuadro) tiene que ser instantáneo.
  const estado = oculto ? 'opacity-0' : animar ? 'opacity-100 transition-opacity duration-500 ease-out' : ''
  return (
    <Etiqueta
      aria-hidden={oculto || undefined}
      className={`${className} ${estado}`}
    >
      {children}
    </Etiqueta>
  )
}
