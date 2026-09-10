import 'server-only'
import { reputationAverage } from '@peaje/shared'

/**
 * Identidad y reputación de agentes vía los Subgraphs de Agent0 (ERC-8004)
 * en The Graph. Una wallet que paga por el gateway se enriquece con su
 * registro on-chain: quién es, a qué se dedica (skills OASF) y qué feedback
 * tiene. Datos live de The Graph; sin GRAPH_API_KEY el reporte sale sin
 * enriquecer.
 *
 * El mismo schema está deployado en varias chains; consultamos todas en
 * paralelo y tomamos la identidad donde aparezca.
 * Docs: https://thegraph.com/docs/en/subgraphs/existing-subgraphs/agent0/
 */

export const DEPLOYMENTS = [
  { chain: 'Ethereum', id: 'FV6RR6y13rsnCxBAicKuQEwDp8ioEGiNaWaZUmvr1F8k' },
  { chain: 'Base', id: '43s9hQRurMGjuYnC1r2ZwS6xSQktbFyXMPMqGKUFJojb' },
  { chain: 'Polygon', id: '9q16PZv1JudvtnCAf44cBoxg82yK9SSsFvrjCY9xnneF' },
  { chain: 'BSC', id: 'D6aWqowLkWqBgcqmpNKXuNikPkob24ADXCciiP8Hvn1K' },
  { chain: 'Base Sepolia', id: '4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u' },
  { chain: 'BSC Chapel', id: 'BTjind17gmRZ6YhT9peaCM13SvWuqztsmqyfjpntbg3Z' },
] as const

const QUERY = `query($ws: [Bytes!]) {
  agents(where: { agentWallet_in: $ws }) {
    agentId
    chainId
    agentWallet
    totalFeedback
    registrationFile {
      name
      description
      image
      ens
      did
      x402Support
      mcpEndpoint
      oasfSkills
      oasfDomains
      a2aSkills
    }
    feedback(first: 50, where: { isRevoked: false }) {
      value
    }
  }
}`

type AgentRow = {
  agentId: string
  chainId: string
  agentWallet: string
  totalFeedback: string
  registrationFile: {
    name: string | null
    description: string | null
    image: string | null
    ens: string | null
    did: string | null
    x402Support: boolean | null
    mcpEndpoint: string | null
    oasfSkills: string[] | null
    oasfDomains: string[] | null
    a2aSkills: string[] | null
  } | null
  feedback: { value: string }[]
}

export type AgentIdentity = {
  wallet: string
  name: string
  description: string | null
  chain: string
  ens: string | null
  x402Support: boolean
  /** Skills OASF crudas, ej. "natural_language_processing/…/search". */
  skills: string[]
  /** Dominios OASF, el "a qué se dedica" de alto nivel. */
  domains: string[]
  feedbackCount: number
  /** Promedio de feedback no revocado (0-100), null si no tiene. */
  feedbackAvg: number | null
}

/**
 * Busca las wallets en todos los deployments de Agent0. Devuelve un mapa
 * wallet (lowercase) → identidad. Falla suave: deployment caído se ignora.
 */
export async function lookupAgentIdentities(wallets: string[]): Promise<Map<string, AgentIdentity>> {
  const key = process.env.GRAPH_API_KEY
  const found = new Map<string, AgentIdentity>()
  if (!key || wallets.length === 0) return found

  const ws = [...new Set(wallets.map((w) => w.toLowerCase()))].slice(0, 100)

  const results = await Promise.allSettled(
    DEPLOYMENTS.map(async ({ chain, id }) => {
      const res = await fetch(`https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { ws } }),
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 300 },
      })
      const json = (await res.json()) as { data?: { agents?: AgentRow[] } }
      return { chain, agents: json.data?.agents ?? [] }
    }),
  )

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const a of r.value.agents) {
      const wallet = a.agentWallet.toLowerCase()
      if (found.has(wallet)) continue // primera identidad encontrada gana
      const reputacion = reputationAverage(a.feedback.map((f) => f.value))
      found.set(wallet, {
        wallet,
        name: a.registrationFile?.name ?? `Agente #${a.agentId}`,
        description: a.registrationFile?.description ?? null,
        chain: r.value.chain,
        ens: a.registrationFile?.ens ?? null,
        x402Support: a.registrationFile?.x402Support ?? false,
        skills: a.registrationFile?.oasfSkills ?? [],
        domains: a.registrationFile?.oasfDomains ?? [],
        feedbackCount: Number(a.totalFeedback) || a.feedback.length,
        feedbackAvg: reputacion,
      })
    }
  }
  return found
}

/** "natural_language_processing/information_retrieval_synthesis/search" → "search" */
export function skillLabel(skill: string): string {
  const last = skill.split('/').filter(Boolean).pop() ?? skill
  return last.replace(/_/g, ' ')
}
