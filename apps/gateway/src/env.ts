import { DEFAULT_CURRENCY, NETWORKS, tempoConfig } from '@peaje/shared'

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
  /** URL pública del gateway (para links en MCP resources y discovery). */
  publicUrl: process.env.GATEWAY_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
}
