'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useDict } from '@/lib/i18n/client'
import { medirDominio } from './actions'

export function Buscador({ inicial }: { inicial: string }) {
  const { radar: d } = useDict()
  const router = useRouter()
  const [valor, setValor] = useState(inicial)
  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = valor.trim()
    if (limpio) router.push(`/radar?d=${encodeURIComponent(limpio)}`)
  }
  return (
    <form onSubmit={enviar} className="flex max-w-xl flex-col gap-2 sm:flex-row">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={d.placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label={d.placeholder}
        className="min-w-0 flex-1 border border-border bg-bg px-4 py-3 font-mono text-sm outline-none focus:border-text"
      />
      <button className="border border-text bg-text px-6 py-3 font-mono text-xs font-bold tracking-[0.1em] text-bg">
        {d.boton}
      </button>
    </form>
  )
}

/** Corre la medición. Con `auto` arranca sola: el dominio todavía no tiene puntaje. */
export function Medir({ dominio, auto = false }: { dominio: string; auto?: boolean }) {
  const { radar: d } = useDict()
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'corriendo'>(auto ? 'corriendo' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const arrancado = useRef(false)

  async function medir() {
    setEstado('corriendo')
    setError(null)
    const r = await medirDominio(dominio)
    if (!r.ok) setError(r.error ?? d.fallo)
    else router.refresh()
    setEstado('idle')
  }

  useEffect(() => {
    if (!auto || arrancado.current) return
    arrancado.current = true
    void medir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (auto) {
    return (
      <div className="border border-border bg-panel p-5 text-sm">
        {estado === 'corriendo' ? (
          <p className="flex items-center gap-3 text-muted">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-accent" />
            {d.midiendo}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-red-600">{error ?? d.fallo}</p>
            <button onClick={medir} className="border border-border px-3 py-1.5 text-xs hover:text-text">
              {d.volverAMedir}
            </button>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={estado === 'corriendo'}
        onClick={medir}
        className="border border-border px-3 py-1.5 text-xs text-muted hover:text-text disabled:opacity-50"
      >
        {estado === 'corriendo' ? d.midiendo : d.volverAMedir}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
