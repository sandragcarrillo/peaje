import { TOKEN_DECIMALS, type NetworkId } from '@peaje/shared'
import { createClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { arcPayoutConfirmed, arcTreasuryBalance, sendArcPayout } from './arc.js'
import {
  arbitrumPayoutConfirmed,
  arbitrumTreasuryBalance,
  sendArbitrumPayout,
  withdrawFromSettlement,
} from './arbitrum.js'
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
  switch (network) {
    case 'tempo':
      return sendTempoPayout(to, amount)
    case 'arc':
      return sendArcPayout(to, amount)
    case 'arbitrum':
      return sendArbitrumPayout(to, amount)
  }
}

/** Saldo de la treasury en decimal, en la red indicada. */
export async function treasuryBalance(network: NetworkId): Promise<string> {
  switch (network) {
    case 'tempo':
      return tempoTreasuryBalance()
    case 'arc':
      return arcTreasuryBalance()
    case 'arbitrum':
      return arbitrumTreasuryBalance()
  }
}

/** true si la tx ya está minada y salió bien. null si todavía no aparece. */
export async function payoutConfirmed(
  network: NetworkId,
  hash: `0x${string}`,
): Promise<boolean | null> {
  switch (network) {
    case 'tempo':
      return tempoPayoutConfirmed(hash)
    case 'arc':
      return arcPayoutConfirmed(hash)
    case 'arbitrum':
      return arbitrumPayoutConfirmed(hash)
  }
}

/**
 * Saca plata del saldo de un negocio hacia `to` (retiro o fondeo de agente).
 * En Tempo y Arc ese saldo vive en la treasury; en Arbitrum vive en
 * PeajeSettlement a nombre de la wallet de cobro del negocio.
 */
export async function payoutFromTenant(
  tenant: { payoutWallet: string | null },
  network: NetworkId,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  if (network !== 'arbitrum') return sendPayout(network, to, amount)
  if (!tenant.payoutWallet) throw new Error('El negocio no tiene wallet de cobro en Arbitrum')
  return withdrawFromSettlement(tenant.payoutWallet as `0x${string}`, to, amount)
}
