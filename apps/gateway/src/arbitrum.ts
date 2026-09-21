import { fromBaseUnits, NETWORKS } from '@peaje/shared'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseAbi,
  parseEventLogs,
  parseSignature,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import { privyAccountByAddress } from './agents/wallet.js'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'

const ARB = NETWORKS.arbitrum

/**
 * Arbitrum Sepolia. A diferencia de Tempo y Arc, acá los pagos no caen en la
 * treasury: caen en PeajeSettlement, que acredita al comerciante y el fee de
 * Peaje on-chain. El gas se paga en ETH, así que la treasury (relayer) paga el
 * gas del settlement y de los retiros; comerciantes y agentes nunca necesitan ETH.
 */
const chain = { ...arbitrumSepolia, rpcUrls: { default: { http: [env.arbitrumRpcUrl] } } }

const account = privateKeyToAccount(env.treasuryPrivateKey)

export const arbitrumPublicClient = createPublicClient({ chain, transport: http(env.arbitrumRpcUrl) })

const relayerClient = createWalletClient({ account, chain, transport: http(env.arbitrumRpcUrl) })

export const settlementAbi = parseAbi([
  'struct Authorization { address from; uint256 value; uint256 validAfter; uint256 validBefore; bytes32 nonce; uint8 v; bytes32 r; bytes32 s; }',
  'function settle(address token, address merchant, Authorization auth) returns (uint256)',
  'function withdrawWithSignature(address token, address account, uint256 amount, address to, uint256 deadline, bytes signature)',
  'function claimable(address token, address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'event PaymentSettled(bytes32 indexed nonce, address indexed token, address indexed merchant, address payer, uint256 amount, uint256 fee)',
])

function settlementAddress(): `0x${string}` {
  if (!env.arbitrumSettlement) throw new Error('Falta ARBITRUM_SETTLEMENT_ADDRESS: el riel de Arbitrum está apagado')
  return env.arbitrumSettlement
}

type Authorization = {
  from: string
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: string
  signature: string
}

/**
 * El agente firmó la autorización EIP-3009 con `to` = el contrato. El relayer
 * la somete vía `settle`, que es quien decide a qué comerciante acreditar: por
 * eso el comerciante sale del contexto del cobro y no del payload del agente.
 */
export async function settleArbitrumAuthorization(payload: Authorization): Promise<{ reference: string }> {
  const contexto = contextoCobro.getStore()
  const merchant = contexto?.merchant ?? account.address

  const signature = payload.signature as `0x${string}`
  if ((signature.length - 2) / 2 !== 65) {
    throw new Error('[arbitrum] PeajeSettlement solo acepta firmas EOA de 65 bytes')
  }
  const { r, s, v, yParity } = parseSignature(signature)

  const hash = await relayerClient.writeContract({
    address: settlementAddress(),
    abi: settlementAbi,
    functionName: 'settle',
    args: [
      ARB.token,
      merchant,
      {
        from: payload.from as `0x${string}`,
        value: BigInt(payload.value),
        validAfter: BigInt(payload.validAfter),
        validBefore: BigInt(payload.validBefore),
        nonce: payload.nonce as `0x${string}`,
        v: v !== undefined ? Number(v) : yParity + 27,
        r,
        s,
      },
    ],
  })

  const receipt = await arbitrumPublicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
  if (receipt.status !== 'success') throw new Error(`[arbitrum] settlement revertido: ${hash}`)

  if (contexto) contexto.network = 'arbitrum'
  return { reference: hash }
}

/** El pagador real sale del evento PaymentSettled: `tx.from` es el relayer. */
export async function resolveArbitrumPayer(txHash: string): Promise<string | null> {
  try {
    const receipt = await arbitrumPublicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    const logs = parseEventLogs({ abi: settlementAbi, eventName: 'PaymentSettled', logs: receipt.logs })
    return logs[0]?.args.payer ?? null
  } catch (error) {
    console.warn('[arbitrum] no se pudo resolver el pagador de', txHash, error)
    return null
  }
}

/**
 * Retiro de lo que el contrato le debe a un comerciante. La wallet del
 * comerciante (custodiada por Privy) firma el retiro EIP-712 y el relayer lo
 * somete pagando el gas: el comerciante no necesita ETH.
 */
export async function withdrawFromSettlement(
  merchant: `0x${string}`,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const contrato = settlementAddress()
  const firmante = await privyAccountByAddress(merchant)
  if (!firmante) throw new Error('La wallet de cobro del negocio no es una wallet custodiada por Peaje')

  const value = parseUnits(amount, ARB.decimals)
  const nonce = await arbitrumPublicClient.readContract({
    address: contrato,
    abi: settlementAbi,
    functionName: 'nonces',
    args: [merchant],
  })
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)

  const signature = await firmante.signTypedData({
    domain: { name: 'PeajeSettlement', version: '1', chainId: chain.id, verifyingContract: contrato },
    types: {
      Withdraw: [
        { name: 'token', type: 'address' },
        { name: 'account', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'to', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Withdraw',
    message: { token: ARB.token, account: merchant, amount: value, to, nonce, deadline },
  })

  return relayerClient.writeContract({
    address: contrato,
    abi: settlementAbi,
    functionName: 'withdrawWithSignature',
    args: [ARB.token, merchant, value, to, deadline, signature],
  })
}

/** Transfer de USDC desde la treasury (su propio saldo, no el de los comerciantes). */
export async function sendArbitrumPayout(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
  return relayerClient.writeContract({
    address: ARB.token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, ARB.decimals)],
  })
}

export async function arbitrumTreasuryBalance(): Promise<string> {
  const raw = await arbitrumPublicClient.readContract({
    address: ARB.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  return fromBaseUnits(raw, ARB.decimals)
}

export async function arbitrumPayoutConfirmed(hash: `0x${string}`): Promise<boolean | null> {
  try {
    const receipt = await arbitrumPublicClient.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}

const eip3009Abi = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
])

/**
 * Transfer de USDC firmado por una wallet sin ETH (un agente devolviendo su
 * saldo): la wallet firma la autorización EIP-3009 y el relayer paga el gas.
 */
export async function relayUsdcTransfer(
  firmante: { address: `0x${string}`; signTypedData: (args: never) => Promise<`0x${string}`> },
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const value = parseUnits(amount, ARB.decimals)
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600)
  const nonce = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((h, b) => h + b.toString(16).padStart(2, '0'), '')}` as `0x${string}`

  const signature = await firmante.signTypedData({
    domain: { ...ARB.eip3009!, chainId: chain.id, verifyingContract: ARB.token },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: { from: firmante.address, to, value, validAfter: 0n, validBefore, nonce },
  } as never)
  const { r, s, v, yParity } = parseSignature(signature)

  return relayerClient.writeContract({
    address: ARB.token,
    abi: eip3009Abi,
    functionName: 'transferWithAuthorization',
    args: [firmante.address, to, value, 0n, validBefore, nonce, v !== undefined ? Number(v) : yParity + 27, r, s],
  })
}

export async function arbitrumUsdcBalance(address: `0x${string}`): Promise<string> {
  const raw = await arbitrumPublicClient.readContract({
    address: ARB.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })
  return fromBaseUnits(raw, ARB.decimals)
}
