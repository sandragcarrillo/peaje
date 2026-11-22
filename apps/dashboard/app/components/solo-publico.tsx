'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * El pie grande del sitio va solo en las páginas públicas (landing, Radar,
 * blog, comparativas, precios, legales). En el panel del dueño y en los flujos
 * de cuenta (entrar, alta, pago, OAuth) estorba, así que ahí va `privado`: el
 * pie legal corto, porque Paddle exige términos, privacidad, reembolsos y
 * precios enlazados desde todo el sitio, checkout incluido.
 */
const PRIVADAS = ['/t', '/negocios', '/acceder', '/nuevo', '/admin', '/checkout', '/pago', '/oauth', '/salir', '/wallet']

export function SoloPublico({ children, privado }: { children: ReactNode; privado?: ReactNode }) {
  const ruta = usePathname() ?? '/'
  if (PRIVADAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))) return <>{privado ?? null}</>
  return <>{children}</>
}
