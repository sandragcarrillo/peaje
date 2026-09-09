import { TOKEN_DECIMALS, type NetworkId } from '@peaje/shared'
import { createClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { arcPayoutConfirmed, arcTreasuryBalance, sendArcPayout } from './arc.js'
import { publicClient } from './chain.js'
import { env } from './env.js'

const account = privateKeyToAccount(env.treasuryPrivateKey)

/**
 * Cliente de escritura de la treasury en Tempo.
 *
 * En Tempo el gas se paga en token, no en un nativo: por eso el chain lleva
 * `feeToken`. Usamos el mismo token con el que cobramos. La misma cuenta firma
 * también en Arc (ver arc.ts): es una key EVM normal, cambia solo el cliente.
 */
const tempoWalletClient = createClient({
  account,
  chain: { ...tempoModerato, feeToken: env.currency },
  transport: http(env.rpcUrl),
})

export const treasuryAddress = account.address

async function sendTempoPayout(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
  return Actions.token.transfer(tempoWalletClient, {
    to,
    token: env.currency,
    amount: parseUnits(amount, TOKEN_DECIMALS),
  })
}

async function tempoTreasuryBalance(): Promise<string> {
  const balance = await Actions.token.getBalance(publicClient, {
    account: account.address,
    token: env.currency,
  })
  return balance.formatted ?? String(balance.amount)
}

async function tempoPayoutConfirmed(hash: `0x${string}`): Promise<boolean | null> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}

/** Manda `amount` (decimal, ej "12.45") del token de la red a `to`. Devuelve el hash. */
export async function sendPayout(
  network: NetworkId,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  return network === 'arc' ? sendArcPayout(to, amount) : sendTempoPayout(to, amount)
}

/** Saldo de la treasury en decimal, en la red indicada. */
export async function treasuryBalance(network: NetworkId): Promise<string> {
  return network === 'arc' ? arcTreasuryBalance() : tempoTreasuryBalance()
}

/** true si la tx ya está minada y salió bien. null si todavía no aparece. */
export async function payoutConfirmed(
  network: NetworkId,
  hash: `0x${string}`,
): Promise<boolean | null> {
  return network === 'arc' ? arcPayoutConfirmed(hash) : tempoPayoutConfirmed(hash)
}
