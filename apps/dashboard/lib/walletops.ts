import 'server-only'
import { fromBaseUnits, NETWORKS, TOKENS, type NetworkId } from '@peaje/shared'
import {
  createClient,
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseUnits,
  type LocalAccount,
} from 'viem'
import { tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { findMerchantWalletId, merchantViemAccount } from './privy'

/**
 * Operaciones sobre la wallet Peaje del merchant (custodiada por Privy):
 * saldos por red y envío de fondos a cualquier address externa. La firma
 * ocurre en Privy vía el adapter de viem; la clave nunca toca este proceso.
 */

const arcTestnet = defineChain({
  id: NETWORKS.arc.testnet.chainId,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.arc.testnet.rpcUrl] } },
})

const arcPublic = createPublicClient({ chain: arcTestnet, transport: http() })
const tempoPublic = createClient({ chain: tempoModerato, transport: http() })

export type WalletBalance = { network: NetworkId; symbol: string; amount: string }

/** Saldos de la wallet en las redes soportadas. Falla suave por red. */
export async function walletBalances(address: `0x${string}`): Promise<WalletBalance[]> {
  const [tempo, arc] = await Promise.allSettled([
    Actions.token.getBalance(tempoPublic, { account: address, token: TOKENS.pathUsd }),
    arcPublic.readContract({
      address: NETWORKS.arc.token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    }),
  ])
  const out: WalletBalance[] = []
  if (tempo.status === 'fulfilled') {
    out.push({
      network: 'tempo',
      symbol: NETWORKS.tempo.tokenSymbol,
      amount: tempo.value.formatted ?? fromBaseUnits(tempo.value.amount, NETWORKS.tempo.decimals),
    })
  }
  if (arc.status === 'fulfilled') {
    out.push({
      network: 'arc',
      symbol: NETWORKS.arc.tokenSymbol,
      amount: fromBaseUnits(arc.value, NETWORKS.arc.decimals),
    })
  }
  return out
}

/**
 * Envía `amount` (decimal) del token de la red desde la wallet Peaje del
 * merchant a `to`. Devuelve el hash. Lanza si la address no es una wallet
 * custodiada por Privy de esta app.
 */
export async function sendFromMerchantWallet(
  walletAddress: `0x${string}`,
  network: NetworkId,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const walletId = await findMerchantWalletId(walletAddress)
  if (!walletId) {
    throw new Error('Peaje does not custody that wallet: move the funds from your own wallet app.')
  }
  // El cast aplaca la inferencia de TS (la firma doble tempo+EVM del account de
  // Privy revienta el checker); en runtime firma ambos tipos de tx igual.
  const account = merchantViemAccount(walletId, walletAddress) as unknown as LocalAccount

  if (network === 'arc') {
    const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() })
    return wallet.writeContract({
      address: NETWORKS.arc.token,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parseUnits(amount, NETWORKS.arc.decimals)],
    })
  }

  // Tempo: el gas se paga en el mismo token (feeToken); Privy firma el tx type 118.
  const wallet = createClient({
    account,
    chain: { ...tempoModerato, feeToken: TOKENS.pathUsd },
    transport: http(),
  })
  return Actions.token.transfer(wallet, {
    to,
    token: TOKENS.pathUsd,
    amount: parseUnits(amount, NETWORKS.tempo.decimals),
  })
}
