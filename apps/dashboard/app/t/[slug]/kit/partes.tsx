'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDict } from '@/lib/i18n/client'
import type { ChequeoIntegracion } from './actions'

/** Bloque colapsable del kit: título + detalle visibles, contenido bajo toggle. */
export function ToggleBlock({
  titulo,
  detalle,
  contenido,
  abierto = false,
}: {
  titulo: string
  detalle: string
  contenido: string
  abierto?: boolean
}) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <details
      open={abierto}
      className="group rounded-lg border border-border bg-panel open:border-accent/40"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-muted transition-transform group-open:rotate-90">▶</span>
        <span className="font-medium">{titulo}</span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted">{detalle}</p>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(contenido)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            }}
            className="shrink-0 text-xs text-accent hover:underline"
          >
            {copiado ? d.copiado : d.copiar}
          </button>
        </div>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed">
          {contenido}
        </pre>
      </div>
    </details>
  )
}

export function BotonScore({ slug, label }: { slug: string; label: string }) {
  const { kit: d } = useDict()
  const [estado, setEstado] = useState<'idle' | 'corriendo' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={estado === 'corriendo'}
        onClick={async () => {
          setEstado('corriendo')
          setError(null)
          const { correrScore } = await import('./actions')
          const result = await correrScore(slug)
          if (!result.ok) {
            setEstado('error')
            setError(result.error ?? d.scanFallo)
          } else {
            setEstado('idle')
          }
        }}
        className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
      >
        {estado === 'corriendo' ? d.escaneando : label}
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  )
}

/** "Ya lo integré" → Peaje verifica bloque por bloque contra el dominio real. */
/** Una pieza del kit: lo que el prompt dice sobre ella cuando falta. */
export type Pieza = { id: string; titulo: string; detalle: string; contenido: string }

export type MarcoPrompt = {
  intro: string
  noCrearTitulo: string
  noCrearDetalle: string
  noCrearCierre: string
  rutas: string[]
  verifica: string
  audit: string
  referencia: string
}

/**
 * "Implementa Peaje": verifica el dominio y arma el prompt SOLO con lo que
 * falta.
 *
 * El prompt completo sigue abajo, pero no es el que querés pegar dos veces:
 * si ya conectaste el dominio, volver a mandarle a un agente las reglas del
 * proxy es pedirle que toque algo que ya está bien. Acá se ve el delta.
 */
export function ImplementarPeaje({
  slug,
  piezas,
  marco,
}: {
  slug: string
  piezas: Pieza[]
  marco: MarcoPrompt
}) {
  const { kit: d } = useDict()
  const [resultados, setResultados] = useState<ChequeoIntegracion[] | null>(null)
  const [corriendo, setCorriendo] = useState(true)
  const [copiado, setCopiado] = useState(false)

  const verificar = useCallback(async () => {
    setCorriendo(true)
    try {
      const { verificarIntegracion } = await import('./actions')
      setResultados(await verificarIntegracion(slug))
    } finally {
      setCorriendo(false)
    }
  }, [slug])

  useEffect(() => {
    void verificar()
  }, [verificar])

  const faltan = resultados?.filter((r) => !r.ok) ?? []
  const listo = resultados !== null && faltan.length === 0
  const sinDominio = resultados?.[0]?.id === 'dominio'

  const pendientes = piezas.filter((p) => faltan.some((f) => f.id === p.id))
  const faltaProxy = faltan.some((f) => f.id === 'proxy')
  // Copias que le ganan al proxy: se nombran una por una, con la ruta exacta,
  // para que el agente borre esas y no se ponga a adivinar.
  const tapadas = faltan.find((f) => f.id === 'frescura')?.faltantes ?? []

  const limpieza =
    faltaProxy || tapadas.length > 0
      ? [
          `## ${marco.noCrearTitulo}`,
          ...(tapadas.length > 0 ? [d.promptTapadas(tapadas), ''] : []),
          marco.noCrearDetalle,
          '',
          ...marco.rutas.map((r) => `- ${r}`),
          '',
          marco.noCrearCierre,
        ].join('\n')
      : null

  const prompt = [
    marco.intro,
    ...pendientes.map((p) => `## ${p.titulo}\n${p.detalle}\n\n\`\`\`\n${p.contenido}\n\`\`\``),
    ...(limpieza ? [limpieza] : []),
    marco.verifica,
    marco.audit,
    marco.referencia,
  ].join('\n\n')

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{d.implementaTitulo}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{d.implementaIntro}</p>
        </div>
        <button
          type="button"
          disabled={corriendo}
          onClick={verificar}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-text disabled:opacity-50"
        >
          {corriendo ? d.verificando : d.verificarDeNuevo}
        </button>
      </div>

      {corriendo && resultados === null ? (
        <p className="mt-5 text-sm text-muted">{d.implementaMidiendo}</p>
      ) : sinDominio ? (
        <p className="mt-5 rounded-lg border border-yellow-400/40 bg-panel p-3 text-sm text-yellow-400">
          {resultados?.[0]?.detalle}
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-1.5">
            {(resultados ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.ok ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <span className={r.ok ? '' : 'text-muted'}>{r.label}</span>
                <span className="text-xs text-muted">· {r.detalle}</span>
              </li>
            ))}
          </ul>

          {listo ? (
            <div className="mt-5 rounded-lg border border-green-400/40 bg-panel p-4">
              <p className="text-sm font-medium text-green-400">{d.implementaListoTitulo}</p>
              <p className="mt-1 text-sm text-muted">{d.implementaListoDetalle}</p>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm">{d.implementaFaltan(faltan.length)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(prompt)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 1500)
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
                >
                  {copiado ? d.implementaCopiado : d.implementaCopiar}
                </button>
                <details className="min-w-full sm:min-w-0">
                  <summary className="cursor-pointer text-xs text-muted hover:text-text">
                    {d.implementaVer}
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-bg p-3 text-[11px] whitespace-pre-wrap text-muted">
                    {prompt}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
