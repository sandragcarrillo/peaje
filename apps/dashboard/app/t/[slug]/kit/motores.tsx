'use client'

import { useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import type { Entidad } from '@peaje/shared'
import { useVerificacion } from './partes'

/**
 * "Motores de respuesta": la capa del kit para ChatGPT, Perplexity y los AI
 * Overviews. No es un kit aparte: el robots.txt y el head de la home son los
 * mismos bloques, acá se cargan los datos que los alimentan y se mide lo que
 * esos motores necesitan de verdad (leer HTML, no toparse con un 403).
 *
 * Lo que NO está, a propósito: llms.txt como señal, FAQPage (Google lo
 * eliminó en 2026), páginas Q&A generadas. Los motores no las usan.
 */

/** Directorios donde el NAP tiene que ser idéntico al del sitio. */
const DIRECTORIOS = [
  { nombre: 'Google Business Profile', url: 'https://business.google.com/' },
  { nombre: 'Yelp', url: 'https://biz.yelp.com/' },
  { nombre: 'Bing Places', url: 'https://www.bingplaces.com/' },
  { nombre: 'LinkedIn', url: 'https://www.linkedin.com/company/setup/new/' },
]

export function MotoresDeRespuesta({
  slug,
  nombre,
  entidad,
  bloquearEntrenamiento,
}: {
  slug: string
  nombre: string
  entidad: Entidad
  bloquearEntrenamiento: boolean
}) {
  const { kit: d } = useDict()
  const { resultados, corriendo } = useVerificacion()

  const sinDominio = resultados?.[0]?.id === 'dominio'
  const chequeos = (resultados ?? []).filter((r) => r.id === 'robots' || r.id === 'bots')

  return (
    <section className="rounded-lg border border-border bg-panel p-5">
      <div>
        <h2 className="font-medium">{d.motoresTitulo}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{d.motoresIntro}</p>
      </div>

      <Parte titulo={d.motoresChequeos}>
        {corriendo && resultados === null ? (
          <p className="text-sm text-muted">{d.motoresMidiendo}</p>
        ) : sinDominio ? (
          <p className="text-sm text-muted">{d.motoresSinDominio}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 font-mono text-xs md:grid-cols-2">
            {chequeos.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5 border border-border bg-bg p-2">
                <span className={`font-bold ${r.ok ? 'text-accent' : 'text-red-600'}`}>{r.ok ? '[x]' : '[ ]'}</span>
                <span className="min-w-0">
                  <span className="block">{r.label}</span>
                  <span className="block text-[10px] leading-relaxed text-muted">{r.detalle}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Parte>

      <Parte titulo={d.entidadTitulo}>
        <p className="mb-3 text-sm text-muted">{d.entidadIntro}</p>
        <FormularioEntidad slug={slug} entidad={entidad} bloquearEntrenamiento={bloquearEntrenamiento} />
      </Parte>

      <Parte titulo={d.fueraTitulo}>
        <p className="text-sm text-muted">{d.fueraIntro}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Copiable etiqueta={d.fueraNombre} valor={nombre} />
          <Copiable etiqueta={d.fueraDireccion} valor={entidad.direccion?.trim() || null} vacio={d.fueraSinDireccion} />
        </div>
        <ul className="mt-3 space-y-1.5 font-mono text-xs">
          {DIRECTORIOS.map((dir) => (
            <li key={dir.nombre} className="flex items-center gap-2.5">
              <span className="text-muted">[ ]</span>
              <span>{dir.nombre}</span>
              <a href={dir.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {d.fueraAbrir} ↗
              </a>
            </li>
          ))}
        </ul>
      </Parte>

      <p className="mt-5 border-t border-border pt-4 text-xs text-muted">{d.motoresNota}</p>
    </section>
  )
}

function FormularioEntidad({
  slug,
  entidad,
  bloquearEntrenamiento,
}: {
  slug: string
  entidad: Entidad
  bloquearEntrenamiento: boolean
}) {
  const { kit: d } = useDict()
  const [pendiente, iniciar] = useTransition()
  const [estado, setEstado] = useState<{ ok: boolean; error?: string } | null>(null)

  const campo =
    'mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none'
  const etiqueta = 'block text-xs text-muted'

  return (
    <form
      action={(fd) => {
        setEstado(null)
        iniciar(async () => {
          const { guardarEntidad } = await import('./actions')
          setEstado(await guardarEntidad(slug, fd))
        })
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={etiqueta}>
          {d.entidadLogo}
          <input name="logoUrl" type="url" defaultValue={entidad.logoUrl ?? ''} placeholder="https://" className={campo} />
        </label>
        <label className={etiqueta}>
          {d.entidadTelefono}
          <input name="telefono" type="tel" defaultValue={entidad.telefono ?? ''} className={campo} />
        </label>
      </div>
      <label className={etiqueta}>
        {d.entidadDireccion}
        <input name="direccion" type="text" defaultValue={entidad.direccion ?? ''} className={campo} />
      </label>
      <label className={etiqueta}>
        {d.entidadDescripcion}
        <textarea
          name="descripcion"
          rows={2}
          maxLength={300}
          defaultValue={entidad.descripcion ?? ''}
          className={campo}
        />
        <span className="mt-1 block text-[11px] text-muted">{d.entidadDescripcionAyuda}</span>
      </label>
      <label className={etiqueta}>
        {d.entidadSameAs}
        <textarea
          name="sameAs"
          rows={3}
          defaultValue={(entidad.sameAs ?? []).join('\n')}
          placeholder={'https://www.linkedin.com/company/...\nhttps://www.instagram.com/...'}
          className={`${campo} font-mono text-xs`}
        />
        <span className="mt-1 block text-[11px] text-muted">{d.entidadSameAsAyuda}</span>
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          name="bloquearEntrenamiento"
          type="checkbox"
          defaultChecked={bloquearEntrenamiento}
          className="mt-1 accent-[var(--accent)]"
        />
        <span>
          {d.entidadBloquearEntrenamiento}
          <span className="block text-xs text-muted">{d.entidadBloquearEntrenamientoAyuda}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {pendiente ? d.entidadGuardando : d.entidadGuardar}
        </button>
        {estado?.ok ? <p className="text-xs text-accent">{d.entidadGuardado}</p> : null}
        {estado && !estado.ok ? <p className="text-xs text-red-600">{estado.error}</p> : null}
      </div>
    </form>
  )
}

/** Un valor del NAP con botón copiar: el punto es que quede idéntico en todos lados. */
function Copiable({ etiqueta, valor, vacio }: { etiqueta: string; valor: string | null; vacio?: string }) {
  const { kit: d } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{etiqueta}</p>
        {valor ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(valor)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            }}
            className="text-xs text-accent hover:underline"
          >
            {copiado ? d.copiado : d.copiar}
          </button>
        ) : null}
      </div>
      {valor ? (
        <p className="mt-1 text-sm">{valor}</p>
      ) : (
        <p className="mt-1 text-xs text-muted">{vacio}</p>
      )}
    </div>
  )
}

function Parte({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{titulo}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}
