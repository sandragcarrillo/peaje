import 'server-only'
import { DEPLOYMENTS } from './agent0'

/**
 * Datos agregados del mercado de agentes: todos los agentes registrados en
 * ERC-8004 (vía los Subgraphs de Agent0 en The Graph), para el observatorio
 * público /mercado. Muestra de hasta 1000 agentes por chain, cacheada 1h.
 */

const QUERY = `{
  agents(first: 1000, orderBy: createdAt, orderDirection: desc) {
    createdAt
    totalFeedback
    registrationFile {
      active
      x402Support
      oasfDomains
      mcpEndpoint
      a2aEndpoint
    }
  }
}`

type Row = {
  createdAt: string
  totalFeedback: string
  registrationFile: {
    active: boolean | null
    x402Support: boolean | null
    oasfDomains: string[] | null
    mcpEndpoint: string | null
    a2aEndpoint: string | null
  } | null
}

export type MarketAgent = {
  chain: string
  /** epoch en segundos */
  createdAt: number
  x402: boolean
  domains: string[]
  mcp: boolean
  a2a: boolean
  feedback: number
}

export async function fetchMarketAgents(): Promise<MarketAgent[]> {
  const key = process.env.GRAPH_API_KEY
  if (!key) return []

  const results = await Promise.allSettled(
    DEPLOYMENTS.map(async ({ chain, id }) => {
      const res = await fetch(`https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: QUERY }),
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 3600 },
      })
      const json = (await res.json()) as { data?: { agents?: Row[] } }
      return (json.data?.agents ?? []).map(
        (a): MarketAgent => ({
          chain,
          createdAt: Number(a.createdAt),
          x402: a.registrationFile?.x402Support ?? false,
          domains: a.registrationFile?.oasfDomains ?? [],
          mcp: Boolean(a.registrationFile?.mcpEndpoint),
          a2a: Boolean(a.registrationFile?.a2aEndpoint),
          feedback: Number(a.totalFeedback) || 0,
        }),
      )
    }),
  )

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** "data/análisis_de_datos" → "análisis de datos"; el último segmento legible. */
export function domainLabel(domain: string): string {
  const last = domain.split('/').filter(Boolean).pop() ?? domain
  return last.replace(/_/g, ' ')
}
