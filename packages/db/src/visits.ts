import type { AgentKind, ClaseVisita, GrupoVisita, NewVisit, QuienVisita, VisitStats } from './types'

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
 * nombre es la marca, igual en los dos idiomas. El grupo es para los
 * reportes (ver `grupoDe`): la marca junta al bot con tipo propio (ClaudeBot)
 * con los suyos que no lo tienen (Claude-User, Claude Code).
 */
const AGENTES_CON_NOMBRE: [RegExp, string | ((m: string) => string), GrupoVisita][] = [
  // Asistentes de IA y sus agentes.
  [/ChatGPT-User/i, 'ChatGPT (ChatGPT-User)', { marca: 'ChatGPT' }],
  [/openai-mcp/i, 'ChatGPT (openai-mcp)', { marca: 'ChatGPT' }],
  [/Claude-User/i, 'Claude (Claude-User)', { marca: 'Claude' }],
  [/Claude-SearchBot/i, 'Claude (Claude-SearchBot)', { marca: 'Claude' }],
  [/claude-code/i, 'Claude Code', { marca: 'Claude' }],
  [/Perplexity-User/i, 'Perplexity (Perplexity-User)', { marca: 'Perplexity' }],
  [
    /GoogleOther|Google-InspectionTool|Google-CloudVertexBot|Google-NotebookLM|Google-Read-Aloud|Google-Site-Verification|Storebot-Google|AdsBot-Google|FeedFetcher-Google|APIs-Google/i,
    (m) => `Google (${m})`,
    { marca: 'Google' },
  ],
  // Buscadores, laboratorios de IA y sus rastreadores.
  [/bingbot|BingPreview|msnbot|adidxbot/i, 'Bing', { marca: 'Bing' }],
  [/Applebot/i, 'Apple', { marca: 'Apple' }],
  [/meta-external\w*|FacebookBot/i, 'Meta', { marca: 'Meta' }],
  [/Amazonbot|Amzn-SearchBot|Amzn-User/i, 'Amazon', { marca: 'Amazon' }],
  [/DuckAssistBot|DuckDuckBot/i, 'DuckDuckGo', { marca: 'DuckDuckGo' }],
  [/Bytespider|TikTokSpider/i, 'ByteDance', { marca: 'ByteDance' }],
  [/CCBot/i, 'Common Crawl', { marca: 'Common Crawl' }],
  [/MistralAI/i, 'Mistral', { marca: 'Mistral' }],
  [/cohere-ai|cohere-training-data-crawler/i, 'Cohere', { marca: 'Cohere' }],
  [/YouBot/i, 'You.com', { marca: 'You.com' }],
  [/Diffbot/i, 'Diffbot', { marca: 'Diffbot' }],
  [/ExaBot|ExaUser|ExaSearchBot|crawler\.exa\.ai/i, 'Exa', { marca: 'Exa' }],
  [/ElevenlabsCrawler|ElevenLabs/i, 'ElevenLabs', { marca: 'ElevenLabs' }],
  [/Reflectionbot/i, 'Reflection AI', { marca: 'Reflection AI' }],
  [/AI2Bot/i, 'Ai2', { marca: 'Ai2' }],
  [/Timpibot/i, 'Timpi', { marca: 'Timpi' }],
  [/PetalBot/i, 'Huawei (PetalBot)', { marca: 'Huawei' }],
  [/YandexBot|YandexAdditional/i, 'Yandex', { marca: 'Yandex' }],
  [/Baiduspider/i, 'Baidu', { marca: 'Baidu' }],
  // Vistas previas de un enlace que alguien compartió en una red o un chat.
  [/facebookexternalhit|facebookcatalog/i, 'Facebook', { clase: 'previas' }],
  [/LinkedInBot/i, 'LinkedIn', { clase: 'previas' }],
  [/Twitterbot/i, 'X', { clase: 'previas' }],
  [/WhatsApp/i, 'WhatsApp', { clase: 'previas' }],
  [/Slackbot|Slack-ImgProxy/i, 'Slack', { clase: 'previas' }],
  [/TelegramBot/i, 'Telegram', { clase: 'previas' }],
  [/Discordbot/i, 'Discord', { clase: 'previas' }],
  [/redditbot/i, 'Reddit', { clase: 'previas' }],
  [/Pinterestbot/i, 'Pinterest', { clase: 'previas' }],
  [/SkypeUriPreview/i, 'Skype', { clase: 'previas' }],
  [/Iframely/i, 'Iframely', { clase: 'previas' }],
  [/Embedly/i, 'Embedly', { clase: 'previas' }],
  [/Bluesky Cardyb/i, 'Bluesky', { clase: 'previas' }],
  // Herramientas de SEO.
  [/AhrefsBot|AhrefsSiteAudit/i, 'Ahrefs', { clase: 'seo' }],
  [/SemrushBot|SiteAuditBot|SplitSignalBot/i, 'Semrush', { clase: 'seo' }],
  [/SERankingBacklinksBot|SE Ranking/i, 'SE Ranking', { clase: 'seo' }],
  [/\bDotBot\b|rogerbot/i, 'Moz', { clase: 'seo' }],
  [/MJ12bot/i, 'Majestic', { clase: 'seo' }],
  [/Barkrowler/i, 'Babbar', { clase: 'seo' }],
  [/DataForSeoBot/i, 'DataForSEO', { clase: 'seo' }],
  [/Screaming Frog/i, 'Screaming Frog', { clase: 'seo' }],
  [/Sitebulb/i, 'Sitebulb', { clase: 'seo' }],
  [/serpstatbot/i, 'Serpstat', { clase: 'seo' }],
  [/SeobilityBot/i, 'Seobility', { clase: 'seo' }],
  [/SEOJuice/i, 'SEOJuice', { clase: 'seo' }],
  [/BLEXBot/i, 'BLEXBot', { clase: 'seo' }],
  [/Dataprovider/i, 'Dataprovider', { clase: 'seo' }],
]

/**
 * Clases sin marca que se reconocen por palabras del user-agent, en este
 * orden: los clientes MCP genéricos (los de una marca van arriba con su
 * marca), los SDKs de agentes y de pago, y los directorios y registros de
 * agentes y de servidores MCP (leen el agent card, el MCP y llms.txt para
 * listar el sitio: BrickBlueBot, WellknownBot, llms.txt-directory).
 */
const CLASES_POR_UA: [RegExp, ClaseVisita][] = [
  [/mcp-remote|mcp-client|mcp-inspector|modelcontextprotocol|fastmcp|mcp-use\b|mcp-proxy/i, 'mcp'],
  [/x402|mppx|agentcash|agentkit|langchain|llama[-_]?index|crewai|autogen|smolagents|pydantic-ai|browser-use|openai-agents/i, 'sdk'],
  [
    /registry|director(?:y|io)|\bindex(?:er)?\b|catalog|\ba2a\b|mcp|agentic|agent[-_.]?(?:card|web|scout|probe|index|tools|map|list)|llms\.?txt|well-?known|discovery/i,
    'directorios',
  ],
]

const SCRIPTS =
  /^(curl|wget|node|undici|python-requests|python-httpx|python-urllib|python|aiohttp|go-http-client|axios|got|ky|reqwest|dart|apache-httpclient|guzzlehttp|faraday|postmanruntime|insomnia|okhttp|java|deno|bun|node-fetch|httpie|ruby|php|libwww-perl|scrapy)\b/i

const OTROS: GrupoVisita = { clase: 'otros' }

/**
 * Quién es una visita de tipo `other` y en qué grupo va. Primero los que
 * tienen nombre conocido; después los navegadores sin nombre de bot (lo más
 * probable, una persona); las clases por palabras del user-agent; cualquiera
 * que se presente con nombre ("compatible; Barkrowler/0.9", "QlyzeBot/1.0",
 * "CreoraPublicReader/1.0"); scripts y herramientas (curl, node); y el resto
 * por el primer nombre de su user-agent.
 */
function identificar(ua: string | null | undefined): { quien: QuienVisita; grupo: GrupoVisita } {
  const u = (ua ?? '').trim()
  if (!u) return { quien: { tipo: 'sin-ua', nombre: null }, grupo: OTROS }
  for (const [patron, nombre, grupo] of AGENTES_CON_NOMBRE) {
    const m = u.match(patron)
    if (m) return { quien: { tipo: 'agente', nombre: typeof nombre === 'string' ? nombre : nombre(m[0]) }, grupo }
  }
  const compatible = u.match(/compatible; ([A-Za-z][\w.-]{1,39})\//i)?.[1]
  const bot = u.match(/([A-Za-z][\w.-]*(?:bot|crawler|spider|reader|fetcher))\b/i)?.[1]?.slice(0, 40)
  const nombre = (compatible && !/^Mozilla$/i.test(compatible) ? compatible : undefined) ?? bot
  // Un navegador, también el de una app (Messenger, Instagram en iOS: sin "Safari/").
  const navegador = /(Chrome|Safari|Firefox|Edg)\//.test(u) || /AppleWebKit\/[\d.]+ \(KHTML, like Gecko\) Mobile\//.test(u)
  if (!nombre && /^Mozilla\/5\.0/.test(u) && navegador) return { quien: { tipo: 'navegador', nombre: null }, grupo: OTROS }
  // "Mozilla" no es un nombre.
  const primero = u.split(/[\s/;(]/)[0]?.slice(0, 40) || u.slice(0, 40)
  const nombrePropio = nombre ?? (/^Mozilla$/i.test(primero) ? null : primero)
  for (const [patron, clase] of CLASES_POR_UA) {
    if (!patron.test(u)) continue
    return { quien: nombrePropio ? { tipo: 'agente', nombre: nombrePropio } : { tipo: 'sin-ua', nombre: null }, grupo: { clase } }
  }
  if (nombre) return { quien: { tipo: 'agente', nombre }, grupo: OTROS }
  const script = u.match(SCRIPTS)
  if (script?.[1]) return { quien: { tipo: 'script', nombre: script[1].toLowerCase() }, grupo: { clase: 'scripts' } }
  // "Mozilla/5.0" sin navegador ni bot: alguien que no dice quién es.
  if (/^Mozilla\//.test(u)) return { quien: { tipo: 'sin-ua', nombre: null }, grupo: OTROS }
  return { quien: { tipo: 'desconocido', nombre: primero }, grupo: OTROS }
}

/** Quién es una visita de tipo `other`, por su user-agent (ver `identificar`). */
export function quienEs(ua: string | null | undefined): QuienVisita {
  return identificar(ua).quien
}

/** El grupo de cada tipo propio: el bot de búsqueda va con su marca. */
const GRUPO_DEL_TIPO: Record<AgentKind, GrupoVisita> = {
  'openai-searchbot': { marca: 'ChatGPT' },
  gptbot: { clase: 'openai-entrenamiento' },
  claudebot: { marca: 'Claude' },
  perplexitybot: { marca: 'Perplexity' },
  googlebot: { marca: 'Google' },
  'mpp-client': { clase: 'pago' },
  'x402-client': { clase: 'pago' },
  other: OTROS,
}

/**
 * "Quién vino" en los reportes: una marca (ChatGPT junta OAI-SearchBot y
 * ChatGPT-User) o, sin marca, la clase de visitante (directorios de agentes,
 * scripts, SEO). Un navegador sin nombre de bot no es visita: queda en `otros`
 * acá, pero `aggregateVisits` lo cuenta aparte.
 */
export function grupoDe(kind: AgentKind, ua: string | null | undefined): GrupoVisita {
  return kind === 'other' ? identificar(ua).grupo : GRUPO_DEL_TIPO[kind] ?? OTROS
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
  const grupos = new Map<string, { grupo: GrupoVisita; visits: number; nombres: Map<string, number> }>()
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
    const id = r.agentKind === 'other' ? identificar(r.userAgent) : null
    const quien = id?.quien ?? null
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

    const grupo = id?.grupo ?? GRUPO_DEL_TIPO[r.agentKind] ?? OTROS
    const claveGrupo = 'marca' in grupo ? `marca:${grupo.marca}` : `clase:${grupo.clase}`
    const g = grupos.get(claveGrupo) ?? { grupo, visits: 0, nombres: new Map<string, number>() }
    g.visits += 1
    if (quien?.nombre) g.nombres.set(quien.nombre, (g.nombres.get(quien.nombre) ?? 0) + 1)
    grupos.set(claveGrupo, g)

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
    grupos: [...grupos.values()]
      .map((g) => ({
        ...g.grupo,
        visits: g.visits,
        nombres: [...g.nombres.entries()]
          .map(([nombre, visits]) => ({ nombre, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 5),
      }))
      .sort((a, b) => b.visits - a.visits),
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
