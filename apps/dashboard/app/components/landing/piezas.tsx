/**
 * Piezas chicas del home que imitan las del producto: el marco doble de "así
 * se vería tu panel" (app/radar/tu-panel.tsx), las marcas del historial y los
 * estados del Radar (citas-vista.tsx). Sin hooks: sirven en servidor y en
 * cliente. Se copian acá en vez de exportarlas del Radar para no tocar
 * app/radar; si cambian allá, cambiarlas acá.
 */

export type Estado = 'cita' | 'nombra' | 'no'

/** Un acento por asistente, como en el Radar: ChatGPT en tinta, Claude en lila. */
const ACENTO: Record<string, string> = { chatgpt: 'var(--text)', claude: 'var(--lila)' }

export function Punto({ id }: { id: string }) {
  return <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: ACENTO[id] ?? 'var(--faint)' }} />
}

/** El marco doble: carcasa con el fondo del panel y adentro la pantalla. */
export function Marco({ barra, children, className = '' }: { barra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[18px] border border-border bg-panel p-1.5 shadow-[0_1px_2px_rgb(28_27_25/0.04),0_28px_56px_-30px_rgb(28_27_25/0.32)] ${className}`}
    >
      <div className="overflow-hidden rounded-[13px] border border-border bg-bg">
        {barra ? <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">{barra}</div> : null}
        {children}
      </div>
    </div>
  )
}

/** Rótulo de la barra del marco: deja claro que lo de adentro es un ejemplo. */
export function Ejemplo({ texto }: { texto: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted">
      <svg aria-hidden viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="6" cy="6" r="4.75" />
        <path d="M6 5.4v3M6 3.6v.01" />
      </svg>
      {texto}
    </span>
  )
}

/** Las marcas del historial del panel: cuatro formas, el verde solo para "te cita". */
export function Marca({ estado, etiqueta }: { estado: Estado; etiqueta: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="shrink-0" role="img" aria-label={etiqueta}>
      <title>{etiqueta}</title>
      {estado === 'cita' ? (
        <>
          <circle cx="8" cy="8" r="7" fill="var(--accent)" />
          <path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="var(--accent-text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : estado === 'nombra' ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--text)" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.5" fill="var(--text)" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--faint)" strokeWidth="1.5" />
      )}
    </svg>
  )
}

/** El resultado de una pregunta en un asistente, dicho con palabras, como en el Radar. */
export function EstadoTexto({ estado, etiqueta }: { estado: Estado; etiqueta: string }) {
  const trazo = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
  const [clase, icono] =
    estado === 'cita'
      ? ['font-medium text-accent', <svg key="i" {...trazo}><path d="M5 12.5 10 17l9-10" /></svg>]
      : estado === 'nombra'
        ? ['text-text', <svg key="i" {...trazo}><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" /></svg>]
        : ['text-muted', <svg key="i" {...trazo}><path d="M7 7l10 10M17 7 7 17" /></svg>]
  return (
    <span className={`flex items-center gap-2 text-sm ${clase}`}>
      <span className="shrink-0">{icono}</span>
      {etiqueta}
    </span>
  )
}

/** Un ícono de 20 px en trazo fino, para listas y franjas. */
export function Icono({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  )
}

/** Trazos de los íconos del home (24×24). Dibujados acá, sin logos de terceros. */
export const ICONOS = {
  globo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-8.5 9h17M12 3c2.3 2.5 3.5 5.5 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z',
  pregunta: 'M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5Zm5.6 2.9a2 2 0 1 1 2.6 1.9c-.5.2-.7.5-.7 1v.3m0 1.9v.01',
  vuelta: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4',
  avion: 'm21 3.5-18 7 6.5 2.5L12 20l3-6.5L21 3.5ZM9.5 13 21 3.5',
  numeral: 'M9.5 4 8 20M16 4l-1.5 16M4.5 9h16M3.5 15h16',
  panel: 'M3.5 5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Zm0 4h17M9.5 9.5v11',
  terminal: 'M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Zm3 5 3 2.5-3 2.5m5 1h4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
} as const
