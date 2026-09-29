import type {
  Agent,
  AgentRun,
  Balance,
  NetworkBalance,
  NewAgent,
  NewAgentRun,
  NewPayment,
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
  AgentTask,
  AgentTaskPatch,
  NewAgentTask,
  TaskStatus,
  AgentPlan,
  NewAgentPlan,
  AgentAction,
  AgentMessage,
  NewAgentMessage,
  CitationPrompt,
  CitationRun,
  NewCitationRun,
} from './types'
import { aggregateVisits } from './visits'

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
      baselineScore: null,
      baselineScoreAt: null,
      entityLogoUrl: null,
      entityPhone: null,
      entityAddress: null,
      entitySameAs: [],
      entityDescription: null,
      robotsBlockTraining: false,
      plan: 'free',
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
    return (await this.listTenantsByPrivyUserId(privyUserId))[0] ?? null
  }

  async listTenantsByPrivyUserId(privyUserId: string) {
    return [...this.#tenants.values()]
      .filter((t) => t.privyUserId === privyUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async listTenants() {
    return [...this.#tenants.values()]
  }

  async setPayoutWallet(tenantId: string, wallet: string) {
    const tenant = this.#tenants.get(tenantId)
    if (tenant) tenant.payoutWallet = wallet
  }

  async updateTenantEntity(tenantId: string, patch: TenantEntityUpdate) {
    const tenant = this.#tenants.get(tenantId)
    if (!tenant) return
    // Solo las claves definidas: un patch parcial no debe borrar lo demás.
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) (tenant as unknown as Record<string, unknown>)[k] = v
    }
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

  async setBaselineScore(tenantId: string, score: number) {
    const t = [...this.#tenants.values()].find((x) => x.id === tenantId)
    if (t && t.baselineScore === null) {
      t.baselineScore = score
      t.baselineScoreAt = new Date().toISOString()
    }
  }

  async setTenantApiKey(tenantId: string, hash: string, prefix: string): Promise<void> {
    const t = [...this.#tenants.values()].find((x) => x.id === tenantId)
    if (!t) return
    for (const [h, id] of this.#hashes) if (id === tenantId) this.#hashes.delete(h)
    this.#hashes.set(hash, tenantId)
    t.apiKeyPrefix = prefix
  }

  #tasks: AgentTask[] = []

  async upsertTask(task: NewAgentTask): Promise<{ task: AgentTask; created: boolean }> {
    const previa = this.#tasks.find((t) => t.tenantId === task.tenantId && t.key === task.key)
    const ahora = new Date().toISOString()
    if (previa) {
      if (previa.status !== 'open') return { task: previa, created: false }
      Object.assign(previa, { kind: task.kind, title: task.title, summary: task.summary, body: task.body, acceptance: task.acceptance, updatedAt: ahora })
      return { task: previa, created: false }
    }
    const nueva: AgentTask = {
      id: this.#id('tsk'),
      tenantId: task.tenantId,
      key: task.key,
      kind: task.kind,
      title: task.title,
      summary: task.summary,
      body: task.body,
      acceptance: task.acceptance,
      status: 'open',
      source: task.source ?? 'agent',
      note: null,
      doneUrl: null,
      createdAt: ahora,
      updatedAt: ahora,
      doneAt: null,
      verifiedAt: null,
    }
    this.#tasks.push(nueva)
    return { task: nueva, created: true }
  }

  async listTasks(tenantId: string, opts: { statuses?: TaskStatus[] } = {}): Promise<AgentTask[]> {
    return this.#tasks
      .filter((t) => t.tenantId === tenantId && (!opts.statuses?.length || opts.statuses.includes(t.status)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getTask(tenantId: string, id: string): Promise<AgentTask | null> {
    return this.#tasks.find((t) => t.tenantId === tenantId && t.id === id) ?? null
  }

  async updateTask(tenantId: string, id: string, patch: AgentTaskPatch): Promise<AgentTask> {
    const t = this.#tasks.find((x) => x.tenantId === tenantId && x.id === id)
    if (!t) throw new Error('Tarea no encontrada')
    Object.assign(t, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: new Date().toISOString() })
    return t
  }

  #messages: AgentMessage[] = []

  async listMessages(tenantId: string, limit: number): Promise<AgentMessage[]> {
    return this.#messages.filter((m) => m.tenantId === tenantId).slice(-limit)
  }

  async addMessage(m: NewAgentMessage): Promise<AgentMessage> {
    const nuevo: AgentMessage = { id: this.#id('msg'), tenantId: m.tenantId, role: m.role, text: m.text, actions: m.actions ?? [], options: m.options ?? [], channel: m.channel ?? 'dashboard', createdAt: new Date().toISOString() }
    this.#messages.push(nuevo)
    return nuevo
  }

  async getMessage(tenantId: string, id: string): Promise<AgentMessage | null> {
    return this.#messages.find((m) => m.tenantId === tenantId && m.id === id) ?? null
  }

  async setMessageActions(tenantId: string, id: string, actions: AgentAction[]): Promise<void> {
    const m = this.#messages.find((x) => x.tenantId === tenantId && x.id === id)
    if (m) m.actions = actions
  }

  #prompts: CitationPrompt[] = []
  #runs: CitationRun[] = []

  async listCitationPrompts(tenantId: string): Promise<CitationPrompt[]> {
    return this.#prompts.filter((p) => p.tenantId === tenantId && p.active)
  }

  async addCitationPrompts(tenantId: string, texts: string[], source: CitationPrompt['source']): Promise<CitationPrompt[]> {
    const nuevos = texts.map((text) => ({ id: this.#id('cpr'), tenantId, text, source, active: true, createdAt: new Date().toISOString() }))
    this.#prompts.push(...nuevos)
    return nuevos
  }

  async removeCitationPrompt(tenantId: string, id: string): Promise<void> {
    const p = this.#prompts.find((x) => x.tenantId === tenantId && x.id === id)
    if (p) p.active = false
  }

  async recordCitationRuns(runs: NewCitationRun[]): Promise<void> {
    this.#runs.unshift(...runs.map((r) => ({ ...r, id: this.#id('crn'), runAt: new Date().toISOString() })))
  }

  async listCitationRuns(tenantId: string, rounds: number): Promise<CitationRun[]> {
    const filas = this.#runs.filter((r) => r.tenantId === tenantId)
    const rondas = [...new Set(filas.map((r) => r.roundId))].slice(0, rounds)
    return filas.filter((r) => rondas.includes(r.roundId))
  }

  async clearMessages(tenantId: string): Promise<void> {
    this.#messages = this.#messages.filter((m) => m.tenantId !== tenantId)
  }

  #plans = new Map<string, AgentPlan>()

  async getPlan(tenantId: string): Promise<AgentPlan | null> {
    return this.#plans.get(tenantId) ?? null
  }

  async savePlan(plan: NewAgentPlan): Promise<AgentPlan> {
    const ahora = new Date().toISOString()
    const guardado = { ...plan, createdAt: ahora, updatedAt: ahora }
    this.#plans.set(plan.tenantId, guardado)
    return guardado
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

  async updateRoute(tenantId: string, routeId: string, patch: UpdateRoute): Promise<Route> {
    const route = (this.#routes.get(tenantId) ?? []).find((r) => r.id === routeId && r.active)
    if (!route) throw new Error('Ruta no encontrada')
    if (patch.priceUsd !== undefined) route.priceUsd = patch.priceUsd
    if (patch.description !== undefined) route.description = patch.description
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

  async recordPayment(payment: NewPayment) {
    const existing = this.#payments.find(
      (p) => p.receiptRef === payment.receiptRef && p.network === payment.network,
    )
    if (existing) return existing
    const row: Payment = {
      platformFee: '0',
      networkFee: '0',
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

  async listPendingWithdrawals(limit = 20) {
    return this.#withdrawals.filter((w) => w.status === 'pending' && w.txRef).slice(0, limit)
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

  // ---- agentes compradores ----

  #agents: Agent[] = []
  #agentRuns: AgentRun[] = []

  async createAgent(input: NewAgent): Promise<Agent> {
    const row: Agent = {
      id: this.#id('agt'),
      tenantId: input.tenantId,
      name: input.name,
      mission: input.mission,
      walletAddress: input.walletAddress,
      privyWalletId: input.privyWalletId ?? null,
      network: input.network,
      maxPerRun: input.maxPerRun,
      deliveryKind: input.deliveryKind ?? 'dashboard',
      deliveryTarget: input.deliveryTarget ?? null,
      frequency: input.frequency,
      status: 'idle',
      runsMax: input.runsMax ?? null,
      runsCount: 0,
      nextRunAt: input.nextRunAt ?? null,
      lastRunAt: null,
      erc8004AgentId: null,
      erc8004ChainId: null,
      erc8004Tx: null,
      createdAt: new Date().toISOString(),
    }
    this.#agents.push(row)
    return row
  }

  async listAgents(tenantId: string) {
    return this.#agents.filter((a) => a.tenantId === tenantId).reverse()
  }

  async getAgent(id: string) {
    return this.#agents.find((a) => a.id === id) ?? null
  }

  async updateAgent(id: string, patch: Parameters<Store['updateAgent']>[1]) {
    const row = this.#agents.find((a) => a.id === id)
    if (!row) throw new Error(`Agente ${id} no existe`)
    Object.assign(row, patch)
    return row
  }

  async deleteAgent(tenantId: string, agentId: string) {
    this.#agents = this.#agents.filter((a) => !(a.id === agentId && a.tenantId === tenantId))
  }

  async listDueAgents(now: string, limit = 20) {
    return this.#agents
      .filter((a) => a.status === 'idle' && a.nextRunAt !== null && a.nextRunAt <= now)
      .sort((a, b) => (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? ''))
      .slice(0, limit)
  }

  async claimAgent(id: string) {
    const row = this.#agents.find((a) => a.id === id)
    if (!row || row.status !== 'idle') return null
    row.status = 'running'
    row.nextRunAt = null
    return row
  }

  async recordAgentRun(input: NewAgentRun): Promise<AgentRun> {
    const row: AgentRun = {
      ...input,
      id: this.#id('run'),
      deliveredAt: null,
      deliveryError: null,
      createdAt: new Date().toISOString(),
    }
    this.#agentRuns.push(row)
    return row
  }

  async markRunDelivered(runId: string, error?: string | null) {
    const row = this.#agentRuns.find((r) => r.id === runId)
    if (row) {
      row.deliveredAt = error ? null : new Date().toISOString()
      row.deliveryError = error ?? null
    }
  }

  async listAgentRuns(agentId: string, limit = 20) {
    return this.#agentRuns
      .filter((r) => r.agentId === agentId)
      .slice(-limit)
      .reverse()
  }

  // ---- monitoreo ----

  #verificaciones: Verificacion[] = []

  async recordVerification(v: NewVerificacion): Promise<Verificacion> {
    const row: Verificacion = { ...v, id: this.#id('ver'), runAt: new Date().toISOString() }
    this.#verificaciones.unshift(row)
    return row
  }

  async lastVerification(tenantId: string) {
    return this.#verificaciones.find((v) => v.tenantId === tenantId) ?? null
  }

  async verificationHistory(tenantId: string, limit: number) {
    return this.#verificaciones.filter((v) => v.tenantId === tenantId).slice(0, limit)
  }

  async markAlerted(id: string, events: string[]) {
    const v = this.#verificaciones.find((x) => x.id === id)
    if (v) v.alerted = events
  }

  // ---- visitas de agentes ----

  #visits: NewVisit[] = []

  async recordVisit(visit: NewVisit) {
    this.#visits.push(visit)
  }

  async recordVisits(visits: NewVisit[]) {
    this.#visits.push(...visits)
  }

  async visitStats(tenantId: string, opts: { days: number }): Promise<VisitStats> {
    const rows = this.#visits
      .filter((v) => v.tenantId === tenantId)
      .map((v) => ({
        ...v,
        agentWallet: v.paymentId ? this.#payments.find((p) => p.id === v.paymentId)?.agentWallet ?? null : null,
      }))
    return aggregateVisits(rows, opts.days)
  }

  async findPaymentByReceiptRef(receiptRef: string) {
    return this.#payments.find((p) => p.receiptRef === receiptRef) ?? null
  }
}
