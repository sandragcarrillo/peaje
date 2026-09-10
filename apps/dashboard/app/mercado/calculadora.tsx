'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDict } from '@/lib/i18n/client'

/**
 * Proyección de revenue si le pones un peaje a tu web. Estimación ilustrativa:
 * requests de agentes × precio × share de agentes pago-ready (dato live del
 * mercado ERC-8004 vía The Graph).
 */
export function Calculadora({
  sharePagoReady,
  crecimientoMensual,
}: {
  sharePagoReady: number
  crecimientoMensual: number | null
}) {
  const { mercado: d } = useDict()
  const [requests, setRequests] = useState(5000)
  const [precio, setPrecio] = useState(0.05)

  const factor = Math.max(sharePagoReady, 0.05)
  const mensual = requests * precio * factor
  const anual = mensual * 12
  // Escenario a 3 meses si tu tráfico de agentes acompaña el ritmo del mercado.
  const enTresMeses = crecimientoMensual !== null ? mensual * (1 + crecimientoMensual) ** 3 : null

  const usd = (n: number) => n.toLocaleString(d.intl, { maximumFractionDigits: 0 })

  return (
    <section className="rounded-2xl border border-border bg-panel p-6">
      <h2 className="text-lg font-medium">{d.calcTitulo}</h2>
      <p className="mt-1 text-sm text-muted">{d.calcSubtitulo}</p>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">{d.calcRequests}</span>
          <input
            type="range"
            min={100}
            max={100000}
            step={100}
            value={requests}
            onChange={(e) => setRequests(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <span className="font-mono text-sm">{requests.toLocaleString(d.intl)}</span>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-muted">{d.calcPrecio}</span>
          <input
            type="range"
            min={0.001}
            max={1}
            step={0.001}
            value={precio}
            onChange={(e) => setPrecio(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <span className="font-mono text-sm">${precio.toFixed(3)}</span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{d.calcProyeccion}</p>
          <p className="mt-1 text-3xl font-medium text-accent tabular-nums">
            ${usd(mensual)}
            <span className="text-base text-muted">{d.calcPorMes}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {d.calcAnual(usd(anual), Math.round(factor * 100))}
          </p>
          {enTresMeses !== null && crecimientoMensual !== null ? (
            <p className="mt-2 max-w-md text-xs text-muted">
              {d.calcRitmoInicio}
              <span className="text-accent">
                {crecimientoMensual >= 1
                  ? d.calcRitmoDuplicado
                  : d.calcRitmoCrecio(Math.round(crecimientoMensual * 100))}
              </span>
              {d.calcRitmoMedio}
              <span className="text-text">
                ${usd(enTresMeses)}
                {d.calcPorMes}
              </span>
              {d.calcRitmoFin}
            </p>
          ) : null}
        </div>
        <Link
          href="/nuevo"
          className="rounded-full bg-text px-5 py-2.5 text-sm font-medium text-bg"
        >
          {d.calcBoton}
        </Link>
      </div>
    </section>
  )
}
