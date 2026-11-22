'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * La pastilla "Instala Peaje con tu IA" (en inglés, "Set me up with usepeaje.com"): al tocarla copia la instrucción
 * de alta (FRASE_ONBOARD de lib/onboard.ts, ya armada en el servidor) para
 * pegarla en ChatGPT, Claude o Cursor. El ícono pasa a un check y un aviso
 * debajo dice qué hacer con lo copiado; se lee por aria-live.
 */

const DURA_MS = 3200

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Sin permiso de portapapeles (o contexto no seguro): el camino viejo.
    try {
      const area = document.createElement('textarea')
      area.value = texto
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function CtaPastilla({
  frase,
  texto,
  dominio,
  pista,
  copiado,
  logos,
  alinear = 'centro',
}: {
  /** Lo que se copia, ya en el idioma de la página. */
  frase: string
  /** "Instala Peaje con" */
  texto: string
  /** "tu IA" o "usepeaje.com" */
  dominio: string
  /** Para lectores de pantalla: qué hace el botón. */
  pista: string
  /** "Copiado. Pégalo en ChatGPT, Claude o Cursor" */
  copiado: string
  /** Los logos en sus círculos, armados en el servidor. */
  logos: React.ReactNode
  alinear?: 'centro' | 'inicio'
}) {
  const [listo, setListo] = useState(false)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current)
    },
    [],
  )

  async function alTocar() {
    const ok = await copiarTexto(frase)
    if (!ok) return
    setListo(true)
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => setListo(false), DURA_MS)
  }

  return (
    <div className={`relative flex max-w-full flex-col ${alinear === 'centro' ? 'items-center' : 'items-start'}`}>
      <button type="button" onClick={alTocar} className="cta-pastilla" aria-describedby={`${id}-pista`} data-copiado={listo ? '' : undefined}>
        <span aria-hidden className="flex shrink-0 items-center -space-x-1.5">
          {logos}
        </span>
        <span className="min-w-0 text-left">
          {texto} <span className="font-semibold">{dominio}</span>
        </span>
        <span aria-hidden className="relative grid h-4 w-4 shrink-0 place-items-center text-muted">
          {listo ? (
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5.25" y="5.25" width="8" height="8" rx="1.75" />
              <path d="M10.75 5.25V4a1.75 1.75 0 0 0-1.75-1.75H4A1.75 1.75 0 0 0 2.25 4v5A1.75 1.75 0 0 0 4 10.75h1.25" />
            </svg>
          )}
        </span>
      </button>
      <span id={`${id}-pista`} className="sr-only">
        {pista}
      </span>
      {/* Aviso flotante bajo la pastilla: no empuja el resto de la página. */}
      <p
        role="status"
        aria-live="polite"
        className={`cta-aviso pointer-events-none absolute top-full z-10 mt-2.5 w-max max-w-[calc(100vw-2rem)] rounded-lg bg-text px-3 py-1.5 text-center text-xs font-medium text-bg shadow-lg ${
          alinear === 'centro' ? 'left-1/2 -translate-x-1/2' : 'left-0'
        } ${listo ? 'opacity-100' : 'translate-y-[-2px] opacity-0'}`}
      >
        {listo ? copiado : ''}
      </p>
    </div>
  )
}
