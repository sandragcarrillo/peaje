import 'server-only'
import { cadena, fromBaseUnits, NETWORKS, redesActivas, TOKENS, type NetworkId } from '@peaje/shared'
import { createClient, createPublicClient, erc20Abi, http } from 'viem'
import { tempo, tempoModerato } from 'viem/chains'
import { Actions } from 'viem/tempo'
import { TESTNET } from './config'

/**
 * Lectura de saldos de una wallet en todas las redes donde se cobra. Peaje ya
 * no envía fondos desde wallets de negocios: los pagos llegan directo a la
 * dirección de cobro (docs/pagos-directos.md).
 */

const tempoPublic = createClient({ chain: TESTNET ? tempoModerato : tempo, transport: http() })

export type WalletBalance = { network: NetworkId; symbol: string; amount: string }

/** RPC propio de Arbitrum One si está (el público tiene límite de pedidos). */
function rpcDe(network: NetworkId, publico: string): string {
  const arbitrum = network === 'arbitrum' || network === 'arbitrum-usdg'
  return (!TESTNET && arbitrum && process.env.ARBITRUM_ONE_RPC_URL) || publico
}

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
 * Saldos de la wallet en las redes de este modo, en el orden de NETWORK_IDS. Falla
 * suave por red: un RPC caído no esconde el resto. Tempo va por su SDK (su
 * token no es un ERC-20 común); el resto es `balanceOf` del stablecoin.
 */
export async function walletBalances(address: `0x${string}`): Promise<WalletBalance[]> {
  const leidos = await Promise.allSettled(
    redesActivas(TESTNET).map(async (network): Promise<WalletBalance> => {
      const def = NETWORKS[network]
      const red = cadena(network, TESTNET)!
      if (network === 'tempo') {
        const b = await Actions.token.getBalance(tempoPublic, { account: address, token: TOKENS.pathUsd })
        return { network, symbol: def.tokenSymbol, amount: b.formatted ?? fromBaseUnits(b.amount, def.decimals) }
      }
      const raw = await lector(rpcDe(network, red.rpcUrl)).readContract({
        address: red.token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      return { network, symbol: def.tokenSymbol, amount: fromBaseUnits(raw, def.decimals) }
    }),
  )
  return leidos.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}
