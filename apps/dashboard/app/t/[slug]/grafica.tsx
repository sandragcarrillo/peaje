import { getDict } from '@/lib/i18n'

/**
 * Gráfica de revenue diario, server-rendered como SVG puro.
 * Sin librería de charts: son barras, no hace falta.
 */
export async function GraficaRevenue({
  datos,
  dias,
}: {
  datos: { date: string; amount: string; count: number }[]
  dias: number
}) {
  const dict = await getDict()
  const porDia = new Map(datos.map((d) => [d.date, d]))
  const hoy = new Date()
  const serie: { fecha: string; label: string; amount: number; count: number }[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - i)
    const clave = d.toISOString().slice(0, 10)
    const row = porDia.get(clave)
    serie.push({
      fecha: clave,
      label: d.toLocaleDateString(dict.panel.formatoFecha, { day: '2-digit', month: 'short' }),
      amount: row ? Number(row.amount) : 0,
      count: row?.count ?? 0,
    })
  }

  const max = Math.max(...serie.map((s) => s.amount), 0.0001)
  const W = 720
  const H = 120
  const gap = 6
  const barW = (W - gap * (serie.length - 1)) / serie.length

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{dict.panel.ultimosDias(dias)}</h2>
        <p className="text-xs text-muted">
          {dict.panel.resumenPagos(
            serie.reduce((a, s) => a + s.count, 0),
            serie.reduce((a, s) => a + s.amount, 0).toFixed(2),
          )}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="mt-3 w-full rounded-lg border border-border bg-panel p-2"
        role="img"
        aria-label={dict.panel.graficaAria(dias)}
      >
        {serie.map((s, i) => {
          const h = s.amount === 0 ? 2 : Math.max((s.amount / max) * H, 3)
          const x = i * (barW + gap)
          return (
            <g key={s.fecha}>
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                rx={2}
                fill={s.amount === 0 ? 'var(--border)' : 'var(--accent)'}
              >
                <title>{dict.panel.graficaBarra(s.label, s.amount.toFixed(2), s.count)}</title>
              </rect>
              {serie.length <= 14 || i % 5 === 0 ? (
                <text
                  x={x + barW / 2}
                  y={H + 13}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {s.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </section>
  )
}
