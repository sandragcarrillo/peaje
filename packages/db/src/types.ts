export type Tenant = {
  id: string
  slug: string
  name: string
  apiKeyPrefix: string | null
  embedSecret: string
  originUrl: string
  payoutWallet: string | null
  /**
   * La wallet que Peaje custodia para el negocio (Privy), fijada al crearlo.
   * Es la única con la que Peaje firma retiros y envíos en su nombre: la de
   * cobro (`payoutWallet`) la edita el dueño y no sirve para decidir quién firma.
   */
  custodialWallet: string | null
  custodialWalletId: string | null
  email: string | null
  privyUserId: string | null
  // ---- app de Privy propia (20261025000000) ----
  /** DID del dueño en la app de Privy vieja. Null = el negocio todavía no migró. */
  privyUserIdLegacy: string | null
  /**
   * Wallet de Privy cuyo dueño es el usuario (no custodial): Peaje no firma con
   * ella. Es la de cobro por defecto; el dueño puede poner otra address propia.
   */
  ownerWallet: string | null
  ownerWalletId: string | null
  /** La que custodiaba la app vieja, solo para barrer fondos y volver atrás. */
  custodialWalletLegacy: string | null
  custodialWalletIdLegacy: string | null
  // ---- fin app de Privy propia ----
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
  /** 'free' | 'founder' | 'pro'. Lo que habilita sale de accesoPro (planes.ts), no de leer esto directo. */
  plan: string
  // ---- M9 ----
  /** Hasta cuándo vale el plan pago (founder o pro). Null si nunca pagó. */
  planUntil: string | null
  /** Fin de la prueba de 14 días de Pro. */
  trialUntil: string | null
  // ---- fin M9 ----
  // ---- Paddle: suscripción Pro con tarjeta ----
  /** Cliente de Paddle (ctm_...). Lo deja el webhook tras el primer checkout; abre el portal de Paddle. */
  paddleCustomerId: string | null
  /** Suscripción de Paddle (sub_...) de este negocio. */
  paddleSubscriptionId: string | null
  /** Estado de esa suscripción en Paddle: active, past_due, paused, canceled, trialing. Null si nunca se suscribió con tarjeta. */
  paddleStatus: string | null
  /** El dueño canceló: conserva Pro hasta esta fecha y la suscripción no se renueva. */
  paddleCancelAt: string | null
  // ---- fin Paddle ----
  // ---- voz de marca ----
  /** Cómo escribe el negocio, leído de su sitio (o editado por el dueño). Lo usan los borradores. */
  voiceProfile: VoiceProfile | null
  voiceProfileAt: string | null
  // ---- fin voz ----
  /**
   * Origen de primer contacto de quien lo dio de alta (cookie peaje_origen del
   * dashboard): ref, "utm_source/utm_medium/utm_campaign" o el host del
   * referrer. Null: sin origen o antes de la migración 20261026300000.
   */
  acquisitionSource: string | null
  createdAt: string
}

// ---- voz de marca ----
/** Perfil compacto de la voz del negocio. Las frases de muestra son citas literales del sitio. */
export type VoiceProfile = {
  /** Idioma principal del sitio, p. ej. "es" o "en". */
  language: string
  /** p. ej. "casual", "neutral", "formal". */
  formality: string
  /** Cómo le habla al lector: "tú", "usted", "vos", "you", "we"... en palabras simples. */
  person: string
  /** "short", "medium" o "long", con una nota si hace falta. */
  sentenceLength: string
  /** Palabras o giros que el negocio repite. */
  uses: string[]
  /** Palabras o tonos que el negocio no usa. */
  avoids: string[]
  /** Hasta 3 frases cortas copiadas tal cual del sitio. */
  samples: string[]
  /** Una línea libre (lo que el dueño agregue). */
  notes?: string
  /** El dueño lo editó: el refresco automático no lo pisa. */
  editedByOwner?: boolean
}
// ---- fin voz ----

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
  // ---- pagos directos ----
  /**
   * Dirección a la que llegó el neto en la misma transacción del pago
   * (PeajeSettlementV3 o split de Tempo). null en pagos anteriores al cambio.
   */
  payoutAddress: string | null
  createdAt: string
}

/** Alta de pago: las comisiones y la dirección de cobro son opcionales. */
export type NewPayment = Omit<Payment, 'id' | 'createdAt' | 'refundTx' | 'platformFee' | 'networkFee' | 'payoutAddress'> &
  Partial<Pick<Payment, 'platformFee' | 'networkFee' | 'payoutAddress'>>

// ---- pagos directos: pagos adelantados (front-run) ----
/**
 * Una autorización EIP-3009 que alguien mandó directo al token antes que el
 * relayer: los fondos quedaron en PeajeSettlementV3 sin repartir. El Safe la
 * reparte con `settleStray(token, merchant, payer, value, nonce, networkFee)`
 * usando estos datos. Montos en unidades base del token.
 */
export type SettlementStray = {
  id: string
  network: string
  contract: string
  token: string
  payer: string
  nonce: string
  value: string
  networkFee: string
  merchant: string
  tenantId: string | null
  path: string | null
  status: 'pending' | 'settled'
  settleTx: string | null
  detectedAt: string
  resolvedAt: string | null
}

export type NewSettlementStray = Omit<SettlementStray, 'id' | 'status' | 'settleTx' | 'detectedAt' | 'resolvedAt'>
// ---- fin pagos directos ----

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
  /** Wallet del agente en la app de Privy vieja, para barrerla tras la migración. */
  walletAddressLegacy: string | null
  privyWalletIdLegacy: string | null
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

export type TenantWalletPatch = Partial<
  Pick<
    Tenant,
    | 'payoutWallet'
    | 'ownerWallet'
    | 'ownerWalletId'
    | 'custodialWallet'
    | 'custodialWalletId'
    | 'custodialWalletLegacy'
    | 'custodialWalletIdLegacy'
  >
>

export type NewTenant = {
  slug: string
  name: string
  originUrl: string
  embedSecret: string
  apiKeyHash?: string
  apiKeyPrefix?: string
  payoutWallet?: string | null
  custodialWallet?: string | null
  custodialWalletId?: string | null
  email?: string | null
  privyUserId?: string | null
  ownerWallet?: string | null
  ownerWalletId?: string | null
  /** Ver Tenant.acquisitionSource. */
  acquisitionSource?: string | null
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
  /** Tarjetas bajo el mensaje: el reporte completo, la tarea o la página, con su link. */
  links: AgentMessageLink[]
  channel: string
  createdAt: string
}

/** Una tarjeta con link que el agente deja bajo su respuesta corta. */
export type AgentMessageLink = { label: string; url: string; kind?: 'report' | 'task' | 'page' }

export type NewAgentMessage = Pick<AgentMessage, 'tenantId' | 'role' | 'text'> & { actions?: AgentAction[]; options?: string[]; links?: AgentMessageLink[]; channel?: string }

/** Un movimiento de créditos del agente: un cargo (positivo) o una devolución (negativo). */
export type CreditCharge = { tenantId: string; credits: number; reason: string }

// ---- trabajos largos del agente (borradores, series de páginas) ----

export const AGENT_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number]

/** A dónde avisar cuando termina: el canal y su id (chat de Telegram, canal de Slack, 'dashboard'). */
export type AgentJobDestino = { canal: string; id: string; idioma?: 'es' | 'en' }

export type AgentJob = {
  id: string
  tenantId: string
  kind: string
  status: AgentJobStatus
  input: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  destino: AgentJobDestino | null
  /** Veces que se tomó: un trabajo que quedó colgado por un reinicio se reintenta una vez. */
  attempts: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type NewAgentJob = Pick<AgentJob, 'tenantId' | 'kind' | 'input'> & { destino?: AgentJobDestino | null }

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
  /** Las páginas citadas completas, en orden. Corridas anteriores al 24 oct 2026 vienen vacías. */
  pages: CitedPage[]
  answerExcerpt: string | null
  error: string | null
}

/** Formato de una página citada: lo que la IA eligió para contestar. */
export const PAGE_FORMATS = ['guide', 'roundup', 'comparison', 'research', 'docs', 'forum', 'video', 'news', 'product', 'other'] as const
export type PageFormat = (typeof PAGE_FORMATS)[number]

export type CitedPage = {
  /** null cuando el motor no da la dirección real (Gemini). */
  url: string | null
  title: string | null
  domain: string
  format: PageFormat | null
}

export type NewCitationRun = Omit<CitationRun, 'id' | 'runAt' | 'pages'> & { pages?: CitedPage[] }

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

// ---- Slack ----

/** Una instalación de la app de Peaje en un workspace. `botTokenEnc` va cifrado por el gateway. */
export type SlackInstall = {
  teamId: string
  teamName: string | null
  enterpriseId: string | null
  botTokenEnc: string
  botUserId: string
  /** El único que aprueba cambios de precio o de rutas desde Slack. */
  installerUserId: string
  installedAt: string
}

/** Un canal (o DM) conectado a un negocio. Varios negocios por canal, uno activo. */
export type SlackLink = { teamId: string; channelId: string; tenantId: string; language: string; linkedBy: string | null; linkedAt: string; active: boolean }

/** Código de un solo uso: lo crea el dashboard, el OAuth lo ata a workspace e instalador. */
export type SlackCode = { code: string; tenantId: string; language: string; teamId: string | null; userId: string | null; expiresAt: string }
// ---- fin Slack ----

// ---- reportes programados (Telegram hoy, Slack después) ----

export const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number]
/** agent_visits: el resumen de visitas de agentes. custom: un pedido en palabras del dueño que corre el agente. */
export const REPORT_KINDS = ['agent_visits', 'custom'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export type ReportSchedule = {
  id: string
  tenantId: string
  /** 'telegram' hoy; 'slack' después. Lo resuelve el registro de canales del gateway. */
  channel: string
  /** Dónde se entrega dentro del canal: el chat id de Telegram, el canal de Slack. */
  target: string
  kind: ReportKind
  /** Solo custom: lo que el agente responde en cada corrida. Null en agent_visits. */
  prompt: string | null
  frequency: ReportFrequency
  /** Hora local 0-23 en `timezone`. */
  hour: number
  /** Solo weekly: 0 domingo … 6 sábado. */
  weekday: number | null
  /** Solo monthly: 1-28. */
  dayOfMonth: number | null
  /** IANA, p. ej. America/Bogota. */
  timezone: string
  active: boolean
  nextRunAt: string
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export type ReportScheduleInput = Pick<ReportSchedule, 'tenantId' | 'channel' | 'target' | 'kind' | 'frequency' | 'hour' | 'weekday' | 'dayOfMonth' | 'timezone' | 'nextRunAt'> & {
  prompt?: string | null
  active?: boolean
  /** Para editar un custom puntual. Sin id, agent_visits pisa el que ya hay para ese destino. */
  id?: string
}
// ---- fin reportes programados ----

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

// ---- radar público: leads ----

/** Quien dejó su email en el radar para medir un dominio. Una fila por (email, dominio). */
export type RadarLead = {
  id: string
  email: string
  domain: string
  source: string
  locale: string
  /** Aceptó tips ocasionales. El reporte del dominio sale igual. */
  marketingConsent: boolean
  lastReportAt: string | null
  /**
   * Origen de primer contacto (cookie peaje_origen), como Tenant.acquisitionSource.
   * `source` es otra cosa: de qué formulario vino ('radar'). El primero que
   * llega se queda: un upsert posterior no lo pisa.
   */
  acquisitionSource: string | null
  createdAt: string
  updatedAt: string
}

export type NewRadarLead = Pick<RadarLead, 'email' | 'domain' | 'locale' | 'marketingConsent'> & {
  source?: string
  acquisitionSource?: string | null
}

// ---- radar público: foto de citación (20261026200000) ----

/** Qué es un dominio citado en lugar del sitio: un medio o listado, un competidor, o no se sabe. */
export type RadarCitasKind = 'publisher' | 'competitor' | null

/** Lo que contestó un motor a una pregunta. `sources`: dominios citados, como mucho 5; el propio primero si está. */
export type RadarCitasCelda = { cited: boolean; mentioned: boolean; sources: string[] }

/**
 * La foto de citación de un dominio para el radar público: tres preguntas de
 * compra hechas a los motores, si el sitio sale citado o mencionado y a quién
 * citan en su lugar. Es el cuerpo de POST /_internal/radar/citas.
 */
export type RadarCitas = {
  domain: string
  measuredAt: string
  cached: boolean
  /** Un motor que no contestó esa pregunta no aparece en `engines` de la pregunta. */
  questions: { text: string; engines: Record<string, RadarCitasCelda> }[]
  /** Por motor: en cuántas de las preguntas que contestó salió citado el sitio. */
  coverage: Record<string, { cited: number; total: number }>
  /** Los 12 dominios más citados en las respuestas donde el sitio no salió, sin el propio. */
  citedInstead: { domain: string; count: number; kind: RadarCitasKind }[]
  /** Los motores que contestaron, en orden: chatgpt, perplexity, claude, gemini. */
  engines: string[]
}

/** Una medición guardada. 'running' es el candado del dominio; las 'done' son el caché. */
export type RadarCitasRun = {
  id: string
  domain: string
  locale: string
  status: 'running' | 'done' | 'failed'
  /** La foto sin `cached` (se decide al servirla). */
  result: Omit<RadarCitas, 'cached'> | null
  /** Algún motor configurado no contestó nada: el caché dura menos. */
  partial: boolean
  error: string | null
  startedAt: string
  measuredAt: string | null
}

export type RadarCitasClaim = { ok: true; id: string } | { ok: false; reason: 'budget' | 'busy' }
// ---- fin radar ----

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
  setCustodialWallet(tenantId: string, address: string, walletId: string): Promise<void>
  // ---- app de Privy propia ----
  /** Negocios cuyo email de dueño coincide, sin distinguir mayúsculas. */
  listTenantsByEmail(email: string): Promise<Tenant[]>
  /**
   * Pasa el negocio al DID de la app nueva y guarda el viejo en
   * privyUserIdLegacy. Solo si todavía no migró (legacy null): devuelve false
   * si ya estaba migrado y no tocó nada.
   */
  rebindTenantOwner(tenantId: string, privyUserId: string, legacyPrivyUserId: string | null): Promise<boolean>
  /** Pisa solo los campos de wallet que vienen definidos. */
  setTenantWallets(tenantId: string, patch: TenantWalletPatch): Promise<void>
  /** El agente cuya wallet (actual o legacy) es esa address, sin distinguir mayúsculas. */
  getAgentByWalletAddress(address: string): Promise<Agent | null>
  // ---- fin app de Privy propia ----
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
  /** Mensajes del dueño desde una fecha. Ya no limita el chat (ver créditos); queda para métricas. */
  countUserMessagesSince(tenantId: string, since: string): Promise<number>
  // ---- créditos del agente ----
  /** Anota un cargo de créditos (o una devolución, con créditos negativos). */
  addCreditCharge(c: CreditCharge): Promise<void>
  /** Créditos usados desde una fecha: la suma de cargos menos devoluciones. */
  creditsUsedSince(tenantId: string, since: string): Promise<number>
  // ---- trabajos largos del agente ----
  createJob(input: NewAgentJob): Promise<AgentJob>
  getJob(id: string): Promise<AgentJob | null>
  listJobs(tenantId: string, limit: number): Promise<AgentJob[]>
  /**
   * Toma el trabajo en cola más viejo: pasa de 'queued' a 'running' solo si
   * nadie lo tomó antes (UPDATE condicional). Null si no hay ninguno libre.
   */
  claimNextJob(kinds: string[]): Promise<AgentJob | null>
  finishJob(id: string, patch: { status: 'done' | 'failed'; result?: Record<string, unknown> | null; error?: string | null }): Promise<AgentJob>
  /** Trabajos en 'running' desde antes de `before` (un reinicio los dejó colgados). */
  listStaleJobs(before: string): Promise<AgentJob[]>
  /** Devuelve un trabajo colgado a la cola, solo si sigue en 'running'. */
  requeueJob(id: string): Promise<void>
  // ---- voz de marca ----
  /** Guarda (o borra con null) el perfil de voz del negocio. */
  setTenantVoiceProfile(tenantId: string, profile: VoiceProfile | null): Promise<void>
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
  /**
   * Reserva el primer mensaje del agente en un destino (el chat de Telegram,
   * `<team>:<canal>` de Slack). True solo la primera vez por negocio, canal y
   * destino; desconectar el chat no la borra.
   */
  claimAgentIntro(tenantId: string, channel: string, target: string): Promise<boolean>
  // ---- Slack ----
  createSlackCode(tenantId: string, code: string, expiresAt: string, language: string): Promise<void>
  /** El código si existe y no venció (no lo consume). */
  getSlackCode(code: string): Promise<SlackCode | null>
  /** Después del OAuth: ata el código al workspace y a quien instaló, y alarga su vencimiento. */
  bindSlackCode(code: string, teamId: string, userId: string, expiresAt: string): Promise<void>
  /** Consume el código pendiente más nuevo de esa persona en ese workspace. */
  consumeSlackCode(teamId: string, userId: string): Promise<SlackCode | null>
  /** Crea o pisa la instalación del workspace. */
  saveSlackInstall(install: Omit<SlackInstall, 'installedAt'>): Promise<void>
  getSlackInstall(teamId: string): Promise<SlackInstall | null>
  /** Borra la instalación y los canales de ese workspace (app desinstalada). */
  deleteSlackInstall(teamId: string): Promise<void>
  /** Liga el negocio al canal y lo deja activo (los otros del canal quedan inactivos). */
  linkSlack(link: Omit<SlackLink, 'linkedAt' | 'active'>): Promise<void>
  /** El negocio activo del canal. */
  getSlackLink(teamId: string, channelId: string): Promise<SlackLink | null>
  listSlackChannel(teamId: string, channelId: string): Promise<SlackLink[]>
  setActiveSlack(teamId: string, channelId: string, tenantId: string): Promise<void>
  listSlackLinks(tenantId: string): Promise<SlackLink[]>
  unlinkSlack(filter: { tenantId?: string; teamId?: string; channelId?: string }): Promise<void>
  /** Marca el evento como visto. False si ya estaba (reintento de Slack). */
  claimSlackEvent(eventId: string): Promise<boolean>
  // ---- fin Slack ----
  // ---- reportes programados ----
  listReportSchedules(tenantId: string): Promise<ReportSchedule[]>
  /** Con id edita ese; sin id, agent_visits pisa el del mismo (canal, destino) y custom crea uno nuevo. Conserva last_run_at. */
  upsertReportSchedule(input: ReportScheduleInput): Promise<ReportSchedule>
  /** Borra los del negocio que coincidan con el filtro. Devuelve cuántos. */
  deleteReportSchedules(tenantId: string, filter: { id?: string; channel?: string; target?: string; kind?: ReportKind }): Promise<number>
  /** Activos con next_run_at <= now, el más atrasado primero. */
  listDueReportSchedules(now: string, limit?: number): Promise<ReportSchedule[]>
  /**
   * Toma la corrida: pone last_run_at y el próximo next_run_at solo si
   * next_run_at sigue siendo `previousNextRunAt`. True si esta llamada la
   * tomó; dos crons a la vez no mandan dos veces.
   */
  markReportScheduleSent(id: string, run: { previousNextRunAt: string; sentAt: string; nextRunAt: string }): Promise<boolean>
  // ---- fin reportes programados ----
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
  /**
   * Total devuelto a agentes (monto + fee + costo de red de los pagos con
   * refundTx) creados desde `since`, de un negocio o de todos. Lo usan los
   * topes de reembolso de Tempo: el reembolso sale segundos después del pago.
   */
  refundedSince(since: string, tenantId?: string): Promise<number>
  listPayments(tenantId: string, limit?: number): Promise<Payment[]>
  balance(tenantId: string): Promise<Balance>
  /** Balance separado por red. Solo redes con actividad o soportadas. */
  balanceByNetwork(tenantId: string): Promise<NetworkBalance[]>
  dailyRevenue(tenantId: string, days: number): Promise<{ date: string; amount: string; count: number }[]>

  // retiros
  /**
   * Registra un retiro. Con `checkAvailable`, en la misma transacción bloquea
   * al negocio, relee su disponible en esa red y solo inserta si alcanza: dos
   * retiros simultáneos no pueden gastar el mismo saldo. Si no alcanza lanza
   * SaldoInsuficiente.
   */
  createWithdrawal(input: { tenantId: string; amount: string; toWallet: string; network: string }, opts?: { checkAvailable?: boolean }): Promise<Withdrawal>
  updateWithdrawal(id: string, patch: { txRef?: string; status?: WithdrawalStatus }): Promise<Withdrawal>
  listWithdrawals(tenantId: string, limit?: number): Promise<Withdrawal[]>
  /** Retiros pending con tx enviada, de todos los tenants: los reconcilia el gateway contra la chain. */
  listPendingWithdrawals(limit?: number): Promise<Withdrawal[]>
  getWithdrawal(id: string): Promise<Withdrawal | null>

  // ---- pagos directos: pagos adelantados ----
  /**
   * Registra un pago adelantado. Único por (contract, token, payer, nonce):
   * `nuevo` es false si ya estaba registrado (no se duplica ni se pisa).
   */
  recordStray(input: NewSettlementStray): Promise<{ stray: SettlementStray; nuevo: boolean }>
  listStrays(status?: SettlementStray['status']): Promise<SettlementStray[]>
  /** El Safe ya corrió settleStray: queda con su tx y deja de estar pendiente. */
  resolveStray(id: string, settleTx: string): Promise<SettlementStray | null>

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
        | 'walletAddress'
        | 'walletAddressLegacy'
        | 'privyWalletIdLegacy'
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
  /** Ventana de `days` hasta ahora; con `from` (y opcional `to`, exclusivo) una ventana exacta. */
  visitStats(tenantId: string, opts: { days: number; from?: string; to?: string }): Promise<VisitStats>
  /** Pago por referencia de receipt: liga la visita con el ledger. */
  findPaymentByReceiptRef(receiptRef: string): Promise<Payment | null>

  // ---- M7: comprador misterioso ----
  recordMysteryRun(run: NewMysteryRun): Promise<MysteryRun>
  lastMysteryRun(tenantId: string): Promise<MysteryRun | null>
  // ---- fin M7 ----

  // ---- M9: cobro del agente Pro ----
  recordBillingPayment(p: NewBillingPayment): Promise<BillingPayment>
  listBillingPayments(tenantId: string, limit?: number): Promise<BillingPayment[]>
  /** Pago ya registrado con esta referencia (un receipt no extiende el plan dos veces). */
  findBillingPayment(method: BillingMethod, reference: string): Promise<BillingPayment | null>
  setTenantPlan(tenantId: string, plan: 'free' | 'founder' | 'pro', until: string | null): Promise<void>
  /** Negocios distintos que pagaron founder alguna vez: el cupo es 50. */
  countFounders(): Promise<number>
  // ---- fin M9 ----

  // ---- Paddle ----
  /** Guarda ids y estado de la suscripción de Paddle en el negocio (solo los campos que vienen). */
  setTenantPaddle(tenantId: string, patch: TenantPaddlePatch): Promise<void>
  getTenantByPaddleSubscription(subscriptionId: string): Promise<Tenant | null>
  /** Evento de webhook ya procesado (idempotencia por event_id). */
  paddleEventSeen(eventId: string): Promise<boolean>
  /** Marca el evento como procesado. Repetirlo no falla. */
  recordPaddleEvent(e: { eventId: string; eventType: string; occurredAt: string | null }): Promise<void>
  markBillingPaymentRefunded(id: string, at: string): Promise<void>
  // ---- bienvenida (20261026000000) ----
  /**
   * Reserva el correo de bienvenida de Pro: marca welcome_sent_at = at solo si
   * estaba en null. true = este llamado lo ganó y debe mandarlo; false = ya se
   * mandó (o lo está mandando otro evento).
   */
  claimWelcomeEmail(tenantId: string, at: string): Promise<boolean>
  /** Suelta la reserva si el envío falló (solo si sigue siendo la de `at`), para que otro evento reintente. */
  releaseWelcomeEmail(tenantId: string, at: string): Promise<void>
  // ---- fin bienvenida ----
  // ---- fin Paddle ----

  // ---- radar público: leads ----
  /** Crea o actualiza el lead (email, dominio): pisa locale y consentimiento, conserva created_at. */
  upsertRadarLead(input: NewRadarLead): Promise<RadarLead>
  getRadarLead(email: string, domain: string): Promise<RadarLead | null>
  /**
   * Toma el envío del reporte: marca last_report_at = ahora solo si el último
   * fue antes de `notSince` (o nunca). Devuelve el lead si lo tomó, null si
   * ya se mandó hace poco o no existe. Dos pedidos a la vez no mandan dos correos.
   */
  claimRadarReport(email: string, domain: string, notSince: string): Promise<RadarLead | null>
  // ---- origen de primer contacto (20261026300000) ----
  /** Leads del radar creados desde `since` (ISO), más reciente primero. Para /admin/origenes. */
  listRadarLeadsSince(since: string): Promise<RadarLead[]>
  /** Negocios creados desde `since` (ISO), más reciente primero. Para /admin/origenes. */
  listTenantsSince(since: string): Promise<Tenant[]>
  // ---- radar público: foto de citación ----
  /** La última medición terminada del dominio e idioma con measured_at >= since, o null. */
  getRadarCitas(domain: string, locale: string, since: string): Promise<RadarCitasRun | null>
  /**
   * Toma una medición nueva: si ya van `maxPerDay` desde `dayStart` (UTC), 'budget';
   * si hay otra 'running' del mismo dominio e idioma empezada después de
   * `staleBefore`, 'busy' (las anteriores se dan por caídas). Si no, crea la
   * fila 'running' con started_at = at.
   */
  claimRadarCitas(input: { domain: string; locale: string; at: string; dayStart: string; maxPerDay: number; staleBefore: string }): Promise<RadarCitasClaim>
  /** Cierra la medición: 'done' con la foto (queda de caché) o 'failed' con el motivo. */
  finishRadarCitas(id: string, outcome: { result: Omit<RadarCitas, 'cached'>; partial: boolean } | { error: string }): Promise<void>
  // ---- fin radar ----
}

// ---- M9: cobro del agente Pro ----
/** 'paddle': tarjeta, con Paddle como Merchant of Record. 'x402' y 'balance': USDC, detrás de BILLING_CRYPTO_ENABLED. */
export type BillingMethod = 'x402' | 'balance' | 'paddle'

export type BillingPayment = {
  id: string
  tenantId: string
  plan: 'founder' | 'pro'
  amountUsd: string
  method: BillingMethod
  /** Referencia del receipt (x402/MPP), id del débito al saldo o transacción de Paddle (txn_...). */
  reference: string
  periodStart: string
  periodEnd: string
  /** Suscripción de Paddle (sub_...) a la que pertenece el cobro. Null en x402 y saldo. */
  subscriptionRef: string | null
  /** Cuándo Paddle aprobó el reembolso completo de este cobro. */
  refundedAt: string | null
  createdAt: string
}

export type NewBillingPayment = Omit<BillingPayment, 'id' | 'createdAt' | 'subscriptionRef' | 'refundedAt'> & { subscriptionRef?: string | null }

export type TenantPaddlePatch = Partial<Pick<Tenant, 'paddleCustomerId' | 'paddleSubscriptionId' | 'paddleStatus' | 'paddleCancelAt'>>
// ---- fin M9 ----

/** El disponible no alcanza para el retiro (ver Store.createWithdrawal). */
export class SaldoInsuficiente extends Error {
  constructor() {
    super('saldo-insuficiente')
    this.name = 'SaldoInsuficiente'
  }
}
