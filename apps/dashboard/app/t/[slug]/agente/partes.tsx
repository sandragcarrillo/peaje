'use client'

import type { AgentTask, TaskFollowup } from '@peaje/db'
import { useState, useTransition } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { buscarTareasAhora, crearClaveAgente, descartarTarea, tareaHecha } from './actions'

const pre = 'overflow-x-auto whitespace-pre-wrap break-all bg-panel-2 px-3 py-2 font-mono text-xs'
const boton = 'rounded-lg border border-border px-3 py-1.5 text-sm hover:text-text disabled:opacity-50'
const input = 'w-full rounded-none border border-border bg-bg px-3 py-1.5 font-mono text-sm outline-none focus:border-text'

export function Clave({ slug, prefijo, mcpUrl, gateway }: { slug: string; prefijo: string | null; mcpUrl: string; gateway: string }) {
  const { miAgente: t } = useDict()
  const [clave, setClave] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const k = clave ?? t.placeholderClave
  const claude = `claude mcp add --transport http peaje ${mcpUrl} --header "Authorization: Bearer ${k}"`
  const cursor = JSON.stringify({ mcpServers: { peaje: { url: mcpUrl, headers: { Authorization: `Bearer ${k}` } } } }, null, 2)
  const terminal = `PEAJE_AGENT_KEY=${k} npx @peaje/cli@1 tasks${gateway.includes('localhost') ? ` --gateway ${gateway}` : ''}`

  return (
    <div className="space-y-4 border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{t.claveTitulo}</span>
          <p className="mt-1 text-sm">{prefijo ? t.claveActual(prefijo) : t.claveNinguna}</p>
        </div>
        <button disabled={pending} className={boton} onClick={() => start(async () => setClave(await crearClaveAgente(slug)))}>
          {prefijo ? t.claveRotar : t.claveGenerar}
        </button>
      </div>
      {clave ? (
        <div>
          <pre className={pre}>{clave}</pre>
          <p className="mt-1 text-xs text-red-600">{t.claveUnaVez}</p>
        </div>
      ) : null}
      <Bloque titulo={t.claudeCode} texto={claude} />
      <Bloque titulo={t.cursor} texto={cursor} />
      <Bloque titulo={t.terminal} texto={terminal} />
    </div>
  )
}

function Bloque({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <span className="text-xs text-muted">{titulo}</span>
      <pre className={`mt-1 ${pre}`}>{texto}</pre>
    </div>
  )
}

export function Buscar({ slug }: { slug: string }) {
  const { miAgente: t } = useDict()
  const [msj, setMsj] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending}
        className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setMsj(null)
            try {
              const r = await buscarTareasAhora(slug)
              setMsj('error' in r ? t.buscarEspera(r.retryInSeconds) : t.buscarResultado(r.creadas, r.actualizadas, r.cerradas))
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
  if (tareas.length === 0) return null
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{titulo}</span>
      <ul className="mt-2 divide-y divide-border border border-border">
        {tareas.map((x) => (
          <Tarea key={x.id} slug={slug} tarea={x} cerrada={cerradas} seguimientos={seguimientos.filter((f) => f.taskId === x.id)} />
        ))}
      </ul>
      {tareas.length === 0 ? <p className="text-sm text-muted">{t.vacio}</p> : null}
    </div>
  )
}

function Tarea({ slug, tarea, cerrada, seguimientos }: { slug: string; tarea: AgentTask; cerrada: boolean; seguimientos: TaskFollowup[] }) {
  const { miAgente: t } = useDict()
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
        <span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{t.tipos[tarea.kind] ?? tarea.kind}</span>
        <span className="font-medium">{tarea.title}</span>
        <p className="mt-1 text-xs text-muted">{t.estados[tarea.status] ?? tarea.status}{tarea.note ? ` · ${tarea.note}` : ''}</p>
        {tarea.status === 'verified' ? <Resultado seguimientos={seguimientos} /> : null}
      </li>
    )
  }

  return (
    <li className="space-y-3 px-4 py-4 text-sm">
      <div>
        <span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{t.tipos[tarea.kind] ?? tarea.kind}</span>
        <span className="font-medium">{tarea.title}</span>
        {tarea.status !== 'open' ? <span className="ml-2 text-xs text-muted">· {t.estados[tarea.status] ?? tarea.status}</span> : null}
      </div>
      <dl className="grid gap-2 text-sm md:grid-cols-[10rem_1fr]">
        <dt className="text-xs text-muted">{t.tarjetaPorQue}</dt>
        <dd>{tarea.summary || t.porQueGenerico[tarea.kind]}</dd>
        <dt className="text-xs text-muted">{t.tarjetaEsperamos}</dt>
        <dd>{t.esperamos[tarea.kind]}</dd>
        <dt className="text-xs text-muted">{t.tarjetaComo}</dt>
        <dd>
          {t.como[tarea.kind]} <span className="text-muted">{t.comoMcp}</span>
        </dd>
      </dl>
      {tarea.note ? <p className="text-xs text-muted">{tarea.note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg bg-text px-3 py-1.5 text-sm font-medium text-bg" onClick={copiar}>
          {copiado ? t.copiado : t.copiarIA}
        </button>
        <button className={boton} onClick={() => setAbierto(!abierto)}>
          {abierto ? t.ocultar : borrador ? t.verPagina : t.verInstrucciones}
        </button>
        <button className={boton} onClick={() => setModo(modo === 'hecha' ? 'nada' : 'hecha')}>
          {t.yaEsta[tarea.kind] ?? t.marcarHecha}
        </button>
        <button className={boton} onClick={() => setModo(modo === 'descartar' ? 'nada' : 'descartar')}>
          {t.noSirve}
        </button>
      </div>
      {abierto ? <pre className={pre}>{borrador ?? tarea.body}</pre> : null}
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
            className="rounded-lg bg-text px-3 py-1.5 text-sm text-bg disabled:opacity-50"
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
      <p className="mt-2 border-l-2 border-border pl-2 text-xs">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{t.resultadoTras(ultimo.kind)}</span> {texto}
      </p>
    )
  }
  const proximo = seguimientos.filter((f) => !f.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  return proximo ? <p className="mt-1 text-xs text-muted">{t.proximaMedicion(proximo.dueAt.slice(0, 10))}</p> : null
}
