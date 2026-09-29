'use client'

import type { MysteryRun } from '@peaje/db'
import { useState, useTransition } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { probarComprador } from './actions'

/**
 * "¿Te elige un agente comprador?": la última corrida del comprador
 * misterioso (misiones, puesto, a quién eligió en tu lugar, problemas del
 * paso de pago) y el botón para probar de nuevo.
 */
export function CompradorPanel({ slug, run }: { slug: string; run: MysteryRun | null }) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const es = locale === 'es'
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const probar = () =>
    start(async () => {
      setMsj(null)
      try {
        const r = await probarComprador(slug)
        if (r.error === 'too-soon') setMsj(t.compEspera(Math.ceil((r.retryInSeconds ?? 0) / 3600)))
      } catch (e) {
        setMsj(e instanceof Error ? e.message : String(e))
      }
    })

  const misiones = run?.missions ?? []
  const elegido = misiones.filter((m) => m.chosen).length
  const visto = misiones.filter((m) => m.found && !m.chosen).length
  const perdido = misiones.filter((m) => !m.found).length
  const problemas = (run?.probe?.targets ?? []).flatMap((x) => x.issues)
  const unicos = [...new Map(problemas.map((i) => [i.id, i])).values()]
  const propios = unicos.filter((i) => i.side === 'owner')
  const dePeaje = unicos.filter((i) => i.side === 'peaje')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t.compIntro}</p>

      {!run ? (
        <p className="text-sm text-muted">{t.compSinCorrer}</p>
      ) : misiones.length === 0 ? (
        <p className="text-sm">{run.summary}</p>
      ) : (
        <div className="space-y-4 border border-border p-4">
          <p className="text-lg font-semibold">{t.compResumen(elegido, visto, perdido, misiones.length)}</p>
          <p className="font-mono text-xs text-muted">{t.compCorrida(new Date(run.runAt).toLocaleString(locale))}</p>
          <ul className="divide-y divide-border border border-border">
            {misiones.map((m, i) => (
              <li key={i} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-medium">“{m.mission}”</p>
                <p className="font-mono text-[11px] uppercase text-muted">
                  {m.found ? `${t.compEncontrado} · ${t.compPuesto(m.rank ?? 0)}` : t.compNoEncontrado}
                  {m.chosen ? ` · ${t.compElegido}` : m.instead ? ` · ${t.compEnTuLugar}: ${m.instead.host}${m.instead.priceUsd !== null ? ` ($${m.instead.priceUsd})` : ''}` : ''}
                </p>
                <p>{es ? m.verdictEs : m.verdict}</p>
                {!m.chosen && m.reason ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">{t.compPorQue}</summary>
                    <p className="mt-1 text-xs text-muted">{m.reason}</p>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>

          {run.probe?.targets.length ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-muted">{t.compPago}: </span>
                {run.probe.targets.map((x) => `${x.via === 'domain' ? t.compDominio : t.compGateway} ${x.ok ? t.compPagoOk : t.compPagoMal}${x.status ? ` (${x.status})` : ''}`).join(' · ')}
              </p>
              {propios.length ? (
                <div>
                  <p className="text-sm font-medium">{t.compProblemas}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {propios.map((i) => (
                      <li key={i.id}>{es ? i.es : i.text}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm">{t.compSinProblemas}</p>
              )}
              {dePeaje.length ? (
                <p className="text-xs text-muted">
                  {t.compDePeaje}: {dePeaje.map((i) => (es ? i.es : i.text)).join(' ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={probar} disabled={pending} className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
          {pending ? t.compProbando : t.compProbar}
        </button>
      </div>
      {msj ? <p className="text-sm text-red-600">{msj}</p> : null}
    </div>
  )
}
