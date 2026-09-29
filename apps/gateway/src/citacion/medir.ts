import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { randomUUID } from 'node:crypto'
import type { CitationRun, NewCitationRun, Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { leerSitio, MODEL } from '../monitor/reporte.js'
import { MOTORES, motoresDisponibles } from './motores.js'

/**
 * Una ronda de citación: cada pregunta del negocio a cada motor disponible,
 * una vez. Citado = el dominio del negocio está entre las fuentes. Mencionado
 * = el nombre o la marca aparece en el texto. La varianza entre respuestas se
 * lee comparando rondas, no repitiendo la misma pregunta (cuesta 3x).
 */

const PARALELO = 3

/** Tope de preguntas por negocio: 20 (Pro). Cada una cuesta una consulta por motor por ronda. */
export const MAX_PROMPTS = 20

/** El dominio propio sin subdominio de API: api.open-meteo.com cuenta como open-meteo.com. */
function raizDe(tenant: Tenant): string | null {
  return dominioVerificable(tenant.originUrl)
}

function esPropio(dominio: string, raiz: string): boolean {
  return dominio === raiz || dominio.endsWith(`.${raiz}`)
}

function marcas(tenant: Tenant, raiz: string | null): string[] {
  const base = raiz ? raiz.split('.')[0]! : null
  return [tenant.name, base].filter((x): x is string => !!x && x.length >= 4).map((x) => x.toLowerCase())
}

export async function correrRonda(tenant: Tenant): Promise<{ roundId: string; runs: number; engines: string[] }> {
  const prompts = await store.listCitationPrompts(tenant.id)
  const motores = motoresDisponibles()
  if (prompts.length === 0) throw new Error('No prompts yet')
  if (motores.length === 0) throw new Error('No answer engine is configured on the gateway')
  const raiz = raizDe(tenant)
  const nombres = marcas(tenant, raiz)
  const roundId = randomUUID()
  const trabajos = prompts.flatMap((p) => motores.map((m) => ({ p, m })))
  const filas: NewCitationRun[] = []
  for (let i = 0; i < trabajos.length; i += PARALELO) {
    const lote = trabajos.slice(i, i + PARALELO)
    filas.push(
      ...(await Promise.all(
        lote.map(async ({ p, m }): Promise<NewCitationRun> => {
          const base = { tenantId: tenant.id, roundId, promptId: p.id, promptText: p.text, engine: m.id }
          try {
            const r = await m.preguntar(p.text)
            const texto = r.texto.toLowerCase()
            return {
              ...base,
              cited: !!raiz && r.dominios.some((d) => esPropio(d, raiz)),
              mentioned: nombres.some((n) => texto.includes(n)),
              domains: r.dominios.slice(0, 20),
              answerExcerpt: r.texto.slice(0, 600),
              error: null,
            }
          } catch (error) {
            return { ...base, cited: false, mentioned: false, domains: [], answerExcerpt: null, error: (error instanceof Error ? error.message : String(error)).slice(0, 300) }
          }
        }),
      )),
    )
  }
  await store.recordCitationRuns(filas)
  return { roundId, runs: filas.length, engines: motores.map((m) => m.id) }
}

export type ResumenCitacion = {
  measuredAt: string | null
  engines: { id: string; name: string; configured: boolean }[]
  share: number | null
  mentionShare: number | null
  byEngine: { engine: string; cited: number; mentioned: number; total: number }[]
  byPrompt: { prompt: string; engines: Record<string, { cited: boolean; mentioned: boolean; error: boolean }> }[]
  /** Los dominios que aparecen donde el negocio no, con cuántas veces. */
  competitors: { domain: string; count: number }[]
  previousShare: number | null
}

function porRonda(runs: CitationRun[]) {
  const orden = [...new Set(runs.map((r) => r.roundId))]
  return orden.map((id) => runs.filter((r) => r.roundId === id))
}

function cuota(runs: CitationRun[], campo: 'cited' | 'mentioned'): number | null {
  const validas = runs.filter((r) => !r.error)
  return validas.length ? Number((validas.filter((r) => r[campo]).length / validas.length).toFixed(2)) : null
}

export async function resumenCitacion(tenant: Tenant): Promise<ResumenCitacion> {
  const runs = await store.listCitationRuns(tenant.id, 2)
  const [ultima = [], previa = []] = porRonda(runs)
  const raiz = raizDe(tenant)
  const conteo = new Map<string, number>()
  for (const r of ultima) {
    if (r.error || r.cited) continue
    for (const d of r.domains) if (!(raiz && esPropio(d, raiz))) conteo.set(d, (conteo.get(d) ?? 0) + 1)
  }
  const motores = [...new Set(ultima.map((r) => r.engine))]
  const preguntas = [...new Set(ultima.map((r) => r.promptText))]
  return {
    measuredAt: ultima[0]?.runAt ?? null,
    engines: MOTORES.map((m) => ({ id: m.id, name: m.nombre, configured: m.disponible() })),
    share: cuota(ultima, 'cited'),
    mentionShare: cuota(ultima, 'mentioned'),
    byEngine: motores.map((e) => {
      const rs = ultima.filter((r) => r.engine === e && !r.error)
      return { engine: e, cited: rs.filter((r) => r.cited).length, mentioned: rs.filter((r) => r.mentioned).length, total: rs.length }
    }),
    byPrompt: preguntas.map((q) => ({
      prompt: q,
      engines: Object.fromEntries(ultima.filter((r) => r.promptText === q).map((r) => [r.engine, { cited: r.cited, mentioned: r.mentioned, error: !!r.error }])),
    })),
    competitors: [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, count]) => ({ domain, count })),
    previousShare: cuota(previa, 'cited'),
  }
}

const PromptsSchema = z.object({ prompts: z.array(z.string()).min(5).max(20) })
let anthropic: Anthropic | null = null

/**
 * Propone las preguntas a medir: las que un cliente real le haría a ChatGPT y
 * donde este negocio debería aparecer. Salen del objetivo del plan y del sitio.
 */
export async function sugerirPrompts(tenant: Tenant, cantidad = 10): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set on the gateway')
  const [plan, dominio] = [await store.getPlan(tenant.id), raizDe(tenant)]
  const sitio = dominio ? await leerSitio(dominio).catch(() => '') : ''
  anthropic ??= new Anthropic()
  const res = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 6_000,
    system:
      'You write the questions a real customer would type into ChatGPT or Perplexity when looking for what this business offers, to measure whether the business gets recommended. Rules: do not include the business name (we measure whether engines bring it up unprompted); mix discovery questions ("best free weather API for Latin America"), comparisons ("X vs Y"), and concrete jobs ("how do I get hourly forecasts for Bogotá in JSON"); write each in the language its customers would use, mixing Spanish and English if the market is Latin America; under 15 words each.',
    messages: [
      {
        role: 'user',
        content: `Business: ${tenant.name} (${dominio ?? tenant.originUrl}).\nOwner goal: ${plan ? `${plan.goal}: ${plan.goalDetail}` : 'not set'}\n\nSite text:\n${sitio.slice(0, 8000)}\n\nWrite ${cantidad} questions.`,
      },
    ],
    output_config: { format: zodOutputFormat(PromptsSchema) },
  })
  return (res.parsed_output?.prompts ?? []).slice(0, cantidad)
}
