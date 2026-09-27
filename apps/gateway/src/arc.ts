import { fromBaseUnits, NETWORKS } from '@peaje/shared'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseEventLogs,
  parseSignature,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { env } from './env.js'

const ARC = NETWORKS.arc
// Arc no tiene mainnet todavía: el gateway opera contra testnet siempre.
const chainInfo = ARC.testnet

/**
 * Arc, la L1 de Circle. EVM estándar con una particularidad: USDC es el token
 * nativo de gas (18 decimales como nativo, 6 vía la interfaz ERC-20 en
 * `ARC.token`). Misma cuenta de treasury que en Tempo: es una key EVM normal.
 */
export const arcTestnet = defineChain({
  id: chainInfo.chainId,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [env.arcRpcUrl] } },
  blockExplorers: { default: { name: 'Arcscan', url: chainInfo.explorerUrl } },
})

const account = privateKeyToAccount(env.treasuryPrivateKey)

export const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(env.arcRpcUrl),
})

const arcWalletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(env.arcRpcUrl),
})

// Los cobros en Arc liquidan en PeajeSettlement (settlement.ts). Acá queda
// solo lo que la treasury hace en Arc: pagos salientes y saldos.

export async function resolveArcPayer(txHash: string): Promise<string | null> {
  try {
    const receipt = await arcPublicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs })
    return transfers[0]?.args.from ?? null
  } catch (error) {
    console.warn('[arc] no se pudo resolver el pagador de', txHash, error)
    return null
  }
}

/** Retiro en Arc: transfer ERC-20 estándar del USDC de la treasury. */
export async function sendArcPayout(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
  return arcWalletClient.writeContract({
    address: ARC.token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, ARC.decimals)],
  })
}

/** Saldo USDC de la treasury en Arc, en decimal. */
export async function arcTreasuryBalance(): Promise<string> {
  const raw = await arcPublicClient.readContract({
    address: ARC.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  return fromBaseUnits(raw, ARC.decimals)
}

/** true si la tx ya está minada y salió bien. null si todavía no aparece. */
export async function arcPayoutConfirmed(hash: `0x${string}`): Promise<boolean | null> {
  try {
    const receipt = await arcPublicClient.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}
