import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { COSTOS_CREDITOS, type Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { buscarTareasDelDueno, tareaPublica, urlValida } from './router.js'
import { completarTarea } from './verificar.js'
import { planConAvance } from './plan.js'
import { conversar } from './agente.js'

/**
 * MCP del dueño: el coding agent del negocio (Claude Code, Cursor, Codex,
 * Lovable) lee las tareas del agente de Peaje y las aplica en el repo, y le
 * puede preguntar al agente lo mismo que el chat (peaje_ask). Nada acá cambia
 * el sitio: Peaje propone, la herramienta del dueño ejecuta, Peaje verifica.
 */
function texto(obj: unknown) {
  return { content: [{ type: 'text' as const, text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] }
}

export function construir(tenant: Tenant): McpServer {
  const dominio = dominioVerificable(tenant.originUrl) ?? tenant.originUrl
  const server = new McpServer(
    { name: `peaje-${tenant.slug}`, version: '1.0.0' },
    {
      instructions: `You are connected to Peaje for ${tenant.name} (${dominio}). Peaje's agent watches how answer engines and AI agents see this business and leaves tasks for you. When the owner asks something about their business (who AI cites instead of them, what to publish next, what else to improve, their visits), call peaje_ask with their question and relay the answer. Start with peaje_plan to see the owner's goal and priorities. Then work through the tasks in this repo: list open tasks, read one with peaje_get_task, implement it here following its prompt, deploy, then call peaje_complete_task with the live URL. Peaje checks the acceptance criteria on the live site. If a task does not make sense for this business, call peaje_dismiss_task with the reason. Never invent facts about the business: use what is in the repo and on the site.`,
    },
  )

  server.registerTool(
    'peaje_status',
    { description: 'Summary for this business: agent-readiness checks, score, open tasks, paid requests in the last 7 days.', inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => {
      const [v, tareas, visitas] = await Promise.all([
        store.lastVerification(tenant.id),
        store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done'] }),
        store.visitStats(tenant.id, { days: 7 }).catch(() => null),
      ])
      const checks = (v?.checks ?? []) as { id: string; ok: boolean }[]
      return texto({
        business: tenant.name,
        domain: dominio,
        checks: { ok: checks.filter((c) => c.ok).length, total: checks.length, failing: checks.filter((c) => !c.ok).map((c) => c.id), measuredAt: v?.runAt ?? null },
        score: v?.score ?? null,
        tasks: { open: tareas.filter((t) => t.status === 'open').length, inProgress: tareas.filter((t) => t.status === 'in_progress').length, waitingVerification: tareas.filter((t) => t.status === 'done').length },
        last7Days: visitas ? { agentRequests: visitas.totals.visits, paid: visitas.totals.paid, revenueUsd: visitas.totals.revenue, funnel: visitas.funnel } : null,
      })
    },
  )

  server.registerTool(
    'peaje_plan',
    { description: "The owner's goal and Peaje's plan for it: steps in priority order, each with a metric, its current value and the target. Read it first to know which tasks matter most.", inputSchema: {}, annotations: { readOnlyHint: true } },
    async () => texto((await planConAvance(tenant)) ?? 'No plan yet. The owner creates it in the Peaje dashboard, "My agent".'),
  )

  server.registerTool(
    'peaje_list_tasks',
    {
      description: 'List the tasks Peaje left for this site. Default: open, in progress and waiting verification.',
      inputSchema: { status: z.enum(['open', 'in_progress', 'done', 'verified', 'dismissed', 'all']).optional().describe('Filter by status') },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => {
      const statuses = !status ? (['open', 'in_progress', 'done'] as const) : status === 'all' ? [] : [status]
      const tasks = await store.listTasks(tenant.id, { statuses: [...statuses] })
      return texto(tasks.map((t) => tareaPublica(t)))
    },
  )

  server.registerTool(
    'peaje_get_task',
    { description: 'Full task: the prompt to implement and the acceptance criteria Peaje will check.', inputSchema: { id: z.string() }, annotations: { readOnlyHint: true } },
    async ({ id }) => {
      const t = await store.getTask(tenant.id, id)
      if (!t) return { ...texto(`No task ${id}`), isError: true }
      return texto(`${t.body}\n\n---\nAcceptance (checked by Peaje on the live site): ${JSON.stringify(t.acceptance)}\nTask id: ${t.id} · status: ${t.status}`)
    },
  )

  server.registerTool(
    'peaje_start_task',
    { description: 'Mark a task as in progress so the owner sees you are on it.', inputSchema: { id: z.string() } },
    async ({ id }) => {
      const t = await store.getTask(tenant.id, id)
      if (!t) return { ...texto(`No task ${id}`), isError: true }
      const r = t.status === 'open' ? await store.updateTask(tenant.id, id, { status: 'in_progress' }) : t
      return texto(tareaPublica(r))
    },
  )

  server.registerTool(
    'peaje_complete_task',
    {
      description: 'Call after the change is deployed. Peaje checks the acceptance criteria on the live site right away; if the deploy is not live yet the task waits and Peaje checks again daily.',
      inputSchema: { id: z.string(), url: z.string().optional().describe('Live URL of the page or route you created, if any') },
    },
    async ({ id, url }) => {
      const t = await store.getTask(tenant.id, id)
      if (!t) return { ...texto(`No task ${id}`), isError: true }
      const r = await completarTarea(tenant, t, urlValida(url), store)
      return texto({ status: r.status, note: r.note })
    },
  )

  server.registerTool(
    'peaje_dismiss_task',
    { description: 'Dismiss a task that does not apply to this business, with the reason.', inputSchema: { id: z.string(), reason: z.string() } },
    async ({ id, reason }) => {
      const t = await store.getTask(tenant.id, id)
      if (!t) return { ...texto(`No task ${id}`), isError: true }
      return texto(tareaPublica(await store.updateTask(tenant.id, id, { status: 'dismissed', note: reason.slice(0, 500) })))
    },
  )

  // El mismo agente del chat y de Telegram, con el mismo historial y los mismos créditos.
  server.registerTool(
    'peaje_ask',
    {
      description:
        `Ask the Peaje agent for this business anything about it: who AI assistants cite instead of it and why, what pages to publish next, what else to improve, its agent visits. Same agent and conversation as the Peaje dashboard chat and Telegram. Answers with the business's real data; links point to full reports in the dashboard. Needs the Pro plan. Talking is free; a reply that looks up data uses ${COSTOS_CREDITOS.consulta} of the owner's monthly credits.`,
      inputSchema: {
        question: z.string().min(1).max(2_000).describe("The owner's question, in their words"),
        language: z.enum(['es', 'en']).optional().describe('Reply language. Default: the language of the question'),
      },
    },
    async ({ question, language }) => {
      const idioma = language ?? (/[¿¡ñáéíóú]|\b(qué|cómo|cuál|dónde|quién|por qué|mis?|tengo|puedo|hay)\b/i.test(question) ? 'es' : 'en')
      try {
        const m = await conversar(tenant, question, { idioma, canal: 'mcp' })
        return texto({ answer: m.text, links: m.links.map((l) => ({ label: l.label, url: l.url })), suggestedReplies: m.options })
      } catch (error) {
        // Sin Pro, el límite por hora o una falla del modelo: el texto ya es para el dueño.
        return { ...texto(error instanceof Error ? error.message : String(error)), isError: true }
      }
    },
  )

  // Con Pro cuesta lo mismo que pedírselo al agente de Peaje en el chat (créditos del mes).
  server.registerTool(
    'peaje_refresh_tasks',
    {
      description: `Ask Peaje to look for new tasks now (failing checks, pages answer engines would cite, routes agents asked for). At most once every 10 minutes. On the Pro plan it uses ${COSTOS_CREDITOS.informe} of the owner's monthly credits, the same as asking in the Peaje chat.`,
      inputSchema: {},
    },
    async () => {
      const r = await buscarTareasDelDueno(tenant, 'en', 'owner-mcp')
      return 'error' in r && r.error === 'not-enough-credits' ? { ...texto(r), isError: true } : texto(r)
    },
  )

  return server
}

export async function handleOwnerMcp(
  tenant: Tenant,
  incoming: import('node:http').IncomingMessage,
  outgoing: import('node:http').ServerResponse,
  body: unknown,
): Promise<void> {
  const server = construir(tenant)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  outgoing.on('close', () => {
    void transport.close()
    void server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(incoming, outgoing, body)
}
