import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Balance,
  NetworkBalance,
  NewResource,
  NewRoute,
  NewTenant,
  Resource,
  Payment,
  Route,
  Store,
  Tenant,
  Withdrawal,
  WithdrawalStatus,
} from './types'

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
    createdAt: row.created_at,
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

  async recordPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'refundTx'>): Promise<Payment> {
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
}
