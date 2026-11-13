'use client'

import { useState } from 'react'
import { estadoVersionKit, type UltimasVersionesKit } from '@peaje/shared'
import { useDict } from '@/lib/i18n/client'
import type { ChequeoIntegracion } from './actions'

/**
 * Qué versión del paquete de Peaje corre el sitio y, si hay una más nueva, el
 * prompt para que el coding agent la instale. Va debajo de la lista de
 * chequeos, así se ve también con todo en verde. Sin la última de npm no se
 * compara: antes que un aviso equivocado, ninguno.
 */
export function VersionKit({
  instalado,
  ultimas,
  kitUrl,
}: {
  instalado: ChequeoIntegracion['kit']
  ultimas: UltimasVersionesKit
  kitUrl: string
}) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  const estado = estadoVersionKit(instalado, ultimas)
  if (!estado) return null

  const linea =
    estado.tipo === 'anterior'
      ? null
      : `${estado.paquete} ${estado.version}${estado.tipo === 'al-dia' ? ` · ${d.versionUltima}` : ''}`
  const aviso =
    estado.tipo === 'nueva'
      ? d.versionNueva(estado.paquete, estado.ultima)
      : estado.tipo === 'anterior'
        ? d.versionAnterior(estado.nuevas)
        : null
  const prompt =
    estado.tipo === 'nueva'
      ? d.promptActualizar({ paquetes: [{ paquete: estado.paquete, ultima: estado.ultima }], conocido: true, kitUrl })
      : estado.tipo === 'anterior'
        ? d.promptActualizar({ paquetes: estado.nuevas, conocido: false, kitUrl })
        : null

  return (
    <div className="mt-3 space-y-2">
      {linea ? <p className="font-mono text-[11px] tracking-[0.02em] text-muted">{linea}</p> : null}
      {aviso && prompt ? (
        <div className="border border-border bg-bg p-3">
          <p className="text-sm">{aviso}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted hover:text-text">{d.versionVerPrompt}</summary>
            <div className="mt-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(prompt)
                  setCopiado(true)
                  setTimeout(() => setCopiado(false), 1500)
                }}
                className="btn btn-secundario btn-chico"
              >
                {copiado ? d.copiado : d.copiar}
              </button>
            </div>
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-panel p-3 text-[11px] whitespace-pre-wrap text-muted">
              {prompt}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  )
}
