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
  // El share de agentes pago-ready del mercado es el punto de partida, pero
  // es un supuesto: editable.
  const pctMercado = Math.max(Math.round(sharePagoReady * 100), 5)
  const [pctPago, setPctPago] = useState(pctMercado)

  const factor = Math.max(pctPago, 1) / 100
  const mensual = requests * precio * factor
  const anual = mensual * 12
  // Escenario a 3 meses si tu tráfico de agentes acompaña el ritmo del mercado.
  const enTresMeses = crecimientoMensual !== null ? mensual * (1 + crecimientoMensual) ** 3 : null

  const usd = (n: number) => n.toLocaleString(d.intl, { maximumFractionDigits: 0 })

  return (
    <section className="space-y-6 border border-border bg-panel p-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold tracking-tight">{d.calcTitulo}</h2>
        <p className="mt-1 text-sm text-muted">{d.calcSubtitulo}</p>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Controles */}
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold">
                {d.calcRequests}: {requests.toLocaleString(d.intl)}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={100000}
              step={100}
              value={requests}
              onChange={(e) => setRequests(Number(e.target.value))}
              className="h-1.5 w-full cursor-ew-resize appearance-none bg-border accent-[var(--accent)]"
            />
            <div className="flex justify-between font-mono text-[10px] text-faint">
              <span>100</span>
              <span>50.000</span>
              <span>100.000</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {d.calcPrecio}
              </span>
              <div className="flex items-center border border-border bg-bg px-3 py-2">
                <span className="mr-1 font-mono text-sm text-muted">$</span>
                <input
                  type="number"
                  min={0.001}
                  max={1}
                  step={0.001}
                  value={precio}
                  onChange={(e) => setPrecio(Number(e.target.value))}
                  className="w-full border-0 bg-transparent p-0 font-mono text-sm outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {d.calcPctLabel}
              </span>
              <div className="flex items-center border border-border bg-bg px-3 py-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={pctPago}
                  onChange={(e) => setPctPago(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="w-full border-0 bg-transparent p-0 font-mono text-sm font-bold outline-none"
                />
                <span className="ml-1 font-mono text-sm text-muted">% x402</span>
              </div>
              <span className="block font-mono text-[10px] text-faint">
                {d.calcPctNota(pctMercado)}
              </span>
            </div>
          </div>

          {enTresMeses !== null && crecimientoMensual !== null ? (
            <p className="max-w-xl text-xs text-muted">
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

        {/* Card de yield */}
        <div className="flex flex-col justify-between space-y-6 border border-border bg-bg p-6 lg:col-span-5">
          <div className="space-y-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {d.calcProyeccion}
            </span>
            <div className="text-5xl font-bold tracking-tight text-accent tabular-nums">
              ${usd(mensual)}
              <span className="text-2xl">{d.calcPorMes}</span>
            </div>
            <span className="block font-mono text-[10px] text-muted">
              {d.calcAnual(usd(anual), Math.round(factor * 100))}
            </span>
          </div>
          <Link
            href="/nuevo"
            className="flex w-full items-center justify-center gap-2 border border-text bg-negro py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta"
          >
            <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
            {d.calcBoton}
          </Link>
        </div>
      </div>
    </section>
  )
}
