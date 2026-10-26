import { isGatewayRail, isNetworkId, TOKEN_DECIMALS, type NetworkId } from '@peaje/shared'
import { createClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { arcTreasuryBalance, sendArcPayout } from './arc.js'
import { sendTreasuryPayout, treasuryTokenBalance } from './settlement.js'
import { retirarGateway, saldoGatewayTreasury } from './circle.js'
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

/** Manda `amount` (decimal, ej "12.45") del token de la red a `to`. Devuelve el hash. */
export async function sendPayout(
  network: NetworkId | string,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  if (isGatewayRail(network)) return retirarGateway(network, to, amount)
  if (!isNetworkId(network)) throw new Error(`Red desconocida: ${network}`)
  switch (network) {
    case 'tempo':
      return sendTempoPayout(to, amount)
    case 'arc':
      return sendArcPayout(to, amount)
    case 'arbitrum':
    case 'arbitrum-usdg':
    case 'robinhood':
      return sendTreasuryPayout(network, to, amount)
  }
}

/** Saldo de la treasury en decimal, en la red indicada. */
export async function treasuryBalance(network: NetworkId | string): Promise<string> {
  if (isGatewayRail(network)) return saldoGatewayTreasury(network)
  if (!isNetworkId(network)) throw new Error(`Red desconocida: ${network}`)
  switch (network) {
    case 'tempo':
      return tempoTreasuryBalance()
    case 'arc':
      return arcTreasuryBalance()
    case 'arbitrum':
    case 'arbitrum-usdg':
    case 'robinhood':
      return treasuryTokenBalance(network)
  }
}
