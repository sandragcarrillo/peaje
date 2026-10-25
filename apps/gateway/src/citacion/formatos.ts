import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PAGE_FORMATS, type CitationRun, type CitedPage, type PageFormat, type Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import type { Pagina } from './motores.js'

/**
 * Qué tipo de página cita la IA para las preguntas de un negocio: guías,
 * rankings de "los mejores", comparaciones, investigación con datos... Sale de
 * las páginas citadas en cada ronda de medición (URL y título). El formato es
 * lo que el dueño tiene que imitar en su propio sitio: el plan de contenido y
 * los borradores lo usan, y el dashboard lo muestra con ejemplos.
 *
 * La clasificación va primero por reglas (dominio, ruta, palabras del título),
 * que cubren casi todo sin costo. Lo que queda sin formato va en un solo
 * pedido a un modelo barato por ronda. Gemini no da la página, solo el
 * dominio: esas filas cuentan para competidores pero no tienen formato.
 */

const MODELO = process.env.CITATION_CLASSIFY_MODEL ?? 'claude-haiku-4-5'
let anthropic: Anthropic | null = null

const VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/
const FORO = /(^|\.)(reddit\.com|quora\.com|stackoverflow\.com|stackexchange\.com|news\.ycombinator\.com|discord\.com|discourse\.org)$|^(community|forum|forums)\./
const NOTICIAS = /(^|\.)(techcrunch\.com|reuters\.com|bloomberg\.com|coindesk\.com|cointelegraph\.com|theblock\.co|decrypt\.co|forbes\.com|cnbc\.com|theverge\.com|wired\.com)$/

/** Formato por reglas; null si no alcanza para decidir. */
export function formatoPorReglas(p: { url: string | null; title: string | null; domain: string }): PageFormat | null {
  const titulo = (p.title ?? '').toLowerCase()
  let ruta = ''
  try {
    ruta = p.url ? new URL(p.url).pathname.toLowerCase() : ''
  } catch {
    ruta = ''
  }
  if (VIDEO.test(p.domain)) return 'video'
  if (FORO.test(p.domain) || /\/(r|forum|forums|community|discussions?|questions)\//.test(ruta)) return 'forum'
  if (/^(docs|developers?|api)\./.test(p.domain) || /readthedocs|^github\.com$/.test(p.domain) || /\/(docs|documentation|reference|api-reference)(\/|$)/.test(ruta)) return 'docs'
  if (!titulo && !ruta) return null
  if (/\bvs\.?\b|\bversus\b|\bcompar(e|ed|ison|ing)\b|\bcomparativ[ao]\b/.test(titulo)) return 'comparison'
  if (/\b(best|top|mejores|los \d+|las \d+)\b|\balternatives?\b|\balternativas\b|^\d+ (best|top|ways|tools)/.test(titulo)) return 'roundup'
  if (/\b(report|study|survey|statistics|stats|benchmark|index|research|data shows|estudio|informe|encuesta|estadísticas)\b/.test(titulo)) return 'research'
  if (/\b(how to|guide|guía|tutorial|what is|what are|qué es|cómo|explained|step[- ]by[- ]step|beginner)/.test(titulo)) return 'guide'
  if (NOTICIAS.test(p.domain) || /\/(news|noticias|press)\//.test(ruta)) return 'news'
  if (/^\/([a-z]{2}(-[a-z]{2})?\/?)?$/.test(ruta) || /^\/([a-z]{2}(-[a-z]{2})?\/)?(pricing|precios|product|products|features|plans|planes)(\/|$)/.test(ruta)) return 'product'
  return null
}

const ClasesSchema = z.object({ formats: z.array(z.object({ i: z.number().int(), format: z.enum(PAGE_FORMATS) })) })

/** Formato de las páginas que las reglas no resolvieron, en un solo pedido. */
async function formatoPorModelo(paginas: Pagina[]): Promise<Map<number, PageFormat>> {
  const salida = new Map<number, PageFormat>()
  if (paginas.length === 0 || !process.env.ANTHROPIC_API_KEY) return salida
  anthropic ??= new Anthropic()
  try {
    const res = await anthropic.messages.parse({
      model: MODELO,
      max_tokens: 2_000,
      system: [
        'Classify each web page by its format, from its title and URL only.',
        'guide: explains how to do something or what something is. roundup: a list of options, "best X", "top N", alternatives. comparison: X vs Y. research: original data, a report, a study or a benchmark. docs: product or API documentation. forum: discussion threads. video: a video. news: a news article. product: a product, pricing or landing page. other: anything else.',
      ].join('\n'),
      messages: [{ role: 'user', content: paginas.map((p, i) => `${i}. ${p.title ?? '(no title)'} | ${p.url ?? p.domain}`).join('\n') }],
      output_config: { format: zodOutputFormat(ClasesSchema) },
    })
    for (const f of res.parsed_output?.formats ?? []) if (f.i >= 0 && f.i < paginas.length) salida.set(f.i, f.format)
  } catch (error) {
    // Sin clasificación no se pierde nada: la página queda guardada sin formato.
    console.warn('[formatos]', error instanceof Error ? error.message : error)
  }
  return salida
}

/**
 * Le pone formato a las páginas de una ronda. Una página repetida entre
 * respuestas se clasifica una vez. Las que no tienen URL ni título (Gemini)
 * quedan sin formato.
 */
export async function clasificarPaginas(listas: Pagina[][]): Promise<CitedPage[][]> {
  const porClave = new Map<string, PageFormat | null>()
  const pendientes: Pagina[] = []
  const clave = (p: Pagina) => p.url ?? `${p.domain}|${p.title ?? ''}`
  for (const p of listas.flat()) {
    const k = clave(p)
    if (porClave.has(k)) continue
    const f = p.url || p.title ? formatoPorReglas(p) : null
    porClave.set(k, f)
    if (f === null && (p.url || p.title)) pendientes.push(p)
  }
  const delModelo = await formatoPorModelo(pendientes.slice(0, 120))
  pendientes.slice(0, 120).forEach((p, i) => {
    const f = delModelo.get(i)
    if (f) porClave.set(clave(p), f)
  })
  return listas.map((ps) => ps.map((p) => ({ ...p, format: porClave.get(clave(p)) ?? null })))
}

export type FormatoCitado = {
  format: PageFormat
  /** Veces que una respuesta citó una página de este formato. */
  citations: number
  /** Dominios distintos detrás de esas citas. */
  sources: number
  /** Hasta tres páginas de ejemplo, las más citadas primero. */
  examples: { url: string; title: string | null; domain: string; citations: number }[]
  /** Las preguntas donde apareció este formato, las más frecuentes primero. */
  prompts: string[]
}

export type FormatosCitados = {
  /** Respuestas con páginas leídas (las de Gemini no cuentan: no traen la página). */
  answers: number
  rounds: number
  formats: FormatoCitado[]
}

const esDe = (dominio: string, raiz: string | null) => !!raiz && (dominio === raiz || dominio.endsWith(`.${raiz}`))

/** Junta las páginas citadas de las últimas rondas por formato, sin contar el sitio propio. */
export function agruparFormatos(runs: CitationRun[], raiz: string | null): FormatosCitados {
  const validas = runs.filter((r) => !r.error && r.pages.some((p) => p.url || p.title))
  const grupos = new Map<PageFormat, { citas: number; dominios: Set<string>; paginas: Map<string, { title: string | null; domain: string; citas: number }>; preguntas: Map<string, number> }>()
  for (const r of validas) {
    for (const p of r.pages) {
      if (!p.format || esDe(p.domain, raiz)) continue
      const g = grupos.get(p.format) ?? { citas: 0, dominios: new Set(), paginas: new Map(), preguntas: new Map() }
      g.citas += 1
      g.dominios.add(p.domain)
      if (p.url) {
        const e = g.paginas.get(p.url) ?? { title: p.title, domain: p.domain, citas: 0 }
        e.citas += 1
        g.paginas.set(p.url, e)
      }
      g.preguntas.set(r.promptText, (g.preguntas.get(r.promptText) ?? 0) + 1)
      grupos.set(p.format, g)
    }
  }
  const formats = [...grupos.entries()]
    .map(([format, g]) => ({
      format,
      citations: g.citas,
      sources: g.dominios.size,
      examples: [...g.paginas.entries()]
        .sort((a, b) => b[1].citas - a[1].citas)
        .slice(0, 3)
        .map(([url, e]) => ({ url, title: e.title, domain: e.domain, citations: e.citas })),
      prompts: [...g.preguntas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([q]) => q),
    }))
    .filter((f) => f.format !== 'other')
    .sort((a, b) => b.citations - a.citations)
  return { answers: validas.length, rounds: new Set(validas.map((r) => r.roundId)).size, formats }
}

/** Los formatos citados de las últimas tres rondas del negocio. */
export async function formatosCitados(tenant: Tenant): Promise<FormatosCitados> {
  const runs = await store.listCitationRuns(tenant.id, 3)
  return agruparFormatos(runs, dominioVerificable(tenant.originUrl))
}

/**
 * Cómo se arma cada formato, para el plan de contenido y los borradores. Es
 * lo que tienen en común las páginas de ese tipo que la IA cita.
 */
export const COMO_SE_ARMA: Record<PageFormat, string> = {
  guide: 'An answer-first guide: the direct answer in the first paragraph, question-led headings, step-by-step sections, examples or prompts the reader can reuse, and a visible "last updated" date.',
  roundup: 'A dated "best options" page: a title with the year, clear inclusion criteria, one short verdict per option with pros and cons, and a comparison table. Include the business itself honestly among the options.',
  comparison: 'A head-to-head comparison: who each option is for, a side-by-side table of the facts that decide the choice (price, limits, coverage), and a plain verdict per use case.',
  research: 'A data page: one original data point, benchmark or customer outcome, the method and the date it was measured, and findings written as quotable sentences with numbers.',
  docs: 'Reference documentation: what the endpoint or feature does, a working example request and response, limits and errors, all on one page per task.',
  forum: 'A public question-and-answer thread: the exact question as a heading and a direct, specific answer from the business, with a link to the details.',
  video: 'A short video that answers the question in the first seconds, with a transcript and chapters on the page.',
  news: 'A dated announcement with the facts first: what changed, for whom, since when, and the numbers.',
  product: 'A product or pricing page that states plainly what it does, for whom, what it costs and the limits, in text a reader can quote.',
  other: 'A page that answers the question directly in its first paragraph and shows when it was last updated.',
}
