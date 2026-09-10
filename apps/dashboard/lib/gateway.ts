import 'server-only'
import type { Agent, AgentRun, Withdrawal } from '@peaje/db'

const base = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8787'
const secret = process.env.INTERNAL_API_SECRET ?? ''

type WithdrawalResponse = {
  withdrawal: Withdrawal
  explorerUrl: string | null
  error?: string
}

/** Llama la API interna del gateway (la única pieza con la clave de la treasury). */
async function internal<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}/_internal${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
      ...init?.headers,
    },
    cache: 'no-store',
  })
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Gateway respondió ${res.status}`)
  return data
}

export function requestWithdrawal(
  slug: string,
  body: { amount?: string; toWallet?: string; network?: string },
) {
  return internal<WithdrawalResponse>(`/${slug}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getWithdrawal(slug: string, id: string) {
  return internal<WithdrawalResponse>(`/${slug}/withdrawals/${id}`)
}

// ---- agentes compradores ----

/** Agente + saldo live de su wallet, tal como lo devuelve el gateway. */
export type AgenteConSaldo = Agent & { balance: string | null }

export type AgentRunConExplorer = AgentRun & { explorerUrl: string | null }

export function listAgents(slug: string) {
  return internal<{ agents: AgenteConSaldo[] }>(`/${slug}/agents`)
}

export function createAgent(
  slug: string,
  body: {
    name: string
    mission: string
    network: string
    maxPerRun: string
    frequency: string
    deliveryKind?: string
    deliveryTarget?: string | null
    runsMax?: number | null
  },
) {
  return internal<{ agent: AgenteConSaldo }>(`/${slug}/agents`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fundAgent(slug: string, id: string, amount: string) {
  return internal<{ agent: AgenteConSaldo; tx: string; explorerUrl: string }>(
    `/${slug}/agents/${id}/fund`,
    { method: 'POST', body: JSON.stringify({ amount }) },
  )
}

export function runAgent(slug: string, id: string) {
  return internal<{ run: AgentRun; agent: AgenteConSaldo | null }>(`/${slug}/agents/${id}/run`, {
    method: 'POST',
  })
}

export function sweepAgent(slug: string, id: string) {
  return internal<{ agent: AgenteConSaldo; tx: string; explorerUrl: string }>(
    `/${slug}/agents/${id}/sweep`,
    { method: 'POST' },
  )
}

export function toggleAgent(slug: string, id: string) {
  return internal<{ agent: AgenteConSaldo }>(`/${slug}/agents/${id}/pause`, { method: 'POST' })
}

export function deleteAgent(slug: string, id: string) {
  return internal<{ ok: true }>(`/${slug}/agents/${id}`, { method: 'DELETE' })
}

export function listAgentRuns(slug: string, id: string) {
  return internal<{ runs: AgentRunConExplorer[] }>(`/${slug}/agents/${id}/runs`)
}
