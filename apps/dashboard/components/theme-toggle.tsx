'use client'

import { useEffect, useState } from 'react'

/**
 * Claro/oscuro. La clase `dark` en <html> redefine los tokens semánticos y
 * todo lo que usa bg-/text-/border- de la casa cambia solo. La elección vive
 * en localStorage; el default sigue al sistema (script inline en el layout
 * la aplica antes de hidratar para que no parpadee).
 */
export function ThemeToggle() {
  const [oscuro, setOscuro] = useState<boolean | null>(null)

  useEffect(() => {
    setOscuro(document.documentElement.classList.contains('dark'))
  }, [])

  function alternar() {
    const siguiente = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', siguiente)
    try {
      localStorage.setItem('peaje_theme', siguiente ? 'dark' : 'light')
    } catch {}
    setOscuro(siguiente)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? 'Light mode' : 'Dark mode'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-text"
    >
      {oscuro ? <Sol /> : <Luna />}
    </button>
  )
}

function Sol() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  )
}

function Luna() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}
