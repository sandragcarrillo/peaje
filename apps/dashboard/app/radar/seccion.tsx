/**
 * Caja numerada de las secciones del radar. Sin hooks ni 'use client': la
 * usan la página (server) y la sección de citas (cliente).
 */
export function Seccion({
  n,
  titulo,
  children,
  tono = 'bg-bg',
}: {
  n: string
  titulo: string
  children: React.ReactNode
  tono?: string
}) {
  return (
    <section className={`border border-border ${tono}`}>
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-4 sm:px-6">
        <span className="font-mono text-xs font-bold text-accent">{n}</span>
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </header>
      <div className="space-y-5 p-4 sm:p-6">{children}</div>
    </section>
  )
}

/** Una sección que arranca cerrada: el encabezado es lo que se abre, sin otra caja ni otro título adentro. */
export function SeccionPlegable({ n, titulo, cuenta, children }: { n: string; titulo: string; cuenta?: number; children: React.ReactNode }) {
  return (
    <details className="group border border-border bg-bg">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-panel sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-xs font-bold text-accent">{n}</span>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {cuenta ? <span className="text-sm tabular-nums text-muted">{cuenta}</span> : null}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="ml-auto shrink-0 text-muted transition-transform group-open:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-border p-4 sm:p-6">{children}</div>
    </details>
  )
}

/** La barra de arriba de la sección 01: igual mientras se mide y en el resultado. */
export function Barra01({ titulo, dominio }: { titulo: string; dominio: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-panel px-4 py-2.5 font-mono text-[11px] tracking-[0.04em] text-muted sm:px-6">
      <span className="font-bold text-accent">01</span>
      <span className="truncate text-text">{titulo}</span>
      <span className="hidden truncate sm:inline">· {dominio}</span>
    </div>
  )
}
