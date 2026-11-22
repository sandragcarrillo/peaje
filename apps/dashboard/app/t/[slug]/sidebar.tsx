'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePublicarSecciones } from '@/components/menu-movil'
import { COBROS_VISIBLES } from '@/lib/config'
import { useDict } from '@/lib/i18n/client'

/** `sub`: cuelga del ítem de arriba (Contenido, debajo de Mi agente). */
type Item = { href: string; label: string; valor?: string; acento?: boolean; sub?: boolean }

/**
 * Sidebar en el orden del camino del dueño: ver su puntaje, el kit, su
 * agente y las visitas. Cobrar es opcional y va aparte, abajo de un separador.
 * Los ceros no se muestran (rutas e ingresos vacíos hacen sentir el producto
 * vacío); el puntaje sí, porque invita a subirlo. El botón principal lleva a
 * activar el agente si no paga, o al kit si ya paga.
 *
 * En el teléfono la columna no se ve: las mismas secciones van al menú del
 * navbar (ver usePublicarSecciones).
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
    // El pipeline de páginas del agente. Sin Pro la página muestra el candado; acá se avisa.
    { href: '/agente/contenido', label: d.contenido.nav, valor: pro ? undefined : 'Pro', sub: true },
    { href: '/integraciones', label: d.panel.navIntegraciones, valor: pro ? undefined : 'Pro', sub: true },
    { href: '/agentes-visitas', label: d.panel.navVisitas },
  ]
  const cobros: Item[] = [
    { href: '/rutas', label: d.panel.navRutas, valor: valores.rutas },
    { href: '/ingresos', label: d.panel.navIngresos, valor: valores.ingresos, acento: true },
  ]

  const conRuta = (items: Item[]) => items.map((i) => ({ ...i, href: `${base}${i.href}` }))
  usePublicarSecciones({
    nombre: name,
    grupos: [{ items: conRuta(principal) }, ...(COBROS_VISIBLES ? [{ titulo: d.panel.sidebarCobros, items: conRuta(cobros) }] : [])],
    boton: { href: pro ? `${base}/kit` : `${base}/agente#plan`, label: pro ? d.panel.sidebarVerMejoras : d.panel.sidebarActivarAgente },
    portal: { href: portalUrl, label: d.panel.navPortal },
    chat: { href: `${base}/chat`, label: d.miAgente.chatTitulo },
  })

  const lista = (items: Item[]) =>
    items.map((item) => {
      const href = `${base}${item.href}`
      const activo = pathname === href
      return (
        <Link
          key={item.href}
          href={href}
          aria-current={activo ? 'page' : undefined}
          // El activo se marca con el fondo entero y el peso de la letra, sin barra al costado.
          className={`flex items-center justify-between rounded-md py-2 pr-3 transition-colors ${item.sub ? 'pl-7' : 'pl-3'} ${
            activo ? 'bg-panel-2 font-semibold text-text' : 'text-muted hover:bg-panel-2 hover:text-text'
          }`}
        >
          <span>{item.label}</span>
          {item.valor ? (
            <span className={`text-xs tabular-nums ${activo || item.acento ? 'font-semibold text-accent' : 'text-faint'}`}>{item.valor}</span>
          ) : null}
        </Link>
      )
    })

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-panel md:block">
      {/* El fondo y el borde ocupan todo el alto; lo que se queda fijo es el contenido, justo debajo de la barra de arriba. */}
      <div className="scroll-thin sticky top-20 flex h-[calc(100dvh-5rem)] flex-col justify-between gap-6 overflow-y-auto p-4">
      <div className="space-y-6">
        {/* Identidad del tenant */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-text text-xs font-semibold text-bg">{iniciales}</div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">{name}</h2>
            <Link href="/negocios" className="text-xs text-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-text hover:decoration-current">
              {d.panel.sidebarCambiar}
            </Link>
          </div>
        </div>

        <nav className="space-y-0.5 text-sm">{lista(principal)}</nav>

        {/* El chat va aparte, como el punto de entrada principal: tiene su propia página. */}
        <Link
          href={`${base}/chat`}
          aria-current={pathname === `${base}/chat` ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm font-medium transition-colors ${
            pathname === `${base}/chat` ? 'border-text bg-panel-2' : 'border-border bg-bg hover:border-text'
          }`}
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          {d.miAgente.chatTitulo}
        </Link>

        {COBROS_VISIBLES ? (
          <div className="space-y-0.5 text-sm">
            <p className="border-t border-border px-3 pt-4 pb-1 text-xs font-medium text-faint">{d.panel.sidebarCobros}</p>
            {lista(cobros)}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Link href={pro ? `${base}/kit` : `${base}/agente#plan`} className="btn btn-primario btn-chico btn-suave btn-ancho">
          {pro ? d.panel.sidebarVerMejoras : d.panel.sidebarActivarAgente}
        </Link>

        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          className="block px-3 py-1 text-xs text-muted underline decoration-transparent underline-offset-2 transition-colors hover:text-text hover:decoration-current"
        >
          {d.panel.navPortal}
        </a>
      </div>
    </div>
    </aside>
  )
}
