import type { AgentJob, AgentJobDestino, AgentMessage, AgentMessageLink, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { tareaConBorrador } from '../ciclo/borrador.js'
import { crearSerie } from '../ciclo/serie.js'
import { tarjetaOportunidades, tarjetaTarea } from './tarjetas.js'
import { anotarCreditos } from './creditos.js'

/**
 * Trabajos largos del agente: escribir una página, una serie de páginas. El
 * chat contesta al toque ("estoy escribiendo la página, te aviso aquí") y el
 * trabajo corre en segundo plano en el proceso del gateway. Al terminar deja
 * un mensaje del agente en la conversación (con sus tarjetas) y avisa por el
 * canal de origen.
 *
 * Los trabajos viven en la tabla agent_jobs. El worker los toma con un UPDATE
 * condicional (status = 'queued' → 'running'), así dos procesos o un reinicio
 * no corren el mismo dos veces. Uno que un reinicio dejó en 'running' vuelve
 * a la cola una vez; la segunda, falla y se avisa.
 *
 * Los canales se enchufan con registrarEntrega(canal, fn) desde su propio
 * módulo (Telegram, Slack): este archivo no importa nada de ellos.
 */

type Idioma = 'es' | 'en'
type Texto = { es: string; en: string }

/** Lo que devuelve un trabajo: el mensaje corto para el dueño y las tarjetas. */
export type ResultadoTrabajo = { mensaje: Texto; links: AgentMessageLink[]; datos?: Record<string, unknown> }

export type Manejador = (job: AgentJob, tenant: Tenant) => Promise<ResultadoTrabajo>

/**
 * Cómo un canal entrega el aviso. `mensaje` es el mensaje del agente ya
 * guardado en la conversación (texto en el idioma del destino + links).
 */
export type Entrega = (job: AgentJob, mensaje: AgentMessage) => Promise<void>

type Registro = { correr: Manejador; aviso: Texto; nombre: Texto }

const manejadores = new Map<string, Registro>()
const entregas = new Map<string, Entrega>()

/** Registra un tipo de trabajo. `aviso`: la respuesta inmediata; `nombre`: para el aviso de error. */
export function registrarTrabajo(kind: string, correr: Manejador, meta: { aviso: Texto; nombre: Texto }): void {
  manejadores.set(kind, { correr, ...meta })
}

/** Registra cómo avisar en un canal ('telegram', 'slack', ...). Reemplaza la anterior del mismo canal. */
export function registrarEntrega(canal: string, fn: Entrega): void {
  entregas.set(canal, fn)
}

export const tiposDeTrabajo = () => [...manejadores.keys()]

/** La respuesta inmediata del chat para un trabajo encolado. */
export function avisoDeTrabajo(kind: string, idioma: Idioma = 'es'): string {
  return manejadores.get(kind)?.aviso[idioma] ?? (idioma === 'es' ? 'Estoy en eso. Te aviso aquí cuando esté listo.' : "I'm on it. I'll tell you here when it's ready.")
}

/**
 * Encola un trabajo y devuelve al toque, sin esperar a que corra. `destino`
 * dice dónde avisar al terminar; null = no avisa (el resultado queda en la tabla).
 */
export async function encolarTrabajo(tenant: Pick<Tenant, 'id'>, kind: string, input: Record<string, unknown>, destino: AgentJobDestino | null = null): Promise<AgentJob> {
  if (!manejadores.has(kind)) throw new Error(`unknown job kind: ${kind}`)
  const job = await store.createJob({ tenantId: tenant.id, kind, input, destino })
  // Si el worker está prendido, que no espere al próximo tick.
  if (temporizador) setImmediate(() => void tick())
  return job
}

// ---- worker ----

const INTERVALO_MS = Number(process.env.AGENT_JOBS_TICK_MS ?? 5_000)
const EN_PARALELO = Number(process.env.AGENT_JOBS_PARALLEL ?? 2)
/** Más que esto en 'running' sin terminar: lo dejó colgado un reinicio. */
const COLGADO_MS = 20 * 60_000
const MAX_INTENTOS = 2

let temporizador: ReturnType<typeof setInterval> | null = null
const enCurso = new Set<string>()
let tomando = false
let vueltas = 0

/** Prende el worker. Devuelve cómo apagarlo. Llamarlo dos veces no duplica nada. */
export function iniciarTrabajos(): () => void {
  if (!temporizador) {
    temporizador = setInterval(() => void tick(), INTERVALO_MS)
    temporizador.unref?.()
    void rescatarColgados()
    void tick()
  }
  return () => {
    if (temporizador) clearInterval(temporizador)
    temporizador = null
  }
}

async function tick(): Promise<void> {
  if (tomando) return
  tomando = true
  try {
    // Cada ~5 minutos, los que quedaron colgados.
    if (++vueltas % Math.max(1, Math.round(300_000 / INTERVALO_MS)) === 0) await rescatarColgados()
    while (enCurso.size < EN_PARALELO) {
      const job = await store.claimNextJob(tiposDeTrabajo())
      if (!job) break
      enCurso.add(job.id)
      void correr(job).finally(() => enCurso.delete(job.id))
    }
  } catch (error) {
    console.error('[trabajos] no se pudo tomar un trabajo', error instanceof Error ? error.message : error)
  } finally {
    tomando = false
  }
}

async function correr(job: AgentJob): Promise<void> {
  const registro = manejadores.get(job.kind)
  const tenant = await store.getTenantById(job.tenantId).catch(() => null)
  let terminado: AgentJob
  try {
    if (!registro) throw new Error(`unknown job kind: ${job.kind}`)
    if (!tenant) throw new Error('business not found')
    const r = await registro.correr(job, tenant)
    terminado = await store.finishJob(job.id, { status: 'done', result: { mensaje: r.mensaje, links: r.links, ...(r.datos ? { datos: r.datos } : {}) } })
    console.log(`[trabajos] ${job.kind} ${job.id} listo`)
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error)
    console.warn(`[trabajos] ${job.kind} ${job.id} falló:`, motivo)
    terminado = await store.finishJob(job.id, { status: 'failed', error: motivo.slice(0, 500) }).catch(() => ({ ...job, status: 'failed' as const, error: motivo }))
    await devolverCreditos(job)
  }
  await alTerminar(terminado)
}

/** Un trabajo que falla devuelve los créditos que pagó la respuesta que lo pidió (`input.creditos`). */
async function devolverCreditos(job: AgentJob): Promise<void> {
  const n = Number(job.input?.creditos ?? 0)
  if (Number.isFinite(n) && n > 0) await anotarCreditos(job.tenantId, -n, `devolución:${job.kind}`)
}

/** Vuelve a la cola lo que un reinicio dejó en 'running'; a la segunda, lo da por fallado. */
async function rescatarColgados(): Promise<void> {
  try {
    const colgados = await store.listStaleJobs(new Date(Date.now() - COLGADO_MS).toISOString())
    for (const j of colgados) {
      if (enCurso.has(j.id)) continue
      if (j.attempts < MAX_INTENTOS) {
        await store.requeueJob(j.id)
        console.log(`[trabajos] ${j.kind} ${j.id} vuelve a la cola`)
      } else {
        const fallado = await store.finishJob(j.id, { status: 'failed', error: 'interrupted twice by a restart' })
        await devolverCreditos(j)
        await alTerminar(fallado)
      }
    }
  } catch (error) {
    console.error('[trabajos] no se pudieron revisar los colgados', error instanceof Error ? error.message : error)
  }
}

/** El texto del aviso, en el idioma del destino. */
export function textoDeResultado(job: AgentJob, idioma: Idioma): { text: string; links: AgentMessageLink[] } {
  if (job.status === 'done' && job.result) {
    const r = job.result as Partial<ResultadoTrabajo>
    return { text: r.mensaje?.[idioma] ?? r.mensaje?.es ?? '', links: Array.isArray(r.links) ? r.links : [] }
  }
  const nombre = manejadores.get(job.kind)?.nombre[idioma] ?? job.kind
  const motivo = (job.error ?? '').replace(/\s+/g, ' ').slice(0, 160)
  return {
    text:
      idioma === 'es'
        ? `No pude terminar ${nombre}.${motivo ? ` Motivo: ${motivo}.` : ''} Si quieres, pídemelo de nuevo.`
        : `I could not finish ${nombre}.${motivo ? ` Reason: ${motivo}.` : ''} Ask me again if you want.`,
    links: [],
  }
}

/**
 * El gancho de entrega: guarda el aviso como mensaje del agente en la
 * conversación (canal del destino) y llama a la entrega del canal, si hay.
 * Sin destino no avisa. Exportado para que un canal pueda reenviar a mano.
 */
export async function alTerminar(job: AgentJob): Promise<AgentMessage | null> {
  if (!job.destino) return null
  const idioma: Idioma = job.destino.idioma === 'en' ? 'en' : 'es'
  const { text, links } = textoDeResultado(job, idioma)
  if (!text) return null
  let mensaje: AgentMessage
  try {
    mensaje = await store.addMessage({ tenantId: job.tenantId, role: 'assistant', text, links, channel: job.destino.canal })
  } catch (error) {
    console.error('[trabajos] no se pudo guardar el aviso', job.id, error instanceof Error ? error.message : error)
    return null
  }
  const entrega = entregas.get(job.destino.canal)
  if (entrega) {
    try {
      await entrega(job, mensaje)
    } catch (error) {
      console.error(`[trabajos] la entrega por ${job.destino.canal} falló`, job.id, error instanceof Error ? error.message : error)
    }
  }
  return mensaje
}

/** Espera a que un trabajo termine (scripts y pruebas). Null si se acaba el tiempo. */
export async function esperarTrabajo(id: string, timeoutMs = 300_000, cadaMs = 1_000): Promise<AgentJob | null> {
  const hasta = Date.now() + timeoutMs
  while (Date.now() < hasta) {
    const j = await store.getJob(id)
    if (j && (j.status === 'done' || j.status === 'failed')) return j
    await new Promise((r) => setTimeout(r, cadaMs))
  }
  return null
}

// ---- los trabajos del agente ----

const lista = (xs: string[]) => xs.map((x) => x.replace(/[.\s]+$/, '')).join('; ')

registrarTrabajo(
  'draft_page',
  async (job, tenant) => {
    const pregunta = String(job.input.question ?? '').trim()
    if (pregunta.length < 8) throw new Error('question is too short')
    const porQue = typeof job.input.why === 'string' ? job.input.why : undefined
    const r = await tareaConBorrador(tenant, pregunta, porQue)
    const tarjeta = (i: Idioma) => [tarjetaTarea(tenant, r.task, i)]
    if (!r.created && !r.updated) {
      return {
        mensaje: {
          es: `Ya había una tarea para «${r.task.title}» y está más allá de abierta, así que no la cambié.`,
          en: `There was already a task for "${r.task.title}" past open, so I left it as it was.`,
        },
        links: tarjeta(job.destino?.idioma === 'en' ? 'en' : 'es'),
        datos: { taskId: r.task.id, status: r.task.status },
      }
    }
    const faltan = r.todos.length
    return {
      mensaje: {
        es: `Lista la página «${r.task.title}».${faltan ? ` Faltan ${faltan} dato${faltan === 1 ? '' : 's'} que no están en tu sitio: ${lista(r.todos)}. Mándamelos y la completo.` : ' Tiene todos los datos; revísala y publícala.'}`,
        en: `The page "${r.task.title}" is ready.${faltan ? ` ${faltan} fact${faltan === 1 ? ' is' : 's are'} missing from your site: ${lista(r.todos)}. Send them and I will fill them in.` : ' It has every fact it needs; review it and publish it.'}`,
      },
      links: tarjeta(job.destino?.idioma === 'en' ? 'en' : 'es'),
      datos: { taskId: r.task.id, created: r.created, todos: r.todos },
    }
  },
  {
    aviso: { es: 'Estoy escribiendo la página, te aviso aquí cuando esté lista.', en: "I'm writing the page. I'll tell you here when it's ready." },
    nombre: { es: 'la página', en: 'the page' },
  },
)

registrarTrabajo(
  'page_series',
  async (job, tenant) => {
    const tema = String(job.input.topic ?? '').trim()
    if (tema.length < 3) throw new Error('topic is too short')
    const r = await crearSerie(tenant, tema)
    const paginas = [...(r.hub ? [r.hub] : []), ...r.spokes]
    if (paginas.length === 0) throw new Error(r.fallidas[0]?.error ?? 'no page could be drafted')
    const idioma: Idioma = job.destino?.idioma === 'en' ? 'en' : 'es'
    const todos = paginas.reduce((n, p) => n + p.todos.length, 0)
    const viejas = paginas.filter((p) => !p.created && !p.updated).length
    const es = [
      `Lista la serie sobre «${r.tema}»: ${r.hub ? `la página principal «${r.hub.title}» y ` : ''}${r.spokes.length} página${r.spokes.length === 1 ? '' : 's'} que la apoya${r.spokes.length === 1 ? '' : 'n'}, enlazadas entre sí.`,
      todos ? `Faltan ${todos} dato${todos === 1 ? '' : 's'} en total; cada página dice cuáles.` : 'Tienen todos los datos.',
      viejas ? `${viejas} ya tenía${viejas === 1 ? '' : 'n'} tarea en curso y no la${viejas === 1 ? '' : 's'} toqué.` : '',
      r.fallidas.length ? `No pude escribir ${r.fallidas.length}: ${r.fallidas.map((f) => `«${f.pregunta}»`).join(', ')}.` : '',
    ]
    const en = [
      `The series on "${r.tema}" is ready: ${r.hub ? `the main page "${r.hub.title}" and ` : ''}${r.spokes.length} supporting page${r.spokes.length === 1 ? '' : 's'}, linked to each other.`,
      todos ? `${todos} fact${todos === 1 ? ' is' : 's are'} missing in total; each page lists its own.` : 'They have every fact they need.',
      viejas ? `${viejas} already had a task in progress and I left ${viejas === 1 ? 'it' : 'them'} as ${viejas === 1 ? 'it was' : 'they were'}.` : '',
      r.fallidas.length ? `I could not write ${r.fallidas.length}: ${r.fallidas.map((f) => `"${f.pregunta}"`).join(', ')}.` : '',
    ]
    return {
      mensaje: { es: es.filter(Boolean).join(' '), en: en.filter(Boolean).join(' ') },
      links: [...paginas.map((p) => tarjetaTarea(tenant, { id: p.taskId, title: p.title, kind: 'content' }, idioma)), tarjetaOportunidades(tenant, idioma)],
      datos: { tema: r.tema, hub: r.hub?.taskId ?? null, spokes: r.spokes.map((s) => s.taskId), fallidas: r.fallidas },
    }
  },
  {
    aviso: {
      es: 'Estoy armando la serie: una página principal y de 3 a 5 que la apoyan. Tardo unos minutos; te aviso aquí cuando esté lista.',
      en: "I'm building the series: one main page and 3 to 5 supporting pages. It takes a few minutes; I'll tell you here when it's ready.",
    },
    nombre: { es: 'la serie de páginas', en: 'the page series' },
  },
)
