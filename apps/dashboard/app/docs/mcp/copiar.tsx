'use client'

import { useState } from 'react'

/** Botón chico para copiar un bloque de código. Recibe los textos ya armados. */
export function Copiar({ texto, etiqueta, listo }: { texto: string; etiqueta: string; listo: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-secundario btn-chico shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1600)
        } catch {
          // Sin permiso de portapapeles: el texto sigue a la vista para copiarlo a mano.
        }
      }}
    >
      <span aria-live="polite">{copiado ? listo : etiqueta}</span>
    </button>
  )
}
