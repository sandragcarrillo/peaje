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
}
