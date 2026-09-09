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

/** EIP-3009: variante v/r/s (USDC v2) y variante bytes (v2.2+, cubre ERC-1271). */
const eip3009Abi = [
  {
    type: 'function',
    name: 'transferWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transferWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

export type ArcAuthorization = {
  from: string
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: string
  signature: string
}

/**
 * Settlement en Arc: el gateway es su propio relayer EIP-3009. El agente firma
 * la autorización off-chain (credential del 402); acá la broadcasteamos con la
 * cuenta de la treasury, que paga el gas en USDC nativo. La referencia del
 * Receipt es el hash de esa tx.
 */
export async function settleArcAuthorization(payload: ArcAuthorization): Promise<{ reference: string }> {
  const signature = payload.signature as `0x${string}`
  const base = [
    payload.from as `0x${string}`,
    payload.to as `0x${string}`,
    BigInt(payload.value),
    BigInt(payload.validAfter),
    BigInt(payload.validBefore),
    payload.nonce as `0x${string}`,
  ] as const

  // Firma EOA de 65 bytes → variante v/r/s (soportada por todo USDC v2).
  // Cualquier otro largo (ERC-1271, etc.) → variante bytes.
  const sigBytes = (signature.length - 2) / 2
  const hash =
    sigBytes === 65
      ? await (() => {
          const { r, s, v, yParity } = parseSignature(signature)
          const vNum = v !== undefined ? Number(v) : yParity + 27
          return arcWalletClient.writeContract({
            address: ARC.token,
            abi: eip3009Abi,
            functionName: 'transferWithAuthorization',
            args: [...base, vNum, r, s],
          })
        })()
      : await arcWalletClient.writeContract({
          address: ARC.token,
          abi: eip3009Abi,
          functionName: 'transferWithAuthorization',
          args: [...base, signature],
        })

  const receipt = await arcPublicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
  if (receipt.status !== 'success') {
    throw new Error(`[arc] settlement revertido: ${hash}`)
  }
  return { reference: hash }
}

/**
 * En Arc `tx.from` es el relayer (nuestra treasury), no el agente. El pagador
 * real sale del evento Transfer de la tx de settlement.
 */
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
