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
  /** Score de agent-readiness con el que llegó, antes de aplicar Peaje. */
  baselineScore: number | null
  baselineScoreAt: string | null
  /**
   * Datos de entidad para los motores de respuesta: alimentan el JSON-LD
   * Organization del kit y el NAP (nombre, dirección, teléfono) que el negocio
   * repite en Google Business Profile, Yelp, etc. Todos opcionales: el kit no
   * inventa campos vacíos.
   */
  entityLogoUrl: string | null
  entityPhone: string | null
  /** Texto libre en una línea; va a PostalAddress.streetAddress tal cual. */
  entityAddress: string | null
  /** URLs de perfiles (LinkedIn, Instagram, Google Business Profile, Wikidata). */
  entitySameAs: string[]
  entityDescription: string | null
  /** Bloquear bots de entrenamiento en robots.txt. No afecta la citación. */
  robotsBlockTraining: boolean
  /** 'free' | 'pro'. Pro recibe alertas y el reporte semanal por correo. */
  plan: string
  createdAt: string
}

/** Lo que el formulario del kit puede cambiar del tenant. */
export type TenantEntityUpdate = Partial<
  Pick<
    Tenant,
    'entityLogoUrl' | 'entityPhone' | 'entityAddress' | 'entitySameAs' | 'entityDescription' | 'robotsBlockTraining'
  >
>

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
  /** El 2% de Peaje sobre el precio, en USD decimal. */
  platformFee: string
  /** Costo de red pagado por el agente encima del precio (solo redes con contrato). */
  networkFee: string
  createdAt: string
}

/** Alta de pago: las comisiones son opcionales (0 en rieles sin contrato). */
export type NewPayment = Omit<Payment, 'id' | 'createdAt' | 'refundTx' | 'platformFee' | 'networkFee'> &
  Partial<Pick<Payment, 'platformFee' | 'networkFee'>>

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

/** Lo que se puede cambiar de una ruta sin recrearla: precio y descripción. */
export type UpdateRoute = {
  priceUsd?: string
  description?: string | null
}

// ---- tareas del agente Pro ----

export const TASK_KINDS = ['content', 'route', 'fix'] as const
export type TaskKind = (typeof TASK_KINDS)[number]
export const TASK_STATUSES = ['open', 'in_progress', 'done', 'verified', 'dismissed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Un criterio que Peaje revisa al marcar la tarea hecha. */
export type TaskCheck =
  | { type: 'check'; id: string }
  | { type: 'url'; url: string; contains?: string; notStatus?: number }

export type AgentTask = {
  id: string
  tenantId: string
  key: string
  kind: TaskKind
  title: string
  summary: string
  body: string
  acceptance: TaskCheck[]
  status: TaskStatus
  source: string
  note: string | null
  doneUrl: string | null
  createdAt: string
  updatedAt: string
  doneAt: string | null
  verifiedAt: string | null
}

export type NewAgentTask = Pick<AgentTask, 'tenantId' | 'key' | 'kind' | 'title' | 'summary' | 'body' | 'acceptance'> & { source?: string }

export type AgentTaskPatch = Partial<Pick<AgentTask, 'status' | 'note' | 'doneUrl' | 'doneAt' | 'verifiedAt'>>

// ---- plan del agente Pro ----

export const PLAN_GOALS = ['recommendations', 'agent-sales', 'both'] as const
export type PlanGoal = (typeof PLAN_GOALS)[number]
export const PLAN_CAPACITIES = ['content', 'code', 'config'] as const
export type PlanCapacity = (typeof PLAN_CAPACITIES)[number]
export const PLAN_CADENCES = ['daily', 'weekly', 'biweekly', 'on-demand'] as const
export type PlanCadence = (typeof PLAN_CADENCES)[number]
/** Métricas que Peaje ya mide. `citation_share` se llena desde el milestone de citación. */
export const PLAN_METRICS = ['checks_passing', 'answer_bot_visits_7d', 'paid_requests_7d', 'revenue_7d', 'payment_attempt_rate', 'tasks_verified', 'citation_share'] as const
export type PlanMetric = (typeof PLAN_METRICS)[number]

export type PlanStep = { title: string; why: string; deliverable: string; metric: PlanMetric; target: number }

export type AgentPlan = {
  tenantId: string
  goal: PlanGoal
  goalDetail: string
  capacity: PlanCapacity[]
  cadence: PlanCadence
  language: string
  summary: string
  steps: PlanStep[]
  baseline: Partial<Record<PlanMetric, number | null>>
  createdAt: string
  updatedAt: string
}

export type NewAgentPlan = Omit<AgentPlan, 'createdAt' | 'updatedAt'>

// ---- conversación con el agente Pro ----

/** Un cambio que el agente propone y el dueño aplica con un botón. */
export type AgentAction = {
  id: string
  type: 'route.create' | 'route.update' | 'route.delete'
  summary: string
  params: { routeId?: string; method?: string; path?: string; priceUsd?: string; description?: string | null }
  status: 'pending' | 'applied' | 'dismissed'
  result?: string
}

export type AgentMessage = {
  id: string
  tenantId: string
  role: 'user' | 'assistant'
  text: string
  actions: AgentAction[]
  /** Respuestas rápidas que el agente ofrece; tocar una la manda como mensaje. */
  options: string[]
  channel: string
  createdAt: string
}

export type NewAgentMessage = Pick<AgentMessage, 'tenantId' | 'role' | 'text'> & { actions?: AgentAction[]; options?: string[]; channel?: string }

// ---- medición de citación ----

export type CitationPrompt = { id: string; tenantId: string; text: string; source: 'agent' | 'owner'; active: boolean; createdAt: string }

export type CitationRun = {
  id: string
  tenantId: string
  roundId: string
  promptId: string | null
  promptText: string
  engine: string
  runAt: string
  cited: boolean
  mentioned: boolean
  domains: string[]
  answerExcerpt: string | null
  error: string | null
}

export type NewCitationRun = Omit<CitationRun, 'id' | 'runAt'>

// ---- M6: ciclo cerrado (re-medición a 2 y 6 semanas de una tarea verificada) ----

export type FollowupKind = '2w' | '6w'

/** Foto de lo que Peaje mide sobre una tarea, al verificarla y al vencer cada seguimiento. */
export type FollowupSnapshot = {
  at: string
  /** La pregunta de la página (tareas de contenido). */
  question?: string | null
  /** Por motor: si cita el sitio y si nombra al negocio. Null si la pregunta todavía no se medía. */
  citation?: Record<string, { cited: boolean; mentioned: boolean }> | null
  answerBotVisits7d?: number | null
  /** Tareas de arreglo y de ruta: si los criterios siguen pasando en el sitio en vivo. */
  passes?: boolean | null
  detail?: string | null
  /** El veredicto en español; la columna `verdict` lo guarda en inglés. */
  verdictEs?: string | null
}

export type TaskFollowup = {
  id: string
  tenantId: string
  taskId: string
  dueAt: string
  kind: FollowupKind
  doneAt: string | null
  before: FollowupSnapshot
  after: FollowupSnapshot | null
  verdict: string | null
  createdAt: string
}
// ---- fin M6 ----

// ---- Telegram ----

export type TelegramLink = { chatId: number; tenantId: string; username: string | null; language: string; linkedAt: string; active: boolean }

// ---- monitoreo: una corrida del verificador por tenant ----

export type Verificacion = {
  id: string
  tenantId: string
  runAt: string
  /** Los Chequeo[] de @peaje/shared tal cual (id, ok, motivo, faltantes, total). */
  checks: unknown[]
  ok: boolean
  score: number | null
  robotsHash: string | null
  llmsHash: string | null
  /** Eventos ya avisados en esta corrida, p. ej. "fallo_nuevo:bots". */
  alerted: string[]
  /** Fallos nuevos que esperan una segunda medición antes de avisar. */
  pending: string[]
}

export type NewVerificacion = Omit<Verificacion, 'id' | 'runAt'>

// ---- M7: comprador misterioso ----

/** Una misión del comprador misterioso: si el negocio apareció, en qué puesto y a quién eligió en su lugar. */
export type MysteryMission = {
  mission: string
  /** El negocio estaba entre los candidatos comprables. */
  found: boolean
  /** Puesto entre los comprables (1 = primero). Null si no apareció. */
  rank: number | null
  /** El comprador lo habría comprado. */
  chosen: boolean
  /** Lo que eligió en su lugar, si no fue el negocio. */
  instead: { name: string; host: string; priceUsd: number | null } | null
  /** Por qué: los motivos del puntaje o el texto del veto del modelo. */
  reason: string
  /** El veredicto en palabras simples (inglés) y en español. */
  verdict: string
  verdictEs: string
}

/**
 * Un problema del 402 que vería un cliente estricto. `side`: 'owner' lo
 * arregla el dueño (sale como tarea); 'peaje' es del gateway de Peaje.
 */
export type MysteryIssue = { id: string; side: 'owner' | 'peaje'; text: string; es: string }

/** La prueba del 402 sobre una URL con precio del negocio. */
export type MysteryProbeTarget = {
  via: 'domain' | 'gateway'
  url: string
  status: number | null
  ok: boolean
  issues: MysteryIssue[]
}

export type MysteryProbe = {
  /** Qué se cobró para probar: la ruta o el link con precio. */
  item: { kind: 'route' | 'link'; path: string; priceUsd: string } | null
  targets: MysteryProbeTarget[]
}

export type MysteryRun = {
  id: string
  tenantId: string
  runAt: string
  missions: MysteryMission[]
  probe: MysteryProbe | null
  issues: string[]
  summary: string | null
}

export type NewMysteryRun = Omit<MysteryRun, 'id' | 'runAt'>
// ---- fin M7 ----

// ---- visitas de agentes (pagas o no) ----

export const AGENT_KINDS = [
  'mpp-client',
  'x402-client',
  'openai-searchbot',
  'perplexitybot',
  'googlebot',
  'claudebot',
  'gptbot',
  'other',
] as const
export type AgentKind = (typeof AGENT_KINDS)[number]

/** Una request a un tenant, haya pagado o no. La escribe el gateway en lotes. */
export type NewVisit = {
  tenantId: string
  at: string
  path: string
  method: string
  userAgent: string | null
  agentKind: AgentKind
  paid: boolean
  network: string | null
  amount: string | null
  paymentId: string | null
  status: number
  /** La ruta con precio que matcheó (null para links `/r/` y paths libres). */
  routeId: string | null
  /** El precio que el agente vio en el 402 (o pagó). Null si no había cobro. */
  priceUsd: string | null
  /** Trajo una credencial de pago: entendió el 402 e intentó pagar. */
  attempted: boolean
}

export type VisitStats = {
  days: number
  totals: { visits: number; paid: number; unpaid: number; revenue: string }
  byKind: { kind: AgentKind; visits: number; paid: number }[]
  topPaths: { path: string; visits: number; served402: number; attempted: number; paid: number; revenue: string }[]
  daily: { date: string; visits: number; paid: number }[]
  /**
   * El embudo de cobro: cuántos 402 se sirvieron, cuántas requests trajeron
   * una credencial (entendieron el 402) y cuántas terminaron pagadas.
   */
  funnel: { served402: number; attempted: number; paid: number }
  /** Paths con precio que se miraron y no se pagaron, con cuántos agentes distintos (por UA) lo hicieron. */
  unpaidDemand: { path: string; served402: number; agents: number; priceUsd: string | null }[]
  /** Paths pedidos por agentes que el origen no tiene (404): demanda de rutas que no existen. */
  notFound: { path: string; visits: number }[]
  /** Wallets distintas que pagaron en la ventana (sale del ledger vía payment_id). */
  agentWallets: string[]
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
  /** Datos de entidad del kit (JSON-LD Organization, toggle de robots). Solo pisa lo que viene definido. */
  updateTenantEntity(tenantId: string, patch: TenantEntityUpdate): Promise<void>
  /** La clave con la que el coding agent del dueño entra al MCP y al CLI. Solo el hash. */
  setTenantApiKey(tenantId: string, hash: string, prefix: string): Promise<void>
  /** Crea la tarea, o actualiza su contenido si sigue abierta. Nunca reabre una descartada o verificada. */
  upsertTask(task: NewAgentTask): Promise<{ task: AgentTask; created: boolean }>
  listTasks(tenantId: string, opts?: { statuses?: TaskStatus[] }): Promise<AgentTask[]>
  getTask(tenantId: string, id: string): Promise<AgentTask | null>
  updateTask(tenantId: string, id: string, patch: AgentTaskPatch): Promise<AgentTask>
  /** Últimos mensajes, del más viejo al más nuevo. */
  listMessages(tenantId: string, limit: number): Promise<AgentMessage[]>
  addMessage(m: NewAgentMessage): Promise<AgentMessage>
  getMessage(tenantId: string, id: string): Promise<AgentMessage | null>
  setMessageActions(tenantId: string, id: string, actions: AgentAction[]): Promise<void>
  clearMessages(tenantId: string): Promise<void>
  /** Mensajes del dueño desde una fecha: el tope mensual del chat. */
  countUserMessagesSince(tenantId: string, since: string): Promise<number>
  listCitationPrompts(tenantId: string): Promise<CitationPrompt[]>
  addCitationPrompts(tenantId: string, texts: string[], source: CitationPrompt['source']): Promise<CitationPrompt[]>
  removeCitationPrompt(tenantId: string, id: string): Promise<void>
  recordCitationRuns(runs: NewCitationRun[]): Promise<void>
  /** Todas las corridas de las últimas `rounds` rondas, de la más nueva a la más vieja. */
  listCitationRuns(tenantId: string, rounds: number): Promise<CitationRun[]>
  /** Código de un solo uso para ligar un chat de Telegram al negocio. */
  createTelegramCode(tenantId: string, code: string, expiresAt: string): Promise<void>
  /** Consume el código: devuelve el negocio si existe y no venció, y lo borra. */
  consumeTelegramCode(code: string): Promise<string | null>
  /** Liga el negocio al chat y lo deja como activo (los otros del chat quedan inactivos). */
  linkTelegram(link: Omit<TelegramLink, 'linkedAt' | 'active'>): Promise<void>
  /** El negocio activo del chat. */
  getTelegramLink(chatId: number): Promise<TelegramLink | null>
  /** Todos los negocios de un chat. */
  listTelegramChat(chatId: number): Promise<TelegramLink[]>
  setActiveTelegram(chatId: number, tenantId: string): Promise<void>
  listTelegramLinks(tenantId: string): Promise<TelegramLink[]>
  unlinkTelegram(filter: { chatId?: number; tenantId?: string }): Promise<void>
  getPlan(tenantId: string): Promise<AgentPlan | null>
  /** Reemplaza el plan del negocio (uno por negocio). */
  savePlan(plan: NewAgentPlan): Promise<AgentPlan>
  // ---- M6: seguimientos de tareas verificadas ----
  /** Agenda los seguimientos a 14 y 42 días. Idempotente por tarea: devuelve los que ya existían si los hay. */
  scheduleFollowups(taskId: string, tenantId: string, before: FollowupSnapshot): Promise<TaskFollowup[]>
  /** Seguimientos pendientes con fecha vencida, de todos los negocios (o de uno). */
  listDueFollowups(now: string, tenantId?: string): Promise<TaskFollowup[]>
  completeFollowup(id: string, after: FollowupSnapshot, verdict: string): Promise<void>
  /** Los del negocio, del vencimiento más nuevo al más viejo. */
  listFollowups(tenantId: string, limit: number): Promise<TaskFollowup[]>
  // ---- fin M6 ----

  // origins permitidos para el iframe
  listAllowedOrigins(tenantId: string): Promise<string[]>
  addAllowedOrigin(tenantId: string, origin: string): Promise<void>
  removeAllowedOrigin(tenantId: string, origin: string): Promise<void>

  /** Primer score visto: solo escribe si todavía no hay baseline. */
  setBaselineScore(tenantId: string, score: number): Promise<void>

  // rutas y precios
  listRoutes(tenantId: string): Promise<Route[]>
  createRoute(input: NewRoute): Promise<Route>
  updateRoute(tenantId: string, routeId: string, patch: UpdateRoute): Promise<Route>
  deleteRoute(tenantId: string, routeId: string): Promise<void>

  // links con precio (URLs absolutas detrás de 402)
  listResources(tenantId: string): Promise<Resource[]>
  getResource(tenantId: string, slug: string): Promise<Resource | null>
  createResources(inputs: NewResource[]): Promise<Resource[]>
  deleteResource(tenantId: string, resourceId: string): Promise<void>

  // ledger
  recordPayment(payment: NewPayment): Promise<Payment>
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
  /** Retiros pending con tx enviada, de todos los tenants: los reconcilia el gateway contra la chain. */
  listPendingWithdrawals(limit?: number): Promise<Withdrawal[]>
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
        | 'mission'
        | 'network'
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

  // monitoreo
  recordVerification(v: NewVerificacion): Promise<Verificacion>
  lastVerification(tenantId: string): Promise<Verificacion | null>
  verificationHistory(tenantId: string, limit: number): Promise<Verificacion[]>
  markAlerted(id: string, events: string[]): Promise<void>

  // visitas de agentes
  recordVisit(visit: NewVisit): Promise<void>
  /** Inserta en lote: el gateway acumula y descarga cada 2 s o 50 filas. */
  recordVisits(visits: NewVisit[]): Promise<void>
  visitStats(tenantId: string, opts: { days: number }): Promise<VisitStats>
  /** Pago por referencia de receipt: liga la visita con el ledger. */
  findPaymentByReceiptRef(receiptRef: string): Promise<Payment | null>

  // ---- M7: comprador misterioso ----
  recordMysteryRun(run: NewMysteryRun): Promise<MysteryRun>
  lastMysteryRun(tenantId: string): Promise<MysteryRun | null>
  // ---- fin M7 ----
}
