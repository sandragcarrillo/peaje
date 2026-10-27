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
      <header className="flex items-baseline gap-3 border-b border-border px-6 py-4">
        <span className="font-mono text-xs font-bold text-accent">{n}</span>
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

/** La barra de arriba de la sección 01: igual mientras se mide y en el resultado. */
export function Barra01({ titulo, dominio }: { titulo: string; dominio: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-panel px-6 py-2.5 font-mono text-[11px] tracking-[0.04em] text-muted">
      <span className="font-bold text-accent">01</span>
      <span className="truncate text-text">{titulo}</span>
      <span className="hidden truncate sm:inline">· {dominio}</span>
    </div>
  )
}
