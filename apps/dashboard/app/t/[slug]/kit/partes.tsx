'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useDict } from '@/lib/i18n/client'
import type { ChequeoIntegracion } from './actions'

/**
 * Una sola medición del dominio para toda la página. "Implementa Peaje" y
 * "Motores de respuesta" leen el mismo resultado: cada verificación son unos
 * veinte fetches al dominio del negocio, y dos secciones midiendo por su
 * cuenta lo duplicaban.
 */
type Verificacion = {
  resultados: ChequeoIntegracion[] | null
  corriendo: boolean
  verificar: () => Promise<void>
}

const VerificacionCtx = createContext<Verificacion | null>(null)

export function VerificacionProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [resultados, setResultados] = useState<ChequeoIntegracion[] | null>(null)
  const [corriendo, setCorriendo] = useState(true)

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

  const valor = useMemo(() => ({ resultados, corriendo, verificar }), [resultados, corriendo, verificar])
  return <VerificacionCtx.Provider value={valor}>{children}</VerificacionCtx.Provider>
}

export function useVerificacion(): Verificacion {
  const v = useContext(VerificacionCtx)
  if (!v) throw new Error('useVerificacion necesita VerificacionProvider')
  return v
}

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
        className="shrink-0 rounded-lg bg-text px-3 py-2 text-xs font-medium text-bg disabled:opacity-50"
      >
        {estado === 'corriendo' ? d.escaneando : label}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

/** "Ya lo integré" → Peaje verifica bloque por bloque contra el dominio real. */
/** Una pieza del kit: lo que el prompt dice sobre ella cuando falta. */
export type Pieza = { id: string; titulo: string; detalle: string; contenido: string; contenidoAeo?: string }

/** Qué capas del kit quiere instalar el dueño. */
export type Capa = 'todo' | 'aeo'

export type MarcoPrompt = {
  /**
   * Datos del prompt corto (una línea que apunta al kit del gateway, el
   * principal). Van como datos y no como función: una función no cruza de un
   * Server Component a uno de cliente, y el prompt depende de `faltan`, que
   * solo se conoce acá después de verificar.
   */
  originHost: string
  base: string
  slug: string
  intro: string
  introAeo: string
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
export function ImplementarPeaje({ piezas, marco }: { piezas: Pieza[]; marco: MarcoPrompt }) {
  const { kit: d } = useDict()
  const { resultados, corriendo, verificar } = useVerificacion()
  const [copiado, setCopiado] = useState(false)
  const [capa, setCapa] = useState<Capa>('todo')
  const soloAeo = capa === 'aeo'

  // `bots` se muestra y se explica en "Motores de respuesta": no es algo que
  // el coding agent arregle en el repo (es el WAF o el bot fight mode), así
  // que meterlo en el prompt solo lo confundiría. Con "solo motores" tampoco
  // cuentan el proxy, los links ni las copias: no hay proxy que instalar.
  const DE_AEO = new Set(['dominio', 'json-ld', 'robots'])
  const propios = (resultados ?? []).filter((r) => r.id !== 'bots' && (!soloAeo || DE_AEO.has(r.id)))
  const faltan = resultados ? propios.filter((r) => !r.ok) : []
  const listo = resultados !== null && faltan.length === 0
  const sinDominio = resultados?.[0]?.id === 'dominio'

  const pendientes = piezas
    .filter((p) => faltan.some((f) => f.id === p.id))
    .map((p) => (soloAeo ? { ...p, contenido: p.contenidoAeo ?? p.contenido } : p))
  const faltaProxy = !soloAeo && faltan.some((f) => f.id === 'proxy')
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

  // El prompt largo queda como respaldo para agentes que no pueden descargar
  // el kit. Se arma igual que antes, pero ya no es lo que se copia primero.
  const promptLargo = (
    soloAeo
      ? [marco.introAeo, ...pendientes.map((p) => `## ${p.titulo}\n${p.detalle}\n\n\`\`\`\n${p.contenido}\n\`\`\``)]
      : [
          marco.intro,
          ...pendientes.map((p) => `## ${p.titulo}\n${p.detalle}\n\n\`\`\`\n${p.contenido}\n\`\`\``),
          ...(limpieza ? [limpieza] : []),
          marco.verifica,
          marco.audit,
          marco.referencia,
        ]
  ).join('\n\n')
  const etiquetas = faltan.map((f) => f.label)
  const prompt = soloAeo
    ? d.promptCortoAeo(marco.originHost, marco.base, marco.slug, etiquetas)
    : d.promptCorto(marco.originHost, marco.base, marco.slug, etiquetas)

  const chip = (valor: Capa, label: string) => (
    <button
      key={valor}
      type="button"
      onClick={() => setCapa(valor)}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        capa === valor ? 'border-accent bg-text text-bg' : 'border-border text-muted hover:border-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className="rounded-lg border border-accent/40 bg-panel p-5">
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

      <div className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{d.capaTitulo}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {chip('todo', d.capaTodo)}
          {chip('aeo', d.capaAeo)}
        </div>
        <p className="mt-2 max-w-2xl text-xs text-muted">{soloAeo ? d.capaAeoDetalle : d.capaTodoDetalle}</p>
      </div>

      {corriendo && resultados === null ? (
        <p className="mt-5 text-sm text-muted">{d.implementaMidiendo}</p>
      ) : sinDominio ? (
        <p className="mt-5 rounded-lg border border-amber-600/50 bg-panel p-3 text-sm text-amber-700">
          {resultados?.[0]?.detalle}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-2.5 font-mono text-xs md:grid-cols-2">
            {propios.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5 border border-border bg-bg p-2">
                <span className={`font-bold ${r.ok ? 'text-accent' : 'text-red-600'}`}>
                  {r.ok ? '[x]' : '[ ]'}
                </span>
                <span className="min-w-0">
                  <span className="block">{r.label}</span>
                  <span className="block truncate text-[10px] text-muted">{r.detalle}</span>
                </span>
              </div>
            ))}
          </div>

          {listo ? (
            <div className="mt-5 border border-accent bg-bg p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {d.implementaListoTitulo}
              </p>
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
                  className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg"
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
                <details className="min-w-full sm:min-w-0">
                  <summary className="cursor-pointer text-xs text-muted hover:text-text">
                    {d.implementaVerLargo}
                  </summary>
                  <p className="mt-2 text-xs text-muted">{d.implementaLargoDetalle}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(promptLargo)}
                      className="text-xs text-accent hover:underline"
                    >
                      {d.copiar}
                    </button>
                  </div>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-bg p-3 text-[11px] whitespace-pre-wrap text-muted">
                    {promptLargo}
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
