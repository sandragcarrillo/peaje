'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDict } from '@/lib/i18n/client'

export function Sidebar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname()
  const d = useDict()
  const base = `/t/${slug}`

  const items = [
    { href: '', label: d.panel.navDashboard },
    { href: '/score', label: d.panel.navScore },
    { href: '/rutas', label: d.panel.navRutas },
    { href: '/kit', label: d.panel.navKit },
    { href: '/clientes', label: d.panel.navClientes },
    { href: '/retirar', label: d.panel.navRetirar },
    { href: '/wallet', label: d.panel.navWallet },
  ]

  return (
    <aside className="w-52 shrink-0">
      <p className="font-mono text-xs text-muted">{slug}</p>
      <p className="mt-1 font-medium">{name}</p>
      <Link href="/negocios" className="mt-1 block text-xs text-muted hover:text-text">
        {d.panel.cambiarNegocio}
      </Link>
      <nav className="mt-6 flex flex-col gap-1">
        {items.map((item) => {
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
