'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { salir } from '@/app/salir/actions'
import { useDict, useLocale } from '@/lib/i18n/client'
import { LanguageToggle } from './language-toggle'
import { ThemeToggle } from './theme-toggle'

/** Lo que la sidebar de un negocio le pasa al menú: rutas completas, labels ya traducidos. */
export type SeccionesMovil = {
  nombre: string
  grupos: { titulo?: string; items: { href: string; label: string; valor?: string; acento?: boolean; sub?: boolean }[] }[]
  boton: { href: string; label: string }
  portal: { href: string; label: string }
  chat: { href: string; label: string }
}

const SeccionesCtx = createContext<{ secciones: SeccionesMovil | null; publicar: (s: SeccionesMovil | null) => void }>({
  secciones: null,
  publicar: () => {},
})

/** Envuelve navbar y página en el layout raíz: así la sidebar (adentro de /t/[slug]) llega al menú (en el navbar). */
export function SeccionesProvider({ children }: { children: React.ReactNode }) {
  const [secciones, publicar] = useState<SeccionesMovil | null>(null)
  const valor = useMemo(() => ({ secciones, publicar }), [secciones])
  return <SeccionesCtx.Provider value={valor}>{children}</SeccionesCtx.Provider>
}

/**
 * La sidebar publica sus secciones mientras está montada. La clave es el
 * JSON: el objeto se arma nuevo en cada render y no debe volver a publicarse
 * si nada cambió.
 */
export function usePublicarSecciones(secciones: SeccionesMovil) {
  const { publicar } = useContext(SeccionesCtx)
  const clave = JSON.stringify(secciones)
  useEffect(() => {
    publicar(JSON.parse(clave))
    return () => publicar(null)
  }, [clave, publicar])
}

/**
 * El navbar en el teléfono: los enlaces del centro, Entrar (o la cuenta y
 * Salir), tema e idioma no entran en la píldora, así que viven en un panel
 * que abre este botón. Desde lg sin sesión, o md con sesión, el navbar los
 * muestra en línea y este menú se esconde (lo decide `className`). Dentro de
 * un negocio, arriba van sus secciones: la sidebar no entra en el teléfono.
 *
 * El panel se posiciona contra el <header> sticky (no contra el botón) para
 * ocupar el ancho de la píldora.
 */
export function MenuMovil({ cuenta, className = '' }: { cuenta?: { email: string }; className?: string }) {
  const d = useDict()
  const locale = useLocale()
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)
  const { secciones } = useContext(SeccionesCtx)

  useEffect(() => setAbierto(false), [ruta])
  useEffect(() => {
    if (!abierto) return
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [abierto])

  const cerrar = () => setAbierto(false)
  const item = 'block rounded-lg px-3 py-3 text-muted hover:bg-panel-2 hover:text-text'

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        aria-label={abierto ? d.nav.cerrarMenu : d.nav.menu}
        className="btn btn-secundario btn-chico btn-icono"
      >
        {abierto ? <IconoCerrar /> : <IconoMenu />}
      </button>

      {abierto ? (
        <>
          <button type="button" aria-label={d.nav.cerrarMenu} onClick={cerrar} className="fixed inset-0 z-40 cursor-default" />
          <div
            id="menu-movil"
            className="scroll-thin absolute inset-x-3 top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-border bg-panel p-2 text-text shadow-xl shadow-black/40 sm:inset-x-6"
          >
            {secciones ? (
              <div className="etiqueta mb-1 border-b border-border pb-3">
                <p className="truncate px-3 pt-2 pb-1 font-bold">{secciones.nombre}</p>
                <Link href={secciones.chat.href} onClick={cerrar} className="mx-1 my-1 flex items-center gap-3 rounded-lg border border-border bg-bg p-2.5 text-text">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-panel-2 text-base leading-none">+</span>
                  {secciones.chat.label}
                </Link>
                {secciones.grupos.map((g, i) => (
                  <nav key={g.titulo ?? i} className={i > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
                    {g.titulo ? <p className="px-3 pt-2 pb-1 text-faint">{g.titulo}</p> : null}
                    {g.items.map((s) => {
                      const activo = ruta === s.href
                      return (
                        <Link
                          key={s.href}
                          href={s.href}
                          onClick={cerrar}
                          aria-current={activo ? 'page' : undefined}
                          className={`flex items-center justify-between rounded-lg py-3 pr-3 ${s.sub ? 'pl-7' : 'pl-3'} ${
                            activo ? 'bg-panel-2 font-bold text-text' : 'text-muted hover:bg-panel-2 hover:text-text'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            {activo ? <span aria-hidden className="h-1.5 w-1.5 bg-accent" /> : null}
                            {s.label}
                          </span>
                          {s.valor ? <span className={activo || s.acento ? 'font-bold text-accent' : 'text-faint'}>{s.valor}</span> : null}
                        </Link>
                      )
                    })}
                  </nav>
                ))}
                <div className="mt-2 space-y-1 px-1">
                  <Link href={secciones.boton.href} onClick={cerrar} className="btn btn-primario btn-chico btn-ancho">
                    {secciones.boton.label}
                  </Link>
                  <a href={secciones.portal.href} target="_blank" rel="noreferrer" className={item}>
                    {secciones.portal.label} ↗
                  </a>
                </div>
              </div>
            ) : null}
            {cuenta ? (
              <nav className="etiqueta">
                <p className="truncate px-3 pt-2 pb-1 text-faint">{cuenta.email}</p>
                <Link href="/negocios" onClick={cerrar} className={item}>
                  {d.nav.negocios}
                </Link>
                <form action={salir}>
                  <button type="submit" className={`${item} w-full text-left`}>
                    {d.nav.salir}
                  </button>
                </form>
              </nav>
            ) : (
              <nav aria-label={d.nav.linkComo} className="etiqueta">
                <Link href="/#como-funciona" onClick={cerrar} className={item}>
                  {d.nav.linkComo}
                </Link>
                <Link href="/precios" onClick={cerrar} className={item}>
                  {d.nav.linkPrecios}
                </Link>
                <Link href="/blog" onClick={cerrar} className={item}>
                  {d.nav.linkBlog}
                </Link>
                <Link href="/acceder" onClick={cerrar} className={item}>
                  {d.nav.entrar}
                </Link>
              </nav>
            )}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-1 pt-3 pb-1">
              <ThemeToggle />
              <LanguageToggle locale={locale} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function IconoMenu() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function IconoCerrar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
