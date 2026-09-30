import type { AgentTask, FollowupSnapshot, TaskFollowup, Tenant } from '@peaje/db'
import type { Chequeo } from '@peaje/shared'
import { store } from '../store.js'
import { maxPreguntas, esPropio, marcas, raizDe } from '../citacion/medir.js'
import { MOTORES, motoresDisponibles } from '../citacion/motores.js'
import { medirMetricas } from '../tareas/plan.js'
import { verificarTarea } from '../tareas/verificar.js'

/**
 * El ciclo cerrado del agente Pro. Cuando una tarea queda verificada en el
 * sitio en vivo, Peaje saca una foto (citación de la pregunta por motor,
 * visitas de bots de respuesta, si el chequeo pasa) y agenda dos
 * seguimientos, a las 2 y a las 6 semanas. El monitor diario procesa los
 * vencidos: vuelve a medir, compara y deja un veredicto en palabras simples.
 */

const NOMBRE_MOTOR = Object.fromEntries(MOTORES.map((m) => [m.id, m.nombre])) as Record<string, string>

/** La pregunta que responde una tarea de contenido. Las de frescura ("Refresh /x") no tienen. */
export function preguntaDe(task: AgentTask): string | null {
  if (task.kind !== 'content' || task.key.startsWith('content:refresh:')) return null
  return task.title.trim() || null
}

const normal = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ')

/** Citación de una pregunta en la última ronda medida, por motor. Null si no estaba en esa ronda. */
async function citacionPrevia(tenant: Tenant, pregunta: string): Promise<FollowupSnapshot['citation']> {
  const runs = (await store.listCitationRuns(tenant.id, 1)).filter((r) => normal(r.promptText) === normal(pregunta) && !r.error)
  if (runs.length === 0) return null
  return Object.fromEntries(runs.map((r) => [r.engine, { cited: r.cited, mentioned: r.mentioned }]))
}

/** Si la pregunta no se mide todavía, entra a las preguntas del negocio para la ronda semanal. */
async function asegurarPregunta(tenant: Tenant, pregunta: string): Promise<void> {
  const actuales = await store.listCitationPrompts(tenant.id)
  if (actuales.some((p) => normal(p.text) === normal(pregunta))) return
  if (actuales.length >= maxPreguntas(tenant)) return
  await store.addCitationPrompts(tenant.id, [pregunta], 'agent')
}

/** La foto al verificar la tarea: el "antes" de los seguimientos. */
export async function fotoAlVerificar(tenant: Tenant, task: AgentTask): Promise<FollowupSnapshot> {
  const pregunta = preguntaDe(task)
  const metricas = await medirMetricas(tenant).catch(() => null)
  const foto: FollowupSnapshot = { at: new Date().toISOString(), answerBotVisits7d: metricas?.answer_bot_visits_7d ?? null, passes: true, detail: task.note }
  if (pregunta) {
    foto.question = pregunta
    foto.citation = await citacionPrevia(tenant, pregunta).catch(() => null)
    await asegurarPregunta(tenant, pregunta).catch(() => undefined)
  }
  return foto
}

/**
 * Agenda los seguimientos de una tarea recién verificada. Idempotente: si ya
 * estaban agendados no hace nada. Nunca rompe la verificación que la llamó.
 */
export async function agendarSeguimientos(tenant: Tenant, task: AgentTask): Promise<void> {
  if (task.status !== 'verified') return
  try {
    const existentes = (await store.listFollowups(tenant.id, 500)).filter((f) => f.taskId === task.id)
    if (existentes.length >= 2) return
    await store.scheduleFollowups(task.id, tenant.id, await fotoAlVerificar(tenant, task))
  } catch (error) {
    console.warn('[ciclo] no se pudieron agendar los seguimientos', tenant.slug, task.id, error instanceof Error ? error.message : error)
  }
}

/** Una sola pregunta a cada motor configurado: citado (dominio propio entre las fuentes) y mencionado. */
export async function medirPregunta(tenant: Tenant, pregunta: string): Promise<{ citation: NonNullable<FollowupSnapshot['citation']>; errores: string[] }> {
  const raiz = raizDe(tenant)
  const nombres = marcas(tenant, raiz)
  const citation: NonNullable<FollowupSnapshot['citation']> = {}
  const errores: string[] = []
  await Promise.all(
    motoresDisponibles().map(async (m) => {
      try {
        const r = await m.preguntar(pregunta)
        const texto = r.texto.toLowerCase()
        citation[m.id] = { cited: !!raiz && r.dominios.some((d) => esPropio(d, raiz)), mentioned: nombres.some((n) => texto.includes(n)) }
      } catch (error) {
        errores.push(`${m.nombre}: ${(error instanceof Error ? error.message : String(error)).slice(0, 120)}`)
      }
    }),
  )
  return { citation, errores }
}

/** ¿Siguen pasando los criterios? Los chequeos salen de la corrida diaria; las URLs se abren. */
async function sigueFuncionando(tenant: Tenant, task: AgentTask): Promise<{ passes: boolean; detail: string }> {
  if (task.acceptance.length === 0) return { passes: true, detail: 'No acceptance criteria to check.' }
  if (task.acceptance.every((c) => c.type === 'check')) {
    const v = await store.lastVerification(tenant.id)
    const checks = (v?.checks ?? []) as Chequeo[]
    const fallan = task.acceptance.filter((c) => c.type === 'check' && !checks.find((x) => x.id === c.id)?.ok)
    return fallan.length === 0 ? { passes: true, detail: 'Passes in the latest daily check.' } : { passes: false, detail: `Fails in the latest daily check: ${fallan.map((c) => (c.type === 'check' ? c.id : '')).join(', ')}` }
  }
  const r = await verificarTarea(tenant, task, task.doneUrl)
  return { passes: r.ok, detail: r.note }
}

type Veredicto = { en: string; es: string }

function veredictoContenido(f: TaskFollowup, despues: FollowupSnapshot, errores: string[]): Veredicto {
  const antes = f.before.citation ?? null
  const ahora = despues.citation ?? {}
  const motores = Object.keys(ahora)
  const en: string[] = []
  const es: string[] = []
  if (despues.passes === false) {
    en.push('The page no longer answers on the live site.')
    es.push('La página ya no responde en el sitio en vivo.')
  }
  if (motores.length === 0) {
    en.push(`Could not ask the AI assistants this time${errores.length ? ` (${errores[0]})` : ''}.`)
    es.push(`Esta vez no se pudo preguntar a los asistentes de IA${errores.length ? ` (${errores[0]})` : ''}.`)
  } else {
    const nuevos = motores.filter((m) => ahora[m]!.cited && !antes?.[m]?.cited)
    const siguen = motores.filter((m) => ahora[m]!.cited && antes?.[m]?.cited)
    const perdidos = motores.filter((m) => !ahora[m]!.cited && antes?.[m]?.cited)
    const nunca = motores.filter((m) => !ahora[m]!.cited && !antes?.[m]?.cited)
    const lista = (ids: string[], y: string) => {
      const n = ids.map((m) => NOMBRE_MOTOR[m] ?? m)
      return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} ${y} ${n.at(-1)}`
    }
    const cambio = nuevos.length > 0 || perdidos.length > 0
    if (nuevos.length) {
      en.push(`${lista(nuevos, 'and')} ${antes ? 'now ' : ''}${nuevos.length > 1 ? 'cite' : 'cites'} your site for this question.`)
      es.push(`${lista(nuevos, 'y')} ${antes ? 'ahora ' : ''}${nuevos.length > 1 ? 'citan' : 'cita'} tu sitio para esta pregunta.`)
    }
    // "it" solo cuando una frase anterior ya nombró el sitio.
    const objeto = () => (en.length > (despues.passes === false ? 1 : 0) ? { en: 'it', es: 'lo' } : { en: 'your site for this question', es: 'tu sitio para esta pregunta' })
    if (siguen.length) {
      const o = objeto()
      en.push(`${lista(siguen, 'and')} still ${siguen.length > 1 ? 'cite' : 'cites'} ${o.en}.`)
      es.push(o.es === 'lo' ? `${lista(siguen, 'y')} lo ${siguen.length > 1 ? 'siguen' : 'sigue'} citando.` : `${lista(siguen, 'y')} ${siguen.length > 1 ? 'siguen' : 'sigue'} citando ${o.es}.`)
    }
    if (perdidos.length) {
      const o = objeto()
      en.push(`${lista(perdidos, 'and')} stopped citing ${o.en}.`)
      es.push(`${lista(perdidos, 'y')} ${perdidos.length > 1 ? 'dejaron' : 'dejó'} de citar${o.es === 'lo' ? 'lo' : ` ${o.es}`}.`)
    }
    if (nunca.length && (cambio || siguen.length)) {
      en.push(`${lista(nunca, 'and')} still ${nunca.length > 1 ? 'do' : 'does'} not.`)
      es.push(`${lista(nunca, 'y')} todavía no.`)
    }
    if (!cambio && siguen.length === 0) {
      en.push(`${antes ? 'No change yet: ' : ''}${lista(nunca, 'and')} ${nunca.length > 1 ? 'do' : 'does'} not cite your site for this question${antes ? '' : ' yet'}.`)
      es.push(`${antes ? 'Sin cambios todavía: ' : ''}${lista(nunca, 'y')} ${antes ? '' : 'todavía '}no ${nunca.length > 1 ? 'citan' : 'cita'} tu sitio para esta pregunta.`)
      if (f.kind === '6w') {
        en.push('Next: get mentioned on another site that covers this topic, like a "best of" list, a Reddit thread or a YouTube video. Most of what AI assistants cite lives on other sites.')
        es.push('Siguiente paso: consigue que te mencionen en otro sitio que hable de este tema, como una lista de "los mejores", un hilo de Reddit o un video de YouTube. La mayoría de lo que citan los asistentes de IA está en otros sitios.')
      }
    }
    if (!antes) {
      en.push('(Not measured before publishing, so this is the first reading.)')
      es.push('(No se midió antes de publicar, así que esta es la primera lectura.)')
    }
  }
  const b = f.before.answerBotVisits7d
  const a = despues.answerBotVisits7d
  if (typeof a === 'number' && typeof b === 'number' && a !== b) {
    en.push(`Visits from AI assistant bots: ${b} → ${a} a week.`)
    es.push(`Visitas de bots de asistentes de IA: ${b} → ${a} por semana.`)
  }
  return { en: en.join(' '), es: es.join(' ') }
}

function veredictoArreglo(f: TaskFollowup, despues: FollowupSnapshot): Veredicto {
  return despues.passes
    ? { en: 'Still working: it passes on the live site.', es: 'Sigue funcionando: pasa en el sitio en vivo.' }
    : {
        en: `It stopped working: ${despues.detail ?? 'the check fails'}. Ask your developer or AI coding tool to apply the task again.`,
        es: `Dejó de funcionar: ${despues.detail ?? 'el chequeo falla'}. Pídele a tu desarrollador o a tu herramienta de IA para código que vuelva a aplicar la tarea.`,
      }
}

/** Procesa los seguimientos vencidos de un negocio. Lo llama la corrida diaria del monitor. */
export async function procesarSeguimientos(tenant: Tenant, ahora = new Date()): Promise<{ procesados: number; veredictos: string[] }> {
  const vencidos = await store.listDueFollowups(ahora.toISOString(), tenant.id)
  const veredictos: string[] = []
  // Si vencen los dos de una misma pregunta a la vez, se pregunta una sola vez.
  const cache = new Map<string, Awaited<ReturnType<typeof medirPregunta>>>()
  for (const f of vencidos) {
    try {
      const task = await store.getTask(tenant.id, f.taskId)
      if (!task) {
        await store.completeFollowup(f.id, { at: ahora.toISOString() }, 'The task no longer exists.')
        continue
      }
      const [estado, metricas] = await Promise.all([sigueFuncionando(tenant, task), medirMetricas(tenant).catch(() => null)])
      const despues: FollowupSnapshot = { at: new Date().toISOString(), passes: estado.passes, detail: estado.detail, answerBotVisits7d: metricas?.answer_bot_visits_7d ?? null }
      const pregunta = f.before.question ?? preguntaDe(task)
      let v: Veredicto
      if (pregunta) {
        const m = cache.get(pregunta) ?? (await medirPregunta(tenant, pregunta))
        cache.set(pregunta, m)
        despues.question = pregunta
        despues.citation = m.citation
        v = veredictoContenido(f, despues, m.errores)
      } else {
        v = veredictoArreglo(f, despues)
      }
      despues.verdictEs = v.es
      await store.completeFollowup(f.id, despues, v.en)
      veredictos.push(v.en)
    } catch (error) {
      console.warn('[ciclo] seguimiento', tenant.slug, f.id, error instanceof Error ? error.message : error)
    }
  }
  return { procesados: veredictos.length, veredictos }
}

export type Resultado = {
  taskId: string
  title: string
  kind: AgentTask['kind']
  url: string | null
  verifiedAt: string | null
  checks: { kind: TaskFollowup['kind']; dueAt: string; doneAt: string | null; verdict: string | null; verdictEs: string | null }[]
}

/** Lo publicado o arreglado y lo que movió, tarea por tarea, más nuevo primero. */
export async function resultados(tenant: Tenant, limite = 20): Promise<Resultado[]> {
  const [seguimientos, tareas] = await Promise.all([store.listFollowups(tenant.id, 200), store.listTasks(tenant.id, { statuses: ['verified'] })])
  const porTarea = new Map<string, TaskFollowup[]>()
  for (const f of seguimientos) porTarea.set(f.taskId, [...(porTarea.get(f.taskId) ?? []), f])
  return tareas
    .filter((t) => porTarea.has(t.id))
    .sort((a, b) => (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? ''))
    .slice(0, limite)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      kind: t.kind,
      url: t.doneUrl,
      verifiedAt: t.verifiedAt,
      checks: porTarea
        .get(t.id)!
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .map((f) => ({ kind: f.kind, dueAt: f.dueAt, doneAt: f.doneAt, verdict: f.verdict, verdictEs: f.after?.verdictEs ?? null })),
    }))
}
