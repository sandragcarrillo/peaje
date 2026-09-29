import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PLAN_METRICS, type AgentPlan, type PlanCadence, type PlanCapacity, type PlanGoal, type PlanMetric, type Tenant } from '@peaje/db'
import { dominioVerificable, type Chequeo } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio, MODEL } from '../monitor/reporte.js'
import { correrRonda, resumenCitacion, sugerirPrompts } from '../citacion/medir.js'
import { motoresDisponibles } from '../citacion/motores.js'

/**
 * El plan del agente Pro: 3 a 6 pasos atados al objetivo del dueño, cada uno
 * con una métrica que Peaje ya mide y una meta. Opus lo arma con los datos
 * reales del negocio; el avance se calcula al leerlo.
 */

const BOTS_RESPUESTA = new Set(['openai-searchbot', 'perplexitybot', 'claudebot', 'googlebot'])

export const DESCRIPCION_METRICA: Record<PlanMetric, string> = {
  checks_passing: 'agent-readiness checks passing (out of 6)',
  answer_bot_visits_7d: 'visits from answer-engine bots (ChatGPT, Perplexity, Claude, Google) in the last 7 days',
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

const PlanSchema = z.object({
  summary: z.string(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        why: z.string(),
        deliverable: z.string(),
        metric: z.enum(PLAN_METRICS),
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
  const res = await anthropic.messages.parse({
    model: MODEL,
    // El modelo razona antes de responder y eso cuenta contra max_tokens: 3000 cortaba el JSON.
    max_tokens: 12000,
    system: [
      "You are Peaje's growth agent for a small business. Peaje makes a business visible to answer engines (ChatGPT, Perplexity, Google AI, Claude) and lets AI agents pay for its API routes over HTTP 402.",
      'Write a plan of 3 to 6 steps for the goal the owner chose. Order the steps by impact on that goal. Respect what the owner can do: never propose code changes if they cannot touch code, never propose writing content if they cannot publish it.',
      'What moves answer-engine recommendations, with evidence: mentions of the brand on third-party sites (Reddit threads, YouTube, listicles; 84% of citations are third-party), pages whose title is the literal question with a direct answer, a concrete number and a cited source, being indexed by Bing (ChatGPT search leans on it), fresh visible dates, and answer bots not being blocked. llms.txt and JSON-LD barely move citations: do not sell them as a lever for recommendations.',
      'What moves agent sales, with evidence: most unpaid 402s are technical failures, not price; fix the 402 path and the descriptions agents read before touching price.',
      'Each step needs one metric from the allowed list and a realistic numeric target for the next 4 to 6 weeks, compared to metricsNow. Use tasks_verified for steps whose output is work in the repo. Use citation_share only when the goal includes recommendations; it becomes measurable later.',
      'Ground every "why" in the business data you were given (numbers, routes, failing checks). No generic advice, no hype.',
      `Write title, why, deliverable and summary in ${e.language === 'es' ? 'Spanish (neutral Latin American, tú)' : 'English'}. Titles under 10 words, why under 35 words, deliverable under 25 words, summary under 40 words.`,
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: `Allowed metrics:\n${PLAN_METRICS.map((m) => `- ${m}: ${DESCRIPCION_METRICA[m]}`).join('\n')}\n\nBusiness data:\n${JSON.stringify(contexto, null, 2)}\n\nSite text:\n${sitio.slice(0, 8000)}`,
      },
    ],
    output_config: { format: zodOutputFormat(PlanSchema) },
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

export type PasoConAvance = AgentPlan['steps'][number] & { baseline: number | null; current: number | null; done: boolean }

/** El plan con el valor actual de cada métrica al lado de la meta. */
export async function planConAvance(tenant: Tenant): Promise<(Omit<AgentPlan, 'steps'> & { steps: PasoConAvance[] }) | null> {
  const plan = await store.getPlan(tenant.id)
  if (!plan) return null
  const ahora = await medirMetricas(tenant, plan.createdAt)
  return {
    ...plan,
    steps: plan.steps.map((s) => {
      const current = ahora[s.metric]
      return { ...s, baseline: plan.baseline[s.metric] ?? null, current, done: current !== null && current >= s.target }
    }),
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
