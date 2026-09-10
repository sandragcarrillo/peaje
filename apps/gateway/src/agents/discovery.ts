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
  /** 'peaje' = 402 pagable hoy; 'erc8004' = servicio del registro. */
  fuente: 'peaje' | 'erc8004'
  nombre: string
  descripcion: string | null
  url: string | null
  precio: number | null
  /** Reputación 0-100 del registro ERC-8004, null si no está registrado. */
  reputacion: number | null
  feedbacks: number
  aceptaPagos: boolean
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
        etiquetas: [t.name, r.slug, r.title ?? ''].filter(Boolean),
      })
    }
  }
  return out
}

export async function descubrirCandidatos(): Promise<Candidato[]> {
  const [registro, directorio] = await Promise.all([desdeElRegistro(), desdeElDirectorio()])
  return [...directorio, ...registro]
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
        motivos.push(c.fuente === 'peaje' ? 'tiene 402 pagable' : 'declara soporte x402')
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
  return evaluados.find((e) => e.score > 0 && e.url !== null && e.precio !== null && e.aceptaPagos) ?? null
}
