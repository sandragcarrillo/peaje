'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { TaskCheck } from '@peaje/db'
import { useDict, useLocale } from '@/lib/i18n/client'
import { contarFiltros, nombreMotor, type Etapa, type EstadoEtapa, type Filtro, type Insignia, type Medicion, type Pieza } from './etapas'
import { TextoMarkdown } from './markdown'
import { tareaHecha } from '../actions'

type FiltroLista = 'todas' | Exclude<Filtro, 'descartada'>
type Pestana = 'evidencia' | 'brief' | 'borrador'

const FILTROS: FiltroLista[] = ['todas', 'listo', 'pendiente', 'publicada']
const PESTANAS: Pestana[] = ['evidencia', 'brief', 'borrador']

/** Fechas en UTC: el servidor y el navegador escriben lo mismo. */
function useFecha() {
  const locale = useLocale()
  return (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
}

const chatCon = (slug: string, mensaje: string) => `/t/${slug}/chat?m=${encodeURIComponent(mensaje)}`

const enlace = 'underline decoration-border underline-offset-2 hover:decoration-text'

/**
 * La vista del pipeline: la lista a la izquierda (arriba en el celular) y el
 * detalle de la elegida con sus etapas y las pestañas Evidencia, Instrucciones
 * y Borrador. Todo llega armado del servidor; acá solo se elige y se filtra.
 */
export function Pipeline({ slug, piezas, inicial, creditosPagina }: { slug: string; piezas: Pieza[]; inicial: string | null; creditosPagina: number }) {
  const { contenido: t } = useDict()
  const [filtro, setFiltro] = useState<FiltroLista>('todas')
  const [id, setId] = useState<string | null>(() => (inicial && piezas.some((p) => p.id === inicial) ? inicial : (piezas[0]?.id ?? null)))
  const detalle = useRef<HTMLDivElement>(null)
  const conteo = useMemo(() => contarFiltros(piezas), [piezas])
  const visibles = useMemo(() => (filtro === 'todas' ? piezas : piezas.filter((p) => p.filtro === filtro)), [piezas, filtro])
  const elegida = visibles.find((p) => p.id === id) ?? null

  const elegir = (nuevo: string | null, mover: boolean) => {
    setId(nuevo)
    const url = new URL(window.location.href)
    if (nuevo) url.searchParams.set('id', nuevo)
    else url.searchParams.delete('id')
    // Con null, el router de Next adopta la URL nueva; pasándole su propio state no se entera.
    window.history.replaceState(null, '', url)
    // En pantallas sin columnas el detalle queda abajo de la lista: se baja hasta él.
    if (mover && window.matchMedia('(max-width: 1279px)').matches) {
      const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => detalle.current?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' }))
    }
  }

  const cambiarFiltro = (f: FiltroLista) => {
    setFiltro(f)
    const lista = f === 'todas' ? piezas : piezas.filter((p) => p.filtro === f)
    if (!lista.some((p) => p.id === id)) elegir(lista[0]?.id ?? null, false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.filtrosEtiqueta}>
        {FILTROS.map((f) => (
          <button key={f} type="button" aria-pressed={filtro === f} onClick={() => cambiarFiltro(f)} className={`btn btn-chico ${filtro === f ? 'btn-primario' : 'btn-secundario'}`}>
            {t.filtros[f]}{' '}
            <span className="font-normal tabular-nums opacity-70">{conteo[f]}</span>
          </button>
        ))}
      </div>

      <details className="group border border-border px-4 py-2.5 text-sm">
        <summary className="etiqueta cursor-pointer list-none text-muted hover:text-text">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
          {t.comoSeOrdena}
        </summary>
        <p className="mt-2 max-w-2xl text-muted">{t.comoSeOrdenaTexto}</p>
      </details>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:items-start">
        {visibles.length === 0 ? (
          <p className="border border-dashed border-border p-4 text-sm text-muted">{t.filtroVacio}</p>
        ) : (
          <ul className="scroll-thin divide-y divide-border overflow-hidden border border-border xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            {visibles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => elegir(p.id, true)}
                  aria-current={p.id === elegida?.id ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 rounded-none border-l-2 px-4 py-3 text-left transition-colors ${
                    p.id === elegida?.id ? 'border-accent bg-panel-2' : 'border-transparent hover:bg-panel'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-medium">{p.titulo}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Tipo p={p} />
                      <Etiqueta p={p} />
                    </span>
                  </span>
                  <NumeroPrioridad p={p} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div ref={detalle} className="min-w-0 scroll-mt-24">
          {elegida ? <Detalle key={elegida.id} slug={slug} p={elegida} creditosPagina={creditosPagina} /> : null}
        </div>
      </div>
    </div>
  )
}

function Tipo({ p }: { p: Pieza }) {
  const { contenido: t } = useDict()
  const tipo = p.tipo === 'actualizar' ? t.tipos.actualizar : p.formato ? (t.fmtCortos[p.formato] ?? t.tipos.nueva) : t.tipos.nueva
  return (
    <span className="etiqueta text-muted">
      {tipo}
      {p.serie ? ` · ${t.serie}` : ''}
    </span>
  )
}

const TONO: Record<Insignia, string> = {
  faltan: 'border-lila bg-lila/20 text-text',
  lista: 'border-accent text-accent',
  'en-curso': 'border-border text-muted',
  'sin-borrador': 'border-border text-muted',
  'por-actualizar': 'border-border text-muted',
  revisando: 'border-border text-muted',
  verificada: 'border-accent bg-accent text-accent-text',
  descartada: 'border-dashed border-border text-faint',
}

function Etiqueta({ p }: { p: Pieza }) {
  const { contenido: t } = useDict()
  const texto = p.insignia === 'faltan' ? t.insignias.faltan(p.pendientes.length) : t.insignias[p.insignia]
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs leading-tight ${TONO[p.insignia]}`}>{texto}</span>
}

/** El número de prioridad, con su porqué en el tooltip. Sin medición, un guion. */
function NumeroPrioridad({ p }: { p: Pieza }) {
  const { contenido: t } = useDict()
  const apagado = p.filtro === 'publicada' || p.filtro === 'descartada'
  if (!p.prioridad) {
    return (
      <span title={t.sinPrioridad} className="shrink-0 pt-0.5 font-mono text-sm text-faint">
        <span aria-hidden>—</span>
        <span className="sr-only">{t.sinPrioridad}</span>
      </span>
    )
  }
  const explicacion = t.prioridadTitulo(p.prioridad)
  return (
    <span title={explicacion} className="flex shrink-0 flex-col items-end">
      <span aria-hidden className={`font-mono text-lg leading-none font-bold tabular-nums ${apagado ? 'text-muted' : 'text-text'}`}>
        {p.prioridad.noCitan}
        <span className="text-xs font-normal text-muted">/{p.prioridad.respondieron}</span>
      </span>
      <span aria-hidden className="mt-1 text-[11px] leading-none text-muted">
        {t.prioridadNoTe}
      </span>
      <span className="sr-only">{explicacion}</span>
    </span>
  )
}

function Detalle({ slug, p, creditosPagina }: { slug: string; p: Pieza; creditosPagina: number }) {
  const { contenido: t } = useDict()
  const [pestana, setPestana] = useState<Pestana>(p.borrador ? 'borrador' : 'evidencia')
  const botones = useRef<(HTMLButtonElement | null)[]>([])

  const teclas = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const j = (i + (e.key === 'ArrowRight' ? 1 : PESTANAS.length - 1)) % PESTANAS.length
    setPestana(PESTANAS[j]!)
    botones.current[j]?.focus()
  }

  return (
    <article className="border border-border">
      <header className="space-y-4 border-b border-border p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tipo p={p} />
            <Etiqueta p={p} />
          </div>
          <h2 className="text-lg leading-snug font-semibold">{p.titulo}</h2>
          {p.status === 'dismissed' && p.nota ? <p className="text-xs text-muted">{t.descartadaPor(p.nota)}</p> : null}
        </div>
        <Etapas etapas={p.etapas} faltan={p.pendientes.length} />
        {p.resultado ? <ResultadoBloque p={p} /> : null}
        {p.status === 'open' || p.status === 'in_progress' ? <MarcarPublicada slug={slug} id={p.id} /> : null}
      </header>

      <div role="tablist" aria-label={p.titulo} className="flex overflow-x-auto border-b border-border px-2">
        {PESTANAS.map((x, i) => (
          <button
            key={x}
            ref={(el) => {
              botones.current[i] = el
            }}
            type="button"
            role="tab"
            id={`pestana-${x}`}
            aria-selected={pestana === x}
            aria-controls={`panel-${x}`}
            tabIndex={pestana === x ? 0 : -1}
            onClick={() => setPestana(x)}
            onKeyDown={(e) => teclas(e, i)}
            className={`shrink-0 rounded-none border-b-2 px-3 py-3 text-sm transition-colors ${pestana === x ? 'border-accent font-medium text-text' : 'border-transparent text-muted hover:text-text'}`}
          >
            {t.tabs[x]}
            {x === 'borrador' && p.pendientes.length ? ' ' : null}
            {x === 'borrador' && p.pendientes.length ? <span className="ml-1 rounded-sm bg-lila/30 px-1 font-mono text-[11px] tabular-nums">{p.pendientes.length}</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} className="p-4 sm:p-5">
        {pestana === 'evidencia' ? <PanelEvidencia slug={slug} p={p} /> : pestana === 'brief' ? <PanelBrief p={p} /> : <PanelBorrador slug={slug} p={p} creditosPagina={creditosPagina} />}
      </div>

      <footer className="border-t border-border px-4 py-3 sm:px-5">
        <Link href={`/t/${slug}/agente/tareas/${encodeURIComponent(p.id)}`} className={`text-sm ${enlace}`}>
          {t.abrirTarea}
        </Link>
      </footer>
    </article>
  )
}

function Marca({ estado, n }: { estado: EstadoEtapa; n: number }) {
  const base = 'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full'
  if (estado === 'hecha') {
    return (
      <span aria-hidden className={`${base} bg-accent text-accent-text`}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    )
  }
  if (estado === 'actual') {
    return (
      <span aria-hidden className={`${base} border-2 border-accent bg-bg`}>
        <span className="h-2 w-2 rounded-full bg-accent" />
      </span>
    )
  }
  if (estado === 'sin-dato') {
    return (
      <span aria-hidden className={`${base} border border-dashed border-border bg-bg font-mono text-[11px] text-faint`}>
        –
      </span>
    )
  }
  return (
    <span aria-hidden className={`${base} border border-border bg-bg font-mono text-[11px] text-muted`}>
      {n}
    </span>
  )
}

/** El stepper: Identificada, Instrucciones, Borrador, Revisión y Publicada. */
function Etapas({ etapas, faltan }: { etapas: Etapa[]; faltan: number }) {
  const { contenido: t } = useDict()
  const fecha = useFecha()
  const detalle = (e: Etapa) => {
    if (e.motivo === 'creada' || e.motivo === 'publicada') return fecha(e.fecha)
    if (e.motivo === 'faltan') return t.motivoFaltan(faltan)
    if (e.motivo === 'revisada-con-faltan') return t.motivoRevisadaConFaltan(faltan)
    return t.motivos[e.motivo] ?? ''
  }
  return (
    <ol className="grid gap-3 sm:grid-cols-5 sm:gap-2">
      {etapas.map((e, i) => {
        const sig = etapas[i + 1]
        const avanzada = e.estado === 'hecha' && (sig?.estado === 'hecha' || sig?.estado === 'actual')
        return (
          <li key={e.id} className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
            {sig ? (
              <span
                aria-hidden
                className={`absolute top-7 -bottom-3 left-3 w-px sm:top-3 sm:-right-2 sm:bottom-auto sm:left-7 sm:h-px sm:w-auto ${avanzada ? 'bg-accent' : 'bg-border'}`}
              />
            ) : null}
            <Marca estado={e.estado} n={i + 1} />
            <div className="min-w-0 sm:pr-1">
              <p className={`text-sm ${e.estado === 'actual' ? 'font-semibold' : 'font-medium'} ${e.estado === 'sin-dato' ? 'text-muted' : ''}`}>
                {t.etapas[e.id]}
                <span className="sr-only">: {t.estadosEtapa[e.estado]}</span>
              </p>
              <p className="text-xs leading-snug text-muted">{detalle(e)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Si Peaje la vio en vivo y lo que midieron los seguimientos a 2 y 6 semanas. */
function ResultadoBloque({ p }: { p: Pieza }) {
  const { contenido: t } = useDict()
  const locale = useLocale()
  const fecha = useFecha()
  const r = p.resultado!
  const texto = (m: Medicion) => {
    if (!m.doneAt) return t.medProgramada(fecha(m.dueAt))
    if (m.citan === null) return t.medSinPreguntar
    return m.citan.length ? t.medCitan(m.citan.length, m.preguntados, m.citan.map(nombreMotor).join(', ')) : t.medNoCitan(m.preguntados)
  }
  return (
    <section className="space-y-3 border-t border-border pt-4 text-sm">
      <p className="etiqueta text-muted">{t.resultado}</p>
      {p.url ? (
        <p className="min-w-0 truncate">
          <span className="text-muted">{t.publicadaEn} </span>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className={`font-mono text-xs ${enlace}`}>
            {p.url}
          </a>
        </p>
      ) : null}
      {r.enVivo === 'vista' ? <p>{t.enVivoSi(fecha(p.verificadaEn))}</p> : null}
      {r.enVivo === 'no-vista' ? (
        <div>
          <p>{t.enVivoNo}</p>
          {p.nota ? <p className="mt-1 text-xs break-words text-muted">{p.nota}</p> : null}
        </div>
      ) : null}
      {r.antes ? <p className="text-xs text-muted">{t.antes(r.antes.citan.length, r.antes.preguntados)}</p> : null}
      {r.mediciones.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {r.mediciones.map((m) => {
            const veredicto = m.doneAt ? (locale === 'es' ? (m.veredictoEs ?? m.veredicto) : m.veredicto) : null
            const citado = !!m.citan?.length
            return (
              <li key={m.kind} className="border border-border p-3">
                <p className="etiqueta flex items-center gap-2 text-muted">
                  {m.doneAt ? <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${citado ? 'bg-accent' : 'bg-faint'}`} /> : null}
                  {t.mediciones[m.kind] ?? m.kind}
                </p>
                <p className={`mt-1 ${m.doneAt ? 'font-medium' : 'text-muted'} ${citado ? 'text-accent' : ''}`}>{texto(m)}</p>
                {veredicto ? <p className="mt-1 text-xs text-muted">{veredicto}</p> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted sm:pt-0.5">{etiqueta}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function PanelEvidencia({ slug, p }: { slug: string; p: Pieza }) {
  const { contenido: t, miAgente: m } = useDict()
  const fecha = useFecha()
  const ev = p.evidencia
  const gana = ev?.formatos[0]
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        {p.pregunta ? (
          <Fila etiqueta={t.evPregunta}>
            <span className="font-medium">{p.pregunta}</span>
          </Fila>
        ) : p.direccion ? (
          <Fila etiqueta={t.evPagina}>
            <span className="font-mono text-xs break-all">{p.direccion}</span>
          </Fila>
        ) : null}
        <Fila etiqueta={t.evPorQue}>{p.porQue || m.porQueGenerico.content}</Fila>
        {p.formato ? (
          <Fila etiqueta={t.evFormato}>
            <span className="font-medium">{m.fmtNombres[p.formato] ?? p.formato}</span>
            {m.fmtRasgos[p.formato]?.length ? <span className="text-muted">. {m.fmtRasgos[p.formato]!.join(' · ')}</span> : null}
          </Fila>
        ) : null}
        {p.modelo ? (
          <Fila etiqueta={t.evModelo}>
            <a href={p.modelo} target="_blank" rel="noopener noreferrer" className={`block truncate ${enlace}`}>
              {p.modelo}
            </a>
          </Fila>
        ) : null}
      </dl>

      {p.tipo === 'actualizar' ? (
        <p className="text-muted">{t.evFrescura}</p>
      ) : ev ? (
        <section className="space-y-3">
          <p className="etiqueta text-muted">{t.evMedido(fecha(ev.medidoEn))}</p>
          {p.prioridad ? <p>{t.evResumen(p.prioridad)}</p> : null}
          <ul className="divide-y divide-border border border-border">
            {ev.motores.map((r) => (
              <li key={r.engine} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[6.5rem_10rem_minmax(0,1fr)] sm:gap-3">
                <span className="font-mono text-xs text-muted sm:pt-0.5">{nombreMotor(r.engine)}</span>
                <span className={r.estado === 'cita' ? 'font-medium text-accent' : r.estado === 'error' ? 'text-muted' : ''}>{t.evEstados[r.estado]}</span>
                <span className="min-w-0 text-muted">
                  {r.estado === 'error' ? null : r.enTuLugar.length ? (
                    <>
                      {t.evCito}:{' '}
                      {r.enTuLugar.slice(0, 4).map((c, i) => (
                        <span key={c.url ?? c.domain}>
                          {i ? ', ' : ''}
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" title={c.title ?? undefined} className={`hover:text-text ${enlace}`}>
                              {c.domain}
                            </a>
                          ) : (
                            c.domain
                          )}
                        </span>
                      ))}
                      {r.enTuLugar.length > 4 ? ` +${r.enTuLugar.length - 4}` : ''}
                    </>
                  ) : (
                    t.evSinPaginas
                  )}
                </span>
              </li>
            ))}
          </ul>
          {gana ? <p className="text-muted">{t.evFormatoGana(m.fmtNombres[gana.format] ?? gana.format, gana.paginas, ev.paginasConFormato)}</p> : null}
          <Link href={`/t/${slug}/agente/citas`} className={`inline-block ${enlace}`}>
            {t.evVerCitas}
          </Link>
        </section>
      ) : (
        <p className="border border-dashed border-border p-3 text-muted">{t.evSinMedir}</p>
      )}
    </div>
  )
}

function PanelBrief({ p }: { p: Pieza }) {
  const { contenido: t } = useDict()
  const criterio = (c: TaskCheck) =>
    c.type === 'check'
      ? t.brCriterioCheck(c.id)
      : `${t.brCriterioUrl(c.url)}${c.contains ? t.brCriterioContiene(c.contains) : ''}${c.notStatus !== undefined ? t.brCriterioNoStatus(c.notStatus) : ''}.`
  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Copiar texto={p.cuerpo} etiqueta={t.copiarIA} primario />
        <span className="max-w-md text-xs text-muted">{t.brCopiarNota}</span>
      </div>

      {p.direccion ? (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <Fila etiqueta={t.brDireccion}>
            <span className="font-mono text-xs break-all">{p.direccion}</span>
          </Fila>
        </dl>
      ) : null}

      <section className="space-y-2">
        <p className="etiqueta text-muted">{t.brCriterios}</p>
        {p.criterios.length ? (
          <>
            <ul className="list-disc space-y-1 pl-5 break-words">
              {p.criterios.map((c, i) => (
                <li key={i}>{criterio(c)}</li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t.brCriteriosNota}</p>
          </>
        ) : (
          <p className="text-muted">{t.brSinCriterios}</p>
        )}
      </section>

      <section className="space-y-2">
        <p className="etiqueta text-muted">{t.brInstrucciones}</p>
        {t.brIngles ? <p className="text-xs text-muted">{t.brIngles}</p> : null}
        <div className="border border-border bg-panel p-4">
          <TextoMarkdown texto={p.instrucciones} chico pendientes={false} />
        </div>
      </section>
    </div>
  )
}

function PanelBorrador({ slug, p, creditosPagina }: { slug: string; p: Pieza; creditosPagina: number }) {
  const { contenido: t } = useDict()

  if (!p.borrador) {
    if (p.tipo === 'actualizar') return <p className="text-sm text-muted">{t.boNoLleva}</p>
    if (p.status === 'open') {
      return (
        <div className="space-y-3 text-sm">
          <p>{t.boSinBorrador}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={chatCon(slug, t.boPedirMensaje(p.titulo))} className="btn btn-primario btn-chico whitespace-normal">
              {t.boPedir}
            </Link>
            <span className="text-xs text-muted">{t.boPedirCosto(creditosPagina)}</span>
          </div>
        </div>
      )
    }
    return <p className="text-sm text-muted">{p.status === 'in_progress' ? t.boSinBorrador : t.boSinBorradorCerrada}</p>
  }

  const borrador = p.borrador
  const descargar = () => {
    const href = URL.createObjectURL(new Blob([borrador], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = href
    a.download = p.archivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Copiar texto={borrador} etiqueta={t.boCopiar} primario />
        <button type="button" onClick={descargar} className="btn btn-secundario btn-chico">
          {t.boDescargar}
        </button>
      </div>

      {p.pendientes.length ? (
        <div className="space-y-2 border border-lila bg-lila/10 p-4">
          <p className="font-medium">{t.boFaltan(p.pendientes.length)}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {p.pendientes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {p.status === 'open' ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted">{t.boFaltanNota}</p>
              <Link href={chatCon(slug, t.boResponderMensaje(p.titulo))} className="btn btn-primario btn-chico">
                {t.boResponder}
              </Link>
            </div>
          ) : p.status === 'in_progress' ? (
            <p className="text-xs text-muted">{t.boEnCurso}</p>
          ) : p.status === 'done' || p.status === 'verified' ? (
            <p className="text-xs text-muted">{t.boCerradaFaltan}</p>
          ) : null}
        </div>
      ) : p.status === 'open' ? (
        <p className="text-xs text-muted">{t.boListo}</p>
      ) : null}

      <div className="border border-border p-4 sm:p-6">
        <TextoMarkdown texto={borrador} />
      </div>
    </div>
  )
}

/**
 * "Ya la publiqué": la URL va a la misma acción que la lista de tareas de Mi
 * agente. Peaje la revisa en vivo; si pasa, agenda las mediciones de 2 y 6
 * semanas, y si todavía no está, la vuelve a revisar cada día.
 */
function MarcarPublicada({ slug, id }: { slug: string; id: string }) {
  const { contenido: t } = useDict()
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [estado, setEstado] = useState<'nada' | 'enviando' | 'ok' | 'pendiente' | 'error'>('nada')

  async function marcar(e: React.FormEvent) {
    e.preventDefault()
    if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) return setEstado('error')
    setEstado('enviando')
    try {
      const tarea = await tareaHecha(slug, id, url)
      setEstado(tarea.status === 'verified' ? 'ok' : 'pendiente')
      router.refresh()
    } catch {
      setEstado('error')
    }
  }

  return (
    <form onSubmit={marcar} className="space-y-2 border border-border bg-panel p-4">
      <p className="text-sm font-medium">{t.publicarTitulo}</p>
      <p className="text-xs text-muted">{t.publicarTexto}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          inputMode="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          aria-label={t.publicarUrl}
          // 16px en el celular: con menos, iOS hace zoom al enfocar el campo.
          className="min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-base sm:text-sm"
        />
        <button type="submit" disabled={estado === 'enviando'} className="btn btn-primario btn-chico shrink-0">
          {estado === 'enviando' ? t.publicarRevisando : t.publicarBoton}
        </button>
      </div>
      {estado === 'ok' || estado === 'pendiente' || estado === 'error' ? (
        <p role="status" className="text-xs text-muted">
          {estado === 'ok' ? t.publicarOk : estado === 'pendiente' ? t.publicarPendiente : t.publicarError}
        </p>
      ) : null}
    </form>
  )
}

function Copiar({ texto, etiqueta, primario }: { texto: string; etiqueta: string; primario?: boolean }) {
  const { contenido: t } = useDict()
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      aria-live="polite"
      className={`btn btn-chico ${primario ? 'btn-primario' : 'btn-secundario'}`}
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        })
      }}
    >
      {copiado ? t.copiado : etiqueta}
    </button>
  )
}
