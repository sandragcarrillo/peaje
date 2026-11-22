import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PAGE_FORMATS, type AgentTask, type PageFormat, type Tenant, type Verificacion } from '@peaje/db'
import { formatosCitados, type FormatosCitados } from '../citacion/formatos.js'
import { paginasDelSitio } from '../acceso/revisar.js'
import { asistentesMedidos, dominioVerificable, type Chequeo } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { env } from '../env.js'
import { TEXTO_MOTIVO } from './email.js'
import { planConAvance } from '../tareas/plan.js'
import { resumenCitacion } from '../citacion/medir.js'
// ---- M6 ----
import { resultados } from '../ciclo/seguimiento.js'
import { lasDeLaSemana, ordenar, type Propuesta } from '../tareas/prioridad.js'
import { tarjetaTarea } from '../tareas/tarjetas.js'

/**
 * El reporte semanal del agente de Peaje para un negocio: estado técnico con
 * el arreglo listo, score y su delta, pagos y visitas de la semana, y qué
 * contenido crear para que los motores de respuesta lo citen.
 */

export type Reporte = {
  dominio: string
  /** Cobros a agentes fuera de prueba (env.cobrosVisibles). Sin eso el correo no habla de pagos. */
  cobros: boolean
  kitUrl: string
  comando: string
  chequeosOk: number
  chequeosTotal: number
  fallando: { id: string; motivo: string; texto: string; detalle: string[] }[]
  idioma: 'es' | 'en'
  /** Lo que Peaje propone trabajar esta semana: pocas, ordenadas, con la evidencia y su enlace. Vacío: todo en orden. */
  semana: (Propuesta & { url: string })[]
  score: number | null
  scorePrevio: number | null
  previaAt: string | null
  pagos: { count: number; revenue: string; porRuta: { path: string; count: number; revenue: string }[] }
  visitas: { total: number; pagadas: number; bots: string[] } | null
  /** `formato` y `modelo`: el tipo de página que la IA cita para esa pregunta y una citada para imitar. */
  contenido: { pregunta: string; respuesta: string; porQue: string; fuente: string; formato?: PageFormat; modelo?: string }[]
  /** Tareas abiertas para el coding agent del dueño, y dónde verlas. */
  tareas: { titulo: string; tipo: string; estado: string }[]
  agenteUrl: string
  /** Avance del plan del dueño, paso por paso. Null si todavía no armó plan. */
  citacion: { share: number | null; previa: number | null; competidores: string[]; medido: string | null } | null
  plan: { resumen: string; pasos: { titulo: string; metrica: string; antes: number | null; ahora: number | null; meta: number; hecho: boolean; avance: string }[] } | null
  // ---- M6: qué se publicó o arregló y qué movió (seguimientos a 2 y 6 semanas) ----
  movido?: { titulo: string; tipo: string; url: string | null; linea: string }[]
  // ---- M7: comprador misterioso (última corrida de la semana) ----
  comprador?: { resumen: string; veredictos: string[]; problemas: string[] } | null
}

const DIAS = 7
export const MODEL = process.env.MONITOR_MODEL ?? 'claude-opus-5'
export const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')

const SugerenciasSchema = z.object({
  paginas: z.array(
    z.object({
      pregunta: z.string(),
      respuesta: z.string(),
      porQue: z.string(),
      /** URL de la página del sitio de donde salió el dato, para que el dueño lo verifique. */
      fuente: z.string(),
      /** El formato de la página, según lo que la IA cita para esa pregunta. */
      formato: z.enum(PAGE_FORMATS),
      /** Una página que la IA ya cita, para imitar su forma. Vacío si no hay evidencia. */
      modelo: z.string(),
    }),
  ),
  /** Propuestas abiertas que ya no encajan con el sitio de hoy: su título exacto, tal como se le pasó. */
  obsoletas: z.array(z.string()),
})

let anthropic: Anthropic | null = null

/** Texto plano de la home y hasta 5 páginas internas, acotado. */
export async function leerSitio(dominio: string): Promise<string> {
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

/** Los formatos citados como texto para el prompt; vacío si todavía no hay mediciones con páginas. */
function evidenciaDeFormatos(f: FormatosCitados | null): string {
  if (!f || f.formats.length === 0) return ''
  const lineas = f.formats.slice(0, 5).map((x) => {
    const ejemplos = x.examples.map((e) => `${e.title ?? e.domain} <${e.url}>`).join('; ')
    return `- ${x.format}: cited ${x.citations} times from ${x.sources} sites. Asked in: ${x.prompts.join(' | ')}. Examples: ${ejemplos || 'none with a URL'}.`
  })
  return `Formats AI assistants cited for this business's questions (last ${f.rounds} measurement rounds, ${f.answers} answers with pages, not counting the business's own site):\n${lineas.join('\n')}\n\n`
}

/** Lo que ya existe, ya está pedido o el dueño descartó: páginas del sitemap y tareas de contenido. Texto para el prompt. */
async function temasCubiertos(tenant: Tenant, dominio: string): Promise<{ texto: string; abiertas: string[] }> {
  const [sitio, tareas] = await Promise.all([
    paginasDelSitio(dominio).catch(() => ({ encontrado: false, paginas: [] })),
    store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done', 'verified', 'dismissed'] }).catch(() => []),
  ])
  const paginas = sitio.paginas.map((p) => p.path).filter((p) => p !== '/')
  // Las de "que te nombren" no son páginas del sitio: no cuentan como tema cubierto.
  const deContenido = tareas.filter((t) => t.kind === 'content' && !t.key.startsWith('content:mention:'))
  const planeadas = deContenido.map((t) => t.title)
  // Las que el dueño todavía no tocó: se vuelven a mirar contra el sitio de hoy.
  const abiertas = deContenido.filter((t) => t.status === 'open').map((t) => t.title)
  const texto = [
    paginas.length ? `Pages the site already has (${paginas.length}):\n${paginas.map((p) => `- ${p}`).join('\n')}\n\n` : '',
    planeadas.length ? `Pages already planned, published through Peaje or turned down by the owner:\n${planeadas.map((t) => `- ${t}`).join('\n')}\n\n` : '',
    abiertas.length ? `Open proposals the owner has not started (re-check these against the site text):\n${abiertas.map((t) => `- ${t}`).join('\n')}\n\n` : '',
  ].join('')
  return { texto, abiertas }
}

/** Las búsquedas de Search Console como texto para el prompt; vacío si no hay conexión. */
function evidenciaDeBusquedas(b: { texto: string; impresiones: number; posicion: number }[] | undefined): string {
  const filas = (b ?? []).filter((x) => x.texto).slice(0, 20)
  if (filas.length === 0) return ''
  return `Google searches where this site was shown in the last 28 days (Search Console):\n${filas.map((x) => `- "${x.texto}": ${x.impresiones} impressions, average position ${x.posicion}`).join('\n')}\n\n`
}

export async function sugerirContenido(tenant: Tenant, dominio: string, evidencia: { busquedas?: { texto: string; impresiones: number; posicion: number }[] } = {}): Promise<Reporte['contenido']> {
  return (await sugerirYRevisar(tenant, dominio, evidencia)).paginas
}

/**
 * Las páginas que conviene crear y, de paso, las propuestas abiertas que ya no encajan con el sitio de hoy.
 * El sitio se lee de nuevo en cada corrida: si el negocio cambió lo que ofrece desde que se propuso una página
 * (por ejemplo, dejó de hablar de algo), esa propuesta sale en `obsoletas` con su título exacto.
 */
export async function sugerirYRevisar(
  tenant: Tenant,
  dominio: string,
  evidencia: { busquedas?: { texto: string; impresiones: number; posicion: number }[] } = {},
): Promise<{ paginas: Reporte['contenido']; obsoletas: string[] }> {
  const nada = { paginas: [], obsoletas: [] }
  if (!process.env.ANTHROPIC_API_KEY) return nada
  try {
    const texto = await leerSitio(dominio)
    if (texto.length < 200) return nada
    const formatos = await formatosCitados(tenant).catch(() => null)
    const yaHechas = await temasCubiertos(tenant, dominio)
    anthropic ??= new Anthropic()
    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: [
        'You advise small businesses on answer-engine optimization: pages that AI assistants such as ' + asistentesMedidos('en') + ' cite when a user asks a question the business can answer. Propose 3 to 5 pages the site does not have yet, each answering one concrete question a customer would type. Be specific to this business; no generic advice. Write in the language of the site. Keep each field short: the question under 15 words, the answer outline under 40 words, the reason under 25 words.',
        'Each page has a format: guide, roundup (best options, top N, alternatives), comparison (X vs Y), research (original data or a benchmark), docs, forum, video, news, product or other.',
        'You also get the pages the site already has (from its sitemap: the URL words say the topic) and the pages already planned or turned down. Never propose a page whose question one of them already answers, whatever the wording or language. Only new topics; if there are fewer than 3, return fewer.',
        'When you are given the Google searches where the site was shown, treat them as real demand: prefer questions close to a search that no existing page answers well (a search ranking past position 10 with no page built for it). Do not propose a page for a search an existing page already targets; improving that page is a separate task.',
        'You may also get open proposals the owner has not started. The site text below is how the site reads today, and it may have changed since they were proposed. Return in "obsoletas" the exact titles of the open proposals that no longer fit: the site no longer offers or talks about what the page would cover, or the facts it would need are gone from the site. Be conservative: when unsure, leave it out of "obsoletas".',
        ...(env.cobrosVisibles
          ? []
          : ['Charging AI agents is not offered to the public right now. Do not propose pages about charging AI agents, paid requests, prices per request, payment protocols or wallets, even if the site text still mentions them, and include in "obsoletas" any open proposal about those topics.']),
        'When you are given the formats AI assistants actually cite for this business\'s questions, prefer the questions where those formats win, pick the format that won for that question, and set "modelo" to the URL of one cited example to emulate. Without that evidence, pick the format that fits the question and leave "modelo" empty. Never put a URL in "modelo" that was not in the evidence.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `Business: ${tenant.name} (${dominio}).\n\n${evidenciaDeFormatos(formatos)}${evidenciaDeBusquedas(evidencia.busquedas)}${yaHechas.texto}Site text:\n\n${texto}\n\nReturn pages with: the exact question as the page title, a two-line outline of the answer, why an answer engine would cite it (entity data, prices, hours, a comparison, a number), the URL of the page on this site where you read the facts you used, the format and the example to emulate. Use only facts that appear in the text; never invent numbers.`,
        },
      ],
      output_config: { format: zodOutputFormat(SugerenciasSchema) },
    })
    const urlsCitadas = new Set(formatos?.formats.flatMap((f) => f.examples.map((e) => e.url)) ?? [])
    // El modelo de ejemplo solo vale si salió de la evidencia: nada de URLs inventadas.
    // Solo valen los títulos que de verdad estaban en la lista de abiertas: el modelo no cierra lo que no se le mostró.
    const abiertas = new Set(yaHechas.abiertas)
    return {
      paginas: (res.parsed_output?.paginas.slice(0, 5) ?? []).map((p) => ({ ...p, modelo: urlsCitadas.has(p.modelo) ? p.modelo : '' })),
      obsoletas: (res.parsed_output?.obsoletas ?? []).filter((t) => abiertas.has(t)),
    }
  } catch (error) {
    console.warn('[monitor] sin sugerencias de contenido', error instanceof Error ? error.message : error)
    return nada
  }
}

/** El idioma en que Peaje le escribe al dueño: el de su plan, o el del chat que conectó. Sin ninguno, inglés. */
export async function idiomaDelDueno(tenant: Tenant): Promise<'es' | 'en'> {
  const plan = await store.getPlan(tenant.id).catch(() => null)
  if (plan?.language) return plan.language.toLowerCase().startsWith('es') ? 'es' : 'en'
  const chats = await store.listTelegramLinks(tenant.id).catch(() => [])
  return chats.some((l) => l.language === 'es') ? 'es' : 'en'
}

/** Las propuestas de la semana con el enlace a cada una, en un idioma. */
export function semanaDe(tenant: Tenant, abiertas: AgentTask[], idioma: 'es' | 'en'): Reporte['semana'] {
  return lasDeLaSemana(abiertas, idioma).map((p) => ({ ...p, url: tarjetaTarea(tenant, { id: p.id, title: p.titulo, kind: p.kind }, idioma).url }))
}

export async function armarReporte(tenant: Tenant, actual: Verificacion, opciones: { conContenido?: boolean; idioma?: 'es' | 'en' } = {}): Promise<Reporte> {
  const dominio = dominioVerificable(tenant.originUrl) ?? tenant.originUrl
  const idioma = opciones.idioma ?? (await idiomaDelDueno(tenant))
  const abiertas = await store.listTasks(tenant.id, { statuses: ['open', 'in_progress', 'done'] }).catch(() => [])
  const chequeos = actual.checks as Chequeo[]
  const fallando = chequeos
    .filter((c) => !c.ok)
    .map((c) => ({ id: c.id, motivo: c.motivo, texto: TEXTO_MOTIVO[c.motivo] ?? c.motivo, detalle: c.faltantes ?? [] }))

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
  // Plan primero (no escribe nada); init solo con el sí del dueño a esa lista.
  const capa = soloAeo && fallando.length > 0 ? ' --only aeo' : ''
  const comando = [
    `npx @peaje/cli@1 plan ${tenant.slug}${capa}   # lists every file it would change, writes nothing`,
    `npx @peaje/cli@1 init ${tenant.slug}${capa} --yes   # only after the owner approves that list`,
  ].join('\n')

  return {
    dominio,
    cobros: env.cobrosVisibles,
    kitUrl: `${DASHBOARD}/t/${tenant.slug}/kit`,
    comando,
    chequeosOk: chequeos.filter((c) => c.ok).length,
    chequeosTotal: chequeos.length,
    fallando,
    idioma,
    semana: semanaDe(tenant, abiertas, idioma),
    score: actual.score,
    scorePrevio: previa?.score ?? null,
    previaAt: historial[1]?.runAt ?? null,
    pagos: { count: pagos.length, revenue: pagos.reduce((s, p) => s + Number(p.amount), 0).toFixed(4), porRuta },
    visitas,
    contenido: opciones.conContenido ? await sugerirContenido(tenant, dominio) : [],
    tareas: ordenar(abiertas)
      .slice(0, 8)
      .map((t) => ({ titulo: t.title, tipo: t.kind, estado: t.status })),
    agenteUrl: `${DASHBOARD}/t/${tenant.slug}/agente`,
    citacion: await resumenCitacion(tenant)
      .then((c) => (c.measuredAt ? { share: c.share, previa: c.previousShare, competidores: c.competitors.slice(0, 5).map((x) => x.domain), medido: c.measuredAt } : null))
      .catch(() => null),
    plan: await planConAvance(tenant)
      .then((p) =>
        p
          ? { resumen: p.summary, pasos: p.steps.map((s) => ({ titulo: s.title, metrica: s.metric, antes: s.baseline, ahora: s.current, meta: s.target, hecho: s.done, avance: s.progress })) }
          : null,
      )
      .catch(() => null),
    // ---- M6 ----
    movido: await lineasMovido(tenant, desde).catch(() => []),
    // ---- M7 ----
    comprador: await store
      .lastMysteryRun(tenant.id)
      .then((r) => (r && new Date(r.runAt).getTime() >= desde && r.summary ? { resumen: r.summary, veredictos: r.missions.map((m) => m.verdict), problemas: r.issues.filter((i) => !i.startsWith("On Peaje's side")) } : null))
      .catch(() => null),
  }
}

// ---- M6: "Qué se movió" en el correo semanal ----
/** Tareas verificadas en la semana y seguimientos con resultado en la semana. */
async function lineasMovido(tenant: Tenant, desde: number): Promise<NonNullable<Reporte['movido']>> {
  const lineas: NonNullable<Reporte['movido']> = []
  for (const r of await resultados(tenant, 30)) {
    const base = { titulo: r.title, tipo: r.kind, url: r.url }
    if (r.verifiedAt && new Date(r.verifiedAt).getTime() >= desde) {
      const proximo = r.checks.find((c) => !c.doneAt)
      lineas.push({ ...base, linea: `Verified on the live site this week.${proximo ? ` Peaje measures again on ${proximo.dueAt.slice(0, 10)}.` : ''}` })
    }
    for (const c of r.checks) if (c.doneAt && new Date(c.doneAt).getTime() >= desde && c.verdict) lineas.push({ ...base, linea: `After ${c.kind === '2w' ? '2' : '6'} weeks: ${c.verdict}` })
  }
  return lineas.slice(0, 10)
}
// ---- fin M6 ----
