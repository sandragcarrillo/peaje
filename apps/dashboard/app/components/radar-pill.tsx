'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * "Radar gratis" del navbar: la misma píldora en todas las páginas (borde de
 * 1px y texto en el acento). Solo en /radar se rellena, para marcar dónde
 * estás. Es cliente porque el layout es de servidor y no sabe la ruta.
 */
export function RadarPill({ texto, className = '' }: { texto: string; className?: string }) {
  const ruta = usePathname() ?? ''
  const activo = ruta === '/radar' || ruta.startsWith('/radar/')

  return (
    <Link
      href="/radar"
      aria-current={activo ? 'page' : undefined}
      className={`etiqueta inline-flex items-center whitespace-nowrap rounded-full border border-accent px-2.5 py-0.5 font-bold transition-colors ${
        activo ? 'bg-accent text-accent-text' : 'text-accent hover:bg-accent/15'
      } ${className}`}
    >
      {texto}
    </Link>
  )
}
