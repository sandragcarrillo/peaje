import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'
import { PLAN_CADENCES, PLAN_CAPACITIES, PLAN_GOALS, type AgentAction, type AgentMessage, type Tenant } from '@peaje/db'
import { dominioVerificable, slugify, type Chequeo } from '@peaje/shared'
import { store } from '../store.js'
import { validarRuta } from '../rutas.js'
import { MODEL } from '../monitor/reporte.js'
import { generarPlan, medirMetricas, planConAvance } from './plan.js'
import { buscarTareas, medirAhora, tareaPublica } from './router.js'
import { MAX_PROMPTS, resumenCitacion, sugerirPrompts } from '../citacion/medir.js'
import { revisarAcceso } from '../acceso/revisar.js'
// ---- M6 ----
import { tareaConBorrador } from '../ciclo/borrador.js'
import { resultados } from '../ciclo/seguimiento.js'
// ---- M7 ----
import { probarAhora, resultadoPublico } from '../comprador/misterioso.js'

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
/** Tope de mensajes del dueño por mes calendario (Pro a US$29). */
const TOPE_MENSUAL = Number(process.env.AGENT_MONTHLY_MESSAGES ?? 150)
const HISTORIAL = 20
const MAX_VUELTAS = 8

type Herramienta = Anthropic.Messages.Tool & { correr: (input: Record<string, unknown>, ctx: Ctx) => Promise<unknown> }
type Ctx = { tenant: Tenant; idioma: 'es' | 'en'; acciones: AgentAction[]; opciones: string[] }

const numero = (x: unknown) => (typeof x === 'number' ? x : Number(x))

const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'offer_choices',
    description: 'Show 2 to 5 short tappable answers under your message, so the owner can reply with one tap. Use it whenever you ask a question with a small set of likely answers. Each choice under 8 words, written as the owner would say it.',
    input_schema: { type: 'object', properties: { choices: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 } }, required: ['choices'] },
    async correr(i, ctx) {
      ctx.opciones = (Array.isArray(i.choices) ? i.choices : []).map((c) => String(c).slice(0, 80)).slice(0, 5)
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
        plan: tenant.plan,
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
      const goal = PLAN_GOALS.find((g) => g === i.goal)
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
        summary: { type: 'string', description: 'One line: why it matters' },
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
    description: 'Whether answer engines (ChatGPT, Perplexity, Gemini, Claude) cite the site for the tracked questions: share overall and by engine, per question, versus the previous round, and which domains appear instead. Also lists the tracked questions and which engines are configured.',
    input_schema: { type: 'object', properties: {} },
    async correr(_i, { tenant }) {
      const [prompts, resumen] = await Promise.all([store.listCitationPrompts(tenant.id), resumenCitacion(tenant)])
      return { trackedQuestions: prompts.map((p) => ({ id: p.id, text: p.text })), ...resumen }
    },
  },
  {
    name: 'manage_questions',
    description: `Change the questions Peaje asks AI assistants for this business (max ${MAX_PROMPTS}). Peaje picks them itself when the plan is built; only use this when the owner asks to add or drop one, or to regenerate them. Questions must not include the business name.`,
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
      const nuevos = textos.filter((t) => !vistos.has(t.toLowerCase())).slice(0, Math.max(0, MAX_PROMPTS - actuales.length))
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
        const html = await res.text()
        const texto = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        return { status: res.status, url: `https://${dominio}${path}`, text: texto.slice(0, 6_000) }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    },
  },
]

// ---- M6: borrador completo de página y resultados del ciclo ----
HERRAMIENTAS.push(
  {
    name: 'draft_page',
    description:
      'Write the complete page (markdown) that answers one question customers ask AI assistants, from the facts on the site: the exact question as title, the direct answer first, a real number with its source, 3 to 5 follow-up sections, a visible updated date and sources. Missing facts come out as [TODO: ...]. Saves it as a content task for their developer or AI coding tool (creates it or updates an open one) and returns its id and title. Takes about a minute and costs money: only when the owner wants the page.',
    input_schema: { type: 'object', properties: { question: { type: 'string', description: 'The exact question, in the language of the site' } }, required: ['question'] },
    async correr(i, { tenant }) {
      const pregunta = String(i.question ?? '').trim()
      if (pregunta.length < 8) return { error: 'question is too short' }
      const r = await tareaConBorrador(tenant, pregunta)
      if (!r.created && !r.updated) return { id: r.task.id, title: r.task.title, status: r.task.status, note: 'A task for this question already exists and is past "open"; the draft was not changed.' }
      return { id: r.task.id, title: r.task.title, created: r.created, missingFacts: r.todos, excerpt: r.task.body.split('\n## Draft\n')[1]?.slice(0, 600) }
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
    'Your job: help them get recommended by AI assistants (ChatGPT, Claude, Perplexity, Gemini) when people ask about what they offer, and sell more to AI agents that pay for their data or API. When you name them, say "AI assistants like ChatGPT, Claude or Perplexity", never "ChatGPT and company". Answer with their real data: call tools before claiming anything about the business. Never invent numbers.',
    '',
    'How you talk:',
    '- Like a warm, sharp person who knows this field, talking to someone who does not. Plain words. Short sentences. One idea at a time.',
    '- No jargon unless they use it first: say "things Peaje checks on your site" instead of "checks", "the payment step" instead of "402", "your developer or AI coding tool" instead of "coding agent", "sources the AI links to" instead of "citations".',
    '- Do not open with a pile of numbers. Lead with what matters for them in one sentence; bring in a number only when it supports the point.',
    '- Keep messages under 40 words by default. The only long message is the finished plan.',
    '- Ask at most one question per message. Every message that ends in a question must also call offer_choices (2 to 5 short answers in their language, the last one a "something else" style option, or a yes/no pair), so they can tap instead of typing.',
    '- Numbers come after you know their goal, one at a time, each tied to what to do about it.',
    '- Before suggesting something, check list_tasks (including dismissed): never repeat a suggestion they already dismissed.',
    '- No hype, no filler, no em dashes, no bold headings in short answers.',
    '',
    primeraVez
      ? 'This is your first conversation with them. Open with two or three sentences: who you are in one line, one specific thing you noticed on their site (read it first with read_site_page), and your first question. Do not list what you can do.'
      : '',
    tienePlan
      ? 'The owner already has a plan (get_plan). Keep answers tied to it.'
      : [
          'The owner has no plan yet. When they ask for a plan, or ask what to do, run a short friendly onboarding, one question per message, each with offer_choices:',
          '  1. Start with: before you build their plan, you want to understand three things. Then ask what they want first: that AI assistants like ChatGPT, Claude or Perplexity recommend them, that AI agents pay to use their data or API, or both.',
          '  2. Then: what people should find them for, in their own words (offer 2 or 3 guesses based on their site, read it with read_site_page, plus "something else").',
          '  3. Then: who can make changes to the site: they publish pages themselves, they have a developer or an AI coding tool, or they only want to adjust settings in Peaje.',
          '  4. Then: how often they want to hear from you: every week, every two weeks, only when they ask.',
          '  Before calling build_plan, write one short line saying you are building their plan now and it takes about half a minute. Then call build_plan and present it simply: one sentence on where they stand, then the steps as a short numbered list in plain words, each with what changes when it is done. End with the first thing to do this week, and one line saying you are also checking what AI assistants answer when customers ask about this, with results on this page in a few minutes. Do not show metric names.',
        ].join('\n'),
    '',
    'What actually works, with evidence: being mentioned on other sites (Reddit threads, YouTube, "best X" lists hold most of what AI assistants cite), pages whose title is the exact question with a direct answer, a concrete number and a source, being indexed by Bing (ChatGPT search leans on it), visible recent dates, and not blocking the AI bots. llms.txt and JSON-LD barely move recommendations; do not sell them for that. For agent sales, most unpaid attempts fail for technical reasons, not price: fix the payment step and the descriptions before touching price.',
    'For "why am I not recommended", use get_citations: where they are and are not cited, which sites show up instead, and one concrete next move. If nothing was measured yet, offer to run the check.',
    'You cannot change the site or Peaje on your own. Site changes become tasks (create_task) for their developer or AI coding tool. Route and price changes are proposals (propose_route_change) the owner approves under your message. Never say something changed when it was only proposed.',
    // M6: borrador y resultados
    'When the owner wants a page for a question, use draft_page (not create_task): it writes the full page from their site and saves it as a task. Tell them what facts are missing, if any. For "did it work?" or "what changed?", use get_results: Peaje measures again 2 and 6 weeks after each verified task.',
    // M7: comprador misterioso
    'For "do agents pick me?", "why does nobody pay?" or "would an agent buy from me?", use get_mystery_results, or run_mystery_shopper if it never ran or the owner asks to test now. Lead with the verdict in one sentence (found or not, picked or not, and who won instead), then the one fix that matters most.',
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
  check_site_access: { es: 'Entrando a tu sitio como lo hacen ChatGPT, Perplexity y Google…', en: 'Opening your site the way ChatGPT, Perplexity and Google do…' },
  manage_questions: { es: 'Ajustando las preguntas que medimos…', en: 'Updating the questions we track…' },
  run_citation_check: { es: 'Preguntándole a ChatGPT, Claude y los demás (1 a 3 minutos)…', en: 'Asking ChatGPT, Claude and the others (1 to 3 minutes)…' },
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
})
// ---- fin M7 ----

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
  opciones: { idioma: 'es' | 'en'; canal?: string; alEstado?: (estado: string) => void },
): Promise<AgentMessage> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  if (!dentroDelLimite(tenant.id)) throw new Error(opciones.idioma === 'es' ? 'Muchos mensajes en esta hora. Prueba en un rato.' : 'Too many messages this hour. Try again later.')
  const inicioMes = new Date()
  inicioMes.setUTCDate(1)
  inicioMes.setUTCHours(0, 0, 0, 0)
  if ((await store.countUserMessagesSince(tenant.id, inicioMes.toISOString())) >= TOPE_MENSUAL) {
    throw new Error(
      opciones.idioma === 'es'
        ? `Llegaste a los ${TOPE_MENSUAL} mensajes de este mes. El agente sigue trabajando solo (medición, tareas, correo) y el chat vuelve el 1 del mes.`
        : `You reached the ${TOPE_MENSUAL} messages for this month. The agent keeps working on its own (tracking, tasks, email) and the chat comes back on the 1st.`,
    )
  }
  const canal = opciones.canal ?? 'dashboard'
  const previos = await store.listMessages(tenant.id, HISTORIAL)
  await store.addMessage({ tenantId: tenant.id, role: 'user', text: texto.slice(0, 4_000), channel: canal })

  const mensajes: Anthropic.Messages.MessageParam[] = [
    ...previos.map((m) => ({ role: m.role, content: m.text || '(empty)' }) as Anthropic.Messages.MessageParam),
    { role: 'user', content: texto.slice(0, 4_000) },
  ]
  const ctx: Ctx = { tenant, idioma: opciones.idioma, acciones: [], opciones: [] }
  const tienePlan = (await store.getPlan(tenant.id)) !== null
  anthropic ??= new Anthropic()

  // El texto de todas las vueltas: el modelo suele escribir la pregunta y
  // después llamar offer_choices; quedarse con la última vuelta la perdía.
  const partes: string[] = []
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const res = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 8_000,
      // Caché de prompt: instrucciones y herramientas son iguales en cada vuelta
      // y cada mensaje; se cobran a una fracción después de la primera.
      system: [{ type: 'text', text: sistema(tenant, opciones.idioma, tienePlan, previos.length === 0), cache_control: { type: 'ephemeral' } }],
      tools: HERRAMIENTAS.map(({ correr: _c, ...t }, i, todas) => (i === todas.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t)),
      messages: mensajes,
    })
    mensajes.push({ role: 'assistant', content: res.content })
    const usos = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
    const texto = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (texto) partes.push(texto)
    if (res.stop_reason !== 'tool_use' || usos.length === 0) break
    const resultados: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const u of usos) {
      const estado = ESTADOS[u.name]
      if (estado) opciones.alEstado?.(estado[opciones.idioma])
      const h = HERRAMIENTAS.find((x) => x.name === u.name)
      try {
        const salida = h ? await h.correr((u.input ?? {}) as Record<string, unknown>, ctx) : { error: `unknown tool ${u.name}` }
        resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(salida).slice(0, 20_000) })
      } catch (error) {
        resultados.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: error instanceof Error ? error.message : String(error) })
      }
    }
    mensajes.push({ role: 'user', content: resultados })
  }

  // Estilo de la casa: sin rayas largas aunque el modelo las use.
  let respuesta = partes.join('\n\n')
  respuesta = respuesta.replace(/\s+—\s+/g, ': ').replace(/—/g, ', ')
  return store.addMessage({
    tenantId: tenant.id,
    role: 'assistant',
    text: respuesta || (opciones.idioma === 'es' ? 'No pude terminar la respuesta. Prueba de nuevo.' : 'I could not finish the answer. Try again.'),
    actions: ctx.acciones,
    options: ctx.opciones,
    channel: canal,
  })
}
