'use client'

import { useState, type ReactNode } from 'react'
import { useDict } from '@/lib/i18n/client'

/** El texto con la clave tapada, para mostrar en pantalla. Copiar usa siempre el texto real. */
const tapar = (texto: string, secreto?: string) => (secreto ? texto.split(secreto).join('•'.repeat(24)) : texto)

/** El ojito que muestra u oculta la clave. */
function Ojo({ visible, alternar }: { visible: boolean; alternar: () => void }) {
  const { kit: d } = useDict()
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={visible}
      aria-label={visible ? d.secretoOcultar : d.secretoMostrar}
      title={visible ? d.secretoOcultar : d.secretoMostrar}
      className="btn btn-secundario btn-chico btn-icono shrink-0"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {visible ? null : <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    </button>
  )
}

/**
 * Una línea para copiar: el comando de instalación o la variable de entorno.
 * Con `secreto`, la clave sale tapada en pantalla y se muestra con el ojito.
 */
export function Copiable({ texto, secreto }: { texto: string; secreto?: string }) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto bg-panel-2 px-3 py-2.5 font-mono text-xs">{visible ? texto : tapar(texto, secreto)}</pre>
      {secreto ? <Ojo visible={visible} alternar={() => setVisible((v) => !v)} /> : null}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
        className="btn btn-secundario btn-chico shrink-0"
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

/** El texto completo para la herramienta de IA, con botón de copiar. Con `secreto`, la clave sale tapada. */
export function PromptAgente({ texto, secreto }: { texto: string; secreto?: string }) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-3">
      {secreto ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Ojo visible={visible} alternar={() => setVisible((v) => !v)} />
          <span>{d.secretoTapado}</span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}
        className="btn btn-primario"
      >
        {copiado ? d.agenteCopiado : d.agenteCopiar}
      </button>
      <pre className="max-h-80 overflow-auto border border-border bg-panel-2 p-3 font-mono text-[11px] whitespace-pre-wrap text-muted">{visible ? texto : tapar(texto, secreto)}</pre>
    </div>
  )
}
