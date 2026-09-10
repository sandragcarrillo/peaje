'use client'

import { useState } from 'react'
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
export function VerificadorIntegracion({ slug }: { slug: string }) {
  const { kit: d } = useDict()
  const [resultados, setResultados] = useState<ChequeoIntegracion[] | null>(null)
  const [corriendo, setCorriendo] = useState(false)

  const ok = resultados?.filter((r) => r.ok).length ?? 0

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">{d.verificadorTitulo}</h2>
          <p className="mt-1 text-xs text-muted">{d.verificadorNota}</p>
        </div>
        <button
          disabled={corriendo}
          onClick={async () => {
            setCorriendo(true)
            try {
              const { verificarIntegracion } = await import('./actions')
              setResultados(await verificarIntegracion(slug))
            } finally {
              setCorriendo(false)
            }
          }}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {corriendo ? d.verificando : d.verificar}
        </button>
      </div>

      {resultados ? (
        <div className="mt-4">
          <p className="text-xs text-muted">{d.publicados(ok, resultados.length)}</p>
          <ul className="mt-2 space-y-1.5">
            {resultados.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.ok ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <span className={r.ok ? '' : 'text-muted'}>{r.label}</span>
                <span className="text-xs text-muted">· {r.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
