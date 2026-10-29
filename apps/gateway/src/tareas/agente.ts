import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'
import { PLAN_CADENCES, PLAN_CAPACITIES, PLAN_GOALS, type AgentAction, type AgentMessage, type Tenant } from '@peaje/db'
import { asistentesMedidos, dominioVerificable, slugify, type Chequeo } from '@peaje/shared'
import { store } from '../store.js'
import { validarRuta } from '../rutas.js'
import { MODEL } from '../monitor/reporte.js'
import { generarPlan, medirMetricas, planConAvance } from './plan.js'
import { buscarTareas, medirAhora, tareaPublica } from './router.js'
import { maxPreguntas, resumenCitacion, sugerirPrompts } from '../citacion/medir.js'
import { competidoresCitados, paginasCitadas } from '../citacion/competidores.js'
// ---- M9 ----
import { accesoPro, mensajeSinPro } from '../billing/acceso.js'
import { LIMITES } from '@peaje/db'
import { revisarAcceso } from '../acceso/revisar.js'
// ---- M6 ----
import { completarBorrador, MARCA_BORRADOR, slugDePregunta } from '../ciclo/borrador.js'
import { resultados } from '../ciclo/seguimiento.js'
// ---- M7 ----
import { probarAhora, resultadoPublico } from '../comprador/misterioso.js'
// ---- reportes programados ----
import type { ReportKind, ReportSchedule } from '@peaje/db'
import { proximaCorrida, validarAgenda } from '../reportes/agenda.js'
import { canalReportes, destinosDe, fechaLocal } from '../reportes/entregar.js'
// ---- tarjetas, trabajos largos y voz ----
import type { AgentJobDestino, AgentMessageLink } from '@peaje/db'
import { REPORTES, tarjetaReporte, tarjetaTarea } from './tarjetas.js'
import { avisoDeTrabajo, encolarTrabajo } from './trabajos.js'
import { guardarPerfilDeVoz, perfilDeVoz, type CambioDeVoz } from '../ciclo/voz.js'
// ---- créditos y filtro de tema ----
import { COSTOS_CREDITOS, type AccionCreditos } from '@peaje/db'
import { anotarCreditos, avisoCreditos, lineaSinCreditos, saldoCreditos, usoPublico, type Saldo } from './creditos.js'
import { clasificarTema } from './tema.js'
import { completarTarea } from './verificar.js'
import { env } from '../env.js'

const MAX_CUSTOM = 5

/**
 * El agente Pro que conversa con el dueño (dashboard hoy, Telegram después).
 * Responde con los datos del negocio usando herramientas de lectura. Puede
 * crear tareas y armar el plan. No cambia nada del sitio ni de Peaje por su
 * cuenta: un cambio de precio o de ruta sale como propuesta y el dueño lo
 * aplica con un botón.
 */

// El chat corre en Sonnet: responde casi igual y cuesta bastante menos por
// mensaje. Opus queda para lo que se piensa una vez: plan, borradores, misiones.
const AGENT_MODEL = process.env.AGENT_MODEL ?? 'claude-sonnet-5'
// Conversar es gratis; lo que el agente hace se paga con los créditos del mes (ver creditos.ts).
const HISTORIAL = 20
const MAX_VUELTAS = 8
const MAX_TOKENS = 8_000
// Charla que el filtro de tema dice que no necesita datos: la primera vuelta va corta.
const TOPE_CHARLA = 600

type Destino = { canal: string; id: string; responderA?: string }
type Herramienta = Anthropic.Messages.Tool & { correr: (input: Record<string, unknown>, ctx: Ctx) => Promise<unknown> }
type Ctx = {
  tenant: Tenant
  idioma: 'es' | 'en'
  acciones: AgentAction[]
  opciones: string[]
  anexos: string[]
  /** Tarjetas con link bajo la respuesta (open_report, borradores). */
  links: AgentMessageLink[]
  /**
   * El chat donde corre la conversación (Telegram, Slack). Sin destino es el
   * dashboard. `responderA`: el mensaje del pedido (Telegram) o el hilo
   * (Slack, thread_ts); un trabajo largo entrega ahí lo que termina.
   */
  destino?: Destino
  /** La corrida de un pedido programado: no puede programar otro. */
  programado?: boolean
}

const numero = (x: unknown) => (typeof x === 'number' ? x : Number(x))

/** Las opciones como vengan: una lista, o un texto (JSON o una por línea) si el modelo las mandó así. */
function listaDeOpciones(x: unknown): string[] {
  let lista: unknown = x
  if (typeof x === 'string') {
    try {
      lista = JSON.parse(x)
    } catch {
      lista = x.split('\n')
    }
  }
  return (Array.isArray(lista) ? lista : []).map((c) => String(c).trim()).filter(Boolean).map((c) => c.slice(0, 80)).slice(0, 5)
}

/** Una URL https del dominio del negocio (o su www). Otra cosa no cierra una tarea. */
function urlDelSitio(tenant: Tenant, x: unknown): string | null {
  const dominio = dominioVerificable(tenant.originUrl)
  if (typeof x !== 'string' || !dominio) return null
  try {
    const u = new URL(x.trim())
    return u.protocol === 'https:' && u.hostname.replace(/^www\./, '') === dominio.replace(/^www\./, '') ? u.toString() : null
  } catch {
    return null
  }
}

/** Herramientas que dependen de que los agentes paguen de verdad: apagadas hasta mainnet (env.cobrosVisibles). */
const SOLO_CON_COBROS = new Set(['run_mystery_shopper', 'get_mystery_results', 'list_routes', 'propose_route_change'])

const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'offer_choices',
    description: 'Show 2 to 5 short tappable answers under your message, so the owner can reply with one tap. Use it whenever you ask a question with a small set of likely answers. Each choice under 8 words, written as the owner would say it.',
    input_schema: { type: 'object', properties: { choices: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 } }, required: ['choices'] },
    async correr(i, ctx) {
      ctx.opciones = listaDeOpciones(i.choices)
      return { shown: ctx.opciones.length }
    },
  },
  {
    name: 'get_overview',
    description: 'Current state of the business: agent-readiness checks (and which fail), score, plan progress, task counts, and the last 7 days of agent traffic, the 402 funnel and payments.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const [v, metricas, plan, tareas, visitas] = await Promise.all([
        store.lastVerification(tenant.id),
        medirMetricas(tenant),
        planConAvance(tenant),
        store.listTasks(tenant.id),
        store.visitStats(tenant.id, { days: 7 }).catch(() => null),
      ])
      const checks = (v?.checks ?? []) as Chequeo[]
      return {
        business: tenant.name,
        domain: dominioVerificable(tenant.originUrl),
        plan: accesoPro(tenant), // M9: plan vigente, hasta cuándo y límites
        checks: checks.map((c) => ({ id: c.id, ok: c.ok, reason: c.ok ? undefined : c.motivo })),
        checkedAt: v?.runAt ?? null,
        score: v?.score ?? null,
        metrics: metricas,
        goalPlan: plan ? { goal: plan.goal, detail: plan.goalDetail, steps: plan.steps.map((s) => ({ title: s.title, metric: s.metric, current: s.current, target: s.target, done: s.done })) } : null,
        tasks: { open: tareas.filter((t) => t.status === 'open').length, inProgress: tareas.filter((t) => t.status === 'in_progress').length, waitingDeploy: tareas.filter((t) => t.status === 'done').length, verified: tareas.filter((t) => t.status === 'verified').length },
        last7Days: visitas ? { totals: visitas.totals, funnel: visitas.funnel } : null,
      }
    },
  },
  {
    name: 'get_agent_traffic',
    description: 'Who visited through Peaje: requests by agent type (paying clients, ChatGPT, Perplexity, Claude, Google bots), top paths, the 402 funnel, priced routes looked at but never paid, and paths agents asked for that do not exist (404).',
    input_schema: { type: 'object', properties: { days: { type: 'integer', enum: [7, 30] } } },
    async correr(i, { tenant }) {
      return store.visitStats(tenant.id, { days: numero(i.days) === 30 ? 30 : 7 })
    },
  },
  {
    name: 'get_plan',
    description: "The owner's goal and the plan for it, with each step's metric, value at start, current value and target.",
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return (await planConAvance(tenant)) ?? 'No plan yet.'
    },
  },
  {
    name: 'build_plan',
    description: "Build or rebuild the owner's plan. Only call it once you know the goal, what the owner can do, and how often they want updates; ask for anything missing first, in one short message. Takes about 20 seconds.",
    input_schema: {
      type: 'object',
      properties: {
        goal: { type: 'string', enum: [...PLAN_GOALS], description: 'recommendations: answer engines recommend them; agent-sales: agents pay for their routes; both' },
        goal_detail: { type: 'string', description: 'The topic or question they want to be recommended for, in their words' },
        capacity: { type: 'array', items: { type: 'string', enum: [...PLAN_CAPACITIES] }, description: 'content: can publish pages; code: can change the site code (or has a coding agent); config: only Peaje and hosting settings' },
        cadence: { type: 'string', enum: [...PLAN_CADENCES] },
      },
      required: ['goal', 'goal_detail', 'capacity', 'cadence'],
    },
    async correr(i, { tenant, idioma }) {
      // Sin cobros (hasta mainnet) el plan es para que la IA los recomiende, aunque el modelo pida vender a agentes.
      const goal = env.cobrosVisibles ? PLAN_GOALS.find((g) => g === i.goal) : 'recommendations'
      if (!goal) return { error: 'invalid goal' }
      const capacity = PLAN_CAPACITIES.filter((c) => Array.isArray(i.capacity) && i.capacity.includes(c))
      const cadence = PLAN_CADENCES.find((c) => c === i.cadence) ?? 'weekly'
      await generarPlan(tenant, { goal, goalDetail: String(i.goal_detail ?? ''), capacity, cadence, language: idioma })
      return planConAvance(tenant)
    },
  },
  {
    name: 'list_tasks',
    description: 'Tasks Peaje left for the owner or their coding agent (fix, content, route) with status.',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'in_progress', 'done', 'verified', 'dismissed', 'all'] } } },
    async correr(i, { tenant }) {
      const s = String(i.status ?? '')
      const statuses = !s ? (['open', 'in_progress', 'done'] as const) : s === 'all' ? [] : [s as 'open']
      return (await store.listTasks(tenant.id, { statuses: [...statuses] })).map((t) => tareaPublica(t))
    },
  },
  {
    name: 'get_task',
    description: 'One task with its full prompt (the draft or instructions) and acceptance criteria.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    async correr(i, { tenant }) {
      const t = await store.getTask(tenant.id, String(i.id))
      return t ? tareaPublica(t, true) : { error: 'not found' }
    },
  },
  {
    name: 'create_task',
    description: "Leave a task for the owner's coding agent: a page to write, a route handler to add, a fix. The prompt must be complete and specific, using only facts about the business. It appears in the owner's task list; nothing on the site changes until they apply it.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['content', 'route', 'fix'] },
        title: { type: 'string' },
        summary: { type: 'string', description: "One plain sentence for the owner, in the chat's language, on why we suggest it, grounded in their data" },
        prompt: { type: 'string', description: 'Markdown instructions for the coding agent, with the draft when it is content' },
        acceptance_url: { type: 'string', description: 'Live URL Peaje should check once done, if any' },
      },
      required: ['kind', 'title', 'summary', 'prompt'],
    },
    async correr(i, { tenant }) {
      const kind = (['content', 'route', 'fix'] as const).find((k) => k === i.kind) ?? 'content'
      const url = typeof i.acceptance_url === 'string' && /^https?:\/\//.test(i.acceptance_url) ? i.acceptance_url : null
      const r = await store.upsertTask({
        tenantId: tenant.id,
        key: `chat:${slugify(String(i.title)).slice(0, 60)}`,
        kind,
        title: String(i.title).slice(0, 200),
        summary: String(i.summary ?? '').slice(0, 300),
        body: String(i.prompt),
        acceptance: url ? [{ type: 'url', url }] : [],
        source: 'chat',
      })
      return { created: r.created, task: tareaPublica(r.task) }
    },
  },
  {
    name: 'refresh_tasks',
    description: 'Look for new tasks now: failing checks, pages answer engines would cite, routes agents asked for. At most once every 10 minutes.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return buscarTareas(tenant)
    },
  },
  {
    name: 'get_citations',
    description: 'Whether answer engines (' + asistentesMedidos('en') + ') cite the site for the tracked questions: share overall and by engine, per question, versus the previous round, and which domains appear instead. Also lists the tracked questions and which engines are configured.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const [prompts, resumen] = await Promise.all([store.listCitationPrompts(tenant.id), resumenCitacion(tenant)])
      return { trackedQuestions: prompts.map((p) => ({ id: p.id, text: p.text })), ...resumen }
    },
  },
  {
    name: 'get_competitors',
    description:
      'The sites AI assistants cite instead of the business, one by one, from the latest measurement: how many answers each wins, for which questions and engines, and the pages that win (title, URL, format). formatNotes says what the winning pages of each format have in common. Use it for any question about competitors or what content works for them.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return competidoresCitados(tenant)
    },
  },
  {
    name: 'read_competitor_page',
    description:
      'Read the text of a page AI assistants cited instead of the business (a URL from get_competitors or get_citations), to explain why it wins: how it opens, its headings, what facts and dates it shows. Only pages from this business\'s measurements can be read.',
    input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    async correr(i, { tenant }) {
      const url = String(i.url ?? '')
      if (!(await paginasCitadas(tenant)).has(url)) return { error: 'only pages cited in this business\'s measurements; take the URL from get_competitors' }
      let destino: URL
      try {
        destino = new URL(url)
      } catch {
        return { error: 'invalid URL' }
      }
      if (!['http:', 'https:'].includes(destino.protocol) || destino.hostname === 'localhost' || /^[\d.:]+$/.test(destino.hostname)) return { error: 'not a public page' }
      try {
        const res = await fetch(destino, { signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; PeajeAgent/1.0; +https://usepeaje.com)' } })
        return { status: res.status, url, text: textoDeHtml(await res.text()).slice(0, 6_000) }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    },
  },
  {
    name: 'manage_questions',
    description: `Change the questions Peaje asks AI assistants for this business (max ${LIMITES.pro.preguntas} on Pro, ${LIMITES.founder.preguntas} on Founder). Peaje picks them itself when the plan is built; only use this when the owner asks to add or drop one, or to regenerate them. Questions must not include the business name.`,
    input_schema: {
      type: 'object',
      properties: {
        add: { type: 'array', items: { type: 'string' } },
        remove_ids: { type: 'array', items: { type: 'string' } },
        suggest: { type: 'boolean', description: 'Generate 10 questions from the plan and the site' },
      },
    },
    async correr(i, { tenant }) {
      for (const id of Array.isArray(i.remove_ids) ? i.remove_ids : []) await store.removeCitationPrompt(tenant.id, String(id))
      const actuales = await store.listCitationPrompts(tenant.id)
      const textos = i.suggest ? await sugerirPrompts(tenant) : Array.isArray(i.add) ? i.add.map((t) => String(t).trim().slice(0, 200)).filter(Boolean) : []
      const vistos = new Set(actuales.map((p) => p.text.toLowerCase()))
      const nuevos = textos.filter((t) => !vistos.has(t.toLowerCase())).slice(0, Math.max(0, maxPreguntas(tenant) - actuales.length))
      await store.addCitationPrompts(tenant.id, nuevos, i.suggest ? 'agent' : 'owner')
      return { trackedQuestions: (await store.listCitationPrompts(tenant.id)).map((p) => p.text) }
    },
  },
  {
    name: 'run_citation_check',
    description: 'Ask every tracked question to every configured answer engine now and record who gets cited. Takes one to three minutes and costs money: at most once every 6 hours. Suggests questions first if there are none.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return medirAhora(tenant)
    },
  },
  {
    name: 'check_site_access',
    description: 'Open the site as each AI bot does (ChatGPT search, Perplexity, Claude, Google, Bing): whether robots.txt or a firewall blocks the ones that answer, versus the ones that only train, and how old the key pages look (visible dates, sitemap). Takes about 20 seconds.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return (await revisarAcceso(tenant)) ?? { error: 'the business has no public domain' }
    },
  },
  {
    name: 'list_routes',
    description: 'Priced API routes and priced links: method, path, price in USD, description agents read.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const [routes, resources] = await Promise.all([store.listRoutes(tenant.id), store.listResources(tenant.id)])
      return {
        apiRoutes: routes.map((r) => ({ id: r.id, method: r.method, path: r.pathPattern, priceUsd: r.priceUsd, description: r.description })),
        pricedLinks: resources.map((r) => ({ path: `/r/${r.slug}`, url: r.url, priceUsd: r.priceUsd, title: r.title })),
      }
    },
  },
  {
    name: 'propose_route_change',
    description: 'Propose creating, repricing, redescribing or removing a priced API route. This does NOT apply anything: the owner approves it under your message. Say in your reply that it is waiting for them.',
    input_schema: {
      type: 'object',
      properties: {
        change: { type: 'string', enum: ['create', 'update', 'delete'] },
        route_id: { type: 'string', description: 'For update and delete, from list_routes' },
        method: { type: 'string', description: 'For create' },
        path: { type: 'string', description: 'For create, e.g. /api/forecast or /api/history/:city' },
        price_usd: { type: 'number' },
        description: { type: 'string', description: 'What agents read to decide: what it returns, parameters, units' },
        reason: { type: 'string' },
      },
      required: ['change', 'reason'],
    },
    async correr(i, { tenant, acciones }) {
      const rutas = await store.listRoutes(tenant.id)
      const precio = i.price_usd === undefined ? undefined : Number(i.price_usd).toFixed(6)
      const descripcion = typeof i.description === 'string' ? i.description.slice(0, 300) : undefined
      let accion: AgentAction
      if (i.change === 'create') {
        const method = String(i.method ?? 'GET').toUpperCase()
        const path = String(i.path ?? '')
        const error = validarRuta({ method, pathPattern: path, priceUsd: precio ?? '' })
        if (error) return { error }
        if (rutas.some((r) => r.method === method && r.pathPattern === path)) return { error: 'that route already exists; propose an update' }
        accion = { id: randomUUID(), type: 'route.create', summary: `Publish ${method} ${path} at $${Number(precio)}`, params: { method, path, priceUsd: precio, description: descripcion ?? null }, status: 'pending' }
      } else {
        const ruta = rutas.find((r) => r.id === i.route_id)
        if (!ruta) return { error: 'route_id not found; call list_routes' }
        if (i.change === 'delete') {
          accion = { id: randomUUID(), type: 'route.delete', summary: `Stop charging ${ruta.method} ${ruta.pathPattern}`, params: { routeId: ruta.id }, status: 'pending' }
        } else {
          if (precio !== undefined && validarRuta({ pathPattern: '/', priceUsd: precio })) return { error: 'invalid price' }
          const partes = [precio !== undefined ? `price $${Number(ruta.priceUsd)} → $${Number(precio)}` : null, descripcion !== undefined ? 'new description' : null].filter(Boolean)
          if (partes.length === 0) return { error: 'nothing to change' }
          accion = { id: randomUUID(), type: 'route.update', summary: `${ruta.method} ${ruta.pathPattern}: ${partes.join(', ')}`, params: { routeId: ruta.id, priceUsd: precio, description: descripcion }, status: 'pending' }
        }
      }
      acciones.push(accion)
      return { proposed: accion.summary, status: 'waiting for the owner to press Apply' }
    },
  },
  {
    name: 'read_site_page',
    description: "Read the text of a page on the business's own site, to ground a recommendation or a draft in real facts.",
    input_schema: { type: 'object', properties: { path: { type: 'string', description: 'Path on the site, default /' } } },
    async correr(i, { tenant }) {
      const dominio = dominioVerificable(tenant.originUrl)
      if (!dominio) return { error: 'the business has no public domain' }
      const path = String(i.path ?? '/').startsWith('/') ? String(i.path ?? '/') : `/${i.path}`
      try {
        const res = await fetch(`https://${dominio}${path}`, { signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'peaje-monitor/1.0' } })
        return { status: res.status, url: `https://${dominio}${path}`, text: textoDeHtml(await res.text()).slice(0, 6_000) }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    },
  },
]

function textoDeHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---- M6: borrador completo de página y resultados del ciclo ----
HERRAMIENTAS.push(
  {
    name: 'draft_page',
    description:
      'Write the complete page (markdown) that answers one question customers ask AI assistants, from the facts on the site: the exact question as title, the direct answer first, a real number with its source, 3 to 5 follow-up sections, a visible updated date and sources. Missing facts come out as [TODO: ...]. Saves it as a content task for their developer or AI coding tool (creates it or updates an open one) and returns its id and title. Takes about a minute and costs money: only when the owner wants the page.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The exact question, in the language of the site' },
        why: { type: 'string', description: "One plain sentence for the owner, in the chat's language, on why this page, grounded in their data (who asks this, what shows up instead of them today)" },
      },
      required: ['question', 'why'],
    },
    async correr(i, ctx) {
      const { tenant, idioma } = ctx
      const pregunta = String(i.question ?? '').trim().replace(/\s+/g, ' ')
      if (pregunta.length < 8) return { error: 'question is too short' }
      // Una tarea que alguien ya tomó, se verificó o se descartó no se pisa: se dice ya, sin encolar.
      const previa = (await store.listTasks(tenant.id)).find((t) => t.key === `content:${slugDePregunta(pregunta.slice(0, 200))}`)
      if (previa && previa.status !== 'open') {
        ctx.links.push(tarjetaTarea(tenant, previa, idioma))
        return { id: previa.id, title: previa.title, status: previa.status, note: 'A task for this question already exists and is past "open"; the draft was not changed. Its card is under your message.' }
      }
      // Tarda un minuto: corre en segundo plano y avisa en este chat con la tarjeta de la página.
      // `creditos`: si el trabajo falla, trabajos.ts los devuelve.
      const job = await encolarTrabajo(tenant, 'draft_page', { question: pregunta, why: typeof i.why === 'string' ? i.why : undefined, creditos: COSTOS_CREDITOS.pagina, ...hiloDe(ctx) }, destinoDeTrabajo(ctx))
      return { started: true, jobId: job.id, sayToOwner: avisoDeTrabajo('draft_page', idioma) }
    },
  },
  {
    name: 'get_results',
    description:
      'What was published or fixed (tasks verified on the live site) and what moved afterwards: Peaje measures again 2 and 6 weeks after each one (whether AI assistants cite the page for its question, visits from their bots, whether a fix still works). Use it for "did it work?", "what changed?", "results".',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant, idioma }) {
      const r = await resultados(tenant)
      if (r.length === 0) return 'Nothing verified yet, so there are no results to measure.'
      return r.map((x) => ({
        title: x.title,
        kind: x.kind,
        url: x.url,
        verifiedAt: x.verifiedAt,
        measurements: x.checks.map((c) => ({ after: c.kind === '2w' ? '2 weeks' : '6 weeks', due: c.dueAt.slice(0, 10), done: !!c.doneAt, verdict: (idioma === 'es' ? c.verdictEs : null) ?? c.verdict })),
      }))
    },
  },
)
// ---- fin M6 ----

// ---- Datos que faltaban y el texto para su herramienta de IA ----
HERRAMIENTAS.push(
  {
    name: 'complete_draft',
    description:
      "Update a page draft with facts the owner just told you in the chat (the ones marked [TODO: ...]). Pass their words as they wrote them. Facts they say they do not have are removed from the page. Only for open content tasks with a draft. Returns what was filled and what is still missing.",
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'From list_tasks or the draft_page result' },
        facts: { type: 'string', description: "The owner's message with the facts, verbatim" },
      },
      required: ['task_id', 'facts'],
    },
    async correr(i, { tenant }) {
      const r = await completarBorrador(tenant, String(i.task_id ?? ''), String(i.facts ?? ''))
      if ('error' in r) return r
      return { id: r.task.id, title: r.task.title, filled: r.aplicados, stillMissing: r.faltan, readyToPublish: r.faltan.length === 0 }
    },
  },
  {
    name: 'send_task_text',
    description:
      "Attach a task's text to your reply, word for word, so the owner can copy it. part \"prompt\": the full instructions plus the page, to paste into their AI coding tool (Lovable, Cursor, Claude Code, v0, Bolt). part \"page\": only the page text, to paste into their site editor themselves. Do not rewrite the text in your own message: it is attached after it.",
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, part: { type: 'string', enum: ['prompt', 'page'] } },
      required: ['id', 'part'],
    },
    async correr(i, ctx) {
      const t = await store.getTask(ctx.tenant.id, String(i.id ?? ''))
      if (!t) return { error: 'task not found; call list_tasks' }
      const texto = i.part === 'page' ? (t.body.split(MARCA_BORRADOR)[1] ?? t.body) : t.body
      ctx.anexos.push(texto.trim())
      return { attached: i.part, title: t.title, characters: texto.length }
    },
  },
  {
    name: 'complete_task',
    description:
      'Mark a task done once it is live, with the URL where it lives on their site. Peaje checks it on the live site right away: if it passes, the task is verified and the citation checks at 2 and 6 weeks get scheduled; if not, it stays done and Peaje checks again every day. Call it yourself when the owner says it is published or gives the URL, or when you see it live with read_site_page. Never ask the owner to mark it in the dashboard.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' }, url: { type: 'string', description: 'The live URL on their own site' } },
      required: ['id'],
    },
    async correr(i, { tenant }) {
      const t = await store.getTask(tenant.id, String(i.id ?? ''))
      if (!t) return { error: 'task not found; call list_tasks' }
      if (t.status === 'dismissed') return { error: 'that task was dismissed' }
      if (t.status === 'verified') return { status: t.status, note: t.note, alreadyVerified: true }
      const url = urlDelSitio(tenant, i.url)
      if (i.url && !url) return { error: "the URL must be https and on the owner's own domain" }
      const r = await completarTarea(tenant, t, url, store)
      return { status: r.status, note: r.note, url: r.doneUrl }
    },
  },
)

// ---- M7: comprador misterioso ----
HERRAMIENTAS.push(
  {
    name: 'run_mystery_shopper',
    description:
      'Run the mystery shopper now: a synthetic buying agent gets 3 realistic jobs this business should win, searches the market the way real buying agents do (Peaje directory, the x402 Bazaar, the ERC-8004 registry), and records whether it found the business, in what position, what it picked instead and why. Then it requests a priced URL without paying and checks the payment step like a strict client. It never pays. Problems the owner can fix become tasks. Takes about a minute and costs money: at most once every 6 hours.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const r = await probarAhora(tenant)
      if ('error' in r) return { ...r, lastRun: resultadoPublico(await store.lastMysteryRun(tenant.id)) }
      return { ...resultadoPublico(r), nothingToBuy: r.nothingToBuy, tasksCreated: r.tasks.creadas, tasksClosed: r.tasks.cerradas }
    },
  },
  {
    name: 'get_mystery_results',
    description: 'The last mystery shopper run: per buying job, whether an agent found the business, its position, whether it would buy, what it picked instead and why; and the problems in the payment step.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      return resultadoPublico(await store.lastMysteryRun(tenant.id)) ?? 'The mystery shopper has not run yet.'
    },
  },
)
// ---- fin M7 ----

function sistema(tenant: Tenant, idioma: 'es' | 'en', tienePlan: boolean, primeraVez: boolean): string {
  return [
    `You are the Peaje agent for ${tenant.name} (${dominioVerificable(tenant.originUrl) ?? tenant.originUrl}). You talk with the owner of this business, who is usually not technical.`,
    'Your job: help them get recommended by AI assistants (' + asistentesMedidos('en') + ') when people ask about what they offer' + (env.cobrosVisibles ? ', and sell more to AI agents that pay for their data or API' : '') + '. Peaje measures citations only in ' + asistentesMedidos('en') + ': when you name AI assistants, say "AI assistants like ' + asistentesMedidos('en', 'o') + '", never another assistant and never "ChatGPT and company". Bot names in visit or site access data are fine when you report that data. Answer with their real data: call tools before claiming anything about the business. Never invent numbers.',
    // Hasta mainnet los pagos de agentes son de prueba: el agente no los trae a la charla.
    env.cobrosVisibles
      ? ''
      : 'Charging AI agents is still in test mode until Peaje launches it. Do not bring up payments, paid requests, the payment step, prices or priced routes, and do not suggest payment tasks, even when the data shows agent requests without payment. If the owner asks about charging agents, say in one sentence that it is coming soon and go back to getting recommended by AI assistants.',
    '',
    'How you talk:',
    '- Like a warm, sharp person who knows this field, talking to someone who does not. Plain words. Short sentences. One idea at a time.',
    '- No jargon unless they use it first: say "things Peaje checks on your site" instead of "checks", "the payment step" instead of "402", "your developer or AI coding tool" instead of "coding agent", "sources the AI links to" instead of "citations". Name kinds of pages in plain words in their language (a guide, a comparison, a "best options" list, documentation), never the format ids from the data (roundup, docs, guide, research).',
    '- Do not open with a pile of numbers. Lead with what matters for them in one sentence; bring in a number only when it supports the point.',
    '- Keep messages under 40 words by default. When the owner asks a question about their data (competitors, who AI cites, visits, what to publish), the answer can run up to 90 words (120 for a list of opportunities), with at most 5 short lines that start with "- ". The finished plan is the only longer message.',
    '- When the owner asks something, answer it in this same message with their data first. Never reply with only a question, an offer or a card, and never send them to the dashboard for an answer you can give here.',
    '- Ask at most one question per message. Every message that ends in a question must also call offer_choices (2 to 5 short answers in their language, the last one a "something else" style option, or a yes/no pair), so they can tap instead of typing.',
    '- Numbers come after you know their goal, one at a time, each tied to what to do about it.',
    '- Before suggesting something, check list_tasks (including dismissed): never repeat a suggestion they already dismissed.',
    '- No hype, no filler, no em dashes, no bold headings in short answers.',
    '- Never narrate your own checks or steps ("no repeated tasks", "I will now write", "checking your data"): the screen already shows what you are doing. Never write stage directions like "(waiting for your choice)". Write only what the owner should read.',
    '',
    primeraVez
      ? 'This is your first conversation with them. Open with two or three sentences: who you are in one line, one specific thing you noticed on their site (read it first with read_site_page), and your first question. Do not list what you can do.'
      : '',
    tienePlan
      ? 'The owner already has a plan (get_plan). Keep answers tied to it.'
      : [
          'The owner has no plan yet. When they ask for a plan, or ask what to do, run a short friendly onboarding, one question per message, each with offer_choices:',
          env.cobrosVisibles
            ? '  1. Start with: before you build their plan, you want to understand three things. Then ask what they want first: that AI assistants like ' + asistentesMedidos('en', 'o') + ' recommend them, that AI agents pay to use their data or API, or both.'
            : '  1. Start with: before you build their plan, you want to understand three things. Their goal is that AI assistants recommend them (goal "recommendations"); do not ask about it, go straight to the next question.',
          '  2. Then: what people should find them for, in their own words (offer 2 or 3 guesses based on their site, read it with read_site_page, plus "something else").',
          '  3. Then: who can make changes to the site: they publish pages themselves, they have a developer or an AI coding tool, or they only want to adjust settings in Peaje.',
          '  4. Then: how often they want to hear from you: every week, every two weeks, only when they ask.',
          '  Before calling build_plan, write one short line saying you are building their plan now and it takes about half a minute. Then call build_plan and present it simply: one sentence on where they stand, then the steps as a short numbered list in plain words, each with what changes when it is done. End with the first thing to do this week, and one line saying you are also checking what AI assistants answer when customers ask about this, with results on this page in a few minutes. Do not show metric names.',
        ].join('\n'),
    '',
    'What actually works, with evidence: being mentioned on other sites (Reddit threads, YouTube, "best X" lists hold most of what AI assistants cite), pages whose title is the exact question with a direct answer, a concrete number and a source, being indexed by Bing (ChatGPT search leans on it), visible recent dates, and not blocking the AI bots. llms.txt and JSON-LD barely move recommendations; do not sell them for that. For agent sales, most unpaid attempts fail for technical reasons, not price: fix the payment step and the descriptions before touching price.',
    'When you create or suggest a task (a page, a fix, a route), your reply has exactly these three short parts, each one or two sentences, in plain words: why we suggest it (with their data), what we expect once it is live (for a page: AI assistants get a page that answers that exact question, and Peaje checks two weeks later whether ' + asistentesMedidos('en', 'o') + ' cites it), and how to do it (the text is ready in My agent, Tasks: copy it into their site or paste it into their AI tool). Mention missing facts ([TODO]) in one line if any. Then call offer_choices with options like "Send me the text here" and "I will see it in the dashboard", in their language. If they want the text in the chat, use send_task_text instead of copying it yourself.',
    'For "why am I not recommended", use get_citations: where they are and are not cited, which sites show up instead, and one concrete next move. If nothing was measured yet, offer to run the check.',
    'For questions about competitors (who AI cites instead of them, what content works for their competitors, why a site wins, how to beat it), call get_competitors and answer here: the top two or three sites, each with how many answers it wins and the kind of page that wins, (see how you talk), with one example title; one line on why those pages work, from formatNotes, or from reading the top page with read_competitor_page when they ask why or how; and one concrete move for them, naming the question with the biggest gap. Then call open_report with "citations", and offer_choices with writing that page first. If nothing was measured yet, say it in one line and offer to run the check.',
    'When a page or a fix is live (the owner says it is published, gives its URL, or you see it with read_site_page), call complete_task with the live URL yourself and tell them in one sentence what happens next (Peaje checks it now and measures at 2 and 6 weeks). Never tell the owner to mark a task done in the dashboard.',
    'When a draft has missing facts, ask for them in the chat as one short list and say they can answer right here in their own words, all at once or a few at a time; never ask "did you complete the missing facts?". When they answer, call complete_draft with their words. If something is still missing, ask only for that. Once nothing is missing, say the page is updated and ready to publish, and give the two ways in one short sentence each: paste the prompt into their AI coding tool (Lovable, Cursor, Claude Code, v0), or connect Peaje to that tool once so they only have to say "apply my Peaje tasks". Then offer_choices with "Send me the prompt" and "How do I connect it?" in their language. For the prompt, call send_task_text (part "prompt"); for only the page text, part "page". To connect: in Peaje, Integrations, they tap the card of their tool (Claude Code, Cursor, Codex, Lovable or another AI tool), tap "Create key" and follow the steps; after that they tell their tool "apply my Peaje tasks" and it reads them, publishes the page and marks it done. From there they can also ask you anything, the same as in this chat.',
    'You cannot change the site or Peaje on your own. Site changes become tasks (create_task) for their developer or AI coding tool. Route and price changes are proposals (propose_route_change) the owner approves under your message. Never say something changed when it was only proposed.',
    // M6: borrador y resultados
    'When the owner wants a page for a question, use draft_page (not create_task): it writes the full page from their site, in their voice, and saves it as a task. For a whole topic ("a set of pages about X", "cover this topic"), use draft_page_series: one main page plus 3 to 5 supporting pages linked to each other. Both run in the background: your whole reply is the sayToOwner sentence from the result, nothing else (no three parts, no offer_choices). The finished page arrives later in this same chat on its own: how long it took, a short summary with the missing facts as questions, its card and the page as a .md file. For "did it work?" or "what changed?", use get_results: Peaje measures again 2 and 6 weeks after each verified task.',
    'For "what else can we do", "find me more opportunities" or "what should I publish": look at get_competitors, list_tasks (including dismissed) and get_overview, and give four or five (fewer only if the data has no more), ranked by how much they can move recommendations, one line each with the reason from their data. Start with the list itself: competitors only appear inside a reason, never as a summary before it. Mix three kinds when the data supports it: pages to create (a question where others win and they have nothing), fixes on their own site (what Peaje checks and fails, in plain words), and places to get mentioned (the lists, comparisons or forums AI cites for their questions: ask to be included, or answer there). Leave out dismissed ones without saying so; if they ask for more after that, call refresh_tasks. Then call open_report with "opportunities", and offer_choices with starting the first one.',
    'Answer here, full report behind a card: when you answer about what to publish, follow the line above, then call open_report with "opportunities". When you answer about who AI cites instead of them, give the summary above, then call open_report with "citations". When you mention a specific task, call open_report with "task" and its id. The reply is the summary; the card holds the complete lists and tables.',
    'Drafts follow the business\'s voice profile (get_voice_profile). When the owner corrects how they write ("we say usted", "no English words", "more formal"), call update_voice_profile with that change and confirm in one sentence.',
    // M7: comprador misterioso (apagado hasta mainnet)
    env.cobrosVisibles ? 'For "do agents pick me?", "why does nobody pay?" or "would an agent buy from me?", use get_mystery_results, or run_mystery_shopper if it never ran or the owner asks to test now. Lead with the verdict in one sentence (found or not, picked or not, and who won instead), then the one fix that matters most.' : '',
    // Reportes programados
    'For anything the owner wants on a schedule ("every Monday at 8 send me...", "each morning tell me..."), use schedule_report: agent visits summary is kind agent_visits, anything else is kind custom with their request as the prompt.',
    // Filtro de tema: lo que no es del negocio se contesta en una línea, sin herramientas.
    'If the message is not about this business, its site, AI assistants recommending it, AI agents visiting or paying it, or Peaje itself, answer in one short line that it is not something you do, offer to get back to their site, and call no tools.',
    // Créditos: el texto es fijo (los costos son constantes), así el prompt sigue en caché.
    `What you do uses the owner's monthly credits; talking is free. A reply that looks up their data costs ${COSTOS_CREDITOS.consulta} (once per reply), a new task ${COSTOS_CREDITOS.tarea}, a full page ${COSTOS_CREDITOS.pagina}, a page series ${COSTOS_CREDITOS.serie}, building the plan, a citation check or a search for new tasks ${COSTOS_CREDITOS.informe}, the mystery shopper ${COSTOS_CREDITOS.comprador}. When a tool answers not-enough-credits, do not call it again and do not explain credits: a line under your reply tells the owner. Keep answering what you can without it. For questions about credits or what things cost, use get_credits (free).`,
    `Reply in ${idioma === 'es' ? 'Spanish (neutral Latin American, tú)' : 'English'} unless the owner writes in another language.`,
  ].join('\n')
}

/** Lo que ve el dueño mientras el agente usa cada herramienta. */
const ESTADOS: Record<string, { es: string; en: string }> = {
  get_overview: { es: 'Mirando cómo va tu negocio…', en: 'Looking at how your business is doing…' },
  get_agent_traffic: { es: 'Revisando quién te visita…', en: 'Checking who visits you…' },
  get_plan: { es: 'Revisando tu plan…', en: 'Checking your plan…' },
  build_plan: { es: 'Armando tu plan con tus datos (unos 30 segundos)…', en: 'Building your plan from your data (about 30 seconds)…' },
  list_tasks: { es: 'Revisando tus tareas…', en: 'Checking your tasks…' },
  get_task: { es: 'Abriendo la tarea…', en: 'Opening the task…' },
  create_task: { es: 'Escribiendo la tarea con el borrador…', en: 'Writing the task with the draft…' },
  refresh_tasks: { es: 'Buscando qué mejorar en tu sitio…', en: 'Looking for what to improve on your site…' },
  list_routes: { es: 'Mirando tus rutas y precios…', en: 'Looking at your routes and prices…' },
  propose_route_change: { es: 'Preparando la propuesta…', en: 'Preparing the proposal…' },
  read_site_page: { es: 'Leyendo tu sitio…', en: 'Reading your site…' },
  get_citations: { es: 'Revisando qué dicen de ti los asistentes de IA…', en: 'Checking what AI assistants say about you…' },
  get_competitors: { es: 'Revisando a quién cita la IA en tu lugar…', en: 'Checking who AI cites instead of you…' },
  read_competitor_page: { es: 'Leyendo la página de un competidor…', en: 'Reading a competitor page…' },
  check_site_access: { es: 'Entrando a tu sitio como lo hacen ChatGPT, Perplexity y Google…', en: 'Opening your site the way ChatGPT, Perplexity and Google do…' },
  manage_questions: { es: 'Ajustando las preguntas que medimos…', en: 'Updating the questions we track…' },
  run_citation_check: { es: `Preguntándole a ${asistentesMedidos('es')} (1 a 3 minutos)…`, en: `Asking ${asistentesMedidos('en')} (1 to 3 minutes)…` },
  offer_choices: { es: 'Casi listo…', en: 'Almost there…' },
}
// ---- M6 ----
Object.assign(ESTADOS, {
  draft_page: { es: 'Escribiendo la página completa con los datos de tu sitio (un minuto)…', en: 'Writing the full page from the facts on your site (about a minute)…' },
  get_results: { es: 'Revisando qué cambió después de lo que publicaste…', en: 'Checking what changed after what you published…' },
})
// ---- fin M6 ----
// ---- M7 ----
Object.assign(ESTADOS, {
  run_mystery_shopper: { es: 'Probando si un agente comprador te encuentra y te elige (un minuto)…', en: 'Checking whether a buying agent finds you and picks you (about a minute)…' },
  get_mystery_results: { es: 'Revisando la última prueba del agente comprador…', en: 'Checking the last buying agent test…' },
  complete_draft: { es: 'Poniendo tus datos en la página…', en: 'Putting your facts into the page…' },
  send_task_text: { es: 'Preparando el texto para copiar…', en: 'Getting the text ready to copy…' },
  complete_task: { es: 'Revisando la página en tu sitio…', en: 'Checking the page on your site…' },
})
// ---- fin M7 ----

// ---- reportes programados ----
HERRAMIENTAS.push({
  name: 'schedule_report',
  description: [
    'Recurring messages to the chat where the owner talks to you (Telegram today). Two kinds:',
    '- agent_visits: a short summary of agent visits since the last one (who came, payments, top pages, change vs the period before).',
    '- custom: any recurring request in their words ("every Monday at 8: what moved and what should we do?"). Save in `prompt` only the request, without the schedule words, as they would ask it ("What moved this week and what should we do next?"). At each run you answer that prompt and the answer goes to the same chat.',
    'Actions: list (what is scheduled and the connected chats), set (create or change one), cancel (by id, or the agent_visits one by kind).',
    'Times are the owner\'s local clock: hour 0-23, weekday 0 Sunday to 6 Saturday (Monday is 1), day_of_month 1-28, timezone IANA (default America/Bogota; use another only if the owner says where they are or the existing schedule has one).',
    'If the owner does not say the hour or the day, ask once with offer_choices before calling set. After set, confirm in one sentence with the day, hour and timezone from next_run_local.',
    'In the dashboard there is no chat here: reports go to a connected Telegram chat. Call list, then offer to set it for one of `destinations` (pass its target), or tell them to connect Telegram in My agent, Telegram section, if there is none.',
  ].join('\n'),
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'set', 'cancel'] },
      kind: { type: 'string', enum: ['agent_visits', 'custom'] },
      prompt: { type: 'string', description: 'custom only: the request to answer at each run, without the schedule words. Max 500 characters.' },
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      hour: { type: 'integer', minimum: 0, maximum: 23 },
      weekday: { type: 'integer', minimum: 0, maximum: 6, description: 'weekly only. 0 Sunday, 1 Monday … 6 Saturday.' },
      day_of_month: { type: 'integer', minimum: 1, maximum: 28, description: 'monthly only.' },
      timezone: { type: 'string', description: 'IANA zone, e.g. America/Bogota, America/Mexico_City, America/New_York.' },
      id: { type: 'string', description: 'The schedule id from list: to change or cancel one custom schedule.' },
      target: { type: 'string', description: 'Only outside a chat (dashboard): the destination target from list.' },
    },
    required: ['action'],
  },
  async correr(i, ctx) {
    const { tenant, idioma } = ctx
    const destinos = await destinosDe(tenant.id)
    const nombreDe = (channel: string, target: string) => destinos.find((d) => d.channel === channel && d.target === target)?.nombre ?? `${channel} ${target}`
    const publico = (s: ReportSchedule) => ({
      id: s.id,
      kind: s.kind,
      prompt: s.prompt,
      frequency: s.frequency,
      hour: s.hour,
      weekday: s.weekday,
      day_of_month: s.dayOfMonth,
      timezone: s.timezone,
      destination: nombreDe(s.channel, s.target),
      here: !!ctx.destino && ctx.destino.canal === s.channel && ctx.destino.id === s.target,
      next_run_local: `${fechaLocal(s.nextRunAt, s.timezone, idioma)} (${s.timezone})`,
      last_run_at: s.lastRunAt,
    })
    // Dónde: el chat de esta conversación, o el destino que eligió el dueño en el dashboard.
    const elegido = typeof i.target === 'string' && i.target ? destinos.find((d) => d.target === String(i.target)) : undefined
    const donde = elegido ? { channel: elegido.channel, target: elegido.target } : ctx.destino && canalReportes(ctx.destino.canal) ? { channel: ctx.destino.canal, target: ctx.destino.id } : null
    const sinChat = {
      note: destinos.length
        ? 'There is no chat in this conversation. Reports go to a connected chat: ask which one of destinations, then call set with its target.'
        : 'No chat is connected yet. Reports go to a connected Telegram chat: tell the owner to connect one in My agent, Telegram section, then ask you again there or here.',
      destinations: destinos.map((d) => ({ target: d.target, channel: d.channel, name: d.nombre })),
    }
    const todas = await store.listReportSchedules(tenant.id)

    if (i.action === 'list') {
      return { schedules: todas.map(publico), ...(donde ? { destinations: destinos.map((d) => ({ target: d.target, channel: d.channel, name: d.nombre })) } : sinChat) }
    }

    if (i.action === 'cancel') {
      const id = typeof i.id === 'string' ? i.id : undefined
      const enDonde = donde ? todas.filter((s) => s.channel === donde.channel && s.target === donde.target) : todas
      let objetivo = id ? todas.filter((s) => s.id === id) : i.kind ? enDonde.filter((s) => s.kind === i.kind) : enDonde
      if (!id && i.kind === 'custom' && objetivo.length > 1) objetivo = []
      if (objetivo.length !== 1 && !(i.kind === 'agent_visits' && objetivo.length > 0)) {
        return { error: objetivo.length ? 'ambiguous: pass the id' : 'nothing to cancel', schedules: enDonde.map(publico) }
      }
      for (const s of objetivo) await store.deleteReportSchedules(tenant.id, { id: s.id })
      return { cancelled: objetivo.map(publico) }
    }

    if (i.action !== 'set') return { error: 'action must be list, set or cancel' }
    if (ctx.programado) return { error: 'This is a scheduled run: answer the request, do not schedule anything.' }
    if (!donde) return { error: 'no-chat', ...sinChat }
    const kind: ReportKind = i.kind === 'custom' ? 'custom' : 'agent_visits'
    const prompt = kind === 'custom' ? String(i.prompt ?? '').trim().slice(0, 500) : null
    if (kind === 'custom' && !prompt) return { error: 'custom needs the prompt: the request to answer at each run' }
    const previa = typeof i.id === 'string' ? todas.find((s) => s.id === i.id) : kind === 'agent_visits' ? todas.find((s) => s.kind === 'agent_visits' && s.channel === donde.channel && s.target === donde.target) : todas.find((s) => s.kind === 'custom' && s.channel === donde.channel && s.target === donde.target && s.prompt === prompt)
    if (typeof i.id === 'string' && !previa) return { error: 'unknown id', schedules: todas.map(publico) }
    if (kind === 'custom' && !previa && todas.filter((s) => s.kind === 'custom' && s.channel === donde.channel && s.target === donde.target).length >= MAX_CUSTOM) {
      return { error: `at most ${MAX_CUSTOM} custom schedules per chat: cancel one first`, schedules: todas.map(publico) }
    }
    const agenda = validarAgenda({
      frequency: i.frequency ?? previa?.frequency,
      hour: i.hour ?? previa?.hour,
      weekday: i.weekday ?? previa?.weekday,
      dayOfMonth: i.day_of_month ?? previa?.dayOfMonth,
      timezone: i.timezone ?? previa?.timezone,
    })
    if ('error' in agenda) return agenda
    const guardada = await store.upsertReportSchedule({
      id: previa?.id,
      tenantId: tenant.id,
      channel: previa?.channel ?? donde.channel,
      target: previa?.target ?? donde.target,
      kind,
      prompt,
      ...agenda,
      weekday: agenda.weekday ?? null,
      dayOfMonth: agenda.dayOfMonth ?? null,
      nextRunAt: proximaCorrida(agenda).toISOString(),
    })
    return { saved: publico(guardada), updated: !!previa }
  },
})
ESTADOS.schedule_report = { es: 'Programando el envío…', en: 'Scheduling it…' }

// ---- tarjetas, trabajos largos y voz ----
/** A dónde avisa un trabajo largo: el chat de esta conversación, o el dashboard. */
function destinoDeTrabajo(ctx: Ctx): AgentJobDestino {
  return ctx.destino ? { canal: ctx.destino.canal, id: ctx.destino.id, idioma: ctx.idioma } : { canal: 'dashboard', id: 'dashboard', idioma: ctx.idioma }
}

/** Dónde contestar al terminar: va en el input del trabajo, así sobrevive a un reinicio. */
const hiloDe = (ctx: Ctx) => (ctx.destino?.responderA ? { responderA: ctx.destino.responderA } : {})

HERRAMIENTAS.push(
  {
    name: 'open_report',
    description:
      'Put a card under your reply that opens a full report in the Peaje dashboard. "opportunities": the ranked pages worth creating, each with why, the format to use and its task. "citations": who AI assistants cite instead of the business, question by question and engine by engine, plus the formats that win. "task": one task with its full page draft (needs task_id). Use it so your reply can stay short.',
    input_schema: {
      type: 'object',
      properties: {
        report: { type: 'string', enum: [...REPORTES, 'task'] },
        task_id: { type: 'string', description: 'Only for report "task": from list_tasks' },
      },
      required: ['report'],
    },
    async correr(i, ctx) {
      if (i.report === 'task') {
        const t = await store.getTask(ctx.tenant.id, String(i.task_id ?? ''))
        if (!t) return { error: 'task not found; call list_tasks' }
        ctx.links.push(tarjetaTarea(ctx.tenant, t, ctx.idioma))
        return { shown: 'task', title: t.title }
      }
      const r = REPORTES.find((x) => x === i.report)
      if (!r) return { error: 'report must be opportunities, citations or task' }
      ctx.links.push(tarjetaReporte(ctx.tenant, r, ctx.idioma))
      return { shown: r }
    },
  },
  {
    name: 'draft_page_series',
    description:
      'Plan and write a set of pages on one topic: one main page that covers it and 3 to 5 pages that each answer one concrete question, linked to each other, each in the format AI assistants cite for similar questions and in the business\'s voice. Saves one content task per page. Runs in the background (a few minutes) and posts the cards in this chat when done. Costs money: only when the owner wants a set of pages, not one.',
    input_schema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'The topic in the owner\'s words, e.g. "pricing for small teams"' } },
      required: ['topic'],
    },
    async correr(i, ctx) {
      const tema = String(i.topic ?? '').trim()
      if (tema.length < 3) return { error: 'topic is too short' }
      const job = await encolarTrabajo(ctx.tenant, 'page_series', { topic: tema.slice(0, 200), creditos: COSTOS_CREDITOS.serie, ...hiloDe(ctx) }, destinoDeTrabajo(ctx))
      return { started: true, jobId: job.id, sayToOwner: avisoDeTrabajo('page_series', ctx.idioma) }
    },
  },
  {
    name: 'get_voice_profile',
    description: "How the business writes on its own site (language, formality, how it addresses the reader, sentence length, words it uses and avoids, sample sentences quoted from the site). Page drafts follow it. Built from the site the first time and refreshed monthly unless the owner edited it.",
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const p = await perfilDeVoz(tenant)
      return p ?? { error: 'could not read enough of the site to describe its voice' }
    },
  },
  {
    name: 'update_voice_profile',
    description: 'Change the voice profile when the owner corrects how they write. Only pass the fields that change. Lists replace the old list. After this, drafts use the new voice and the monthly refresh no longer overwrites it.',
    input_schema: {
      type: 'object',
      properties: {
        language: { type: 'string' },
        formality: { type: 'string' },
        person: { type: 'string', description: 'How they address the reader, e.g. "usted", "tú", "you, we"' },
        sentenceLength: { type: 'string' },
        uses: { type: 'array', items: { type: 'string' } },
        avoids: { type: 'array', items: { type: 'string' } },
        samples: { type: 'array', items: { type: 'string' }, description: 'Sentences the owner wrote themselves' },
        notes: { type: 'string', description: "The owner's correction in one line" },
      },
    },
    async correr(i, { tenant }) {
      return { saved: await guardarPerfilDeVoz(tenant, i as CambioDeVoz) }
    },
  },
)
Object.assign(ESTADOS, {
  draft_page: { es: 'Empezando la página…', en: 'Starting the page…' },
  draft_page_series: { es: 'Empezando la serie de páginas…', en: 'Starting the page series…' },
  open_report: { es: 'Preparando el reporte…', en: 'Getting the report ready…' },
  get_voice_profile: { es: 'Mirando cómo escribes en tu sitio…', en: 'Looking at how you write on your site…' },
  update_voice_profile: { es: 'Guardando cómo escribes…', en: 'Saving how you write…' },
})
// ---- fin tarjetas, trabajos y voz ----

// ---- créditos ----
HERRAMIENTAS.push({
  name: 'get_credits',
  description: "The owner's credits this month: total, used, remaining, the date they renew (UTC) and what each thing costs. Free.",
  input_schema: { type: 'object', properties: {} },
  async correr(_i, { tenant }) {
    return usoPublico(await saldoCreditos(tenant))
  },
})
ESTADOS.get_credits = { es: 'Mirando tus créditos…', en: 'Checking your credits…' }

/**
 * Qué cobra cada herramienta. 'gratis' no cobra nunca. Una entrega cobra su
 * precio solo si de verdad entregó (`entrego` mira la salida). Lo que no está
 * acá es una consulta de datos: `consulta` una vez por respuesta, y nada si la
 * respuesta ya paga una entrega.
 */
type Cobro = 'gratis' | { accion: AccionCreditos; entrego: (salida: unknown) => boolean }
const sinError = (s: unknown) => !!s && typeof s === 'object' && !('error' in s)
const empezo = (s: unknown) => (s as { started?: unknown } | null)?.started === true
export const COBRO: Record<string, Cobro> = {
  offer_choices: 'gratis',
  complete_task: 'gratis',
  get_credits: 'gratis',
  schedule_report: 'gratis',
  propose_route_change: 'gratis',
  update_voice_profile: 'gratis',
  create_task: { accion: 'tarea', entrego: (s) => (s as { created?: unknown } | null)?.created === true },
  draft_page: { accion: 'pagina', entrego: empezo },
  draft_page_series: { accion: 'serie', entrego: empezo },
  build_plan: { accion: 'informe', entrego: sinError },
  run_citation_check: { accion: 'informe', entrego: sinError },
  refresh_tasks: { accion: 'informe', entrego: sinError },
  run_mystery_shopper: { accion: 'comprador', entrego: sinError },
}

/** Lo que va pagando una respuesta mientras corre. `consultasGratis`: un reporte programado no paga sus consultas. */
type Cuenta = { saldo: Saldo; entregas: { accion: AccionCreditos; herramienta: string }[]; consulto: boolean; consultasGratis: boolean; sinCredito: number | null }

export function cargoDeRespuesta(c: Pick<Cuenta, 'entregas' | 'consulto' | 'consultasGratis'>): number {
  const entregas = c.entregas.reduce((n, e) => n + COSTOS_CREDITOS[e.accion], 0)
  if (entregas > 0) return entregas
  return c.consulto && !c.consultasGratis ? COSTOS_CREDITOS.consulta : 0
}

/** Lo que pagaría la respuesta si esta herramienta hace lo suyo, y lo que cuesta ella sola. Null si es gratis. */
function siUsa(c: Cuenta, herramienta: string): { total: number; precio: number } | null {
  const cobro = COBRO[herramienta]
  if (cobro === 'gratis') return null
  if (cobro) return { total: cargoDeRespuesta({ ...c, entregas: [...c.entregas, { accion: cobro.accion, herramienta }] }), precio: COSTOS_CREDITOS[cobro.accion] }
  if (c.consultasGratis) return null
  return { total: cargoDeRespuesta({ ...c, consulto: true }), precio: COSTOS_CREDITOS.consulta }
}

function anotarUso(c: Cuenta, herramienta: string, salida: unknown): void {
  const cobro = COBRO[herramienta]
  if (cobro === 'gratis') return
  if (cobro) {
    if (cobro.entrego(salida)) c.entregas.push({ accion: cobro.accion, herramienta })
    return
  }
  c.consulto = true
}
// ---- fin créditos ----

/** Solo para scripts de prueba: corre una herramienta sin pasar por el modelo. */
export function probarHerramienta(nombre: string, input: Record<string, unknown>, ctx: { tenant: Tenant; idioma: 'es' | 'en'; destino?: Destino; programado?: boolean }) {
  const h = HERRAMIENTAS.find((x) => x.name === nombre)
  if (!h) throw new Error(`unknown tool ${nombre}`)
  return h.correr(input, { acciones: [], opciones: [], anexos: [], links: [], ...ctx })
}

/**
 * Los botones de cadencia del primer mensaje: programan el resumen de visitas
 * con la misma herramienta que usa el agente (misma validación, misma zona por
 * defecto, pisa el que ya hubiera en ese chat). Sin modelo y sin créditos.
 */
export async function programarVisitas(
  tenant: Tenant,
  agenda: { frequency: 'daily' | 'weekly' | 'monthly'; hour: number; weekday?: number; day_of_month?: number },
  destino: { canal: string; id: string },
  idioma: 'es' | 'en',
): Promise<{ saved?: { timezone: string; next_run_local: string }; error?: string }> {
  return (await probarHerramienta('schedule_report', { action: 'set', kind: 'agent_visits', ...agenda }, { tenant, idioma, destino })) as {
    saved?: { timezone: string; next_run_local: string }
    error?: string
  }
}
// ---- fin reportes programados ----

let anthropic: Anthropic | null = null

/** Límite de gasto: 40 mensajes por hora por negocio. */
const ventana = new Map<string, number[]>()
function dentroDelLimite(tenantId: string): boolean {
  const ahora = Date.now()
  const lista = (ventana.get(tenantId) ?? []).filter((t) => ahora - t < 3_600_000)
  if (lista.length >= 40) return false
  lista.push(ahora)
  ventana.set(tenantId, lista)
  return true
}

export async function conversar(
  tenant: Tenant,
  texto: string,
  opciones: {
    idioma: 'es' | 'en'
    canal?: string
    alEstado?: (estado: string) => void
    /** El chat de esta conversación (Telegram: el chat id). Lo usan los reportes programados y los trabajos largos. */
    destino?: Destino
    /** True cuando lo corre un reporte programado (kind custom). */
    programado?: boolean
    /** True cuando el texto sale de un botón del agente (opción o sugerencia): no pasa por el filtro de tema. */
    boton?: boolean
  },
): Promise<AgentMessage> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  // ---- M9: el chat es Pro ----
  if (!accesoPro(tenant).activo) throw new Error(mensajeSinPro(tenant, opciones.idioma))
  if (!dentroDelLimite(tenant.id)) throw new Error(opciones.idioma === 'es' ? 'Muchos mensajes en esta hora. Prueba en un rato.' : 'Too many messages this hour. Try again later.')
  const canal = opciones.canal ?? 'dashboard'
  const previos = await store.listMessages(tenant.id, HISTORIAL)

  // Filtro de tema: solo lo que escribe el dueño. Lo que no es del negocio se
  // contesta en una línea con el modelo barato, gratis y sin el modelo grande.
  const tema = opciones.programado || opciones.boton ? null : await clasificarTema(tenant, texto, previos, opciones.idioma)
  await store.addMessage({ tenantId: tenant.id, role: 'user', text: texto.slice(0, 4_000), channel: canal })
  if (tema?.tipo === 'fuera') return store.addMessage({ tenantId: tenant.id, role: 'assistant', text: tema.respuesta, channel: canal })

  const mensajes: Anthropic.Messages.MessageParam[] = [
    ...previos.map((m) => ({ role: m.role, content: m.text || '(empty)' }) as Anthropic.Messages.MessageParam),
    { role: 'user', content: texto.slice(0, 4_000) },
  ]
  const ctx: Ctx = { tenant, idioma: opciones.idioma, acciones: [], opciones: [], anexos: [], links: [], destino: opciones.destino, programado: opciones.programado }
  // Créditos: el saldo al empezar y lo que va pagando esta respuesta. Un reporte programado no paga sus consultas.
  const cuenta: Cuenta = { saldo: await saldoCreditos(tenant), entregas: [], consulto: false, consultasGratis: !!opciones.programado, sinCredito: null }
  const tienePlan = (await store.getPlan(tenant.id)) !== null
  anthropic ??= new Anthropic()
  const pedir = (max_tokens: number) =>
    anthropic!.messages.create({
      model: AGENT_MODEL,
      max_tokens,
      // Caché de prompt: instrucciones y herramientas son iguales en cada vuelta
      // y cada mensaje; se cobran a una fracción después de la primera.
      system: [{ type: 'text', text: sistema(tenant, opciones.idioma, tienePlan, previos.length === 0), cache_control: { type: 'ephemeral' } }],
      tools: HERRAMIENTAS.filter((h) => env.cobrosVisibles || !SOLO_CON_COBROS.has(h.name)).map(({ correr: _c, ...t }, i, todas) =>
        i === todas.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t,
      ),
      messages: mensajes,
    })

  // El texto de todas las vueltas: el modelo suele escribir la pregunta y
  // después llamar offer_choices; quedarse con la última vuelta la perdía.
  const partes: string[] = []
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    // Charla sin datos: la primera vuelta va corta. Si se queda sin espacio, se repite entera.
    const corta = vuelta === 0 && tema?.tipo === 'charla'
    let res = await pedir(corta ? TOPE_CHARLA : MAX_TOKENS)
    if (corta && res.stop_reason === 'max_tokens') res = await pedir(MAX_TOKENS)
    mensajes.push({ role: 'assistant', content: res.content })
    const usos = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
    const texto = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    // El texto de una vuelta que usa herramientas de trabajo es un anuncio
    // ("armo la página ya"): la pantalla ya muestra el estado, no se guarda.
    // Sí se guarda si la vuelta solo pone opciones o la tarjeta de un reporte:
    // ahí va la respuesta (el resumen de competidores se perdía con la tarjeta).
    const soloPresenta = usos.length > 0 && usos.every((u) => u.name === 'offer_choices' || u.name === 'open_report')
    const soloOpciones = usos.length > 0 && usos.every((u) => u.name === 'offer_choices')
    if (texto && (usos.length === 0 || soloPresenta)) partes.push(texto)
    if (res.stop_reason !== 'tool_use' || usos.length === 0) break
    const resultados: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const u of usos) {
      // Sin saldo para lo que cuesta esta herramienta: no corre, y el dueño ve una línea abajo.
      const costo = siUsa(cuenta, u.name)
      if (costo && costo.total > cuenta.saldo.quedan) {
        cuenta.sinCredito = Math.max(cuenta.sinCredito ?? 0, costo.precio)
        resultados.push({
          type: 'tool_result',
          tool_use_id: u.id,
          is_error: true,
          content: JSON.stringify({ error: 'not-enough-credits', note: 'The owner does not have enough credits this month for this. Do not call it again. A line under your reply tells them when credits renew; answer the rest without it.' }),
        })
        continue
      }
      const estado = ESTADOS[u.name]
      if (estado) opciones.alEstado?.(estado[opciones.idioma])
      const h = HERRAMIENTAS.find((x) => x.name === u.name)
      try {
        const salida = h ? await h.correr((u.input ?? {}) as Record<string, unknown>, ctx) : { error: `unknown tool ${u.name}` }
        if (h) anotarUso(cuenta, u.name, salida)
        resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(salida).slice(0, 20_000) })
      } catch (error) {
        resultados.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: error instanceof Error ? error.message : String(error) })
      }
    }
    mensajes.push({ role: 'user', content: resultados })
    // Si la vuelta solo ofreció opciones, la respuesta ya está: otra vuelta solo
    // agregaba acotaciones como "(aguardando tu respuesta)" y costaba una llamada.
    if (soloOpciones) break
  }

  // Estilo de la casa: sin rayas largas aunque el modelo las use.
  let respuesta = partes.join('\n\n')
  // Acotaciones del modelo ("(aguardando tu respuesta)"): el prompt las prohíbe, pero a veces salen.
  respuesta = respuesta
    .replace(/^[ \t]*[(*_[]+(?:aguardando|esperando|waiting|awaiting)[^()*_[\]\n]{0,60}[)*_\]]+[ \t]*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  respuesta = respuesta.replace(/\s+—\s+/g, ': ').replace(/—/g, ', ')
  // Créditos: lo que paga esta respuesta, y una línea si algo no alcanzó o si ya va por el 80 %.
  const cargo = cargoDeRespuesta(cuenta)
  const despues: Saldo = { ...cuenta.saldo, usados: cuenta.saldo.usados + cargo, quedan: Math.max(0, cuenta.saldo.quedan - cargo) }
  const linea = cuenta.sinCredito
    ? lineaSinCreditos({ costo: cuenta.sinCredito, quedan: despues.quedan, renueva: despues.renueva }, opciones.idioma)
    : cargo > 0
      ? avisoCreditos(despues, opciones.idioma)
      : null
  if (linea) respuesta = [respuesta, linea].filter(Boolean).join('\n\n')
  // El texto de la tarea va tal cual, después de la respuesta: el modelo no lo reescribe.
  if (ctx.anexos.length) respuesta = [respuesta, ...ctx.anexos].filter(Boolean).join('\n\n---\n\n')
  const guardado = await store.addMessage({
    tenantId: tenant.id,
    role: 'assistant',
    text: respuesta || (opciones.idioma === 'es' ? 'No pude terminar la respuesta. Prueba de nuevo.' : 'I could not finish the answer. Try again.'),
    actions: ctx.acciones,
    options: ctx.opciones,
    links: ctx.links.filter((l, i, a) => a.findIndex((x) => x.url === l.url) === i).slice(0, 8),
    channel: canal,
  })
  // Se cobra al final, con la respuesta ya guardada: una que falla antes no paga.
  if (cargo > 0) await anotarCreditos(tenant.id, cargo, cuenta.entregas.length ? cuenta.entregas.map((e) => e.herramienta).join('+') : 'consulta')
  return guardado
}
