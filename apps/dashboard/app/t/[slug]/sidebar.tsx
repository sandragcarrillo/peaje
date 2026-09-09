'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '', label: 'Dashboard' },
  { href: '/score', label: 'Score' },
  { href: '/rutas', label: 'Agregar rutas' },
  { href: '/kit', label: 'Haz que te encuentren' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/retirar', label: 'Retirar' },
  { href: '/wallet', label: 'Mi wallet' },
] as const

export function Sidebar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname()
  const base = `/t/${slug}`

  return (
    <aside className="w-52 shrink-0">
      <p className="font-mono text-xs text-muted">{slug}</p>
      <p className="mt-1 font-medium">{name}</p>
      <Link href="/negocios" className="mt-1 block text-xs text-muted hover:text-text">
        cambiar de negocio →
      </Link>
      <nav className="mt-6 flex flex-col gap-1">
        {ITEMS.map((item) => {
          const href = `${base}${item.href}`
          const activo = pathname === href
          return (
            <Link
              key={item.href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                activo ? 'bg-accent text-black' : 'text-muted hover:bg-panel hover:text-text'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
