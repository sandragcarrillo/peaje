/**
 * El chrome de la casa (design/direccion-visual.md §5): eyebrow, header de
 * página, status bar y stat tile. Server components puros: sin estado.
 * Terminal editorial: la grotesca dice una cosa grande, la mono reporta.
 */

/** Kicker mono sobre un titular. `dot` le pone el punto verde de estado. */
export function Eyebrow({ children, dot }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
      {dot ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
      {children}
    </p>
  )
}

export function PageHeader({
  eyebrow,
  dot,
  titulo,
  sub,
}: {
  eyebrow?: React.ReactNode
  dot?: boolean
  titulo: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <header>
      {eyebrow ? <Eyebrow dot={dot}>{eyebrow}</Eyebrow> : null}
      <h1 className="mt-2 text-2xl font-semibold">{titulo}</h1>
      {sub ? <p className="mt-2 max-w-2xl text-sm text-muted">{sub}</p> : null}
    </header>
  )
}

/** Franja de pares clave:valor (§5.1): la página reportando su estado. */
export function StatusBar({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border py-2.5 font-mono text-[11px] tracking-[0.1em]">
      {items.map(([k, v], i) => (
        <span key={k} className="flex min-w-0 items-center gap-2">
          {i === 0 ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          <span className="uppercase text-muted">{k}:</span>
          <span className="truncate text-text">{v}</span>
        </span>
      ))}
    </div>
  )
}

/** Tile de métrica: label mono arriba, número grande en grotesca. */
export function StatTile({
  label,
  value,
  n,
  tono = 'normal',
}: {
  label: string
  value: React.ReactNode
  /** Índice visual estilo Stitch: `01 //` delante del label. */
  n?: number
  tono?: 'normal' | 'acento' | 'vivo'
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-medium tabular-nums ${
          tono === 'acento' ? 'text-accent' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * Buffer de terminal (Stitch): isla oscura con las últimas líneas de
 * actividad como log. Las líneas son datos reales; el label lo pone quien
 * lo usa, en lenguaje de humanos.
 */
export function TerminalBuffer({ label, lineas }: { label: string; lineas: string[] }) {
  if (lineas.length === 0) return null
  return (
    <div className="isla-tinta overflow-hidden rounded-lg border border-border bg-bg">
      <p className="flex items-center gap-2 border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        {label}
      </p>
      <div className="space-y-1 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
        {lineas.map((l) => (
          <p key={l} className="truncate">
            <span className="text-accent">›</span> <span className="text-text">{l}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * Barra de sección (Stitch): índice + label a la izquierda, meta a la
 * derecha, hairlines arriba y abajo. Divide la página en bloques numerados
 * sin necesitar cards para todo.
 */
export function SectionBar({
  label,
  meta,
}: {
  /** Compat: el índice ya no se muestra (pedido de San). */
  n?: number
  label: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-y border-text/70 py-2 font-mono text-[11px] uppercase tracking-[0.12em]">
      <span className="text-text">{label}</span>
      {meta ? <span className="text-muted normal-case tracking-normal">{meta}</span> : null}
    </div>
  )
}

/** Línea de agregados al pie de una vista (Stitch): datos reales, mono. */
export function FooterStrip({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-text/70 pt-3 font-mono text-[11px] tracking-[0.08em]">
      {items.map(([k, v]) => (
        <span key={k} className="flex items-center gap-2">
          <span className="uppercase text-muted">{k}:</span>
          <span className="text-text">{v}</span>
        </span>
      ))}
    </div>
  )
}
