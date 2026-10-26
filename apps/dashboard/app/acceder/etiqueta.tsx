import type { ReactNode } from 'react'

/**
 * La etiqueta chica sobre el título de /acceder y /nuevo. Igual que el
 * Eyebrow de components/chrome pero sin mayúsculas sostenidas.
 */
export function Etiqueta({ children, dot }: { children: ReactNode; dot?: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-xs text-muted">
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
      {children}
    </p>
  )
}
