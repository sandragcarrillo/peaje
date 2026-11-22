'use client'

import { Children, useState, type ReactNode } from 'react'

/**
 * Una lista larga con tope: muestra las primeras `visibles` filas y, si hay
 * más, un botón a todo el ancho para ver el resto. Las filas llegan ya armadas
 * desde el server (son los hijos), así que sirve para cualquier lista del panel.
 * `fijo`: filas que van siempre al final, estén o no abiertas las demás.
 */
export function Tope({
  visibles,
  mas,
  menos,
  fijo,
  className,
  children,
}: {
  visibles: number
  /** El texto del botón ya armado ("Ver 12 más"): una función no cruza del server al cliente. */
  mas: string
  menos: string
  fijo?: ReactNode
  className?: string
  children: ReactNode
}) {
  const filas = Children.toArray(children)
  const [todas, setTodas] = useState(false)
  const ocultas = filas.length - visibles
  return (
    <div>
      <ul className={className}>
        {todas ? filas : filas.slice(0, visibles)}
        {fijo}
      </ul>
      {ocultas > 0 ? (
        <button type="button" className="btn btn-secundario btn-ancho mt-3" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? menos : mas}
        </button>
      ) : null}
    </div>
  )
}
