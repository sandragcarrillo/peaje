import { getDict } from '@/lib/i18n'

/**
 * Gráfica de revenue calcada del mock: card con header y leyenda, retícula
 * de hairlines punteadas con valores en $, barras div con hover, y la de
 * hoy resaltada en el acento. Datos reales por día.
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
      label: d.toLocaleDateString(dict.panel.formatoFecha, { weekday: 'short' }),
      amount: row ? Number(row.amount) : 0,
      count: row?.count ?? 0,
    })
  }

  const max = Math.max(...serie.map((s) => s.amount), 0.0001)
  const ALTO = 150
  const totalPagos = serie.reduce((a, s) => a + s.count, 0)
  const totalMonto = serie.reduce((a, s) => a + s.amount, 0).toFixed(2)

  return (
    <div className="space-y-6 border border-border bg-bg p-6">
      <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            {dict.panel.ultimosDias(dias)}
          </div>
          <h3 className="mt-0.5 text-lg font-semibold">
            {dict.panel.resumenPagos(totalPagos, totalMonto)}
          </h3>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.04em]">
          <span className="flex items-center gap-1.5 text-muted">
            <span aria-hidden className="inline-block h-3 w-3 bg-border" />
            {dict.panel.histLabel}
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            <span aria-hidden className="inline-block h-3 w-3 bg-accent" />
            {dict.panel.hoyLabel}
          </span>
        </div>
      </div>

      <div className="pt-2 pb-1">
        <div className="relative flex h-48 w-full flex-col justify-between border-b border-border">
          {[1, 0.75, 0.5, 0.25].map((f) => (
            <div
              key={f}
              className="flex w-full justify-between border-b border-dashed border-border pb-1 font-mono text-[10px] text-muted"
            >
              <span>${(max * f).toFixed(2)}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 top-6 bottom-0 flex items-end justify-between px-3 md:px-8">
            {serie.map((s, i) => {
              const esHoy = i === serie.length - 1
              const alto = Math.max(Math.round((s.amount / max) * ALTO), s.amount > 0 ? 6 : 2)
              return (
                <div key={s.fecha} className="group flex cursor-default flex-col items-center gap-2">
                  <span
                    className={`font-mono text-[10px] ${
                      esHoy
                        ? 'font-bold text-text'
                        : 'text-muted opacity-0 transition-opacity group-hover:opacity-100'
                    }`}
                  >
                    ${s.amount.toFixed(2)}
                  </span>
                  <div
                    className={`w-8 transition-colors md:w-12 ${
                      esHoy ? 'bg-accent' : 'bg-border group-hover:bg-faint'
                    }`}
                    style={{ height: `${alto}px` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex justify-between px-3 pt-2 font-mono text-[10px] uppercase text-muted md:px-8">
          {serie.map((s, i) => (
            <span key={s.fecha} className={i === serie.length - 1 ? 'font-bold text-text' : ''}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
