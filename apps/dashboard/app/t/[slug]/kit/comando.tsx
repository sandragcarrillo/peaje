'use client'

import { useState } from 'react'
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
