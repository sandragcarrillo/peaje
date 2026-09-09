import { tempoConfig, type NetworkId } from '@peaje/shared'
import { createPublicClient, http } from 'viem'
import { resolveArcPayer } from './arc.js'
import { env } from './env.js'

const config = tempoConfig(env.testnet)

/** Cliente de lectura sobre Tempo. Se usa para resolver quién pagó una tx. */
export const publicClient = createPublicClient({
  transport: http(config.rpcUrl),
})

/**
 * El Receipt de MPP no trae la wallet del agente, solo el hash de la tx.
 * En Tempo el agente broadcastea él mismo: el pagador es `tx.from`. En Arc
 * broadcastea nuestra treasury (relayer), así que se resuelve por el evento
 * Transfer (ver arc.ts).
 */
export async function resolvePayer(network: NetworkId, txHash: string): Promise<string | null> {
  if (network === 'arc') return resolveArcPayer(txHash)
  try {
    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` })
    return tx.from ?? null
  } catch (error) {
    console.warn('[chain] no se pudo resolver el pagador de', txHash, error)
    return null
  }
}
