import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Agent,
  AgentRun,
  Balance,
  NewAgent,
  NewAgentRun,
  NewPayment,
  NetworkBalance,
  NewResource,
  NewRoute,
  NewTenant,
  NewVerificacion,
  NewVisit,
  Resource,
  Payment,
  Route,
  Store,
  Tenant,
  TenantEntityUpdate,
  Verificacion,
  VisitStats,
  Withdrawal,
  WithdrawalStatus,
  UpdateRoute,
} from './types'
import { aggregateVisits, type VisitRow } from './visits'

type Row = Record<string, any>

function tenantFrom(row: Row): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    apiKeyPrefix: row.api_key_prefix,
    embedSecret: row.embed_secret,
    originUrl: row.origin_url,
    payoutWallet: row.payout_wallet,
    baselineScore: row.baseline_score ?? null,
    baselineScoreAt: row.baseline_score_at ?? null,
    // `??` a propósito: hasta que corra la migración 20260922 estas columnas
    // no existen y la fila llega sin ellas. El gateway tiene que seguir andando.
    entityLogoUrl: row.entity_logo_url ?? null,
    entityPhone: row.entity_phone ?? null,
    entityAddress: row.entity_address ?? null,
    entitySameAs: Array.isArray(row.entity_same_as) ? row.entity_same_as : [],
    entityDescription: row.entity_description ?? null,
    robotsBlockTraining: row.robots_block_training ?? false,
    plan: row.plan ?? 'free',
    email: row.email,
    privyUserId: row.privy_user_id,
    createdAt: row.created_at,
  }
}

function routeFrom(row: Row): Route {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    method: row.method,
    pathPattern: row.path_pattern,
    priceUsd: String(row.price_usd),
    description: row.description,
    active: row.active,
  }
}

function resourceFrom(row: Row): Resource {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    url: row.url,
    title: row.title,
    priceUsd: String(row.price_usd),
    active: row.active,
  }
}

function paymentFrom(row: Row): Payment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    routeId: row.route_id,
    path: row.path,
    agentWallet: row.agent_wallet,
    amount: String(row.amount),
    receiptRef: row.receipt_ref,
    method: row.method,
    network: row.network ?? 'tempo',
    refundTx: row.refund_tx ?? null,
    platformFee: String(row.platform_fee ?? '0'),
    networkFee: String(row.network_fee ?? '0'),
    createdAt: row.created_at,
  }
}

function verificacionFrom(row: Row): Verificacion {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    runAt: row.run_at,
    checks: (row.checks ?? []) as unknown[],
    ok: Boolean(row.ok),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    robotsHash: row.robots_hash ?? null,
    llmsHash: row.llms_hash ?? null,
    alerted: (row.alerted ?? []) as string[],
    pending: (row.pending ?? []) as string[],
  }
}

function withdrawalFrom(row: Row): Withdrawal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    amount: String(row.amount),
    toWallet: row.to_wallet,
    txRef: row.tx_ref,
    status: row.status,
    network: row.network ?? 'tempo',
    createdAt: row.created_at,
  }
}

function agentFrom(row: Row): Agent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    mission: row.mission,
    walletAddress: row.wallet_address,
    privyWalletId: row.privy_wallet_id,
    network: row.network,
    maxPerRun: String(row.max_per_run),
    deliveryKind: row.delivery_kind ?? 'dashboard',
    deliveryTarget: row.delivery_target ?? null,
    frequency: row.frequency,
    status: row.status,
    runsMax: row.runs_max,
    runsCount: row.runs_count ?? 0,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    erc8004AgentId: row.erc8004_agent_id ?? null,
    erc8004ChainId: row.erc8004_chain_id ?? null,
    erc8004Tx: row.erc8004_tx ?? null,
    createdAt: row.created_at,
  }
}

function agentRunFrom(row: Row): AgentRun {
  return {
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    decision: row.decision,
    targetUrl: row.target_url,
    amount: row.amount === null || row.amount === undefined ? null : String(row.amount),
    network: row.network,
    receiptRef: row.receipt_ref,
    resultExcerpt: row.result_excerpt,
    result: row.result ?? null,
    error: row.error,
    deliveredAt: row.delivered_at ?? null,
    deliveryError: row.delivery_error ?? null,
    createdAt: row.created_at,
  }
}

/** Todo pasa por service role: el esquema tiene RLS prendido sin políticas. */
export class SupabaseStore implements Store {
  #db: SupabaseClient

  constructor(url: string, serviceRoleKey: string) {
    this.#db = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  }

  #fail(context: string, error: { message: string } | null): never | void {
    if (error) throw new Error(`[supabase] ${context}: ${error.message}`)
  }

  async createTenant(input: NewTenant): Promise<Tenant> {
    const { data, error } = await this.#db
      .from('tenants')
      .insert({
        slug: input.slug,
        name: input.name,
        origin_url: input.originUrl,
        api_key_hash: input.apiKeyHash ?? null,
        api_key_prefix: input.apiKeyPrefix ?? null,
        embed_secret: input.embedSecret,
        payout_wallet: input.payoutWallet ?? null,
        email: input.email ?? null,
        privy_user_id: input.privyUserId ?? null,
      })
      .select()
      .single()
    this.#fail('createTenant', error)
    return tenantFrom(data as Row)
  }

  async #tenantWhere(column: string, value: string): Promise<Tenant | null> {
    const { data, error } = await this.#db.from('tenants').select().eq(column, value).maybeSingle()
    this.#fail(`getTenant(${column})`, error)
    return data ? tenantFrom(data as Row) : null
  }

  getTenantBySlug = (slug: string) => this.#tenantWhere('slug', slug)
  getTenantById = (id: string) => this.#tenantWhere('id', id)
  getTenantByApiKeyHash = (hash: string) => this.#tenantWhere('api_key_hash', hash)
  // Con multi-negocio puede haber varios: devuelve el más reciente.
  getTenantByPrivyUserId = async (privyUserId: string) =>
    (await this.listTenantsByPrivyUserId(privyUserId))[0] ?? null

  async listTenantsByPrivyUserId(privyUserId: string): Promise<Tenant[]> {
    const { data, error } = await this.#db
      .from('tenants')
      .select()
      .eq('privy_user_id', privyUserId)
      .order('created_at', { ascending: false })
    this.#fail('listTenantsByPrivyUserId', error)
    return (data ?? []).map(tenantFrom)
  }

  async listTenants(): Promise<Tenant[]> {
    const { data, error } = await this.#db
      .from('tenants')
      .select()
      .order('created_at', { ascending: false })
    this.#fail('listTenants', error)
    return (data ?? []).map(tenantFrom)
  }

  async setPayoutWallet(tenantId: string, wallet: string) {
    const { error } = await this.#db
      .from('tenants')
      .update({ payout_wallet: wallet })
      .eq('id', tenantId)
    this.#fail('setPayoutWallet', error)
  }

  async updateTenantEntity(tenantId: string, patch: TenantEntityUpdate): Promise<void> {
    const fila: Row = {}
    if (patch.entityLogoUrl !== undefined) fila.entity_logo_url = patch.entityLogoUrl
    if (patch.entityPhone !== undefined) fila.entity_phone = patch.entityPhone
    if (patch.entityAddress !== undefined) fila.entity_address = patch.entityAddress
    if (patch.entitySameAs !== undefined) fila.entity_same_as = patch.entitySameAs
    if (patch.entityDescription !== undefined) fila.entity_description = patch.entityDescription
    if (patch.robotsBlockTraining !== undefined) fila.robots_block_training = patch.robotsBlockTraining
    if (Object.keys(fila).length === 0) return
    const { error } = await this.#db.from('tenants').update(fila).eq('id', tenantId)
    this.#fail('updateTenantEntity', error)
  }

  async setBaselineScore(tenantId: string, score: number): Promise<void> {
    // Solo la primera vez: el baseline es el "antes" y no se pisa.
    const { error } = await this.#db
      .from('tenants')
      .update({ baseline_score: score, baseline_score_at: new Date().toISOString() })
      .eq('id', tenantId)
      .is('baseline_score', null)
    this.#fail('setBaselineScore', error)
  }

  async listAllowedOrigins(tenantId: string) {
    const { data, error } = await this.#db
      .from('allowed_origins')
      .select('origin')
      .eq('tenant_id', tenantId)
    this.#fail('listAllowedOrigins', error)
    return (data ?? []).map((r: Row) => r.origin as string)
  }

  async addAllowedOrigin(tenantId: string, origin: string) {
    const { error } = await this.#db
      .from('allowed_origins')
      .upsert({ tenant_id: tenantId, origin }, { onConflict: 'tenant_id,origin' })
    this.#fail('addAllowedOrigin', error)
  }

  async removeAllowedOrigin(tenantId: string, origin: string) {
    const { error } = await this.#db
      .from('allowed_origins')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('origin', origin)
    this.#fail('removeAllowedOrigin', error)
  }

  async listRoutes(tenantId: string): Promise<Route[]> {
    const { data, error } = await this.#db
      .from('routes')
      .select()
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('created_at', { ascending: true })
    this.#fail('listRoutes', error)
    return (data ?? []).map(routeFrom)
  }

  async createRoute(input: NewRoute): Promise<Route> {
    const { data, error } = await this.#db
      .from('routes')
      .insert({
        tenant_id: input.tenantId,
        method: input.method.toUpperCase(),
        path_pattern: input.pathPattern,
        price_usd: input.priceUsd,
        description: input.description ?? null,
      })
      .select()
      .single()
    this.#fail('createRoute', error)
    return routeFrom(data as Row)
  }

  async updateRoute(tenantId: string, routeId: string, patch: UpdateRoute): Promise<Route> {
    const cambios: Record<string, unknown> = {}
    if (patch.priceUsd !== undefined) cambios.price_usd = patch.priceUsd
    if (patch.description !== undefined) cambios.description = patch.description
    const { data, error } = await this.#db
      .from('routes')
      .update(cambios)
      .eq('tenant_id', tenantId)
      .eq('id', routeId)
      .eq('active', true)
      .select()
      .single()
    this.#fail('updateRoute', error)
    return routeFrom(data as Row)
  }

  async deleteRoute(tenantId: string, routeId: string) {
    const { error } = await this.#db
      .from('routes')
      .update({ active: false })
      .eq('tenant_id', tenantId)
      .eq('id', routeId)
    this.#fail('deleteRoute', error)
  }

  async listResources(tenantId: string): Promise<Resource[]> {
    const { data, error } = await this.#db
      .from('resources')
      .select()
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('created_at', { ascending: true })
    this.#fail('listResources', error)
    return (data ?? []).map(resourceFrom)
  }

  async getResource(tenantId: string, slug: string): Promise<Resource | null> {
    const { data, error } = await this.#db
      .from('resources')
      .select()
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()
    this.#fail('getResource', error)
    return data ? resourceFrom(data as Row) : null
  }

  async createResources(inputs: NewResource[]): Promise<Resource[]> {
    if (inputs.length === 0) return []
    const { data, error } = await this.#db
      .from('resources')
      .upsert(
        inputs.map((r) => ({
          tenant_id: r.tenantId,
          slug: r.slug,
          url: r.url,
          title: r.title ?? null,
          price_usd: r.priceUsd,
          active: true,
        })),
        { onConflict: 'tenant_id,slug' },
      )
      .select()
    this.#fail('createResources', error)
    return (data ?? []).map(resourceFrom)
  }

  async deleteResource(tenantId: string, resourceId: string): Promise<void> {
    const { error } = await this.#db
      .from('resources')
      .update({ active: false })
      .eq('tenant_id', tenantId)
      .eq('id', resourceId)
    this.#fail('deleteResource', error)
  }

  async recordPayment(payment: NewPayment): Promise<Payment> {
    // (network, receipt_ref) es único: si el Receipt ya se acreditó, devolvemos el existente.
    const { data, error } = await this.#db
      .from('payments')
      .upsert(
        {
          tenant_id: payment.tenantId,
          route_id: payment.routeId,
          path: payment.path,
          agent_wallet: payment.agentWallet,
          amount: payment.amount,
          receipt_ref: payment.receiptRef,
          method: payment.method,
          network: payment.network,
          platform_fee: payment.platformFee ?? '0',
          network_fee: payment.networkFee ?? '0',
        },
        { onConflict: 'network,receipt_ref' },
      )
      .select()
      .single()
    this.#fail('recordPayment', error)
    return paymentFrom(data as Row)
  }

  async setPaymentWallet(paymentId: string, wallet: string) {
    const { error } = await this.#db
      .from('payments')
      .update({ agent_wallet: wallet })
      .eq('id', paymentId)
    this.#fail('setPaymentWallet', error)
  }

  async markPaymentRefunded(paymentId: string, txRef: string) {
    const { error } = await this.#db
      .from('payments')
      .update({ refund_tx: txRef })
      .eq('id', paymentId)
    this.#fail('markPaymentRefunded', error)
  }

  async listPayments(tenantId: string, limit = 50): Promise<Payment[]> {
    const { data, error } = await this.#db
      .from('payments')
      .select()
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)
    this.#fail('listPayments', error)
    return (data ?? []).map(paymentFrom)
  }

  async balance(tenantId: string): Promise<Balance> {
    const { data, error } = await this.#db
      .from('tenant_balances')
      .select()
      .eq('tenant_id', tenantId)
      .maybeSingle()
    this.#fail('balance', error)
    const row = (data ?? {}) as Row
    return {
      revenue: String(row.revenue ?? '0'),
      withdrawn: String(row.withdrawn ?? '0'),
      available: String(row.available ?? '0'),
      requestCount: Number(row.request_count ?? 0),
    }
  }

  async balanceByNetwork(tenantId: string): Promise<NetworkBalance[]> {
    const { data, error } = await this.#db
      .from('tenant_network_balances')
      .select()
      .eq('tenant_id', tenantId)
      .order('network', { ascending: true })
    this.#fail('balanceByNetwork', error)
    return ((data ?? []) as Row[]).map((row) => ({
      network: row.network,
      revenue: String(row.revenue ?? '0'),
      withdrawn: String(row.withdrawn ?? '0'),
      available: String(row.available ?? '0'),
      requestCount: Number(row.request_count ?? 0),
    }))
  }

  async dailyRevenue(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data, error } = await this.#db
      .from('payments')
      .select('amount, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
    this.#fail('dailyRevenue', error)
    const buckets = new Map<string, { amount: number; count: number }>()
    for (const row of (data ?? []) as Row[]) {
      const date = String(row.created_at).slice(0, 10)
      const bucket = buckets.get(date) ?? { amount: 0, count: 0 }
      bucket.amount += Number(row.amount)
      bucket.count += 1
      buckets.set(date, bucket)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, amount: b.amount.toFixed(6), count: b.count }))
  }

  async createWithdrawal(input: { tenantId: string; amount: string; toWallet: string; network: string }) {
    const { data, error } = await this.#db
      .from('withdrawals')
      .insert({
        tenant_id: input.tenantId,
        amount: input.amount,
        to_wallet: input.toWallet,
        network: input.network,
      })
      .select()
      .single()
    this.#fail('createWithdrawal', error)
    return withdrawalFrom(data as Row)
  }

  async updateWithdrawal(id: string, patch: { txRef?: string; status?: WithdrawalStatus }) {
    const update: Row = {}
    if (patch.txRef !== undefined) update.tx_ref = patch.txRef
    if (patch.status !== undefined) {
      update.status = patch.status
      if (patch.status === 'confirmed') update.confirmed_at = new Date().toISOString()
    }
    const { data, error } = await this.#db
      .from('withdrawals')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    this.#fail('updateWithdrawal', error)
    return withdrawalFrom(data as Row)
  }

  async listPendingWithdrawals(limit = 20): Promise<Withdrawal[]> {
    const { data, error } = await this.#db
      .from('withdrawals')
      .select()
      .eq('status', 'pending')
      .not('tx_ref', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit)
    this.#fail('listPendingWithdrawals', error)
    return (data ?? []).map(withdrawalFrom)
  }

  async listWithdrawals(tenantId: string, limit = 20): Promise<Withdrawal[]> {
    const { data, error } = await this.#db
      .from('withdrawals')
      .select()
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)
    this.#fail('listWithdrawals', error)
    return (data ?? []).map(withdrawalFrom)
  }

  async getWithdrawal(id: string): Promise<Withdrawal | null> {
    const { data, error } = await this.#db.from('withdrawals').select().eq('id', id).maybeSingle()
    this.#fail('getWithdrawal', error)
    return data ? withdrawalFrom(data as Row) : null
  }

  // ---- agentes compradores ----

  async createAgent(input: NewAgent): Promise<Agent> {
    const { data, error } = await this.#db
      .from('agents')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        mission: input.mission,
        wallet_address: input.walletAddress,
        privy_wallet_id: input.privyWalletId ?? null,
        network: input.network,
        max_per_run: input.maxPerRun,
        delivery_kind: input.deliveryKind ?? 'dashboard',
        delivery_target: input.deliveryTarget ?? null,
        frequency: input.frequency,
        runs_max: input.runsMax ?? null,
        next_run_at: input.nextRunAt ?? null,
      })
      .select()
      .single()
    this.#fail('createAgent', error)
    return agentFrom(data as Row)
  }

  async listAgents(tenantId: string): Promise<Agent[]> {
    const { data, error } = await this.#db
      .from('agents')
      .select()
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    this.#fail('listAgents', error)
    return (data ?? []).map(agentFrom)
  }

  async getAgent(id: string): Promise<Agent | null> {
    const { data, error } = await this.#db.from('agents').select().eq('id', id).maybeSingle()
    this.#fail('getAgent', error)
    return data ? agentFrom(data as Row) : null
  }

  async updateAgent(id: string, patch: Parameters<Store['updateAgent']>[1]): Promise<Agent> {
    const update: Row = {}
    if (patch.status !== undefined) update.status = patch.status
    if (patch.mission !== undefined) update.mission = patch.mission
    if (patch.network !== undefined) update.network = patch.network
    if (patch.frequency !== undefined) update.frequency = patch.frequency
    if (patch.maxPerRun !== undefined) update.max_per_run = patch.maxPerRun
    if (patch.nextRunAt !== undefined) update.next_run_at = patch.nextRunAt
    if (patch.lastRunAt !== undefined) update.last_run_at = patch.lastRunAt
    if (patch.runsCount !== undefined) update.runs_count = patch.runsCount
    if (patch.runsMax !== undefined) update.runs_max = patch.runsMax
    if (patch.privyWalletId !== undefined) update.privy_wallet_id = patch.privyWalletId
    if (patch.erc8004AgentId !== undefined) update.erc8004_agent_id = patch.erc8004AgentId
    if (patch.erc8004ChainId !== undefined) update.erc8004_chain_id = patch.erc8004ChainId
    if (patch.erc8004Tx !== undefined) update.erc8004_tx = patch.erc8004Tx
    if (patch.deliveryKind !== undefined) update.delivery_kind = patch.deliveryKind
    if (patch.deliveryTarget !== undefined) update.delivery_target = patch.deliveryTarget
    const { data, error } = await this.#db
      .from('agents')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    this.#fail('updateAgent', error)
    return agentFrom(data as Row)
  }

  async deleteAgent(tenantId: string, agentId: string): Promise<void> {
    const { error } = await this.#db
      .from('agents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', agentId)
    this.#fail('deleteAgent', error)
  }

  async listDueAgents(now: string, limit = 20): Promise<Agent[]> {
    const { data, error } = await this.#db
      .from('agents')
      .select()
      .eq('status', 'idle')
      .not('next_run_at', 'is', null)
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(limit)
    this.#fail('listDueAgents', error)
    return (data ?? []).map(agentFrom)
  }

  async claimAgent(id: string): Promise<Agent | null> {
    // El .eq('status','idle') hace el claim atómico: si otro worker ya lo
    // tomó, la condición no matchea y no vuelve ninguna fila.
    const { data, error } = await this.#db
      .from('agents')
      .update({ status: 'running', next_run_at: null })
      .eq('id', id)
      .eq('status', 'idle')
      .select()
      .maybeSingle()
    this.#fail('claimAgent', error)
    return data ? agentFrom(data as Row) : null
  }

  async recordAgentRun(input: NewAgentRun): Promise<AgentRun> {
    const { data, error } = await this.#db
      .from('agent_runs')
      .insert({
        agent_id: input.agentId,
        status: input.status,
        decision: input.decision ?? null,
        target_url: input.targetUrl,
        amount: input.amount,
        network: input.network,
        receipt_ref: input.receiptRef,
        result_excerpt: input.resultExcerpt,
        result: input.result,
        error: input.error,
      })
      .select()
      .single()
    this.#fail('recordAgentRun', error)
    return agentRunFrom(data as Row)
  }

  async markRunDelivered(runId: string, error?: string | null): Promise<void> {
    const { error: err } = await this.#db
      .from('agent_runs')
      .update({ delivered_at: error ? null : new Date().toISOString(), delivery_error: error ?? null })
      .eq('id', runId)
    this.#fail('markRunDelivered', err)
  }

  async listAgentRuns(agentId: string, limit = 20): Promise<AgentRun[]> {
    const { data, error } = await this.#db
      .from('agent_runs')
      .select()
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)
    this.#fail('listAgentRuns', error)
    return (data ?? []).map(agentRunFrom)
  }

  // ---- monitoreo ----

  async recordVerification(v: NewVerificacion): Promise<Verificacion> {
    const { data, error } = await this.#db
      .from('verificaciones')
      .insert({
        tenant_id: v.tenantId,
        checks: v.checks,
        ok: v.ok,
        score: v.score,
        robots_hash: v.robotsHash,
        llms_hash: v.llmsHash,
        alerted: v.alerted,
        pending: v.pending,
      })
      .select()
      .single()
    this.#fail('recordVerification', error)
    return verificacionFrom(data as Row)
  }

  async lastVerification(tenantId: string): Promise<Verificacion | null> {
    const rows = await this.verificationHistory(tenantId, 1)
    return rows[0] ?? null
  }

  async verificationHistory(tenantId: string, limit: number): Promise<Verificacion[]> {
    const { data, error } = await this.#db
      .from('verificaciones')
      .select()
      .eq('tenant_id', tenantId)
      .order('run_at', { ascending: false })
      .limit(limit)
    this.#fail('verificationHistory', error)
    return ((data ?? []) as Row[]).map(verificacionFrom)
  }

  async markAlerted(id: string, events: string[]): Promise<void> {
    const { error } = await this.#db.from('verificaciones').update({ alerted: events }).eq('id', id)
    this.#fail('markAlerted', error)
  }

  // ---- visitas de agentes ----

  async recordVisit(visit: NewVisit) {
    await this.recordVisits([visit])
  }

  async recordVisits(visits: NewVisit[]) {
    if (visits.length === 0) return
    const { error } = await this.#db.from('agent_visits').insert(
      visits.map((v) => ({
        tenant_id: v.tenantId,
        at: v.at,
        path: v.path,
        method: v.method,
        user_agent: v.userAgent,
        agent_kind: v.agentKind,
        paid: v.paid,
        network: v.network,
        amount: v.amount,
        payment_id: v.paymentId,
        status: v.status,
        route_id: v.routeId,
        price_usd: v.priceUsd,
        attempted: v.attempted,
      })),
    )
    this.#fail('recordVisits', error)
  }

  async visitStats(tenantId: string, opts: { days: number }): Promise<VisitStats> {
    const since = new Date(Date.now() - opts.days * 86_400_000).toISOString()
    // La wallet del agente vive en el ledger: se trae por la FK payment_id.
    const { data, error } = await this.#db
      .from('agent_visits')
      .select('at, path, method, user_agent, agent_kind, paid, network, amount, payment_id, status, route_id, price_usd, attempted, payments(agent_wallet)')
      .eq('tenant_id', tenantId)
      .gte('at', since)
      .order('at', { ascending: false })
      .limit(20_000)
    this.#fail('visitStats', error)
    const rows: VisitRow[] = ((data ?? []) as Row[]).map((r) => ({
      tenantId,
      at: String(r.at),
      path: r.path,
      method: r.method,
      userAgent: r.user_agent ?? null,
      agentKind: r.agent_kind,
      paid: Boolean(r.paid),
      network: r.network ?? null,
      amount: r.amount === null || r.amount === undefined ? null : String(r.amount),
      paymentId: r.payment_id ?? null,
      status: Number(r.status),
      routeId: r.route_id ?? null,
      priceUsd: r.price_usd === null || r.price_usd === undefined ? null : String(r.price_usd),
      attempted: Boolean(r.attempted),
      agentWallet: r.payments?.agent_wallet ?? null,
    }))
    return aggregateVisits(rows, opts.days)
  }

  async findPaymentByReceiptRef(receiptRef: string): Promise<Payment | null> {
    const { data, error } = await this.#db
      .from('payments')
      .select()
      .eq('receipt_ref', receiptRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    this.#fail('findPaymentByReceiptRef', error)
    return data ? paymentFrom(data as Row) : null
  }
}
