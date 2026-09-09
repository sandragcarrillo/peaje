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

/**
 * Store en memoria. Corre el gateway y el dashboard sin Supabase, con la misma
 * interfaz. Se pierde al reiniciar: sirve para desarrollo y para el fallback
 * si no hay credenciales configuradas.
 */
export class MemoryStore implements Store {
  #tenants = new Map<string, Tenant>()
  #origins = new Map<string, Set<string>>()
  #routes = new Map<string, Route[]>()
  #payments: Payment[] = []
  #withdrawals: Withdrawal[] = []
  #seq = 0

  #id(prefix: string) {
    return `${prefix}_${++this.#seq}`
  }

  async createTenant(input: NewTenant): Promise<Tenant> {
    if ([...this.#tenants.values()].some((t) => t.slug === input.slug)) {
      throw new Error(`El slug "${input.slug}" ya existe`)
    }
    const tenant: Tenant = {
      id: this.#id('ten'),
      slug: input.slug,
      name: input.name,
      apiKeyPrefix: input.apiKeyPrefix ?? null,
      embedSecret: input.embedSecret,
      originUrl: input.originUrl,
      payoutWallet: input.payoutWallet ?? null,
      email: input.email ?? null,
      privyUserId: input.privyUserId ?? null,
      createdAt: new Date().toISOString(),
    }
    this.#tenants.set(tenant.id, tenant)
    if (input.apiKeyHash) this.#hashes.set(input.apiKeyHash, tenant.id)
    if (input.privyUserId) this.#privyUserIds.set(input.privyUserId, tenant.id)
    this.#routes.set(tenant.id, [])
    this.#origins.set(tenant.id, new Set())
    return tenant
  }

  #hashes = new Map<string, string>()
  #privyUserIds = new Map<string, string>()

  async getTenantBySlug(slug: string) {
    return [...this.#tenants.values()].find((t) => t.slug === slug) ?? null
  }

  async getTenantById(id: string) {
    return this.#tenants.get(id) ?? null
  }

  async getTenantByApiKeyHash(hash: string) {
    const id = this.#hashes.get(hash)
    return id ? (this.#tenants.get(id) ?? null) : null
  }

  async getTenantByPrivyUserId(privyUserId: string) {
    const id = this.#privyUserIds.get(privyUserId)
    return id ? (this.#tenants.get(id) ?? null) : null
  }

  async listTenants() {
    return [...this.#tenants.values()]
  }

  async setPayoutWallet(tenantId: string, wallet: string) {
    const tenant = this.#tenants.get(tenantId)
    if (tenant) tenant.payoutWallet = wallet
  }

  async listAllowedOrigins(tenantId: string) {
    return [...(this.#origins.get(tenantId) ?? [])]
  }

  async addAllowedOrigin(tenantId: string, origin: string) {
    if (!this.#origins.has(tenantId)) this.#origins.set(tenantId, new Set())
    this.#origins.get(tenantId)!.add(origin)
  }

  async removeAllowedOrigin(tenantId: string, origin: string) {
    this.#origins.get(tenantId)?.delete(origin)
  }

  async listRoutes(tenantId: string) {
    return (this.#routes.get(tenantId) ?? []).filter((r) => r.active)
  }

  async createRoute(input: NewRoute): Promise<Route> {
    const route: Route = {
      id: this.#id('rte'),
      tenantId: input.tenantId,
      method: input.method.toUpperCase(),
      pathPattern: input.pathPattern,
      priceUsd: input.priceUsd,
      description: input.description ?? null,
      active: true,
    }
    const list = this.#routes.get(input.tenantId) ?? []
    const duplicate = list.find(
      (r) => r.active && r.method === route.method && r.pathPattern === route.pathPattern,
    )
    if (duplicate) throw new Error(`Ya existe una ruta ${route.method} ${route.pathPattern}`)
    list.push(route)
    this.#routes.set(input.tenantId, list)
    return route
  }

  async deleteRoute(tenantId: string, routeId: string) {
    const list = this.#routes.get(tenantId) ?? []
    const route = list.find((r) => r.id === routeId)
    if (route) route.active = false
  }

  #resources = new Map<string, Resource[]>()

  async listResources(tenantId: string) {
    return (this.#resources.get(tenantId) ?? []).filter((r) => r.active)
  }

  async getResource(tenantId: string, slug: string) {
    return (await this.listResources(tenantId)).find((r) => r.slug === slug) ?? null
  }

  async createResources(inputs: NewResource[]) {
    const created: Resource[] = []
    for (const input of inputs) {
      const list = this.#resources.get(input.tenantId) ?? []
      if (list.some((r) => r.active && r.slug === input.slug)) continue
      const row: Resource = {
        id: this.#id('res'),
        tenantId: input.tenantId,
        slug: input.slug,
        url: input.url,
        title: input.title ?? null,
        priceUsd: input.priceUsd,
        active: true,
      }
      list.push(row)
      this.#resources.set(input.tenantId, list)
      created.push(row)
    }
    return created
  }

  async deleteResource(tenantId: string, resourceId: string) {
    const row = (this.#resources.get(tenantId) ?? []).find((r) => r.id === resourceId)
    if (row) row.active = false
  }

  async recordPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'refundTx'>) {
    const existing = this.#payments.find(
      (p) => p.receiptRef === payment.receiptRef && p.network === payment.network,
    )
    if (existing) return existing
    const row: Payment = {
      ...payment,
      id: this.#id('pay'),
      refundTx: null,
      createdAt: new Date().toISOString(),
    }
    this.#payments.push(row)
    return row
  }

  async setPaymentWallet(paymentId: string, wallet: string) {
    const row = this.#payments.find((p) => p.id === paymentId)
    if (row) row.agentWallet = wallet
  }

  async markPaymentRefunded(paymentId: string, txRef: string) {
    const row = this.#payments.find((p) => p.id === paymentId)
    if (row) row.refundTx = txRef
  }

  async listPayments(tenantId: string, limit = 50) {
    return this.#payments
      .filter((p) => p.tenantId === tenantId)
      .slice(-limit)
      .reverse()
  }

  async balance(tenantId: string): Promise<Balance> {
    const payments = this.#payments.filter((p) => p.tenantId === tenantId && !p.refundTx)
    const revenue = payments.reduce((acc, p) => acc + Number(p.amount), 0)
    const withdrawn = this.#withdrawals
      .filter((w) => w.tenantId === tenantId && w.status !== 'failed')
      .reduce((acc, w) => acc + Number(w.amount), 0)
    return {
      revenue: revenue.toFixed(6),
      withdrawn: withdrawn.toFixed(6),
      available: (revenue - withdrawn).toFixed(6),
      requestCount: payments.length,
    }
  }

  async balanceByNetwork(tenantId: string): Promise<NetworkBalance[]> {
    const networks = new Set<string>(['tempo', 'arc'])
    for (const p of this.#payments) if (p.tenantId === tenantId) networks.add(p.network)
    for (const w of this.#withdrawals) if (w.tenantId === tenantId) networks.add(w.network)
    return [...networks].sort().map((network) => {
      const payments = this.#payments.filter(
        (p) => p.tenantId === tenantId && p.network === network && !p.refundTx,
      )
      const revenue = payments.reduce((acc, p) => acc + Number(p.amount), 0)
      const withdrawn = this.#withdrawals
        .filter((w) => w.tenantId === tenantId && w.network === network && w.status !== 'failed')
        .reduce((acc, w) => acc + Number(w.amount), 0)
      return {
        network,
        revenue: revenue.toFixed(6),
        withdrawn: withdrawn.toFixed(6),
        available: (revenue - withdrawn).toFixed(6),
        requestCount: payments.length,
      }
    })
  }

  async dailyRevenue(tenantId: string, days: number) {
    const buckets = new Map<string, { amount: number; count: number }>()
    const since = Date.now() - days * 86_400_000
    for (const p of this.#payments) {
      if (p.tenantId !== tenantId || p.refundTx) continue
      const time = new Date(p.createdAt).getTime()
      if (time < since) continue
      const date = p.createdAt.slice(0, 10)
      const bucket = buckets.get(date) ?? { amount: 0, count: 0 }
      bucket.amount += Number(p.amount)
      bucket.count += 1
      buckets.set(date, bucket)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, amount: b.amount.toFixed(6), count: b.count }))
  }

  async createWithdrawal(input: { tenantId: string; amount: string; toWallet: string; network: string }) {
    const row: Withdrawal = {
      id: this.#id('wdr'),
      tenantId: input.tenantId,
      amount: input.amount,
      toWallet: input.toWallet,
      txRef: null,
      status: 'pending',
      network: input.network,
      createdAt: new Date().toISOString(),
    }
    this.#withdrawals.push(row)
    return row
  }

  async updateWithdrawal(id: string, patch: { txRef?: string; status?: WithdrawalStatus }) {
    const row = this.#withdrawals.find((w) => w.id === id)
    if (!row) throw new Error(`Retiro ${id} no existe`)
    if (patch.txRef !== undefined) row.txRef = patch.txRef
    if (patch.status !== undefined) row.status = patch.status
    return row
  }

  async listWithdrawals(tenantId: string, limit = 20) {
    return this.#withdrawals
      .filter((w) => w.tenantId === tenantId)
      .slice(-limit)
      .reverse()
  }

  async getWithdrawal(id: string) {
    return this.#withdrawals.find((w) => w.id === id) ?? null
  }
}
