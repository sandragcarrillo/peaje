import { fromBaseUnits, NETWORKS, type SettlementNetwork } from '@peaje/shared'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseAbi,
  parseEventLogs,
  parseSignature,
  parseUnits,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { privyAccountByAddress } from './agents/wallet.js'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'

/**
 * Redes con settlement on-chain (Arbitrum, Robinhood). Los pagos no caen en
 * la treasury: caen en PeajeSettlement, que acredita al comerciante y el fee
 * de Peaje en la misma transacción. El gas es ETH en estas redes, así que la
 * treasury actúa de relayer: comerciantes y agentes nunca necesitan ETH.
 */

export const settlementAbi = parseAbi([
  'struct Authorization { address from; uint256 value; uint256 validAfter; uint256 validBefore; bytes32 nonce; uint8 v; bytes32 r; bytes32 s; }',
  'function settle(address token, address merchant, Authorization auth) returns (uint256)',
  'function withdrawWithSignature(address token, address account, uint256 amount, address to, uint256 deadline, bytes signature)',
  'function claimable(address token, address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'event PaymentSettled(bytes32 indexed nonce, address indexed token, address indexed merchant, address payer, uint256 amount, uint256 fee)',
])

const eip3009Abi = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
])

const relayer = privateKeyToAccount(env.treasuryPrivateKey)

type Riel = {
  chain: Chain
  publicClient: PublicClient
  relayerClient: WalletClient<ReturnType<typeof http>, Chain, typeof relayer>
  token: `0x${string}`
  decimals: number
}

const rieles = new Map<SettlementNetwork, Riel>()

function riel(network: SettlementNetwork): Riel {
  const cached = rieles.get(network)
  if (cached) return cached

  const def = NETWORKS[network]
  const rpcUrl = env.settlementRpcUrls[network]
  const chain = defineChain({
    id: def.testnet.chainId,
    name: `${def.label} Testnet`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: def.label, url: def.testnet.explorerUrl } },
  })
  const nuevo: Riel = {
    chain,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    relayerClient: createWalletClient({ account: relayer, chain, transport: http(rpcUrl) }),
    token: def.token,
    decimals: def.decimals,
  }
  rieles.set(network, nuevo)
  return nuevo
}

export function settlementContract(network: SettlementNetwork): `0x${string}` {
  const contrato = env.settlementContracts[network]
  if (!contrato) throw new Error(`El riel de ${NETWORKS[network].label} está apagado: no hay PeajeSettlement configurado`)
  return contrato
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

function vrs(signature: `0x${string}`) {
  const { r, s, v, yParity } = parseSignature(signature)
  return { v: v !== undefined ? Number(v) : yParity + 27, r, s }
}

/**
 * El agente firmó la autorización EIP-3009 con `to` = el contrato. El relayer
 * la somete vía `settle`, que decide a qué comerciante acreditar: por eso el
 * comerciante sale del contexto del cobro y no del payload del agente.
 */
export async function settleAuthorization(
  network: SettlementNetwork,
  payload: Authorization,
): Promise<{ reference: string }> {
  const { publicClient, relayerClient, token } = riel(network)
  const contexto = contextoCobro.getStore()
  const merchant = contexto?.merchant ?? relayer.address

  const signature = payload.signature as `0x${string}`
  if ((signature.length - 2) / 2 !== 65) {
    throw new Error(`[${network}] PeajeSettlement solo acepta firmas EOA de 65 bytes`)
  }

  const hash = await relayerClient.writeContract({
    address: settlementContract(network),
    abi: settlementAbi,
    functionName: 'settle',
    args: [
      token,
      merchant,
      {
        from: payload.from as `0x${string}`,
        value: BigInt(payload.value),
        validAfter: BigInt(payload.validAfter),
        validBefore: BigInt(payload.validBefore),
        nonce: payload.nonce as `0x${string}`,
        ...vrs(signature),
      },
    ],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
  if (receipt.status !== 'success') throw new Error(`[${network}] settlement revertido: ${hash}`)

  if (contexto) contexto.network = network
  return { reference: hash }
}

/** El pagador real sale del evento PaymentSettled: `tx.from` es el relayer. */
export async function resolveSettlementPayer(network: SettlementNetwork, txHash: string): Promise<string | null> {
  try {
    const receipt = await riel(network).publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    const logs = parseEventLogs({ abi: settlementAbi, eventName: 'PaymentSettled', logs: receipt.logs })
    return logs[0]?.args.payer ?? null
  } catch (error) {
    console.warn(`[${network}] no se pudo resolver el pagador de`, txHash, error)
    return null
  }
}

/**
 * Retiro de lo que el contrato le debe a un comerciante. Su wallet (custodiada
 * por Privy) firma el retiro EIP-712 y el relayer lo somete pagando el gas.
 */
export async function withdrawFromSettlement(
  network: SettlementNetwork,
  merchant: `0x${string}`,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const { chain, publicClient, relayerClient, token, decimals } = riel(network)
  const contrato = settlementContract(network)
  const firmante = await privyAccountByAddress(merchant)
  if (!firmante) throw new Error('La wallet de cobro del negocio no es una wallet custodiada por Peaje')

  const value = parseUnits(amount, decimals)
  const nonce = await publicClient.readContract({
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
    message: { token, account: merchant, amount: value, to, nonce, deadline },
  })

  return relayerClient.writeContract({
    address: contrato,
    abi: settlementAbi,
    functionName: 'withdrawWithSignature',
    args: [token, merchant, value, to, deadline, signature],
  })
}

/**
 * Transfer del stablecoin firmado por una wallet sin ETH (un agente que
 * devuelve su saldo): firma EIP-3009 y el relayer paga el gas.
 */
export async function relayTokenTransfer(
  network: SettlementNetwork,
  firmante: LocalAccount,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const { chain, relayerClient, token, decimals } = riel(network)
  const value = parseUnits(amount, decimals)
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600)
  const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`

  const signature = await firmante.signTypedData({
    domain: { ...NETWORKS[network].eip3009!, chainId: chain.id, verifyingContract: token },
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
  })
  const { v, r, s } = vrs(signature)

  return relayerClient.writeContract({
    address: token,
    abi: eip3009Abi,
    functionName: 'transferWithAuthorization',
    args: [firmante.address, to, value, 0n, validBefore, nonce, v, r, s],
  })
}

export async function tokenBalance(network: SettlementNetwork, address: `0x${string}`): Promise<string> {
  const { publicClient, token, decimals } = riel(network)
  const raw = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
  return fromBaseUnits(raw, decimals)
}

/** Lo que el contrato le debe hoy a una cuenta, en decimal. */
export async function claimableEnContrato(network: SettlementNetwork, account: `0x${string}`): Promise<string> {
  const { publicClient, token, decimals } = riel(network)
  const raw = await publicClient.readContract({
    address: settlementContract(network),
    abi: settlementAbi,
    functionName: 'claimable',
    args: [token, account],
  })
  return fromBaseUnits(raw, decimals)
}

/** Transfer desde la treasury (su propio saldo, no el de los comerciantes). */
export async function sendTreasuryPayout(
  network: SettlementNetwork,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const { relayerClient, token, decimals } = riel(network)
  return relayerClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, decimals)],
  })
}

export async function treasuryTokenBalance(network: SettlementNetwork): Promise<string> {
  return tokenBalance(network, relayer.address)
}

export async function txConfirmed(network: SettlementNetwork, hash: `0x${string}`): Promise<boolean | null> {
  try {
    const receipt = await riel(network).publicClient.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}
