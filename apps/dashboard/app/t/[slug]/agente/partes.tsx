'use client'

import type { AgentTask, TaskFollowup } from '@peaje/db'
import { useState, useTransition } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { buscarTareasAhora, descartarTarea, tareaHecha } from './actions'

const pre = 'overflow-x-auto whitespace-pre-wrap break-all bg-panel-2 px-3 py-2 font-mono text-xs'
const boton = 'btn btn-secundario btn-chico btn-suave'
// 16px en el celular: con menos, iOS hace zoom al enfocar el campo.
const input = 'w-full border border-border bg-bg px-3 py-1.5 font-mono text-base outline-none focus:border-text sm:text-sm'

export function Buscar({ slug }: { slug: string }) {
  const { miAgente: t } = useDict()
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        className="btn btn-secundario btn-chico btn-suave"
        onClick={() =>
          start(async () => {
            setMsj(null)
            try {
              const r = await buscarTareasAhora(slug)
              setMsj(
                'error' in r
                  ? r.error === 'not-enough-credits'
                    ? r.message
                    : t.buscarEspera(r.retryInSeconds)
                  : t.buscarResultado(r.creadas, r.actualizadas, r.cerradas),
              )
            } catch (e) {
              setMsj(e instanceof Error ? e.message : String(e))
            }
          })
        }
      >
        {pending ? t.buscando : t.buscar}
      </button>
      <span className="text-xs text-muted">{msj ?? t.buscarNota}</span>
    </div>
  )
}

export function ListaTareas({
  slug,
  titulo,
  tareas,
  cerradas = false,
  seguimientos = [],
}: {
  slug: string
  titulo: string
  tareas: AgentTask[]
  cerradas?: boolean
  seguimientos?: TaskFollowup[]
}) {
  const { miAgente: t } = useDict()
  // Pocas a la vista: las abiertas vienen en orden de prioridad, así que las primeras son las que importan.
  const tope = cerradas ? 5 : 3
  const [todas, setTodas] = useState(false)
  if (tareas.length === 0) return null
  const visibles = todas ? tareas : tareas.slice(0, tope)
  const ocultas = tareas.length - tope
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xs font-medium text-muted">{titulo}</h3>
        {/* Cómo se trabajan: una vez para toda la lista, no repetido en cada tarjeta. */}
        {cerradas ? null : (
          <details className="border-0 text-xs">
            <summary className="cursor-pointer text-muted hover:text-text">{t.tarjetaComo}</summary>
            <div className="mt-2 max-w-[65ch] space-y-2 text-sm text-muted">
              {[...new Set(tareas.map((x) => x.kind))].map((k) => (
                <p key={k}>
                  <span className="font-medium text-text">{t.tipos[k] ?? k}.</span> {t.como[k]} {t.esperamos[k]}
                </p>
              ))}
              <p>{t.comoMcp}</p>
            </div>
          </details>
        )}
      </div>
      {/* Las abiertas, una tarjeta cada una: se leen y se resuelven de a una. Las cerradas, una lista compacta. */}
      <ul className={cerradas ? 'tarjeta mt-2 divide-y divide-border' : 'mt-2 space-y-3'}>
        {visibles.map((x, i) => (
          <Tarea key={x.id} slug={slug} tarea={x} cerrada={cerradas} primera={!cerradas && i === 0 && tareas.length > 1} seguimientos={seguimientos.filter((f) => f.taskId === x.id)} />
        ))}
      </ul>
      {ocultas > 0 ? (
        // Un botón de verdad, a todo el ancho de la lista: es la única forma de ver el resto.
        <button type="button" className="btn btn-secundario btn-suave btn-ancho mt-3" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? t.verMenos : t.verMas(ocultas)}
        </button>
      ) : null}
    </div>
  )
}

function Tarea({ slug, tarea, cerrada, primera = false, seguimientos }: { slug: string; tarea: AgentTask; cerrada: boolean; primera?: boolean; seguimientos: TaskFollowup[] }) {
  const { miAgente: t } = useDict()
  const locale = useLocale() === 'es' ? 'es' : 'en'
  const p = tarea.priority
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<'nada' | 'hecha' | 'descartar'>('nada')
  const [valor, setValor] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const correr = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError(null)
      try {
        await fn()
        setModo('nada')
        setValor('')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

  // Tareas abiertas: por qué, qué esperamos y cómo, en palabras simples. Las cerradas, compactas.
  const borrador = tarea.body.split('\n## Draft\n')[1]?.trim() ?? null
  const copiar = () => {
    void navigator.clipboard.writeText(tarea.body)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  if (cerrada) {
    return (
      <li className="px-4 py-3 text-sm">
        <span className="font-medium">{tarea.title}</span>
        <p className="mt-1 text-xs text-muted">
          {t.tipos[tarea.kind] ?? tarea.kind} · {t.estados[tarea.status] ?? tarea.status}
          {tarea.note ? ` · ${tarea.note}` : ''}
        </p>
        {tarea.status === 'verified' ? <Resultado seguimientos={seguimientos} /> : null}
      </li>
    )
  }

  const porQue = p?.why[locale] || tarea.summary || t.porQueGenerico[tarea.kind]
  const meta = [t.tipos[tarea.kind] ?? tarea.kind, ...(p ? [t.impacto[p.impact], t.esfuerzo[p.effort]] : []), ...(tarea.status !== 'open' ? [t.estados[tarea.status] ?? tarea.status] : [])]

  return (
    <li className="tarjeta space-y-4 p-4 text-sm sm:p-5">
      <div className="space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {primera ? <span className="font-medium text-accent">{t.primeroEsta}</span> : null}
          {meta.map((m, i) => (
            <span key={m} className="flex items-center gap-2">
              {i > 0 || primera ? <span aria-hidden className="h-0.5 w-0.5 rounded-full bg-faint" /> : null}
              {m}
            </span>
          ))}
        </p>
        <h4 className="text-balance text-base font-semibold leading-snug">{p?.label[locale] ?? tarea.title}</h4>
        <p className="max-w-[65ch] text-muted">{porQue}</p>
      </div>
      {tarea.note ? <p className="text-xs text-muted">{tarea.note}</p> : null}
      {/* Una acción principal; copiar para la IA al lado; lo demás, como texto. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {borrador ? (
          <>
            <button className="btn btn-primario btn-chico btn-suave" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
              {abierto ? t.ocultar : t.verPagina}
            </button>
            <button className={boton} onClick={copiar}>
              {copiado ? t.copiado : t.copiarIA}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primario btn-chico btn-suave" onClick={copiar}>
              {copiado ? t.copiado : t.copiarIA}
            </button>
            <button className={boton} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
              {abierto ? t.ocultar : t.verInstrucciones}
            </button>
          </>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-x-3">
          <button className="accion-texto" aria-pressed={modo === 'hecha'} onClick={() => setModo(modo === 'hecha' ? 'nada' : 'hecha')}>
            {t.yaEsta[tarea.kind] ?? t.marcarHecha}
          </button>
          <button className="accion-texto" aria-pressed={modo === 'descartar'} onClick={() => setModo(modo === 'descartar' ? 'nada' : 'descartar')}>
            {t.noSirve}
          </button>
        </span>
      </div>
      {abierto ? <pre className={`${pre} rounded-md`}>{borrador ?? tarea.body}</pre> : null}
      {modo !== 'nada' ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === 'hecha' ? t.urlEnVivo : t.motivo}
            className={`${input} max-w-md flex-1`}
          />
          <button
            disabled={pending}
            className="btn btn-primario btn-chico btn-suave"
            onClick={() => correr(() => (modo === 'hecha' ? tareaHecha(slug, tarea.id, valor) : descartarTarea(slug, tarea.id, valor)))}
          >
            {modo === 'hecha' ? t.verificar : t.noSirve}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </li>
  )
}

/** El último veredicto del ciclo (2 o 6 semanas después de verificada), o cuándo se mide. */
function Resultado({ seguimientos }: { seguimientos: TaskFollowup[] }) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const hechos = seguimientos.filter((f) => f.doneAt && f.verdict).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const ultimo = hechos[0]
  if (ultimo) {
    const texto = (locale === 'es' ? ultimo.after?.verdictEs : null) ?? ultimo.verdict
    return (
      <p className="mt-2 text-xs">
        <span className="text-xs font-medium text-muted">{t.resultadoTras(ultimo.kind)}</span> {texto}
      </p>
    )
  }
  const proximo = seguimientos.filter((f) => !f.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  return proximo ? <p className="mt-1 text-xs text-muted">{t.proximaMedicion(proximo.dueAt.slice(0, 10))}</p> : null
}
