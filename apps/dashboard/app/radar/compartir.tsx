'use client'

import { useState } from 'react'

/** Botón que copia un texto al portapapeles y avisa un segundo y medio. */
export function Copiar({
  texto,
  etiqueta,
  copiado,
  variante = 'borde',
}: {
  texto: string
  etiqueta: string
  copiado: string
  variante?: 'borde' | 'lleno' | 'enlace'
}) {
  const [listo, setListo] = useState(false)
  const clases = {
    borde: 'btn btn-secundario btn-chico',
    lleno: 'btn btn-primario btn-chico',
    enlace: 'text-left text-sm text-muted underline underline-offset-4 hover:text-text',
  }[variante]
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto)
          setListo(true)
          setTimeout(() => setListo(false), 1500)
        } catch {
          // sin permiso de portapapeles: no rompemos la página
        }
      }}
      className={clases}
    >
      {listo ? copiado : etiqueta}
    </button>
  )
}
