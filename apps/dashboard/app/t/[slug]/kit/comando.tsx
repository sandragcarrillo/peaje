'use client'

import { useState, type ReactNode } from 'react'
import { useDict } from '@/lib/i18n/client'

/** Una línea para copiar: el comando de instalación o la variable de entorno. */
export function Copiable({ texto }: { texto: string }) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto bg-panel-2 px-3 py-2.5 font-mono text-xs">{texto}</pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
        className="shrink-0 border border-border px-3 text-xs text-muted hover:text-text"
      >
        {copiado ? d.unComandoCopiado : d.unComandoCopiar}
      </button>
    </div>
  )
}

/** Dos caminos para instalar: la herramienta de IA del dueño, o a mano. */
export function Pestanas({ agente, manual }: { agente: ReactNode; manual: ReactNode }) {
  const { kit: d } = useDict()
  const [modo, setModo] = useState<'agente' | 'manual'>('agente')
  const tab = (valor: 'agente' | 'manual', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={modo === valor}
      onClick={() => setModo(valor)}
      className={`px-4 py-2.5 text-sm ${modo === valor ? 'border-b-2 border-accent font-medium text-text' : 'text-muted hover:text-text'}`}
    >
      {label}
    </button>
  )
  return (
    <div>
      <div role="tablist" className="flex gap-2 border-b border-border">
        {tab('agente', d.pestanaAgente)}
        {tab('manual', d.pestanaManual)}
      </div>
      <div className="pt-5">{modo === 'agente' ? agente : manual}</div>
    </div>
  )
}

/** El texto completo para la herramienta de IA, con botón de copiar. */
export function PromptAgente({ texto }: { texto: string }) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
        className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg"
      >
        {copiado ? d.agenteCopiado : d.agenteCopiar}
      </button>
      <pre className="max-h-80 overflow-auto border border-border bg-panel-2 p-3 font-mono text-[11px] whitespace-pre-wrap text-muted">{texto}</pre>
    </div>
  )
}
