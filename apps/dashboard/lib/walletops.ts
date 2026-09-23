import 'server-only'
import { fromBaseUnits, isSettlementNetwork, NETWORK_IDS, NETWORKS, TOKENS, type NetworkId } from '@peaje/shared'
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

const tempoPublic = createClient({ chain: tempoModerato, transport: http() })

export type WalletBalance = { network: NetworkId; symbol: string; amount: string }

/** Un cliente de lectura por RPC: Arbitrum USDC y USDG comparten cadena. */
const lectores = new Map<string, ReturnType<typeof createPublicClient>>()
function lector(rpcUrl: string) {
  let cliente = lectores.get(rpcUrl)
  if (!cliente) {
    cliente = createPublicClient({ transport: http(rpcUrl) })
    lectores.set(rpcUrl, cliente)
  }
  return cliente
}

/**
 * Saldos de la wallet en todas las redes, en el orden de NETWORK_IDS. Falla
 * suave por red: un RPC caído no esconde el resto. Tempo va por su SDK (su
 * token no es un ERC-20 común); el resto es `balanceOf` del stablecoin.
 */
export async function walletBalances(address: `0x${string}`): Promise<WalletBalance[]> {
  const leidos = await Promise.allSettled(
    NETWORK_IDS.map(async (network): Promise<WalletBalance> => {
      const def = NETWORKS[network]
      if (network === 'tempo') {
        const b = await Actions.token.getBalance(tempoPublic, { account: address, token: TOKENS.pathUsd })
        return { network, symbol: def.tokenSymbol, amount: b.formatted ?? fromBaseUnits(b.amount, def.decimals) }
      }
      const raw = await lector(def.testnet.rpcUrl).readContract({
        address: def.token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      return { network, symbol: def.tokenSymbol, amount: fromBaseUnits(raw, def.decimals) }
    }),
  )
  return leidos.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
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

  // En las redes con settlement el saldo del negocio vive en PeajeSettlement y
  // el gas es ETH: esos retiros los hace el gateway con un retiro firmado.
  if (isSettlementNetwork(network)) {
    throw new Error(`${NETWORKS[network].label} withdrawals go through Peaje: use Withdraw in your business dashboard.`)
  }

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
