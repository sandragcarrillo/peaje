import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PAGE_FORMATS, type AgentTask, type PageFormat, type Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio } from '../monitor/reporte.js'
import { formatosCitados, type FormatosCitados } from '../citacion/formatos.js'
import { lineasDeFormato } from '../tareas/generar.js'
import { cuerpoConBorrador, preguntasPendientes, redactarBorrador, slugDePregunta, type Borrador } from './borrador.js'
import type { RevisionVoz } from './revision-voz.js'
import { perfilDeVoz } from './voz.js'

/**
 * Una serie de páginas sobre un tema ("hub and spokes"): una página principal
 * que lo explica completo y 3 a 5 páginas que contestan cada una una pregunta
 * concreta, enlazadas entre sí. Así la IA encuentra una respuesta para cada
 * variante de la pregunta y todas apuntan a la principal.
 *
 * El formato de cada página sale de lo que la IA ya cita para las preguntas
 * del negocio (citacion/formatos.ts). Cada página se redacta con
 * redactarBorrador (con la voz del negocio) y queda como una tarea de
 * contenido, con los links entre páginas anotados en la tarea.
 *
 * Corre como el trabajo 'page_series' (tareas/trabajos.ts): tarda unos minutos.
 */

const PLAN_MODEL = process.env.AGENT_MODEL ?? 'claude-sonnet-5'
/** Borradores a la vez: cada uno es una llamada a Opus de un minuto. */
const PARALELO = 3
export const MIN_SPOKES = 3
export const MAX_SPOKES = 5

const PaginaSchema = z.object({
  pregunta: z.string(),
  porQue: z.string(),
  formato: z.enum(PAGE_FORMATS),
  /** URL de una página que la IA ya cita, para imitar su forma. Vacío si no hay. */
  modelo: z.string(),
})

const PlanSchema = z.object({ hub: PaginaSchema, spokes: z.array(PaginaSchema) })

export type PaginaDeSerie = z.infer<typeof PaginaSchema> & { slug: string; url: string; rol: 'hub' | 'spoke' }
export type PlanDeSerie = { tema: string; hub: PaginaDeSerie; spokes: PaginaDeSerie[] }

export type ResultadoSerie = {
  tema: string
  hub: PaginaCreada | null
  spokes: PaginaCreada[]
  /** Páginas que no se pudieron redactar. */
  fallidas: { pregunta: string; error: string }[]
}

/** `todos`: una pregunta por [TODO] de la página. `revision`: lo que limpió la revisión de voz (solo las redactadas ahora). */
export type PaginaCreada = {
  taskId: string
  title: string
  url: string
  rol: 'hub' | 'spoke'
  formato: PageFormat
  created: boolean
  updated: boolean
  todos: string[]
  status: AgentTask['status']
  revision?: RevisionVoz
}

let anthropic: Anthropic | null = null

function evidencia(f: FormatosCitados | null): string {
  if (!f || f.formats.length === 0) return 'No citation evidence yet: pick the format that fits each question and leave "modelo" empty.'
  return [
    `Formats AI assistants cited for this business's questions (last ${f.rounds} rounds, ${f.answers} answers, the business's own site excluded):`,
    ...f.formats.slice(0, 6).map((x) => `- ${x.format}: ${x.citations} citations from ${x.sources} sites. Asked in: ${x.prompts.join(' | ')}. Examples: ${x.examples.map((e) => e.url).join(' ') || 'none with a URL'}`),
  ].join('\n')
}

/** Planea la serie: la página principal y de 3 a 5 preguntas concretas, cada una con su formato. */
export async function planearSerie(tenant: Tenant, tema: string, ctx: { sitio: string; formatos: FormatosCitados | null; existentes?: string[]; preguntasMedidas?: string[]; idioma?: string | null }): Promise<PlanDeSerie> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) throw new Error('The business has no public domain')
  anthropic ??= new Anthropic()
  const res = await anthropic.messages.parse({
    model: PLAN_MODEL,
    max_tokens: 3_000,
    system: [
      'You plan a small series of web pages on one topic for a small business, so AI assistants like ChatGPT, Claude or Perplexity cite it for every variant of the question.',
      '- hub: one main page that answers the topic as a whole. Its "pregunta" is the broad question a customer would type.',
      `- spokes: ${MIN_SPOKES} to ${MAX_SPOKES} pages, each answering one concrete, narrower question a customer would type next (a price, a comparison, a how-to, a who-is-it-for). No overlap between them or with the hub.`,
      '- Each page gets a format: guide, roundup, comparison, research, docs, forum, video, news, product or other. Prefer the formats that the citation evidence shows winning for similar questions; otherwise pick the one that fits. Avoid video and forum: the business publishes these on its own site.',
      '- "modelo": the URL of one cited example to emulate, copied from the evidence, or empty. Never a URL that is not in the evidence.',
      '- "porQue": one short sentence on why an AI assistant would cite that page, grounded in the business.',
      '- Only questions this business can answer with facts on its site. Do not repeat a page the business already has a task for.',
      'Write the questions in the language of the site, even when the topic is written in another language: the pages live on that site. Each question under 15 words. Plain words, no hype.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Business: ${tenant.name} (${dominio}).`,
          `Topic: ${tema}`,
          ctx.idioma ? `Site language: ${ctx.idioma}` : '',
          ctx.preguntasMedidas?.length ? `Questions Peaje measures for this business:\n${ctx.preguntasMedidas.slice(0, 15).map((q) => `- ${q}`).join('\n')}` : '',
          ctx.existentes?.length ? `Pages that already have a task (do not repeat):\n${ctx.existentes.slice(0, 30).map((q) => `- ${q}`).join('\n')}` : '',
          evidencia(ctx.formatos),
          `Site text:\n${ctx.sitio.slice(0, 10_000)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    output_config: { format: zodOutputFormat(PlanSchema) },
  })
  const plan = res.parsed_output
  if (!plan) throw new Error('The model did not return a plan for the series')
  const urlsCitadas = new Set(ctx.formatos?.formats.flatMap((f) => f.examples.map((e) => e.url)) ?? [])
  const usados = new Set<string>()
  const pagina = (p: z.infer<typeof PaginaSchema>, rol: 'hub' | 'spoke'): PaginaDeSerie | null => {
    const pregunta = p.pregunta.trim().replace(/\s+/g, ' ').slice(0, 200)
    if (pregunta.length < 8) return null
    const slug = slugDePregunta(pregunta)
    if (usados.has(slug)) return null
    usados.add(slug)
    return { ...p, pregunta, modelo: urlsCitadas.has(p.modelo) ? p.modelo : '', slug, url: `https://${dominio}/${slug}`, rol }
  }
  const hub = pagina(plan.hub, 'hub')
  if (!hub) throw new Error('The plan came back without a main page')
  const spokes = plan.spokes.map((s) => pagina(s, 'spoke')).filter((s): s is PaginaDeSerie => !!s).slice(0, MAX_SPOKES)
  if (spokes.length < MIN_SPOKES) throw new Error(`The plan came back with ${spokes.length} pages; a series needs at least ${MIN_SPOKES}`)
  return { tema, hub, spokes }
}

/** Las líneas "- Series ..." de la tarea: con qué páginas se enlaza esta. */
export function lineasDeSerie(p: PaginaDeSerie, plan: PlanDeSerie): string[] {
  const otras = plan.spokes.filter((s) => s.slug !== p.slug)
  if (p.rol === 'hub') {
    return [
      `- Series: this is the main page of the series "${plan.tema}". Link every page below from it, and each of them links back here.`,
      ...plan.spokes.map((s) => `- Series page: "${s.pregunta}" at ${s.url}`),
    ]
  }
  return [
    `- Series: this page is part of "${plan.tema}". Link back to the main page, and to the other pages where they fit.`,
    `- Series main page: "${plan.hub.pregunta}" at ${plan.hub.url}`,
    ...otras.map((s) => `- Series page: "${s.pregunta}" at ${s.url}`),
  ]
}

/** Corre `fn` sobre la lista con `n` a la vez, en orden. */
async function enTandas<T, R>(lista: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(lista.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, lista.length) }, async () => {
      while (i < lista.length) {
        const k = i++
        salida[k] = await fn(lista[k]!)
      }
    }),
  )
  return salida
}

/**
 * Planea, redacta y guarda la serie. Una página que ya tiene tarea más allá
 * de "open" (tomada, hecha o descartada) no se toca: queda enlazada igual.
 */
export async function crearSerie(tenant: Tenant, tema: string, opts: { alAvanzar?: (texto: string) => void } = {}): Promise<ResultadoSerie> {
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) throw new Error('The business has no public domain')
  const limpio = tema.trim().replace(/\s+/g, ' ').slice(0, 200)
  if (limpio.length < 3) throw new Error('topic is too short')
  const sitio = await leerSitio(dominio).catch(() => '')
  if (sitio.length < 200) throw new Error('Could not read enough of the site to write the series')
  const [formatos, tareas, preguntas, voz] = await Promise.all([
    formatosCitados(tenant).catch(() => null),
    store.listTasks(tenant.id).catch((): AgentTask[] => []),
    store.listCitationPrompts(tenant.id).catch(() => []),
    perfilDeVoz(tenant, { sitio }).catch(() => null),
  ])
  const porClave = new Map(tareas.map((t) => [t.key, t]))
  const plan = await planearSerie(tenant, limpio, {
    sitio,
    formatos,
    existentes: tareas.filter((t) => t.kind === 'content' && t.status !== 'dismissed').map((t) => t.title),
    preguntasMedidas: preguntas.map((p) => p.text),
    idioma: voz?.language ?? null,
  })
  opts.alAvanzar?.(`plan: ${plan.hub.pregunta} + ${plan.spokes.length}`)

  const paginas = [plan.hub, ...plan.spokes]
  const fallidas: ResultadoSerie['fallidas'] = []
  const creadas = await enTandas(paginas, PARALELO, async (p): Promise<PaginaCreada | null> => {
    const key = `content:${p.slug}`
    const previa = porClave.get(key)
    const base = { url: p.url, rol: p.rol, formato: p.formato }
    if (previa && previa.status !== 'open') return { ...base, taskId: previa.id, title: previa.title, created: false, updated: false, todos: [], status: previa.status }
    const relacionadas = (p.rol === 'hub' ? plan.spokes : [plan.hub, ...plan.spokes.filter((s) => s.slug !== p.slug)]).map((r) => ({ pregunta: r.pregunta, url: r.url, rol: r.rol }))
    let b: Borrador
    try {
      b = await redactarBorrador(tenant, p.pregunta, { sitio, voz, porQue: p.porQue, formato: p.formato, modelo: p.modelo || undefined, relacionadas })
    } catch (error) {
      fallidas.push({ pregunta: p.pregunta, error: error instanceof Error ? error.message : String(error) })
      return null
    }
    const r = await store.upsertTask({
      tenantId: tenant.id,
      key,
      kind: 'content',
      title: p.pregunta,
      summary: p.porQue.slice(0, 300),
      body: cuerpoConBorrador(tenant, dominio, p.pregunta, p.slug, b, p.porQue, lineasDeFormato({ formato: p.formato, modelo: p.modelo || undefined }), lineasDeSerie(p, plan)),
      acceptance: [{ type: 'url', url: p.url }],
      source: 'series',
    })
    opts.alAvanzar?.(`draft: ${p.pregunta}`)
    return { ...base, taskId: r.task.id, title: r.task.title, created: r.created, updated: !r.created, todos: preguntasPendientes(b), status: r.task.status, revision: b.revision }
  })
  const [hub = null, ...spokes] = creadas
  return { tema: limpio, hub, spokes: spokes.filter((s): s is PaginaCreada => !!s), fallidas }
}

