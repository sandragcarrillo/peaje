'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDict } from '@/lib/i18n/client'
import { CHAINS } from '@/lib/config'

/**
 * Sidebar calcado del diseño de Stitch: tarjeta de identidad con bloque de
 * iniciales, nav mono donde cada ítem muestra su dato real a la derecha
 * (score, rutas, saldo), acción directa NUEVA RUTA, y pie de sistema.
 * Sin iconos de Material (no cargamos esa fuente); los valores son reales,
 * nunca los de utilería del mock.
 */
export function Sidebar({
  slug,
  name,
  valores,
  portalUrl,
}: {
  slug: string
  name: string
  valores: { score: string; rutas: string; retirar: string }
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

  const items: { href: string; label: string; valor?: string; acento?: boolean }[] = [
    { href: '', label: d.panel.navDashboard },
    { href: '/score', label: d.panel.navScore, valor: valores.score },
    { href: '/rutas', label: d.panel.navRutas, valor: valores.rutas },
    { href: '/kit', label: d.panel.navKit },
    { href: '/clientes', label: d.panel.navClientes },
    { href: '/retirar', label: d.panel.navRetirar, valor: valores.retirar, acento: true },
  ]

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
              <h2 className="truncate font-mono text-xs leading-none font-bold uppercase">{name}</h2>
              <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                ID: {slug}
              </p>
            </div>
          </div>
          <Link
            href="/negocios"
            className="mt-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted hover:text-text"
          >
            {d.panel.sidebarCambiar} →
          </Link>
        </div>

        <nav className="space-y-1 font-mono text-xs uppercase">
          {items.map((item) => {
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
                  <span
                    className={`text-[10px] ${
                      activo || item.acento ? 'font-bold text-accent' : 'text-muted/70'
                    }`}
                  >
                    {item.valor}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <Link
          href={`${base}/rutas`}
          className="flex w-full items-center justify-center gap-2 bg-negro px-3 py-2 font-mono text-xs font-bold tracking-[0.1em] text-white uppercase transition-colors hover:bg-tinta"
        >
          <span>{d.panel.sidebarNuevaRuta}</span>
          <span className="text-accent">+</span>
        </Link>

        <div className="space-y-1 font-mono text-xs uppercase text-muted">
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-1.5 transition-colors hover:text-text"
          >
            <span>{d.panel.navPortal}</span>
            <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
          </a>
        </div>

        <div className="space-y-1 border-t border-border px-3 pt-2 font-mono text-[10px] uppercase leading-relaxed text-muted">
          <p>MPP/1.1 · 402</p>
          <p>{CHAINS.join(' · ')}</p>
        </div>
      </div>
    </aside>
  )
}
