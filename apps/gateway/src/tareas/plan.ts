import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PLAN_METRICS, type AgentPlan, type PlanCadence, type PlanCapacity, type PlanGoal, type PlanMetric, type Tenant } from '@peaje/db'
import { asistentesMedidos, dominioVerificable, type Chequeo } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio, MODEL } from '../monitor/reporte.js'
import { correrRonda, resumenCitacion, sugerirPrompts } from '../citacion/medir.js'
import { motoresDisponibles } from '../citacion/motores.js'
import { env } from '../env.js'

/**
 * El plan del agente Pro: 3 a 6 pasos atados al objetivo del dueño, cada uno
 * con una métrica que Peaje ya mide y una meta. Opus lo arma con los datos
 * reales del negocio; el avance se calcula al leerlo.
 */

// Los bots con que los asistentes buscan para responder. ClaudeBot no: según
// Anthropic es su rastreador de entrenamiento, como GPTBot para OpenAI (los de
// Claude que responden son Claude-SearchBot y Claude-User). Igual que el panel
// de visitas (agentes-visitas/page.tsx).
const BOTS_RESPUESTA = new Set(['openai-searchbot', 'perplexitybot', 'googlebot'])

// Métricas de cobro: hasta que los cobros salgan de prueba (env.cobrosVisibles)
// no se proponen ni se muestran. Un plan armado antes las trae; se esconden al leerlo.
const METRICAS_DE_COBRO = new Set<PlanMetric>(['paid_requests_7d', 'revenue_7d', 'payment_attempt_rate'])
const metricasDelPlan = (): PlanMetric[] => PLAN_METRICS.filter((m) => env.cobrosVisibles || !METRICAS_DE_COBRO.has(m))

/** Las métricas que el agente puede mencionar: sin las de cobro mientras estén en prueba. */
export function metricasVisibles(m: Record<PlanMetric, number | null>): Partial<Record<PlanMetric, number | null>> {
  return Object.fromEntries(metricasDelPlan().map((k) => [k, m[k]]))
}

export const DESCRIPCION_METRICA: Record<PlanMetric, string> = {
  checks_passing: 'agent-readiness checks passing (out of 6)',
  answer_bot_visits_7d: 'visits from the bots ChatGPT search, Perplexity and Google use to answer people, in the last 7 days (training crawlers like GPTBot and ClaudeBot do not count)',
  paid_requests_7d: 'paid requests from agents in the last 7 days',
  revenue_7d: 'USD earned from agents in the last 7 days',
  payment_attempt_rate: 'share of 402 responses where the agent came back to pay (0 to 1)',
  tasks_verified: 'Peaje tasks verified on the live site since the plan started',
  citation_share: 'share of (tracked question, answer engine) pairs where the engine cites the site as a source (0 to 1)',
}

/** El valor actual de cada métrica. `desde` acota las tareas verificadas al plan. */
export async function medirMetricas(tenant: Tenant, desde?: string): Promise<Record<PlanMetric, number | null>> {
  const [v, visitas, tareas, citas] = await Promise.all([
    store.lastVerification(tenant.id),
    store.visitStats(tenant.id, { days: 7 }).catch(() => null),
    store.listTasks(tenant.id, { statuses: ['verified'] }).catch(() => []),
    resumenCitacion(tenant).catch(() => null),
  ])
  const checks = (v?.checks ?? []) as Chequeo[]
  const servidos = visitas?.funnel.served402 ?? 0
  return {
    checks_passing: checks.length ? checks.filter((c) => c.ok).length : null,
    answer_bot_visits_7d: visitas ? visitas.byKind.filter((k) => BOTS_RESPUESTA.has(k.kind)).reduce((s, k) => s + k.visits, 0) : null,
    paid_requests_7d: visitas ? visitas.totals.paid : null,
    revenue_7d: visitas ? Number(Number(visitas.totals.revenue).toFixed(4)) : null,
    payment_attempt_rate: servidos > 0 ? Number(((visitas?.funnel.attempted ?? 0) / servidos).toFixed(2)) : null,
    tasks_verified: tareas.filter((t) => !desde || (t.verifiedAt ?? '') >= desde).length,
    citation_share: citas?.share ?? null,
  }
}

const esquemaPlan = (metricas: PlanMetric[]) =>
  z.object({
    summary: z.string(),
    steps: z
      .array(
        z.object({
          title: z.string(),
          why: z.string(),
          deliverable: z.string(),
          metric: z.enum(metricas as [PlanMetric, ...PlanMetric[]]),
          target: z.number(),
        }),
      )
      .min(3)
      .max(6),
  })

let anthropic: Anthropic | null = null

export type EntradaPlan = { goal: PlanGoal; goalDetail: string; capacity: PlanCapacity[]; cadence: PlanCadence; language: 'es' | 'en' }

export async function generarPlan(tenant: Tenant, e: EntradaPlan): Promise<AgentPlan> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  const dominio = dominioVerificable(tenant.originUrl)
  const [metricas, v, visitas30, rutas, tareas, sitio] = await Promise.all([
    medirMetricas(tenant),
    store.lastVerification(tenant.id),
    store.visitStats(tenant.id, { days: 30 }).catch(() => null),
    store.listRoutes(tenant.id),
    store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done'] }),
    dominio ? leerSitio(dominio).catch(() => '') : Promise.resolve(''),
  ])
  const contexto = {
    business: tenant.name,
    domain: dominio,
    goal: e.goal,
    goalDetail: e.goalDetail,
    ownerCanDo: e.capacity,
    metricsNow: metricas,
    failingChecks: ((v?.checks ?? []) as Chequeo[]).filter((c) => !c.ok).map((c) => ({ id: c.id, reason: c.motivo })),
    last30Days: visitas30
      ? { agentRequests: visitas30.totals.visits, paid: visitas30.totals.paid, funnel: visitas30.funnel, byKind: visitas30.byKind, unmetDemand: visitas30.unpaidDemand, requested404: visitas30.notFound }
      : null,
    pricedRoutes: rutas.map((r) => ({ route: `${r.method} ${r.pathPattern}`, priceUsd: r.priceUsd, description: r.description })),
    openTasks: tareas.map((t) => ({ kind: t.kind, title: t.title })),
  }
  anthropic ??= new Anthropic()
  const permitidas = metricasDelPlan()
  const res = await anthropic.messages.parse({
    model: MODEL,
    // El modelo razona antes de responder y eso cuenta contra max_tokens: 3000 cortaba el JSON.
    max_tokens: 12000,
    system: [
      `You are Peaje's growth agent for a small business. Peaje makes a business visible to answer engines (it measures whether ${asistentesMedidos('en')} cite it) and lets AI agents pay for its API routes over HTTP 402.`,
      'Write a plan of 3 to 6 steps for the goal the owner chose. Order the steps by impact on that goal. Respect what the owner can do: never propose code changes if they cannot touch code, never propose writing content if they cannot publish it.',
      'What moves answer-engine recommendations, with evidence: mentions of the brand on third-party sites (Reddit threads, YouTube, listicles; 84% of citations are third-party), pages whose title is the literal question with a direct answer, a concrete number and a cited source, being indexed by Bing (ChatGPT search leans on it), fresh visible dates, and answer bots not being blocked. llms.txt and JSON-LD barely move citations: do not sell them as a lever for recommendations.',
      env.cobrosVisibles
        ? 'What moves agent sales, with evidence: most unpaid 402s are technical failures, not price; fix the 402 path and the descriptions agents read before touching price.'
        : 'Charging AI agents is not live yet: no steps about prices, payments, priced routes or the 402 step.',
      'Each step needs one metric from the allowed list and a realistic numeric target for the next 4 to 6 weeks, compared to metricsNow. Use tasks_verified for steps whose output is work in the repo. Use citation_share only when the goal includes recommendations; it becomes measurable later.',
      'Ground every "why" in the business data you were given (numbers, routes, failing checks). No generic advice, no hype.',
      `Write title, why, deliverable and summary in ${e.language === 'es' ? 'Spanish (neutral Latin American, tú)' : 'English'}. Titles under 10 words, why under 35 words, deliverable under 25 words, summary under 40 words.`,
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: `Allowed metrics:\n${permitidas.map((m) => `- ${m}: ${DESCRIPCION_METRICA[m]}`).join('\n')}\n\nBusiness data:\n${JSON.stringify(contexto, null, 2)}\n\nSite text:\n${sitio.slice(0, 8000)}`,
      },
    ],
    output_config: { format: zodOutputFormat(esquemaPlan(permitidas)) },
  })
  if (res.stop_reason === 'max_tokens') throw new Error('The plan came back cut off. Try again.')
  const plan = res.parsed_output
  if (!plan) throw new Error('The model did not return a plan')
  const guardado = await store.savePlan({
    tenantId: tenant.id,
    goal: e.goal,
    goalDetail: e.goalDetail.slice(0, 300),
    capacity: e.capacity,
    cadence: e.cadence,
    language: e.language,
    summary: plan.summary,
    steps: plan.steps,
    baseline: metricas,
  })
  // El dueño no sabe qué le preguntan sus clientes a una IA: Peaje elige las
  // preguntas y hace la primera medición en segundo plano, sin frenar el chat.
  void primeraMedicion(tenant)
  return guardado
}

async function primeraMedicion(tenant: Tenant): Promise<void> {
  try {
    if ((await store.listCitationPrompts(tenant.id)).length === 0) {
      await store.addCitationPrompts(tenant.id, await sugerirPrompts(tenant), 'agent')
    }
    if (motoresDisponibles().length > 0 && (await store.listCitationRuns(tenant.id, 1)).length === 0) await correrRonda(tenant)
  } catch (error) {
    console.warn('[plan] primera medición de citación', tenant.slug, error instanceof Error ? error.message : error)
  }
}

/**
 * `progress`: el avance en una línea, en el idioma del plan, con qué se mide,
 * dónde arrancó, dónde está y la meta. El agente la usa tal cual: "meta
 * cumplida" a secas no le dice nada al dueño.
 */
export type PasoConAvance = AgentPlan['steps'][number] & { baseline: number | null; current: number | null; done: boolean; progress: string }

type Idioma = 'es' | 'en'

const ETIQUETA_METRICA: Record<PlanMetric, Record<Idioma, string>> = {
  checks_passing: { es: 'Revisiones técnicas de tu sitio que pasan (de 6)', en: 'Technical checks your site passes (of 6)' },
  answer_bot_visits_7d: {
    es: 'Visitas en 7 días de los bots con que ChatGPT, Perplexity y Google buscan para responder (sin rastreadores de entrenamiento)',
    en: 'Visits in 7 days from the bots ChatGPT, Perplexity and Google use to answer people (training crawlers excluded)',
  },
  paid_requests_7d: { es: 'Pedidos pagados por agentes en 7 días', en: 'Requests paid by agents in 7 days' },
  revenue_7d: { es: 'Lo que pagaron los agentes en 7 días', en: 'What agents paid in 7 days' },
  payment_attempt_rate: { es: 'Agentes que intentaron pagar después del paso de pago', en: 'Agents that tried to pay after the payment step' },
  tasks_verified: { es: 'Tareas verificadas en tu sitio desde que se armó el plan', en: 'Tasks verified on your site since the plan was built' },
  citation_share: {
    es: 'Respuestas de los asistentes de IA que citan tu sitio, en las preguntas que mide Peaje',
    en: 'AI assistant answers that cite your site, for the questions Peaje tracks',
  },
}

function valorMetrica(m: PlanMetric, v: number | null, idioma: Idioma): string {
  if (v === null) return idioma === 'es' ? 'sin medir' : 'not measured'
  if (m === 'citation_share' || m === 'payment_attempt_rate') return `${Math.round(v * 100)}%`
  if (m === 'revenue_7d') return `US$${v}`
  return new Intl.NumberFormat(idioma === 'es' ? 'es-CO' : 'en-US').format(v)
}

export function progresoDePaso(p: { metric: PlanMetric; baseline: number | null; current: number | null; target: number; done: boolean }, creado: string, idioma: Idioma): string {
  const f = (v: number | null) => valorMetrica(p.metric, v, idioma)
  const fecha = new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(creado))
  // Las tareas se cuentan desde que se armó el plan: no hay punto de partida que mostrar.
  const inicio = p.metric === 'tasks_verified' ? '' : idioma === 'es' ? `${f(p.baseline)} al armar el plan (${fecha}), ` : `${f(p.baseline)} when the plan was built (${fecha}), `
  const hoy = idioma === 'es' ? `${f(p.current)} hoy, meta ${f(p.target)}.` : `${f(p.current)} now, target ${f(p.target)}.`
  const cumplida = p.done ? (idioma === 'es' ? ' Cumplida.' : ' Met.') : ''
  return `${ETIQUETA_METRICA[p.metric][idioma]}: ${inicio}${hoy}${cumplida}`
}

/**
 * El plan con el valor actual de cada métrica al lado de la meta. Con los
 * cobros en prueba, un plan armado antes no muestra sus pasos de cobro ni su
 * resumen (que habla de ellos), y su objetivo se lee como recomendaciones.
 */
export async function planConAvance(tenant: Tenant): Promise<(Omit<AgentPlan, 'steps'> & { steps: PasoConAvance[] }) | null> {
  const plan = await store.getPlan(tenant.id)
  if (!plan) return null
  const ahora = await medirMetricas(tenant, plan.createdAt)
  const idioma: Idioma = plan.language === 'en' ? 'en' : 'es'
  const visibles = new Set(metricasDelPlan())
  const steps = plan.steps
    .filter((s) => visibles.has(s.metric))
    .map((s) => {
      const current = ahora[s.metric]
      const paso = { ...s, baseline: plan.baseline[s.metric] ?? null, current, done: current !== null && current >= s.target }
      return { ...paso, progress: progresoDePaso(paso, plan.createdAt, idioma) }
    })
  const escondio = steps.length < plan.steps.length
  const hechos = steps.filter((s) => s.done).length
  return {
    ...plan,
    goal: env.cobrosVisibles ? plan.goal : 'recommendations',
    summary: escondio
      ? idioma === 'es'
        ? `Tu plan para que los asistentes de IA te recomienden: ${steps.length} ${steps.length === 1 ? 'paso' : 'pasos'}, ${hechos} ${hechos === 1 ? 'cumplido' : 'cumplidos'}.`
        : `Your plan to get recommended by AI assistants: ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}, ${hechos} done.`
      : plan.summary,
    steps,
  }
}

/** ¿Toca mandar el correo esta semana según la cadencia elegida? */
export function tocaCorreo(plan: AgentPlan | null, hoy = new Date()): boolean {
  if (!plan) return true
  if (plan.cadence === 'on-demand') return false
  if (plan.cadence === 'biweekly') {
    const semanas = Math.floor((hoy.getTime() - new Date(plan.createdAt).getTime()) / (7 * 86_400_000))
    return semanas % 2 === 0
  }
  return true
}
