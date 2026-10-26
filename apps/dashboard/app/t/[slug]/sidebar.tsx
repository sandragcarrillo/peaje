'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDict } from '@/lib/i18n/client'

type Item = { href: string; label: string; valor?: string; acento?: boolean }

/**
 * Sidebar en el orden del camino del dueño: ver su puntaje, las mejoras, su
 * agente y las visitas. Cobrar es opcional y va aparte, abajo de un separador.
 * Los ceros no se muestran (rutas e ingresos vacíos hacen sentir el producto
 * vacío); el puntaje sí, porque invita a subirlo. El botón principal lleva a
 * activar el agente si no paga, o a las mejoras si ya paga.
 */
export function Sidebar({
  slug,
  name,
  valores,
  pro,
  portalUrl,
}: {
  slug: string
  name: string
  /** Cada valor es opcional: sin dato (o en cero) no se muestra. */
  valores: { score?: string; rutas?: string; ingresos?: string }
  pro: boolean
  portalUrl: string
}) {
  const pathname = usePathname()
  const d = useDict()
  const base = `/t/${slug}`
  const iniciales = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const principal: Item[] = [
    { href: '', label: d.panel.navDashboard, valor: valores.score, acento: true },
    { href: '/kit', label: d.panel.navKit },
    { href: '/agente', label: d.panel.navAgente },
    { href: '/agentes-visitas', label: d.panel.navVisitas },
  ]
  const cobros: Item[] = [
    { href: '/rutas', label: d.panel.navRutas, valor: valores.rutas },
    { href: '/ingresos', label: d.panel.navIngresos, valor: valores.ingresos, acento: true },
  ]

  const lista = (items: Item[]) =>
    items.map((item) => {
      const href = `${base}${item.href}`
      const activo = pathname === href
      return (
        <Link
          key={item.href}
          href={href}
          className={`flex items-center justify-between px-3 py-2 transition-colors ${
            activo
              ? 'border-l-2 border-accent bg-panel-2 font-bold text-text'
              : 'border-l-2 border-transparent text-muted hover:bg-panel-2 hover:text-text'
          }`}
        >
          <span className="flex items-center gap-2.5">
            {activo ? <span aria-hidden className="h-1.5 w-1.5 bg-accent" /> : null}
            <span>{item.label}</span>
          </span>
          {item.valor ? (
            <span className={`text-[10px] ${activo || item.acento ? 'font-bold text-accent' : 'text-muted/70'}`}>
              {item.valor}
            </span>
          ) : null}
        </Link>
      )
    })

  return (
    <aside className="scroll-thin sticky top-16 hidden h-[calc(100vh-5rem)] w-64 shrink-0 flex-col justify-between gap-6 self-start overflow-y-auto border-r border-border bg-panel p-4 md:flex">
      <div className="space-y-6">
        {/* Identidad del tenant */}
        <div className="border border-border bg-bg p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-negro font-mono text-[10px] font-bold text-white">
              {iniciales}
            </div>
            <div className="overflow-hidden">
              <h2 className="truncate font-mono text-xs leading-none font-bold">{name}</h2>
              <p className="mt-1 font-mono text-[10px] text-muted">ID: {slug}</p>
            </div>
          </div>
          <Link href="/negocios" className="mt-2 block font-mono text-[10px] text-muted hover:text-text">
            {d.panel.sidebarCambiar} →
          </Link>
        </div>

        <nav className="space-y-1 font-mono text-xs">{lista(principal)}</nav>

        <div className="space-y-1 font-mono text-xs">
          <p className="border-t border-border px-3 pt-4 pb-1 text-[10px] text-muted">{d.panel.sidebarCobros}</p>
          {lista(cobros)}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Link href={pro ? `${base}/kit` : `${base}/agente#plan`} className="btn btn-primario btn-chico btn-ancho">
          {pro ? d.panel.sidebarVerMejoras : d.panel.sidebarActivarAgente}
        </Link>

        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-1 font-mono text-[10px] text-muted transition-colors hover:text-text"
        >
          {d.panel.navPortal} ↗
        </a>
      </div>
    </aside>
  )
}
