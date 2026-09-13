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
  /**
   * Take rate de Peaje por transacción (0.02 = 2%). El agente paga el precio
   * listado completo; al ledger del negocio se acredita el neto. Como todo
   * el pago cae on-chain en la treasury, la diferencia queda ahí: ese es el
   * revenue de la plataforma.
   */
  feePct: Math.min(0.1, Math.max(0, Number(process.env.PEAJE_FEE_PCT ?? '0.02'))),
}
