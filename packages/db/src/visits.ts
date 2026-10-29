import type { AgentKind, NewVisit, QuienVisita, VisitStats } from './types'

/** Una visita ya persistida más, si pagó, la wallet que sale del ledger. */
export type VisitRow = NewVisit & { agentWallet?: string | null }

/**
 * Lo que no es la visita de un agente, aunque pase por el gateway:
 * - Nuestras herramientas (verificador, monitor diario, radar) y Ora, el
 *   servicio que calcula el puntaje: OraBot entra cada vez que se mide el sitio.
 * - Lo que lee el propio kit instalado en el sitio del negocio. El proxy pide
 *   el manifest cada minuto por instancia y PeajeHead pide el catálogo y el
 *   agent card cada hora por página, con el user-agent de Node o de Vercel.
 *   Antes se contaban y eran cerca del 75% del total.
 * El gateway no lo guarda; el agregador tampoco cuenta lo que se guardó
 * antes de este filtro, así que las visitas viejas quedan limpias sin borrar.
 */
const UA_PROPIOS = /peaje-verificador|peaje-monitor|PeajeRadar|OraBot/i
const LECTURAS_DEL_KIT = new Set(['/discovery/resources', '/.well-known/agent-card.json'])
const UA_DEL_KIT = /^(node|undici|Vercel Edge Functions|Next\.js Middleware|peaje-kit(\/.*)?)$/i

export function noEsVisita(path: string, ua: string | null | undefined): boolean {
  if (ua && UA_PROPIOS.test(ua)) return true
  // El manifest solo lo lee el kit. El reporte de lecturas lo manda el kit y
  // se registra como la lectura que trae, no como request.
  if (path === '/kit/manifest.json' || path === '/kit/visita') return true
  return LECTURAS_DEL_KIT.has(path) && UA_DEL_KIT.test(ua ?? '')
}

/**
 * Agentes y bots con nombre que no tienen tipo propio en `agent_kind` (ese
 * tipo es un check de la base; agregar uno pide migración). Se reconocen por
 * el user-agent al leer, así que sirven también para las visitas viejas. El
 * nombre es la marca, igual en los dos idiomas.
 */
const AGENTES_CON_NOMBRE: [RegExp, string | ((m: string) => string)][] = [
  [/ChatGPT-User/i, 'ChatGPT (ChatGPT-User)'],
  [/Claude-User/i, 'Claude (Claude-User)'],
  [/Claude-SearchBot/i, 'Claude (Claude-SearchBot)'],
  [/Perplexity-User/i, 'Perplexity (Perplexity-User)'],
  [/claude-code/i, 'Claude Code'],
  [/bingbot/i, 'Bing'],
  [/Applebot/i, 'Apple'],
  [/meta-external\w*/i, 'Meta'],
  [/facebookexternalhit|facebookcatalog/i, 'Facebook'],
  [/LinkedInBot/i, 'LinkedIn'],
  [/Twitterbot/i, 'X'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Slackbot|Slack-ImgProxy/i, 'Slack'],
  [/TelegramBot/i, 'Telegram'],
  [/Discordbot/i, 'Discord'],
  [/Amazonbot/i, 'Amazon'],
  [/DuckAssistBot|DuckDuckBot/i, 'DuckDuckGo'],
  [/Bytespider/i, 'ByteDance'],
  [/CCBot/i, 'Common Crawl'],
  [/MistralAI-User/i, 'Mistral'],
  [/cohere-ai/i, 'Cohere'],
  [/GoogleOther|Google-InspectionTool|Storebot-Google|AdsBot-Google/i, (m) => `Google (${m})`],
  [/AhrefsBot/i, 'Ahrefs'],
  [/SemrushBot/i, 'Semrush'],
  [/YandexBot/i, 'Yandex'],
  [/Baiduspider/i, 'Baidu'],
]

const SCRIPTS = /^(curl|wget|node|undici|python-requests|python-httpx|python-urllib|aiohttp|go-http-client|axios|postmanruntime|okhttp|java|deno|bun|node-fetch|httpie|ruby|php|libwww-perl)\b/i

/**
 * Quién es una visita de tipo `other`, por su user-agent. Primero los que
 * tienen nombre conocido; después cualquiera que se presente como bot o
 * lector (`CreoraPublicReader/1.0`); después scripts y herramientas (curl,
 * node), navegadores (lo más probable, una persona) y el resto por el primer
 * nombre de su user-agent.
 */
export function quienEs(ua: string | null | undefined): QuienVisita {
  const u = (ua ?? '').trim()
  if (!u) return { tipo: 'sin-ua', nombre: null }
  for (const [patron, nombre] of AGENTES_CON_NOMBRE) {
    const m = u.match(patron)
    if (m) return { tipo: 'agente', nombre: typeof nombre === 'string' ? nombre : nombre(m[0]) }
  }
  const bot = u.match(/([A-Za-z][\w.-]*(?:bot|crawler|spider|reader|fetcher))\b/i)
  if (bot?.[1]) return { tipo: 'agente', nombre: bot[1].slice(0, 40) }
  const script = u.match(SCRIPTS)
  if (script?.[1]) return { tipo: 'script', nombre: script[1].toLowerCase() }
  if (/^Mozilla\/5\.0/.test(u) && /(Chrome|Safari|Firefox|Edg)\//.test(u)) return { tipo: 'navegador', nombre: null }
  // "Mozilla/5.0" sin navegador ni bot: alguien que no dice quién es. "Mozilla" no es un nombre.
  if (/^Mozilla\//.test(u)) return { tipo: 'sin-ua', nombre: null }
  return { tipo: 'desconocido', nombre: u.split(/[\s/;(]/)[0]?.slice(0, 40) || u.slice(0, 40) }
}

/**
 * Agrega visitas en memoria. Lo comparten MemoryStore y SupabaseStore: los
 * dos traen las filas de la ventana y las resumen acá, así el panel ve lo
 * mismo con o sin Supabase. Volúmenes de miles de filas por mes: alcanza.
 */
export function aggregateVisits(rows: VisitRow[], days: number, range?: { from: string; to?: string }): VisitStats {
  // Con `range`, la ventana exacta [from, to): la usan los reportes programados.
  const since = range ? new Date(range.from).getTime() : Date.now() - days * 86_400_000
  const until = range?.to ? new Date(range.to).getTime() : Infinity
  const byKind = new Map<AgentKind, { visits: number; paid: number }>()
  const byPath = new Map<string, { visits: number; served402: number; attempted: number; paid: number; revenue: number; priceUsd: string | null; agentes: Set<string> }>()
  const byDay = new Map<string, { visits: number; paid: number }>()
  const notFound = new Map<string, number>()
  const wallets = new Set<string>()
  const otros = new Map<string, { quien: QuienVisita; visits: number }>()
  let navegadores = 0
  let visits = 0
  let paid = 0
  let revenue = 0
  let served402 = 0
  let attempted = 0

  for (const r of rows) {
    const t = new Date(r.at).getTime()
    if (t < since || t >= until) continue
    if (noEsVisita(r.path, r.userAgent)) continue
    // Un navegador sin nombre de bot es, lo más probable, una persona (o un agente
    // que navega como una): no se puede decir que sea un agente. Se cuenta aparte.
    const quien = r.agentKind === 'other' ? quienEs(r.userAgent) : null
    if (quien?.tipo === 'navegador') {
      navegadores += 1
      continue
    }
    visits += 1
    const monto = r.paid && r.amount ? Number(r.amount) : 0
    if (r.paid) paid += 1
    revenue += monto

    const k = byKind.get(r.agentKind) ?? { visits: 0, paid: 0 }
    k.visits += 1
    if (r.paid) k.paid += 1
    byKind.set(r.agentKind, k)

    if (quien) {
      const clave = `${quien.tipo}:${quien.nombre ?? ''}`
      const o = otros.get(clave) ?? { quien, visits: 0 }
      o.visits += 1
      otros.set(clave, o)
    }

    const es402 = r.status === 402
    if (es402) served402 += 1
    if (r.attempted) attempted += 1

    const p = byPath.get(r.path) ?? { visits: 0, served402: 0, attempted: 0, paid: 0, revenue: 0, priceUsd: null, agentes: new Set<string>() }
    p.visits += 1
    if (es402) {
      p.served402 += 1
      // Un agente distinto por user-agent: sin wallet en el 402 es la mejor aproximación.
      p.agentes.add(r.userAgent ?? 'sin-ua')
    }
    if (r.attempted) p.attempted += 1
    if (r.paid) p.paid += 1
    p.revenue += monto
    if (r.priceUsd) p.priceUsd = r.priceUsd
    byPath.set(r.path, p)

    // Paths pedidos que el origen no tiene: los clientes de pago y los bots
    // que buscan algo concreto. Los archivos típicos de escáner no cuentan.
    if (r.status === 404 && !/\.(php|env|git|xml|ico|png|jpg|js|css|map|txt)$/i.test(r.path) && !r.path.startsWith('/.well-known')) {
      notFound.set(r.path, (notFound.get(r.path) ?? 0) + 1)
    }

    const date = r.at.slice(0, 10)
    const d = byDay.get(date) ?? { visits: 0, paid: 0 }
    d.visits += 1
    if (r.paid) d.paid += 1
    byDay.set(date, d)

    if (r.agentWallet) wallets.add(r.agentWallet.toLowerCase())
  }

  return {
    days,
    totals: { visits, paid, unpaid: visits - paid, revenue: revenue.toFixed(6) },
    byKind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.visits - a.visits),
    otros: [...otros.values()].map((o) => ({ ...o.quien, visits: o.visits })).sort((a, b) => b.visits - a.visits),
    navegadores,
    topPaths: [...byPath.entries()]
      .map(([path, v]) => ({ path, visits: v.visits, served402: v.served402, attempted: v.attempted, paid: v.paid, revenue: v.revenue.toFixed(6) }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20),
    funnel: { served402, attempted, paid },
    unpaidDemand: [...byPath.entries()]
      .filter(([, v]) => v.served402 > 0 && v.paid === 0)
      .map(([path, v]) => ({ path, served402: v.served402, agents: v.agentes.size, priceUsd: v.priceUsd }))
      .sort((a, b) => b.served402 - a.served402)
      .slice(0, 10),
    notFound: [...notFound.entries()]
      .map(([path, visits]) => ({ path, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10),
    daily: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    agentWallets: [...wallets].sort(),
  }
}
