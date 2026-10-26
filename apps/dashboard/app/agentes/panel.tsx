'use client'

import type { AgentRun } from '@peaje/db'
import { useState } from 'react'
import { money } from '@/lib/config'
import { useDict } from '@/lib/i18n/client'
import { CuerpoMarkdown, separarFuente } from './tu-agente'

// Fondear un agente desde el saldo del negocio ya no existe: Peaje no guarda
// saldos. El dueño manda fondos a la dirección del agente (ver tu-agente.tsx).

export function Resultados({ runs }: { runs: AgentRun[] }) {
  const d = useDict()
  if (runs.length === 0) {
    return <p className="mt-4 text-sm text-muted">{d.agentes.sinCompras}</p>
  }
  return (
    <ul className="mt-4 space-y-4 border-t border-border pt-4">
      {runs.map((r) => (
        <Resultado key={r.id} run={r} />
      ))}
    </ul>
  )
}

function Resultado({ run }: { run: AgentRun }) {
  const d = useDict()
  const [abierto, setAbierto] = useState(false)
  const decision = (run.decision ?? {}) as {
    mercado?: { consultados?: number; conReputacionOnchain?: number }
    justificacion?: string | null
    elegido?: { nombre?: string } | null
    codigo?: string | null
  }
  const crudo = run.result ?? run.resultExcerpt
  // Una corrida vieja puede traer HTML comprado tal cual: no se vomita en la
  // tarjeta. Se muestra una nota y el HTML queda plegado como texto.
  const esHtml = crudo !== null && /^\s*<!doctype|^\s*<html/i.test(crudo)
  const cuerpo = crudo

  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span
          className={
            run.status === 'success'
              ? 'text-accent'
              : run.status === 'failed'
                ? 'text-red-600'
                : 'text-amber-700'
          }
        >
          ●
        </span>
        <span className="text-muted">
          {new Date(run.createdAt).toLocaleString(d.agentes.fechaLocale, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {decision.elegido?.nombre ? (
          <span className="text-text">{decision.elegido.nombre}</span>
        ) : null}
        {run.amount ? <span>{money(run.amount)}</span> : null}
        {run.deliveredAt ? <span className="text-muted">· {d.agentes.avisado}</span> : null}
        {run.deliveryError ? (
          <span className="text-amber-700" title={run.deliveryError}>
            · {d.agentes.noSePudoAvisar}
          </span>
        ) : null}
        {decision.mercado?.consultados ? (
          <span className="text-muted">
            ·{' '}
            {d.agentes.evaluo(
              decision.mercado.consultados,
              decision.mercado.conReputacionOnchain ?? 0,
            )}
          </span>
        ) : null}
      </div>

      {run.error ? (
        <p className="mt-1 text-xs text-amber-500">{traducirErrorDeCorrida(run.error, decision.codigo, d)}</p>
      ) : null}

      {cuerpo ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className="btn btn-secundario btn-chico"
          >
            {abierto
              ? d.agentes.ocultarResultado
              : esHtml
                ? d.agentes.verHtml(Math.max(1, Math.round((cuerpo?.length ?? 0) / 1024)))
                : d.agentes.leerResultado}
          </button>
          {abierto ? (
            esHtml ? (
              <pre className="mt-2 max-h-80 overflow-auto border border-border bg-bg p-3 text-[11px] whitespace-pre-wrap text-muted">
                {cuerpo}
              </pre>
            ) : (
              <div className="mt-2 max-h-96 overflow-auto border border-border bg-bg p-4">
                <CuerpoMarkdown texto={separarFuente(cuerpo ?? '').cuerpo} />
                {separarFuente(cuerpo ?? '').fuente ? (
                  <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] break-all text-muted">
                    {d.agentes.fuenteComprada}: {separarFuente(cuerpo ?? '').fuente}
                  </p>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Los errores de corridas se guardan en español (los escribe el gateway).
 * Acá se mapean a la copy del idioma del UI: por código cuando existe, y por
 * prefijo para las corridas viejas que no lo traen.
 */
export function traducirErrorDeCorrida(
  error: string,
  codigo: string | null | undefined,
  d: ReturnType<typeof useDict>,
): string {
  if (codigo === 'fondos') return d.agentes.faltaSaldoCompra
  if (codigo === 'sin-match') return d.agentes.sinPlan
  if (error.startsWith('Sin presupuesto') || error.startsWith('Falta saldo')) {
    return d.agentes.faltaSaldoCompra
  }
  if (error.startsWith('Ningún servicio') || error.startsWith('No compré nada')) {
    return d.agentes.sinPlan
  }
  return error
}
