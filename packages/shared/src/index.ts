/** Constantes y helpers compartidos entre gateway, dashboard y cliente demo. */

export const TEMPO = {
  mainnet: {
    chainId: 4217,
    rpcUrl: 'https://rpc.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
  },
  testnet: {
    chainId: 42431,
    rpcUrl: 'https://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
  },
} as const

/** Tokens TIP-20 soportados. Mismo address en mainnet y testnet. */
export const TOKENS = {
  pathUsd: '0x20c0000000000000000000000000000000000000',
  usdc: '0x20C000000000000000000000b9537d11c60E8b50',
} as const

export const DEFAULT_CURRENCY = TOKENS.pathUsd
/** Los TIP-20 de Tempo usan 6 decimales. */
export const TOKEN_DECIMALS = 6

// ---- redes de settlement ----

/** Redes donde el gateway acepta pagos. La clave es la que se persiste en la DB. */
export type NetworkId = 'tempo' | 'arc'

type ChainInfo = { chainId: number; rpcUrl: string; explorerUrl: string }

export type NetworkDef = {
  id: NetworkId
  label: string
  /** Token con el que se cobra y del que salen los retiros en esta red. */
  token: `0x${string}`
  tokenSymbol: string
  decimals: number
  /** Domain EIP-712 del token, para autorizaciones EIP-3009 (redes EVM genéricas). */
  eip3009?: { name: string; version: string }
  mainnet: ChainInfo | null
  testnet: ChainInfo
}

export const NETWORKS: Record<NetworkId, NetworkDef> = {
  tempo: {
    id: 'tempo',
    label: 'Tempo',
    token: TOKENS.pathUsd,
    tokenSymbol: 'pathUSD',
    decimals: 6,
    mainnet: TEMPO.mainnet,
    testnet: TEMPO.testnet,
  },
  arc: {
    id: 'arc',
    label: 'Arc',
    // Interfaz ERC-20 del USDC nativo de Arc; el gas de la red se paga en ese mismo USDC.
    token: '0x3600000000000000000000000000000000000000',
    tokenSymbol: 'USDC',
    decimals: 6,
    // Leído on-chain del contrato: name() = "USDC", version() = "2".
    eip3009: { name: 'USDC', version: '2' },
    // Arc no publica direcciones de mainnet todavía (sept 2026).
    mainnet: null,
    testnet: {
      chainId: 5042002,
      rpcUrl: 'https://rpc.testnet.arc.io',
      explorerUrl: 'https://testnet.arcscan.app',
    },
  },
}

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[]

export function isNetworkId(value: string): value is NetworkId {
  return value in NETWORKS
}

export function networkChain(id: NetworkId, testnet: boolean): ChainInfo {
  const def = NETWORKS[id]
  const chain = testnet ? def.testnet : def.mainnet
  if (!chain) throw new Error(`La red ${id} no tiene mainnet todavía`)
  return chain
}

export function explorerTxUrl(network: NetworkId, hash: string, testnet = true): string {
  return `${networkChain(network, testnet).explorerUrl}/tx/${hash}`
}

/**
 * El Receipt de MPP trae el método de pago (`tempo`, `evm`), no la red.
 * Mientras la única red EVM genérica sea Arc, el mapeo es directo.
 */
export function networkFromReceiptMethod(method: string | undefined): NetworkId {
  return method === 'evm' ? 'arc' : 'tempo'
}

export function tempoConfig(testnet: boolean) {
  return testnet ? TEMPO.testnet : TEMPO.mainnet
}

/** @deprecated Usar `explorerTxUrl(network, hash, testnet)`: asume Tempo. */
export function txExplorerUrl(hash: string, testnet = true): string {
  return `${tempoConfig(testnet).explorerUrl}/tx/${hash}`
}

/** Convierte unidades base del token (ej. "50000") a decimal ("0.05"). */
export function fromBaseUnits(base: string | bigint, decimals = TOKEN_DECIMALS): string {
  const value = BigInt(base)
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/** Normaliza un precio a string decimal, que es lo que espera mppx. */
export function formatAmount(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n) || n < 0) throw new Error(`Monto inválido: ${amount}`)
  const fixed = n.toFixed(TOKEN_DECIMALS)
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}

// ---- reputación ERC-8004 ----

/**
 * Promedio de feedback del registro ERC-8004.
 *
 * La spec define un score de 0 a 100, pero hay agentes publicando valores
 * fuera de rango (se ven hasta 924). Descartamos los malformados en vez de
 * recortarlos: recortar premiaría al que infla. Si a un agente no le queda
 * ningún valor válido, se trata como "sin reputación".
 */
export function reputationAverage(values: (string | number)[]): number | null {
  const validos = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v) && v >= 0 && v <= 100)
  if (validos.length === 0) return null
  return Math.round(validos.reduce((s, v) => s + v, 0) / validos.length)
}

// ---- frecuencias de agentes compradores ----

export type AgentFrequencyId = 'once' | 'hourly' | 'daily' | 'biweekly' | 'monthly'

export type UiLocale = 'en' | 'es'

export const AGENT_FREQUENCIES: {
  id: AgentFrequencyId
  labels: Record<UiLocale, string>
  /** @deprecated Usar `labels[locale]`. Se mantiene por compatibilidad. */
  label: string
}[] = [
  { id: 'once', labels: { en: 'Once', es: 'Una vez' }, label: 'Una vez' },
  { id: 'hourly', labels: { en: 'Hourly', es: 'Cada hora' }, label: 'Cada hora' },
  { id: 'daily', labels: { en: 'Daily', es: 'Diaria' }, label: 'Diaria' },
  { id: 'biweekly', labels: { en: 'Every 15 days', es: 'Cada 15 días' }, label: 'Cada 15 días' },
  { id: 'monthly', labels: { en: 'Monthly', es: 'Mensual' }, label: 'Mensual' },
]

export function frequencyLabel(id: string, locale: UiLocale = 'en'): string {
  return AGENT_FREQUENCIES.find((f) => f.id === id)?.labels[locale] ?? id
}

/**
 * Próxima corrida según la frecuencia. `null` para 'once': el agente corre una
 * sola vez y queda 'done'. Mensual usa el mismo día del mes siguiente (el
 * clamp del Date resuelve el 31 en meses cortos).
 */
export function nextRunAt(frequency: AgentFrequencyId, from = new Date()): Date | null {
  const d = new Date(from)
  switch (frequency) {
    case 'once':
      return null
    case 'hourly':
      d.setHours(d.getHours() + 1)
      return d
    case 'daily':
      d.setDate(d.getDate() + 1)
      return d
    case 'biweekly':
      d.setDate(d.getDate() + 15)
      return d
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      return d
  }
}

// ---- credenciales de tenant ----

const KEY_PREFIX = 'peaje_live_'

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Genera un API key. Se muestra una sola vez; en la DB va solo el hash. */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomHex(24)}`
}

/** Secreto para firmar los JWT del iframe. Distinto del API key. */
export function generateEmbedSecret(): string {
  return randomHex(32)
}

/** Prefijo visible del key, para que el tenant lo reconozca en el dashboard. */
export function apiKeyPrefix(key: string): string {
  return `${key.slice(0, KEY_PREFIX.length + 6)}…`
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return toHex(new Uint8Array(digest))
}

/** Slug URL-safe a partir de un nombre. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
