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
  const data = (await res.json()) as T & { error?: string; code?: string }
  if (!res.ok) {
    const err = new Error(data.error ?? `Gateway respondió ${res.status}`) as Error & { code?: string }
    err.code = data.code
    throw err
  }
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

/** Agente + saldos live de su wallet, tal como lo devuelve el gateway. */
export type AgenteConSaldo = Agent & {
  /** Saldo en la red donde opera el agente. */
  balance: string | null
  /** Saldo por cada riel de Peaje. */
  balances: Record<string, string | null>
  /** USDC en Base mainnet: el riel del mercado real de x402. */
  balanceBase: string | null
}

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

export function fundAgent(
  slug: string,
  id: string,
  amount: string,
  network?: string,
  fromSlug?: string,
) {
  return internal<{ agent: AgenteConSaldo; tx: string; explorerUrl: string }>(
    `/${slug}/agents/${id}/fund`,
    { method: 'POST', body: JSON.stringify({ amount, network, fromSlug }) },
  )
}

export function runAgent(slug: string, id: string, body?: { mission?: string; url?: string }) {
  return internal<{ run: AgentRun; agent: AgenteConSaldo | null }>(`/${slug}/agents/${id}/run`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

/** Un candidato del plan, ya en lenguaje de persona. */
export type ServicioDelPlan = {
  nombre: string
  descripcion: string | null
  url: string | null
  precio: number | null
  red: string
  fuente: string
  reputacion: number | null
}

export type PlanDeCompra = {
  consultados: number
  saldos: Record<string, number>
  elegido: ServicioDelPlan | null
  veredicto: string | null
  vetados: { nombre: string; motivo: string }[]
  alternativas: ServicioDelPlan[]
  faltaFondeo: boolean
}

/** Plan sin compra: qué compraría el agente para este pedido. */
export function askAgent(slug: string, id: string, texto: string) {
  return internal<{ plan: PlanDeCompra }>(`/${slug}/agents/${id}/ask`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  })
}

export type Capacidad = {
  id: string
  cuantos: number
  precioDesde: number | null
  ejemplo: { nombre: string; precio: number | null } | null
}

/** Qué puede comprar un agente hoy, agrupado por categoría. */
export function marketCapacidades() {
  return internal<{ capacidades: Capacidad[] }>(`/mercado/capacidades`)
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

// ---- tareas del agente Pro ----

export type ResultadoBusqueda = { creadas: number; actualizadas: number; cerradas: number } | { error: 'too-soon'; retryInSeconds: number }

/** Busca tareas nuevas. 429 no es error para la UI: trae cuánto esperar. */
export async function buscarTareas(slug: string): Promise<ResultadoBusqueda> {
  const res = await fetch(`${base}/_internal/${slug}/tasks/generate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    cache: 'no-store',
  })
  const data = (await res.json()) as ResultadoBusqueda & { error?: string }
  if (!res.ok && res.status !== 429) throw new Error(data.error ?? `Gateway respondió ${res.status}`)
  return data
}

export function completarTarea(slug: string, id: string, url?: string) {
  return internal<{ task: { status: string; note: string | null } }>(`/${slug}/tasks/${id}/done`, {
    method: 'POST',
    body: JSON.stringify(url ? { url } : {}),
  })
}

export type PlanDelNegocio = {
  goal: string
  goalDetail: string
  capacity: string[]
  cadence: string
  summary: string
  createdAt: string
  steps: { title: string; why: string; deliverable: string; metric: string; target: number; baseline: number | null; current: number | null; done: boolean }[]
}

export async function leerPlan(slug: string) {
  return (await internal<{ plan: PlanDelNegocio | null }>(`/${slug}/tasks/plan`)).plan
}

export function armarPlan(slug: string, body: { goal: string; goalDetail: string; capacity: string[]; cadence: string; language: string }) {
  return internal<{ plan: PlanDelNegocio }>(`/${slug}/tasks/plan`, { method: 'POST', body: JSON.stringify(body) })
}

export function enviarAlAgente(slug: string, text: string, language: string) {
  return internal<{ message: import('@peaje/db').AgentMessage }>(`/${slug}/tasks/chat`, {
    method: 'POST',
    body: JSON.stringify({ text, language, channel: 'dashboard' }),
  })
}

export type Citacion = {
  prompts: { id: string; text: string; source: string }[]
  summary: {
    measuredAt: string | null
    engines: { id: string; name: string; configured: boolean }[]
    share: number | null
    mentionShare: number | null
    previousShare: number | null
    byEngine: { engine: string; cited: number; mentioned: number; total: number }[]
    byPrompt: { prompt: string; engines: Record<string, { cited: boolean; mentioned: boolean; error: boolean }> }[]
    competitors: { domain: string; count: number }[]
  }
}

export function leerCitacion(slug: string) {
  return internal<Citacion>(`/${slug}/tasks/citations`)
}

export function agregarPreguntas(slug: string, body: { texts?: string[]; suggest?: boolean }) {
  return internal<{ added: unknown[] }>(`/${slug}/tasks/citations/prompts`, { method: 'POST', body: JSON.stringify(body) })
}

export function quitarPregunta(slug: string, id: string) {
  return internal<{ ok: boolean }>(`/${slug}/tasks/citations/prompts/${id}`, { method: 'DELETE' })
}

/** 429 trae cuánto esperar; no es error para la UI. */
export async function medirCitacion(slug: string): Promise<{ error?: 'too-soon'; retryInSeconds?: number }> {
  const res = await fetch(`${base}/_internal/${slug}/tasks/citations/run`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, cache: 'no-store' })
  const data = (await res.json()) as { error?: string; retryInSeconds?: number }
  if (!res.ok && res.status !== 429) throw new Error(data.error ?? `Gateway respondió ${res.status}`)
  return data as { error?: 'too-soon'; retryInSeconds?: number }
}

// ---- M7: comprador misterioso ----

export type CorridaComprador = import('@peaje/db').MysteryRun

export async function leerComprador(slug: string) {
  return (await internal<{ run: CorridaComprador | null }>(`/${slug}/mystery`)).run
}

/** Corre el comprador misterioso. 429 trae cuánto esperar; no es error para la UI. */
export async function correrComprador(slug: string): Promise<{ run?: CorridaComprador; error?: 'too-soon'; retryInSeconds?: number }> {
  const res = await fetch(`${base}/_internal/${slug}/mystery/run`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, cache: 'no-store' })
  const data = (await res.json()) as { run?: CorridaComprador; error?: string; retryInSeconds?: number }
  if (!res.ok && res.status !== 429) throw new Error(data.error ?? `Gateway respondió ${res.status}`)
  return data as { run?: CorridaComprador; error?: 'too-soon'; retryInSeconds?: number }
}
// ---- fin M7 ----

// ---- Telegram ----

export type EstadoTelegram = { configured: boolean; links: { username: string | null; language: string; linkedAt: string }[] }

export function leerTelegram(slug: string) {
  return internal<EstadoTelegram>(`/${slug}/telegram`)
}

export function enlaceTelegram(slug: string) {
  return internal<{ url: string; expiresAt: string }>(`/${slug}/telegram/link`, { method: 'POST' })
}

export function desconectarTelegram(slug: string) {
  return internal<{ ok: boolean }>(`/${slug}/telegram`, { method: 'DELETE' })
}

// ---- M9: plan y cobro del agente Pro ----

export type EstadoBilling = {
  access: import('@peaje/db').AccesoPro
  prices: Record<'founder' | 'pro', { usd: number; charged: string; limits: { preguntas: number; mensajes: number } }>
  founder: { slotsLeft: number; total: number; available: boolean; alreadyFounder: boolean }
  balanceAvailable: string
  payments: import('@peaje/db').BillingPayment[]
  checkout: { founder: string | null; pro: string }
  upgradeUrl: string
}

export function leerBilling(slug: string) {
  return internal<EstadoBilling>(`/${slug}/billing`)
}

export function pagarPlanConSaldo(slug: string, plan: 'founder' | 'pro') {
  return internal<{ ok: true; plan: string; planUntil: string }>(`/${slug}/billing/pay-with-balance`, { method: 'POST', body: JSON.stringify({ plan }) })
}
// ---- fin M9 ----
