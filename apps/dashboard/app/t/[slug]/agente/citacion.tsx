'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { Citacion, FormatosCitados } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { agregarPregunta, borrarPregunta, medirAhora } from './actions'

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

/** Por debajo de esto, el panel avisa que los conteos son una pista. */
const POCAS_RESPUESTAS = 12

/** Qué tipo de página cita la IA para las preguntas del negocio, con ejemplos y cómo armarla. */
export function FormatosPanel({ datos }: { datos: FormatosCitados }) {
  const { miAgente: t } = useDict()
  return (
    <div className="tarjeta p-4 sm:p-5">
      <p className="font-semibold">{t.fmtTitulo}</p>
      <p className="mt-1 text-sm text-muted">{t.fmtIntro}</p>
      {datos.formats.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.fmtSinDatos}</p>
      ) : (
        <>
          <p className="mt-2 text-xs tabular-nums text-muted">
            {t.fmtBase(datos.answers, datos.rounds)} {datos.answers < POCAS_RESPUESTAS ? t.fmtPoco : null}
          </p>
          <div className="-mx-4 mt-3 divide-y divide-border border-t border-border sm:-mx-5">
            {datos.formats.map((f, i) => (
              <details key={f.format} open={i === 0} className="group px-4 py-3 sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-90">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                    {t.fmtNombres[f.format] ?? f.format}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{t.fmtConteo(f.citations, f.sources)}</span>
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <p>{t.fmtPara[f.format]}</p>
                  <div>
                    <p className="text-xs text-muted">{t.fmtComoArmar}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {(t.fmtRasgos[f.format] ?? []).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  {f.examples.length ? (
                    <div>
                      <p className="text-xs text-muted">{t.fmtEjemplos}</p>
                      <ul className="mt-1 space-y-0.5">
                        {f.examples.map((e) => (
                          <li key={e.url} className="truncate">
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-2 hover:decoration-text">
                              {e.domain}
                              {e.title ? ` · ${e.title}` : ''}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {f.prompts.length ? (
                    <p className="text-xs text-muted">
                      {t.fmtPreguntas}: {f.prompts.join(' · ')}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium">{t.fmtPrimerPaso}: </span>
                    {t.fmtPaso[f.format]}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** `costo`: lo que cuesta medir, ya en texto desde el server. Null si no hay nada que avisar. */
export function CitacionPanel({ slug, datos, costo = null }: { slug: string; datos: Citacion | null; costo?: string | null }) {
  const { miAgente: t } = useDict()
  const [texto, setTexto] = useState('')
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [midiendo, setMidiendo] = useState(false)
  const router = useRouter()
  // Preguntas elegidas pero sin resultado: la primera medición corre en el
  // gateway. Se relee cada 15 s, hasta 4 minutos.
  const esperando = !!datos && datos.prompts.length > 0 && !datos.summary.measuredAt
  useEffect(() => {
    if (!esperando) return
    let vueltas = 0
    const id = setInterval(() => {
      vueltas += 1
      router.refresh()
      if (vueltas >= 16) clearInterval(id)
    }, 15_000)
    return () => clearInterval(id)
  }, [esperando, router])

  const correr = (fn: () => Promise<unknown>) =>
    start(async () => {
      setMsj(null)
      try {
        await fn()
      } catch (e) {
        setMsj(e instanceof Error ? e.message : String(e))
      }
    })

  // La única acción principal de la sección: la misma medición a pedido, con o sin resultados previos.
  const medir = (
    <button
      disabled={pending || midiendo}
      onClick={() => {
        setMidiendo(true)
        correr(async () => {
          try {
            const r = await medirAhora(slug)
            if (r.error === 'too-soon') setMsj(t.citEspera(Math.ceil((r.retryInSeconds ?? 0) / 3600)))
            else if (r.error === 'not-enough-credits') setMsj(r.message ?? null)
          } finally {
            setMidiendo(false)
          }
        })
      }}
      className="btn btn-primario whitespace-normal"
    >
      {pending && midiendo ? t.citMidiendo : t.citMedir}
    </button>
  )

  // Sin medición todavía (ni una en camino): qué hace y el botón, nada más.
  if (!datos || (!datos.summary.measuredAt && !esperando)) {
    return (
      <div className="tarjeta space-y-3 p-4 sm:p-5">
        <p className="max-w-[65ch] text-sm text-muted">{t.citVacio}</p>
        {/* El costo a la izquierda y el botón a la derecha, separados del texto por una línea. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs text-faint">{costo}</span>
          {medir}
        </div>
        {msj ? <p className="text-sm text-red-600">{msj}</p> : null}
      </div>
    )
  }
  const s = datos.summary
  const faltan = s.engines.filter((e) => !e.configured).map((e) => e.name)
  const motores = s.engines.filter((e) => s.byEngine.some((b) => b.engine === e.id))

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
          {/* Con varios motores la tabla no entra en el celular: se desliza de lado. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-muted">
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
          </div>
          <p className="mt-2 text-xs text-muted">✓ {t.citCitado} · ~ {t.citMencion} · ✗ {t.citNo}</p>
        </div>
      ) : null}

      {s.measuredAt && s.formats ? <FormatosPanel datos={s.formats} /> : null}

      {s.measuredAt ? null : <p className="text-sm">{t.citMidiendoFondo}</p>}

      {datos.prompts.length > 0 ? (
        <details className="border border-border p-3">
          <summary className="cursor-pointer text-sm text-muted">
            {t.citPreguntas} ({datos.prompts.length})
          </summary>
          <ul className="mt-3 divide-y divide-border border border-border">
            {datos.prompts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>{p.text}</span>
                <button disabled={pending} onClick={() => correr(() => borrarPregunta(slug, p.id))} className="btn btn-secundario btn-chico hover:text-red-600">
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
              className="min-w-64 flex-1 border border-border bg-bg px-3 py-2 text-base outline-none focus:border-text sm:text-sm"
            />
            <button disabled={pending || !texto.trim()} onClick={() => correr(async () => { await agregarPregunta(slug, texto); setTexto('') })} className="btn btn-secundario">
              {t.citAgregar}
            </button>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-xs text-faint">
          {costo}
          {costo && faltan.length ? ' · ' : null}
          {faltan.length ? t.citFaltan(faltan.join(', ')) : null}
        </span>
        {medir}
      </div>
      {msj ? <p className="text-sm text-red-600">{msj}</p> : null}
    </div>
  )
}
