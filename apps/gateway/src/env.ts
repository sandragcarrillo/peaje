import {
  DEFAULT_CURRENCY,
  NETWORKS,
  SETTLEMENT_CONTRACTS,
  tempoConfig,
  type SettlementNetwork,
} from '@peaje/shared'

function settlementAddress(variable: string, deployed: `0x${string}` | undefined): `0x${string}` | null {
  const value = process.env[variable]
  if (value === 'off') return null
  return (value as `0x${string}` | undefined) ?? deployed ?? null
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** Clave para firmar challenges MPP. 32+ bytes. */
  mppSecretKey: required('MPP_SECRET_KEY'),
  /** Wallet de la plataforma que recibe todos los pagos. */
  treasuryAddress: required('TREASURY_ADDRESS') as `0x${string}`,
  currency: (process.env.MPP_CURRENCY ?? DEFAULT_CURRENCY) as `0x${string}`,
  testnet: (process.env.TEMPO_NETWORK ?? 'testnet') === 'testnet',
  /** Clave de la treasury. Solo testnet. Firma los retiros. */
  treasuryPrivateKey: required('TREASURY_PRIVATE_KEY') as `0x${string}`,
  /** Secreto compartido entre dashboard y gateway para la API interna. */
  internalSecret: required('INTERNAL_API_SECRET'),
  rpcUrl: tempoConfig((process.env.TEMPO_NETWORK ?? 'testnet') === 'testnet').rpcUrl,
  /** RPC de Arc. Solo testnet: Arc no publica mainnet todavía. */
  arcRpcUrl: process.env.ARC_RPC_URL ?? NETWORKS.arc.testnet.rpcUrl,
  /** RPC por red con settlement on-chain (override opcional por variable de entorno). */
  settlementRpcUrls: {
    arbitrum: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? NETWORKS.arbitrum.testnet.rpcUrl,
    'arbitrum-usdg': process.env.ARBITRUM_SEPOLIA_RPC_URL ?? NETWORKS['arbitrum-usdg'].testnet.rpcUrl,
    robinhood: process.env.ROBINHOOD_TESTNET_RPC_URL ?? NETWORKS.robinhood.testnet.rpcUrl,
  } satisfies Record<SettlementNetwork, string>,
  /**
   * PeajeSettlement por red. Por defecto la dirección desplegada que trae el
   * paquete compartido; `<RED>_SETTLEMENT_ADDRESS=off` apaga ese riel.
   */
  settlementContracts: {
    arbitrum: settlementAddress('ARBITRUM_SETTLEMENT_ADDRESS', SETTLEMENT_CONTRACTS.arbitrum),
    'arbitrum-usdg': settlementAddress('ARBITRUM_SETTLEMENT_ADDRESS', SETTLEMENT_CONTRACTS['arbitrum-usdg']),
    robinhood: settlementAddress('ROBINHOOD_SETTLEMENT_ADDRESS', SETTLEMENT_CONTRACTS.robinhood),
  } satisfies Record<SettlementNetwork, `0x${string}` | null>,
  /** URL pública del gateway (para links en MCP resources y discovery). */
  publicUrl: process.env.GATEWAY_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
  /**
   * Take rate de Peaje por transacción (0.02 = 2%). El agente paga el precio
   * listado completo; al ledger del negocio se acredita el neto. Como todo
   * el pago cae on-chain en la treasury, la diferencia queda ahí: ese es el
   * revenue de la plataforma.
   */
  feePct: Math.min(0.1, Math.max(0, Number(process.env.PEAJE_FEE_PCT ?? '0.02'))),
}
