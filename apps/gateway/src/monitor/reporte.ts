import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Tenant, Verificacion } from '@peaje/db'
import { dominioVerificable, type Chequeo } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { TEXTO_MOTIVO } from './email.js'

/**
 * El reporte semanal del agente de Peaje para un negocio: estado técnico con
 * el arreglo listo, score y su delta, pagos y visitas de la semana, y qué
 * contenido crear para que los motores de respuesta lo citen.
 */

export type Reporte = {
  dominio: string
  kitUrl: string
  comando: string
  chequeosOk: number
  chequeosTotal: number
  fallando: { id: string; texto: string; detalle: string[] }[]
  score: number | null
  scorePrevio: number | null
  previaAt: string | null
  pagos: { count: number; revenue: string; porRuta: { path: string; count: number; revenue: string }[] }
  visitas: { total: number; pagadas: number; bots: string[] } | null
  contenido: { pregunta: string; respuesta: string; porQue: string; fuente: string }[]
}

const DIAS = 7
const MODEL = process.env.MONITOR_MODEL ?? 'claude-opus-5'
const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://peaje-dashboard.vercel.app').replace(/\/$/, '')

const SugerenciasSchema = z.object({
  paginas: z.array(
    z.object({
      pregunta: z.string(),
      respuesta: z.string(),
      porQue: z.string(),
      /** URL de la página del sitio de donde salió el dato, para que el dueño lo verifique. */
      fuente: z.string(),
    }),
  ),
})

let anthropic: Anthropic | null = null

/** Texto plano de la home y hasta 5 páginas internas, acotado. */
async function leerSitio(dominio: string): Promise<string> {
  const limpiar = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const leer = async (url: string) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'peaje-monitor/1.0' } })
      if (!res.ok) return ''
      return await res.text()
    } catch {
      return ''
    }
  }
  const home = await leer(`https://${dominio}/`)
  const links = [...home.matchAll(/href="(\/[a-z0-9\-/]{2,60})"/gi)]
    .map((m) => m[1]!)
    .filter((h) => !/\.(png|jpg|svg|css|js|xml|json)$/i.test(h))
    .filter((h, i, a) => a.indexOf(h) === i)
    .slice(0, 5)
  const paginas = await Promise.all(links.map((l) => leer(`https://${dominio}${l}`)))
  return [
    `[https://${dominio}/]\n${limpiar(home).slice(0, 6_000)}`,
    ...paginas.map((p, i) => `[https://${dominio}${links[i]}]\n${limpiar(p).slice(0, 1_500)}`),
  ]
    .join('\n\n')
    .slice(0, 14_000)
}

export async function sugerirContenido(tenant: Tenant, dominio: string): Promise<Reporte['contenido']> {
  if (!process.env.ANTHROPIC_API_KEY) return []
  try {
    const texto = await leerSitio(dominio)
    if (texto.length < 200) return []
    anthropic ??= new Anthropic()
    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system:
        'You advise small businesses on answer-engine optimization: pages that ChatGPT, Perplexity and Google AI Overviews cite when a user asks a question the business can answer. Propose 3 to 5 question-and-answer pages the site does not have yet, each answering one concrete question a customer would type. Be specific to this business; no generic advice. Write in the language of the site. Keep each field short: the question under 15 words, the answer outline under 40 words, the reason under 25 words.',
      messages: [
        {
          role: 'user',
          content: `Business: ${tenant.name} (${dominio}). Site text:\n\n${texto}\n\nReturn pages with: the exact question as the page title, a two-line outline of the answer, why an answer engine would cite it (entity data, prices, hours, a comparison, a number), and the URL of the page on this site where you read the facts you used. Use only facts that appear in the text; never invent numbers.`,
        },
      ],
      output_config: { format: zodOutputFormat(SugerenciasSchema) },
    })
    return res.parsed_output?.paginas.slice(0, 5) ?? []
  } catch (error) {
    console.warn('[monitor] sin sugerencias de contenido', error instanceof Error ? error.message : error)
    return []
  }
}

export async function armarReporte(tenant: Tenant, actual: Verificacion, opciones: { conContenido?: boolean } = {}): Promise<Reporte> {
  const dominio = dominioVerificable(tenant.originUrl) ?? tenant.originUrl
  const chequeos = actual.checks as Chequeo[]
  const fallando = chequeos
    .filter((c) => !c.ok)
    .map((c) => ({ id: c.id, texto: TEXTO_MOTIVO[c.motivo] ?? c.motivo, detalle: c.faltantes ?? [] }))

  const desde = Date.now() - DIAS * 86_400_000
  const historial = await store.verificationHistory(tenant.id, 60)
  const previa = historial.find((v) => new Date(v.runAt).getTime() <= desde) ?? null

  const pagos = (await store.listPayments(tenant.id, 2_000)).filter((p) => new Date(p.createdAt).getTime() >= desde && !p.refundTx)
  const porRutaMap = new Map<string, { count: number; revenue: number }>()
  for (const p of pagos) {
    const r = porRutaMap.get(p.path) ?? { count: 0, revenue: 0 }
    r.count += 1
    r.revenue += Number(p.amount)
    porRutaMap.set(p.path, r)
  }
  const porRuta = [...porRutaMap.entries()]
    .map(([path, r]) => ({ path, count: r.count, revenue: r.revenue.toFixed(4) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  let visitas: Reporte['visitas'] = null
  try {
    const v = await store.visitStats(tenant.id, { days: DIAS })
    const NOMBRE_BOT: Record<string, string> = { 'openai-searchbot': 'ChatGPT', perplexitybot: 'Perplexity', googlebot: 'Google', claudebot: 'Claude', gptbot: 'OpenAI training crawler' }
    const bots = v.byKind.filter((k) => k.kind in NOMBRE_BOT).map((k) => `${NOMBRE_BOT[k.kind]} (${k.visits})`)
    visitas = { total: v.totals.visits, pagadas: v.totals.paid, bots }
  } catch {
    visitas = null
  }

  const soloAeo = fallando.every((f) => f.id === 'json-ld' || f.id === 'robots' || f.id === 'bots')
  const comando = `npx @peaje/cli@1 init ${tenant.slug}${soloAeo && fallando.length > 0 ? ' --only aeo' : ''} --yes`

  return {
    dominio,
    kitUrl: `${DASHBOARD}/t/${tenant.slug}/kit`,
    comando,
    chequeosOk: chequeos.filter((c) => c.ok).length,
    chequeosTotal: chequeos.length,
    fallando,
    score: actual.score,
    scorePrevio: previa?.score ?? null,
    previaAt: historial[1]?.runAt ?? null,
    pagos: { count: pagos.length, revenue: pagos.reduce((s, p) => s + Number(p.amount), 0).toFixed(4), porRuta },
    visitas,
    contenido: opciones.conContenido ? await sugerirContenido(tenant, dominio) : [],
  }
}
