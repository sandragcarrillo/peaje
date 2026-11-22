'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * El ciclo del home (sistema de revnu.com): cuatro pasos a la izquierda, en
 * acordeón, y la pantalla del paso activo a la derecha, en su marco.
 *
 * Avanza solo cada 6 s (la barra del paso se llena con transform y al
 * terminar pasa al siguiente) solo si: la pantalla es de escritorio, la
 * persona no pidió movimiento reducido, el bloque está a la vista y la
 * pestaña visible. Se pausa con el puntero o el foco encima. Si la persona
 * elige un paso, deja de avanzar solo. En el teléfono no hay autoplay: los
 * cuatro pasos van apilados, cada uno con su pantalla debajo.
 *
 * Las pantallas llegan armadas del servidor (pantallas-ciclo.tsx).
 */
export function Ciclo({ pasos, pantallas }: { pasos: { titulo: string; texto: string }[]; pantallas: React.ReactNode[] }) {
  const [activo, setActivo] = useState(0)
  const [auto, setAuto] = useState(false)
  const [elegido, setElegido] = useState(false)
  const [visible, setVisible] = useState(false)
  const [encima, setEncima] = useState(false)
  const [oculta, setOculta] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)')
    const leer = () => setAuto(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const leer = () => setOculta(document.hidden)
    leer()
    document.addEventListener('visibilitychange', leer)
    return () => document.removeEventListener('visibilitychange', leer)
  }, [])

  const avanza = auto && !elegido
  const corre = avanza && visible && !encima && !oculta

  return (
    <div ref={caja}>
      {/* Escritorio: acordeón y pantalla lado a lado. */}
      <div
        className="hidden items-start gap-14 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
        onPointerEnter={() => setEncima(true)}
        onPointerLeave={() => setEncima(false)}
        onFocusCapture={() => setEncima(true)}
        onBlurCapture={() => setEncima(false)}
      >
        <ol className="border-t border-border">
          {pasos.map((p, i) => {
            const abierto = i === activo
            return (
              <li key={p.titulo} className="relative border-b border-border">
                <button
                  type="button"
                  aria-expanded={abierto}
                  aria-controls="ciclo-pantalla"
                  onClick={() => {
                    setActivo(i)
                    setElegido(true)
                  }}
                  className="group flex w-full items-baseline gap-4 pt-5 pb-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 translate-y-[-1px] place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${
                      abierto ? 'border-accent bg-accent text-accent-text' : 'border-border text-muted group-hover:text-text'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-xl font-medium tracking-[-0.015em] transition-colors ${abierto ? 'text-text' : 'text-muted group-hover:text-text'}`}>
                    {p.titulo}
                  </span>
                </button>
                <div
                  aria-hidden={!abierto}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[48ch] pb-5 pl-10 text-[15px] leading-relaxed text-muted">{p.texto}</p>
                  </div>
                </div>
                {abierto ? (
                  <span
                    key={`${activo}-${avanza}`}
                    aria-hidden
                    data-corre={avanza ? '' : undefined}
                    className="ciclo-barra absolute right-0 -bottom-px left-0 h-0.5 bg-accent"
                    style={{ animationPlayState: corre ? 'running' : 'paused' }}
                    onAnimationEnd={() => setActivo((a) => (a + 1) % pasos.length)}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
        <div id="ciclo-pantalla" className="min-h-[30rem]">
          <div key={activo} className="ciclo-pantalla">
            {pantallas[activo]}
          </div>
        </div>
      </div>

      {/* Teléfono y tableta: los pasos apilados, cada uno con su pantalla. */}
      <ol className="space-y-14 lg:hidden">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden
                className="grid h-6 w-6 shrink-0 translate-y-[-1px] place-items-center rounded-full border border-accent bg-accent text-xs font-semibold text-accent-text tabular-nums"
              >
                {i + 1}
              </span>
              <h3 className="text-xl font-medium tracking-[-0.015em]">{p.titulo}</h3>
            </div>
            <p className="mt-2 max-w-[60ch] pl-9 text-[15px] leading-relaxed text-muted">{p.texto}</p>
            <div className="mt-5">{pantallas[i]}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
