import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AgentTask, Tenant } from '@peaje/db'
import { dominioVerificable, slugify } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio, MODEL } from '../monitor/reporte.js'

/**
 * El borrador completo de una página que los asistentes de IA citarían: Opus
 * la escribe en markdown con el texto real del sitio. Lo que no está en el
 * sitio sale como [TODO: ...] para que el dueño lo complete; nunca se inventa.
 *
 * Forma (ver docs/agente-pro.md): H1 = la pregunta literal, respuesta directa
 * primero, un dato propio con su fuente, 3 a 5 secciones autocontenidas con
 * las preguntas que siguen, una línea "Actualizado <mes año>" y fuentes.
 */

/** Tope de borradores nuevos por búsqueda de tareas: cada uno es una llamada a Opus. */
export const MAX_BORRADORES = 3

/** Separa las instrucciones del borrador dentro del cuerpo de la tarea. */
export const MARCA_BORRADOR = '\n## Draft\n'

const BorradorSchema = z.object({
  markdown: z.string(),
  /** Los datos que faltaron en el sitio, uno por placeholder. */
  todos: z.array(z.string()),
})

export type Borrador = { markdown: string; todos: string[] }

let anthropic: Anthropic | null = null

export const slugDePregunta = (pregunta: string) => slugify(pregunta).slice(0, 60) || 'faq'

export async function redactarBorrador(tenant: Tenant, pregunta: string, opts: { sitio?: string; porQue?: string; fuente?: string } = {}): Promise<Borrador> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  const dominio = dominioVerificable(tenant.originUrl)
  const sitio = opts.sitio ?? (dominio ? await leerSitio(dominio).catch(() => '') : '')
  if (sitio.length < 200) throw new Error('Could not read enough of the site to write a draft')
  const hoy = new Date().toISOString().slice(0, 10)
  anthropic ??= new Anthropic()
  const res = await anthropic.messages.parse({
    model: MODEL,
    // Opus razona antes de responder y eso cuenta contra max_tokens.
    max_tokens: 12_000,
    system: [
      'You write one complete web page, in markdown, for a small business. The goal: AI assistants like ChatGPT, Claude or Perplexity cite this page when someone asks the question it answers.',
      'Structure, in this order:',
      '1. H1: the exact question, word for word.',
      '2. First paragraph: the direct answer in 2 or 3 sentences. No preamble.',
      '3. A visible line "Updated <Month YYYY>" (in the language of the page, e.g. "Actualizado: septiembre de 2026").',
      '4. At least one concrete number from the business (a price, a limit, a count, a coverage) and, right next to it, where it comes from (the page of the site where it is stated, linked).',
      '5. 3 to 5 short H2 sections, each titled as a follow-up question a reader would ask next, each answer self-contained (readable alone, 2 to 5 sentences or a short list).',
      '6. A short "Sources" section (in the language of the page) linking the pages of the business\'s own site the facts come from.',
      'Rules: use only facts present in the site text. When a fact the page needs is missing, write a clearly marked placeholder like [TODO: confirm price] instead of inventing it, and list each one in "todos". Never invent numbers, names, clients, quotes or dates. Write in the language of the site text. Plain words, short sentences, no hype, no em dashes, no keyword stuffing. Under 700 words.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: `Business: ${tenant.name} (${dominio ?? tenant.originUrl}). Today: ${hoy}.\nQuestion: ${pregunta}\n${opts.porQue ? `Why an AI assistant would cite it: ${opts.porQue}\n` : ''}${opts.fuente ? `Main source page: ${opts.fuente}\n` : ''}\nSite text (each block starts with its URL):\n${sitio.slice(0, 14_000)}`,
      },
    ],
    output_config: { format: zodOutputFormat(BorradorSchema) },
  })
  if (res.stop_reason === 'max_tokens') throw new Error('The draft came back cut off')
  const salida = res.parsed_output
  if (!salida?.markdown.trim()) throw new Error('The model did not return a draft')
  // El H1 es siempre la pregunta literal, aunque el modelo la reformule.
  const cuerpo = salida.markdown.trim().replace(/^#\s+[^\n]*\n+/, '')
  return { markdown: `# ${pregunta}\n\n${cuerpo}\n`, todos: salida.todos }
}

/** El cuerpo de una tarea de contenido con borrador: instrucciones cortas + "## Draft" + la página. */
export function cuerpoConBorrador(tenant: Tenant, dominio: string, pregunta: string, slug: string, b: Borrador, porQue?: string): string {
  return [
    `# New page: ${pregunta}`,
    '',
    `AI assistants like ChatGPT, Claude or Perplexity get asked this and ${tenant.name} has no page that answers it. The full page is drafted below from the facts on the site.`,
    '',
    '## What to do',
    '',
    `1. Create the page at \`https://${dominio}/${slug}\` (or the closest slug that fits this site's routing). Title and H1: exactly "${pregunta}".`,
    '2. Use the draft below as the page content, in the site\'s layout and styles. Keep the order: direct answer first, the number with its source, the follow-up sections, the updated date, the sources.',
    b.todos.length
      ? `3. Replace every [TODO: ...] with the real fact, or delete that sentence. Never publish a TODO. Missing: ${b.todos.map((t) => t.replace(/[.\s]+$/, '')).join('; ')}.`
      : '3. Check the facts against the site one last time.',
    "4. Link it from the site's navigation or footer, and add it to the sitemap.",
    '5. Deploy, then mark this task done with the live URL. Peaje checks the page on the live site, then measures at 2 and 6 weeks whether AI assistants cite it.',
    ...(porQue ? ['', `Why an AI assistant would cite it: ${porQue}`] : []),
    MARCA_BORRADOR,
    b.markdown,
  ].join('\n')
}

export const tieneBorrador = (t: Pick<AgentTask, 'body'>) => t.body.includes(MARCA_BORRADOR)

/**
 * Crea o actualiza la tarea de contenido con el borrador completo. La usa la
 * herramienta draft_page del chat. Misma `key` que las sugerencias del
 * monitor, así una pregunta no genera dos tareas.
 */
export async function tareaConBorrador(tenant: Tenant, pregunta: string): Promise<{ task: AgentTask; created: boolean; updated: boolean; todos: string[] }> {
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) throw new Error('The business has no public domain')
  const limpia = pregunta.trim().replace(/\s+/g, ' ').slice(0, 200)
  const slug = slugDePregunta(limpia)
  const key = `content:${slug}`
  const previa = (await store.listTasks(tenant.id)).find((t) => t.key === key)
  // Una tarea que alguien ya tomó, se verificó o se descartó no se pisa.
  if (previa && previa.status !== 'open') return { task: previa, created: false, updated: false, todos: [] }
  const b = await redactarBorrador(tenant, limpia)
  const r = await store.upsertTask({
    tenantId: tenant.id,
    key,
    kind: 'content',
    title: limpia,
    summary: previa?.summary || 'A full page drafted from your site, ready to publish.',
    body: cuerpoConBorrador(tenant, dominio, limpia, slug, b),
    acceptance: [{ type: 'url', url: `https://${dominio}/${slug}` }],
    source: 'chat',
  })
  return { task: r.task, created: r.created, updated: !r.created, todos: b.todos }
}
