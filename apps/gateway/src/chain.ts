import { isSettlementNetwork, tempoConfig, type NetworkId } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { resolveArcPayer } from './arc.js'
import { resolveSettlementPayer } from './settlement.js'
import { env } from './env.js'

const config = tempoConfig(env.testnet)

/** Cliente de lectura sobre Tempo. Se usa para resolver quién pagó una tx. */
export const publicClient = createPublicClient({
  transport: http(config.rpcUrl),
})

/**
 * El Receipt de MPP no trae la wallet del agente, solo el hash de la tx.
 * En Tempo el agente broadcastea él mismo: el pagador es `tx.from`. En las
 * redes con contrato broadcastea el relayer, así que se resuelve por el
 * evento PaymentSettled (ver settlement.ts).
 */
export async function resolvePayer(network: NetworkId, txHash: string): Promise<string | null> {
  // Arc liquida en PeajeSettlementV3 como las demás redes EVM; un pago viejo
  // sin evento de settlement cae a leer el Transfer.
  if (isSettlementNetwork(network)) {
    const pagador = await resolveSettlementPayer(network, txHash)
    if (pagador || network !== 'arc') return pagador
    return resolveArcPayer(txHash)
  }
  try {
    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` })
    return tx.from ?? null
  } catch (error) {
    console.warn('[chain] no se pudo resolver el pagador de', txHash, error)
    return null
  }
}
