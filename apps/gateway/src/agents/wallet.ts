import { PrivyClient } from '@privy-io/node'
import { createViemAccount } from '@privy-io/node/viem'
import { fromBaseUnits, NETWORKS, TOKENS, type NetworkId } from '@peaje/shared'
import { createClient, createWalletClient, erc20Abi, http, parseUnits, type LocalAccount } from 'viem'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { arcPublicClient, arcTestnet } from '../arc.js'
import { publicClient } from '../chain.js'

/**
 * Wallet de un agente comprador: una cuenta EVM custodiada por Privy, igual
 * que la del merchant. No hay contrato ni deploy.
 *
 * Por qué wallet propia y no una sub-cuenta contable: así el presupuesto es el
 * saldo real de una address. Un bug no puede gastar más de lo que hay.
 */

let cached: PrivyClient | undefined

function privy(): PrivyClient {
  if (!cached) {
    const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID
    const appSecret = process.env.PRIVY_APP_SECRET
    if (!appId || !appSecret) throw new Error('Faltan PRIVY_APP_ID / PRIVY_APP_SECRET en el gateway')
    cached = new PrivyClient({ appId, appSecret })
  }
  return cached
}

export async function createAgentWallet(name: string): Promise<{ id: string; address: `0x${string}` }> {
  const wallet = await privy()
    .wallets()
    .create({ chain_type: 'ethereum', display_name: `peaje-agente-${name}`.slice(0, 60) })
  return { id: wallet.id, address: wallet.address as `0x${string}` }
}

/** El cast aplaca la inferencia de viem con la firma doble tempo+EVM de Privy. */
export function agentAccount(walletId: string, address: `0x${string}`): LocalAccount {
  return createViemAccount(privy(), { walletId, address }) as unknown as LocalAccount
}

/** Saldo del agente en la red donde opera, en decimal. */
export async function agentBalance(address: `0x${string}`, network: NetworkId): Promise<string> {
  if (network === 'arc') {
    const raw = await arcPublicClient.readContract({
      address: NETWORKS.arc.token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    })
    return fromBaseUnits(raw, NETWORKS.arc.decimals)
  }
  const balance = await Actions.token.getBalance(publicClient, { account: address, token: TOKENS.pathUsd })
  return balance.formatted ?? fromBaseUnits(balance.amount, NETWORKS.tempo.decimals)
}

/**
 * Barrido: el agente devuelve `amount` (o todo su saldo) a la wallet del
 * negocio. Sin esto la plata queda atrapada en los agentes.
 */
export async function sweepAgent(
  walletId: string,
  address: `0x${string}`,
  network: NetworkId,
  to: `0x${string}`,
  amount?: string,
): Promise<`0x${string}`> {
  const account = agentAccount(walletId, address)
  const monto = amount ?? (await agentBalance(address, network))
  const decimals = NETWORKS[network].decimals

  if (network === 'arc') {
    const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() })
    return wallet.writeContract({
      address: NETWORKS.arc.token,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parseUnits(monto, decimals)],
    })
  }

  const wallet = createClient({
    account,
    chain: { ...tempoModerato, feeToken: TOKENS.pathUsd },
    transport: http(),
  })
  return Actions.token.transfer(wallet, {
    to,
    token: TOKENS.pathUsd,
    amount: parseUnits(monto, decimals),
  })
}
