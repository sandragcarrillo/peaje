export type Tenant = {
  id: string
  slug: string
  name: string
  apiKeyPrefix: string | null
  embedSecret: string
  originUrl: string
  payoutWallet: string | null
  email: string | null
  privyUserId: string | null
  createdAt: string
}

export type Route = {
  id: string
  tenantId: string
  method: string
  pathPattern: string
  priceUsd: string
  description: string | null
  active: boolean
}

export type Payment = {
  id: string
  tenantId: string
  routeId: string | null
  path: string
  agentWallet: string | null
  amount: string
  receiptRef: string
  method: string
  /** Red de settlement ('tempo' | 'arc'). */
  network: string
  /** Hash del refund al agente si el origin falló. No-null = no cuenta para el balance. */
  refundTx: string | null
  createdAt: string
}

export type Withdrawal = {
  id: string
  tenantId: string
  amount: string
  toWallet: string
  txRef: string | null
  status: WithdrawalStatus
  /** Red de la que sale el payout. */
  network: string
  createdAt: string
}

export type WithdrawalStatus = 'pending' | 'confirmed' | 'failed'

export type Balance = {
  revenue: string
  withdrawn: string
  available: string
  requestCount: number
}

/** Balance de un tenant en una red concreta. */
export type NetworkBalance = Balance & { network: string }

// ---- agentes compradores (lado demanda) ----

export type AgentFrequency = 'once' | 'hourly' | 'daily' | 'biweekly' | 'monthly'
export type AgentDelivery = 'dashboard' | 'webhook' | 'email'
export type AgentStatus = 'idle' | 'running' | 'paused' | 'done'

export type Agent = {
  id: string
  tenantId: string
  name: string
  /** Objetivo en lenguaje natural. */
  mission: string
  walletAddress: string
  /** Id de la wallet en Privy: sin esto no se puede firmar. */
  privyWalletId: string | null
  network: string
  /** Tope blando por corrida; el techo duro es el saldo de la wallet. */
  maxPerRun: string
  /** Cómo le llega el resultado a la persona. */
  deliveryKind: AgentDelivery
  /** URL del webhook o dirección de correo, según deliveryKind. */
  deliveryTarget: string | null
  frequency: AgentFrequency
  status: AgentStatus
  runsMax: number | null
  runsCount: number
  nextRunAt: string | null
  lastRunAt: string | null
  /** Id del NFT en el IdentityRegistry de ERC-8004; null si no está registrado. */
  erc8004AgentId: string | null
  erc8004ChainId: number | null
  erc8004Tx: string | null
  createdAt: string
}

export type NewAgent = {
  tenantId: string
  name: string
  mission: string
  walletAddress: string
  privyWalletId?: string | null
  network: string
  maxPerRun: string
  frequency: AgentFrequency
  deliveryKind?: AgentDelivery
  deliveryTarget?: string | null
  runsMax?: number | null
  nextRunAt?: string | null
}

export type AgentRunStatus = 'success' | 'failed' | 'skipped'

export type AgentRun = {
  id: string
  agentId: string
  status: AgentRunStatus
  /** Candidatos evaluados, elegido y por qué. Evidencia de la decisión. */
  decision: unknown
  targetUrl: string | null
  amount: string | null
  network: string | null
  receiptRef: string | null
  resultExcerpt: string | null
  /** Resultado completo; el panel es donde la persona lo lee. */
  result: string | null
  error: string | null
  deliveredAt: string | null
  deliveryError: string | null
  createdAt: string
}

export type NewAgentRun = Omit<AgentRun, 'id' | 'createdAt' | 'deliveredAt' | 'deliveryError'>

export type NewTenant = {
  slug: string
  name: string
  originUrl: string
  embedSecret: string
  apiKeyHash?: string
  apiKeyPrefix?: string
  payoutWallet?: string | null
  email?: string | null
  privyUserId?: string | null
}

export type Resource = {
  id: string
  tenantId: string
  slug: string
  url: string
  title: string | null
  priceUsd: string
  active: boolean
}

export type NewResource = {
  tenantId: string
  slug: string
  url: string
  title?: string | null
  priceUsd: string
}

export type NewRoute = {
  tenantId: string
  method: string
  pathPattern: string
  priceUsd: string
  description?: string | null
}

/** Contrato de persistencia. Lo implementan MemoryStore y SupabaseStore. */
export interface Store {
  // tenants
  createTenant(input: NewTenant): Promise<Tenant>
  getTenantBySlug(slug: string): Promise<Tenant | null>
  getTenantById(id: string): Promise<Tenant | null>
  getTenantByApiKeyHash(hash: string): Promise<Tenant | null>
  getTenantByPrivyUserId(privyUserId: string): Promise<Tenant | null>
  /** Todos los negocios de un usuario, más reciente primero. */
  listTenantsByPrivyUserId(privyUserId: string): Promise<Tenant[]>
  listTenants(): Promise<Tenant[]>
  setPayoutWallet(tenantId: string, wallet: string): Promise<void>

  // origins permitidos para el iframe
  listAllowedOrigins(tenantId: string): Promise<string[]>
  addAllowedOrigin(tenantId: string, origin: string): Promise<void>
  removeAllowedOrigin(tenantId: string, origin: string): Promise<void>

  // rutas y precios
  listRoutes(tenantId: string): Promise<Route[]>
  createRoute(input: NewRoute): Promise<Route>
  deleteRoute(tenantId: string, routeId: string): Promise<void>

  // links con precio (URLs absolutas detrás de 402)
  listResources(tenantId: string): Promise<Resource[]>
  getResource(tenantId: string, slug: string): Promise<Resource | null>
  createResources(inputs: NewResource[]): Promise<Resource[]>
  deleteResource(tenantId: string, resourceId: string): Promise<void>

  // ledger
  recordPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'refundTx'>): Promise<Payment>
  setPaymentWallet(paymentId: string, wallet: string): Promise<void>
  markPaymentRefunded(paymentId: string, txRef: string): Promise<void>
  listPayments(tenantId: string, limit?: number): Promise<Payment[]>
  balance(tenantId: string): Promise<Balance>
  /** Balance separado por red. Solo redes con actividad o soportadas. */
  balanceByNetwork(tenantId: string): Promise<NetworkBalance[]>
  dailyRevenue(tenantId: string, days: number): Promise<{ date: string; amount: string; count: number }[]>

  // retiros
  createWithdrawal(input: { tenantId: string; amount: string; toWallet: string; network: string }): Promise<Withdrawal>
  updateWithdrawal(id: string, patch: { txRef?: string; status?: WithdrawalStatus }): Promise<Withdrawal>
  listWithdrawals(tenantId: string, limit?: number): Promise<Withdrawal[]>
  getWithdrawal(id: string): Promise<Withdrawal | null>

  // agentes compradores
  createAgent(input: NewAgent): Promise<Agent>
  listAgents(tenantId: string): Promise<Agent[]>
  getAgent(id: string): Promise<Agent | null>
  updateAgent(
    id: string,
    patch: Partial<
      Pick<
        Agent,
        | 'status'
        | 'frequency'
        | 'maxPerRun'
        | 'nextRunAt'
        | 'lastRunAt'
        | 'runsCount'
        | 'runsMax'
        | 'privyWalletId'
        | 'erc8004AgentId'
        | 'erc8004ChainId'
        | 'erc8004Tx'
        | 'deliveryKind'
        | 'deliveryTarget'
      >
    >,
  ): Promise<Agent>
  deleteAgent(tenantId: string, agentId: string): Promise<void>
  /** Agentes ociosos con corrida vencida. Lo usa el scheduler del gateway. */
  listDueAgents(now: string, limit?: number): Promise<Agent[]>
  /**
   * Toma el agente para ejecutarlo: pasa de 'idle' a 'running' solo si nadie
   * más lo tomó. Devuelve null si ya estaba tomado. Evita que el scheduler y
   * el botón "correr ahora" ejecuten la misma misión a la vez y gasten doble.
   */
  claimAgent(id: string): Promise<Agent | null>
  recordAgentRun(input: NewAgentRun): Promise<AgentRun>
  markRunDelivered(runId: string, error?: string | null): Promise<void>
  listAgentRuns(agentId: string, limit?: number): Promise<AgentRun[]>
}
