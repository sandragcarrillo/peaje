import { reputationAverage } from '@peaje/shared'
import { store } from '../store.js'
import { env } from '../env.js'

/**
 * Descubrimiento de servicios para un agente comprador. Dos fuentes que se
 * componen en una sola decisión:
 *
 * 1. El registro ERC-8004 (Subgraphs de Agent0 en The Graph): quién existe en
 *    el ecosistema, a qué se dedica (dominios/skills OASF), si acepta pagos
 *    on-chain y qué reputación tiene. Es la inteligencia de mercado.
 * 2. El directorio de Peaje: rutas y links con precio de los tenants, que son
 *    402 reales y pagables hoy.
 *
 * La reputación y el filtro de "acepta pagos" salen de datos live de The
 * Graph; el precio y la URL pagable salen del directorio. Ninguna de las dos
 * fuentes alcanza sola: por eso se componen.
 */

const DEPLOYMENTS = [
  { chain: 'Ethereum', id: 'FV6RR6y13rsnCxBAicKuQEwDp8ioEGiNaWaZUmvr1F8k' },
  { chain: 'Base', id: '43s9hQRurMGjuYnC1r2ZwS6xSQktbFyXMPMqGKUFJojb' },
  { chain: 'Polygon', id: '9q16PZv1JudvtnCAf44cBoxg82yK9SSsFvrjCY9xnneF' },
  { chain: 'Base Sepolia', id: '4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u' },
] as const

const QUERY = `{
  agents(first: 500, orderBy: totalFeedback, orderDirection: desc) {
    agentId
    agentWallet
    totalFeedback
    registrationFile {
      name
      description
      active
      x402Support
      oasfDomains
      oasfSkills
      mcpEndpoint
      webEndpoint
    }
    feedback(first: 50, where: { isRevoked: false }) { value }
  }
}`

export type Candidato = {
  /**
   * 'peaje' = directorio propio; 'x402' = Bazaar público de x402 (servicios
   * reales de terceros que cobran 402); 'erc8004' = registro de identidad.
   */
  fuente: 'peaje' | 'x402' | 'erc8004'
  nombre: string
  descripcion: string | null
  url: string | null
  precio: number | null
  /** Reputación 0-100 del registro ERC-8004, null si no está registrado. */
  reputacion: number | null
  feedbacks: number
  aceptaPagos: boolean
  /**
   * true = el agente puede pagarlo HOY con sus rieles (Tempo/Arc testnet).
   * Un servicio real en Base mainnet es señal de mercado, no una compra.
   */
  pagable: boolean
  etiquetas: string[]
  chain?: string
}

type GraphAgent = {
  agentId: string
  agentWallet: string | null
  totalFeedback: string
  registrationFile: {
    name: string | null
    description: string | null
    active: boolean | null
    x402Support: boolean | null
    oasfDomains: string[] | null
    oasfSkills: string[] | null
    mcpEndpoint: string | null
    webEndpoint: string | null
  } | null
  feedback: { value: string }[]
}

/** Servicios del registro ERC-8004, vía The Graph. Falla suave por chain. */
async function desdeElRegistro(): Promise<Candidato[]> {
  const key = process.env.GRAPH_API_KEY
  if (!key) {
    console.warn('[agents] sin GRAPH_API_KEY: el descubrimiento usa solo el directorio de Peaje')
    return []
  }

  const results = await Promise.allSettled(
    DEPLOYMENTS.map(async ({ chain, id }) => {
      const res = await fetch(`https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: QUERY }),
        signal: AbortSignal.timeout(10_000),
      })
      const json = (await res.json()) as { data?: { agents?: GraphAgent[] } }
      return { chain, agents: json.data?.agents ?? [] }
    }),
  )

  const out: Candidato[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const a of r.value.agents) {
      const reg = a.registrationFile
      if (!reg || reg.active === false) continue
      out.push({
        fuente: 'erc8004',
        nombre: reg.name ?? `Agente #${a.agentId}`,
        descripcion: reg.description,
        url: reg.webEndpoint ?? reg.mcpEndpoint,
        precio: null,
        reputacion: reputationAverage(a.feedback.map((f) => f.value)),
        feedbacks: Number(a.totalFeedback) || 0,
        aceptaPagos: reg.x402Support ?? false,
        pagable: false,
        etiquetas: [...(reg.oasfDomains ?? []), ...(reg.oasfSkills ?? [])],
        chain: r.value.chain,
      })
    }
  }
  return out
}

/** Servicios pagables del directorio de Peaje: 402 reales, con precio. */
async function desdeElDirectorio(): Promise<Candidato[]> {
  const tenants = await store.listTenants()
  const out: Candidato[] = []
  for (const t of tenants) {
    // Las rutas de API con precio también son comprables (GET sin parámetros
    // de path; la query la completa la capa de lenguaje sobre la misión).
    const routes = await store.listRoutes(t.id).catch(() => [])
    for (const r of routes) {
      if (Number(r.priceUsd) <= 0) continue
      if (r.method.toUpperCase() !== 'GET') continue
      if (r.pathPattern.includes(':') || r.pathPattern.includes('*')) continue
      out.push({
        fuente: 'peaje',
        nombre: r.description ?? `${t.name} ${r.pathPattern}`,
        descripcion: `${t.name} · API ${r.method} ${r.pathPattern}`,
        url: `${env.publicUrl}/${t.slug}${r.pathPattern}`,
        precio: Number(r.priceUsd),
        reputacion: null,
        feedbacks: 0,
        aceptaPagos: true,
        pagable: true,
        etiquetas: [t.name, r.pathPattern, r.description ?? '', 'api'].filter(Boolean),
      })
    }
    const resources = await store.listResources(t.id).catch(() => [])
    for (const r of resources) {
      if (Number(r.priceUsd) <= 0) continue
      out.push({
        fuente: 'peaje',
        nombre: r.title ?? r.slug,
        descripcion: `${t.name} · ${r.slug}`,
        url: `${env.publicUrl}/${t.slug}/r/${r.slug}`,
        precio: Number(r.priceUsd),
        reputacion: null,
        feedbacks: 0,
        aceptaPagos: true,
        pagable: true,
        etiquetas: [t.name, r.slug, r.title ?? ''].filter(Boolean),
      })
    }
  }
  return out
}

/**
 * Redes que las wallets de agentes pueden liquidar hoy: Tempo, Arc y Arbitrum
 * Sepolia (rieles de Peaje) más Base mainnet, donde vive el mercado real de
 * x402. La misma wallet Privy firma en todas: son cuentas EVM.
 */
const REDES_PAGABLES = new Set(['eip155:42431', 'eip155:5042002', 'eip155:421614', 'eip155:8453'])

type BazaarItem = {
  resource?: string
  type?: string
  accepts?: { network?: string; maxAmountRequired?: string; amount?: string }[]
  metadata?: { name?: string; description?: string; category?: string }
  extensions?: { bazaar?: { info?: { title?: string; description?: string } } }
}

/**
 * El Bazaar público de x402 (índice de CDP): servicios REALES de terceros
 * que cobran 402, con precio y red. Saca al agente de la burbuja de Peaje:
 * ve el mercado completo y compra donde sus rieles alcanzan.
 */
let bazaarCache: { candidatos: Candidato[]; expira: number } | null = null

async function desdeElBazaar(): Promise<Candidato[]> {
  if (bazaarCache && bazaarCache.expira > Date.now()) return bazaarCache.candidatos
  try {
    // El índice completo son ~15 páginas de 1000. Con 100 el agente veía el
    // 0,7% del mercado y "lo mejor disponible" era casi siempre basura.
    const primera = await paginaBazaar(0)
    const total = Math.min(primera.total, 20_000)
    const offsets: number[] = []
    for (let o = 1000; o < total; o += 1000) offsets.push(o)
    const resto = await Promise.all(offsets.map((o) => paginaBazaar(o).catch(() => ({ items: [], total: 0 }))))
    const items = [...primera.items, ...resto.flatMap((p) => p.items)]

    const out: Candidato[] = []
    for (const item of items) {
      if (!item.resource) continue
      const acepta = item.accepts?.[0]
      const red = acepta?.network ?? null
      const crudo = Number(acepta?.maxAmountRequired ?? acepta?.amount ?? Number.NaN)
      // USDC de 6 decimales en todas las redes que lista el Bazaar hoy.
      const precio = Number.isFinite(crudo) ? crudo / 1e6 : null
      let host = item.resource
      try {
        host = new URL(item.resource).hostname
      } catch {}
      const info = item.extensions?.bazaar?.info
      out.push({
        fuente: 'x402',
        nombre: item.metadata?.name ?? info?.title ?? host,
        descripcion: item.metadata?.description ?? info?.description ?? item.resource,
        url: item.resource,
        precio,
        reputacion: null,
        feedbacks: 0,
        aceptaPagos: true,
        pagable: red !== null && REDES_PAGABLES.has(red),
        etiquetas: [host, item.metadata?.category ?? '', item.type ?? ''].filter(Boolean),
        chain: red ?? undefined,
      })
    }
    bazaarCache = { candidatos: out, expira: Date.now() + 60 * 60 * 1000 }
    return out
  } catch {
    // Si el índice falla, mejor el caché viejo que un mercado vacío.
    return bazaarCache?.candidatos ?? []
  }
}

async function paginaBazaar(offset: number): Promise<{ items: BazaarItem[]; total: number }> {
  const res = await fetch(
    `https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources?limit=1000&offset=${offset}`,
    { signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`Bazaar ${res.status}`)
  const json = (await res.json()) as { items?: BazaarItem[]; pagination?: { total?: number } }
  return { items: json.items ?? [], total: json.pagination?.total ?? 0 }
}

export async function descubrirCandidatos(): Promise<Candidato[]> {
  const [registro, directorio, bazaar] = await Promise.all([
    desdeElRegistro(),
    desdeElDirectorio(),
    desdeElBazaar(),
  ])
  return [...directorio, ...bazaar, ...registro]
}

// ---- decisión ----

export type Evaluado = Candidato & {
  score: number
  motivos: string[]
}

/** Palabras significativas de la misión, sin ruido. */
function palabrasClave(mision: string): string[] {
  const stop = new Set([
    'de','la','el','los','las','un','una','para','por','con','sin','que','del','en','y','o','a',
    'necesito','quiero','busco','dame','traeme','sobre','mi','me','al','lo','se','su',
  ])
  return mision
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stop.has(w))
}

/**
 * Puntúa candidatos contra la misión y el presupuesto de la corrida.
 *
 * El motor es determinista y auditable a propósito: un modelo puede traducir
 * la misión o redactar el porqué, pero no decide a quién se le paga. Cada
 * decisión queda con sus motivos en el log de la corrida.
 */
export function evaluar(
  candidatos: Candidato[],
  mision: string,
  maxPorCorrida: number,
  /** Sinónimos del modelo. Solo amplían el recall; no cambian quién decide. */
  terminosExtra: string[] = [],
): Evaluado[] {
  const claves = [...new Set([...palabrasClave(mision), ...terminosExtra])]

  return candidatos
    .map((c): Evaluado => {
      const motivos: string[] = []
      let score = 0

      const texto = [c.nombre, c.descripcion ?? '', ...c.etiquetas]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
      const coincidencias = claves.filter((k) => texto.includes(k))
      if (coincidencias.length > 0) {
        score += coincidencias.length * 30
        motivos.push(`coincide con "${coincidencias.join('", "')}"`)
      }

      if (c.aceptaPagos) {
        score += 20
        motivos.push(
          c.pagable
            ? 'tiene 402 pagable con tus rieles'
            : c.fuente === 'x402'
              ? 'cobra 402 real, pero en una red que tu agente aún no liquida'
              : 'declara soporte x402',
        )
      } else {
        motivos.push('no declara soporte de pagos')
      }

      if (c.reputacion !== null) {
        score += (c.reputacion / 100) * 25
        motivos.push(`reputación ${c.reputacion}/100 con ${c.feedbacks} feedbacks on-chain`)
      }

      if (c.precio !== null) {
        if (c.precio > maxPorCorrida) {
          score = -1
          motivos.push(`$${c.precio} supera el tope de $${maxPorCorrida} por corrida`)
        } else {
          // Más barato puntúa mejor, pero pesa menos que la pertinencia.
          score += (1 - c.precio / maxPorCorrida) * 15
          motivos.push(`$${c.precio} dentro del tope de $${maxPorCorrida}`)
        }
      }

      return { ...c, score: Math.round(score * 10) / 10, motivos }
    })
    .sort((a, b) => b.score - a.score)
}

/** El elegido: mejor score, pagable y dentro del tope. */
export function elegir(evaluados: Evaluado[]): Evaluado | null {
  return elegirVarios(evaluados, 1)[0] ?? null
}

/**
 * Lista corta de comprables, en orden de score. El runner valida cada uno
 * con la capa de lenguaje antes de pagar: si el primero es basura pertinente
 * (docs que mencionan el tema), cae al siguiente en vez de comprarla.
 */
export function elegirVarios(evaluados: Evaluado[], n: number): Evaluado[] {
  // Un host por cupo: tres endpoints del mismo proveedor no son tres
  // opciones, y taparían alternativas reales en la lista corta.
  const hosts = new Set<string>()
  const out: Evaluado[] = []
  for (const e of evaluados) {
    if (!(e.score > 0 && e.url !== null && e.precio !== null && e.pagable)) continue
    let host = e.url
    try {
      host = new URL(e.url).hostname
    } catch {}
    if (hosts.has(host)) continue
    hosts.add(host)
    out.push(e)
    if (out.length >= n) break
  }
  return out
}

// ---- capacidades ----

const CATEGORIAS: { id: string; patron: RegExp }[] = [
  { id: 'web', patron: /search|serp|websearch|extract|scrape/i },
  { id: 'clima', patron: /weather|forecast|clima/i },
  { id: 'social', patron: /twitter|tweet|reddit|instagram|social/i },
  { id: 'noticias', patron: /news|hackernews|headline/i },
  { id: 'viajes', patron: /hotel|flight|tripadvisor|travel|nearby|airbnb/i },
  { id: 'imagenes', patron: /image|imagen|photo|album/i },
  { id: 'cripto', patron: /token|onchain|defi|nansen|gas|coingecko|wallet|balance/i },
  { id: 'compras', patron: /ebay|amazon|giftcard|bitrefill|shop|product/i },
]

export type Capacidad = {
  id: string
  cuantos: number
  precioDesde: number | null
  ejemplo: { nombre: string; precio: number | null } | null
}

/**
 * Lo que el agente puede comprar HOY, agrupado en lenguaje de persona:
 * alimenta la sección "qué puede hacer tu agente" del dashboard. Sale del
 * mismo inventario que usa la compra, así que nunca promete de más.
 */
export async function capacidadesDelMercado(): Promise<Capacidad[]> {
  const candidatos = await descubrirCandidatos()
  const pagables = candidatos.filter((c) => c.pagable && c.url && c.precio !== null)
  return CATEGORIAS.map(({ id, patron }) => {
    const grupo = pagables.filter((c) =>
      patron.test([c.nombre, c.descripcion ?? '', c.url ?? ''].join(' ')),
    )
    const precios = grupo.map((c) => c.precio ?? Infinity).filter((p) => Number.isFinite(p))
    const ejemplo = grupo.toSorted((a, b) => (a.precio ?? 1) - (b.precio ?? 1))[0] ?? null
    return {
      id,
      cuantos: grupo.length,
      precioDesde: precios.length > 0 ? Math.min(...precios) : null,
      ejemplo: ejemplo ? { nombre: ejemplo.nombre, precio: ejemplo.precio } : null,
    }
  }).filter((c) => c.cuantos > 0)
}
