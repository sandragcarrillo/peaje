'use client'

import { useState, useTransition } from 'react'
import type { Citacion } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { agregarPregunta, borrarPregunta, medirAhora } from './actions'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

export function CitacionPanel({ slug, datos }: { slug: string; datos: Citacion | null }) {
  const { miAgente: t } = useDict()
  const [texto, setTexto] = useState('')
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [midiendo, setMidiendo] = useState(false)
  if (!datos) return null
  const s = datos.summary
  const faltan = s.engines.filter((e) => !e.configured).map((e) => e.name)
  const motores = s.engines.filter((e) => s.byEngine.some((b) => b.engine === e.id))

  const correr = (fn: () => Promise<unknown>) =>
    start(async () => {
      setMsj(null)
      try {
        await fn()
      } catch (e) {
        setMsj(e instanceof Error ? e.message : String(e))
      }
    })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t.citIntro}</p>
      {s.measuredAt ? (
        <div className="border border-border p-4">
          <p className="text-lg font-semibold">
            {t.citCuota(pct(s.share))} {s.previousShare !== null ? <span className="text-sm font-normal text-muted">{t.citAntes(pct(s.previousShare))}</span> : null}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {s.byEngine.map((b) => `${s.engines.find((e) => e.id === b.engine)?.name ?? b.engine} ${b.cited}/${b.total}`).join(' · ')}
          </p>
          {s.competitors.length ? (
            <p className="mt-3 text-sm">
              <span className="text-muted">{t.citEnTuLugar}: </span>
              {s.competitors.slice(0, 6).map((c) => `${c.domain} (${c.count})`).join(', ')}
            </p>
          ) : null}
          <table className="mt-4 w-full text-sm">
            <thead className="text-left font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="pb-2 font-normal" />
                {motores.map((m) => (
                  <th key={m.id} className="pb-2 text-center font-normal">{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.byPrompt.map((p) => (
                <tr key={p.prompt} className="border-t border-border">
                  <td className="py-2 pr-3">{p.prompt}</td>
                  {motores.map((m) => {
                    const r = p.engines[m.id]
                    const v = !r || r.error ? '·' : r.cited ? '✓' : r.mentioned ? '~' : '✗'
                    return (
                      <td key={m.id} className="py-2 text-center font-mono" title={r?.cited ? t.citCitado : r?.mentioned ? t.citMencion : t.citNo}>
                        {v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">✓ {t.citCitado} · ~ {t.citMencion} · ✗ {t.citNo}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t.citSinMedir}</p>
      )}

      {datos.prompts.length > 0 ? (
        <details className="border border-border p-3">
          <summary className="cursor-pointer text-sm text-muted">
            {t.citPreguntas} ({datos.prompts.length})
          </summary>
          <ul className="mt-3 divide-y divide-border border border-border">
            {datos.prompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>{p.text}</span>
                <button disabled={pending} onClick={() => correr(() => borrarPregunta(slug, p.id))} className="font-mono text-[11px] uppercase text-muted hover:text-red-600">
                  {t.quitar}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t.citPlaceholder}
              className="min-w-64 flex-1 rounded-none border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-text"
            />
            <button disabled={pending || !texto.trim()} onClick={() => correr(async () => { await agregarPregunta(slug, texto); setTexto('') })} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
              {t.citAgregar}
            </button>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || midiendo}
          onClick={() => {
            setMidiendo(true)
            correr(async () => {
              try {
                const r = await medirAhora(slug)
                if (r.error === 'too-soon') setMsj(t.citEspera(Math.ceil((r.retryInSeconds ?? 0) / 3600)))
              } finally {
                setMidiendo(false)
              }
            })
          }}
          className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {pending && midiendo ? t.citMidiendo : t.citMedir}
        </button>
        {faltan.length ? <span className="text-xs text-muted">{t.citFaltan(faltan.join(', '))}</span> : null}
      </div>
      {msj ? <p className="text-sm text-red-600">{msj}</p> : null}
    </div>
  )
}
