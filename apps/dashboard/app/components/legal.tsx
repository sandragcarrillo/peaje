import Link from 'next/link'

/**
 * Piezas compartidas de las páginas legales (/terms, /privacy, /reembolsos) y
 * de /precios. Lenguaje visual de la casa: grotesca para títulos, mono para
 * etiquetas, text-muted para el cuerpo, hairlines border-border. Sin
 * mayúsculas sostenidas.
 */

export const ENLACE = 'text-text underline underline-offset-2 hover:text-accent'

/** Contenedor de lectura: columna angosta, título, fecha y cuerpo. */
export function Documento({
  titulo,
  actualizadaLabel,
  actualizada,
  children,
}: {
  titulo: string
  actualizadaLabel: string
  actualizada: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold">{titulo}</h1>
      <p className="mt-3 font-mono text-xs text-muted">
        {actualizadaLabel}: {actualizada}.
      </p>
      <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-muted">{children}</div>
      <p className="mt-10 border-t border-border pt-5 font-mono text-xs text-muted">
        {actualizadaLabel}: {actualizada}.
      </p>
    </article>
  )
}

/** Sección con su encabezado numerado. */
export function Seccion({ id, titulo, children }: { id?: string; titulo?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      {titulo ? <h2 className="text-xl font-semibold text-text">{titulo}</h2> : null}
      {children}
    </section>
  )
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-text">{children}</h3>
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>
}

/** Término destacado dentro de un párrafo o una viñeta. */
export function T({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-text">{children}</strong>
}

/** Enlace interno. */
export function L({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={ENLACE}>
      {children}
    </Link>
  )
}

/** Enlace externo, en pestaña nueva. */
export function X({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ENLACE}>
      {children}
    </a>
  )
}

/** Correo de contacto como mailto. */
export function Correo({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className={ENLACE}>
      {email}
    </a>
  )
}
