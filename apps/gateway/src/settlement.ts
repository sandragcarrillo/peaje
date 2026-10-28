import { fromBaseUnits, NETWORKS, type SettlementNetwork } from '@peaje/shared'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseSignature,
  parseUnits,
  type Chain,
  type LocalAccount,
  type PublicClient,
} from 'viem'
import { nonceManager, privateKeyToAccount } from 'viem/accounts'
import { settlementV3Abi } from './abi/settlement-v3.js'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'
import { AutorizacionUsada, eip3009Abi, LiquidacionPendiente, liquidarV3, OrigenFallo, pagadorDeLogs, PagoAdelantado, type AutorizacionFirmada, type RielV3 } from './liquidacion-v3.js'
import { store } from './store.js'

/**
 * Redes EVM con PeajeSettlementV3 (Arbitrum USDC y USDG, Robinhood, Arc). El
 * agente firma una autorización EIP-3009 a favor del contrato y el relayer la
 * somete con `settle`: en la misma transacción el 98% llega a la wallet de
 * cobro del negocio y el 2% más el costo de red al fee recipient del contrato.
 * Nada queda en Peaje y no hay retiros (docs/pagos-directos.md).
 *
 * Dos llaves distintas: el relayer (RELAYER_PRIVATE_KEY, solo gas nativo)
 * firma `settle`; la treasury firma lo que es de Peaje (relayar el barrido
 * de un agente, pagos de su propio saldo).
 */

const treasury = privateKeyToAccount(env.treasuryPrivateKey)
// Con nonceManager, dos pagos simultáneos no leen el mismo nonce pendiente (uno revertía "nonce too low").
const relayer = env.relayerPrivateKey ? privateKeyToAccount(env.relayerPrivateKey, { nonceManager }) : null

type Riel = {
  chain: Chain
  publicClient: PublicClient
  treasuryClient: ReturnType<typeof walletClient>
  relayerClient: ReturnType<typeof walletClient> | null
  token: `0x${string}`
  decimals: number
}

function walletClient(account: LocalAccount, chain: Chain, rpcUrl: string) {
  return createWalletClient({ account, chain, transport: http(rpcUrl) })
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
    nativeCurrency: network === 'arc' ? { name: 'USDC', symbol: 'USDC', decimals: 18 } : { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: def.label, url: def.testnet.explorerUrl } },
  })
  const nuevo: Riel = {
    chain,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    treasuryClient: walletClient(treasury, chain, rpcUrl),
    relayerClient: relayer ? walletClient(relayer, chain, rpcUrl) : null,
    token: def.token,
    decimals: def.decimals,
  }
  rieles.set(network, nuevo)
  return nuevo
}

/** PeajeSettlementV3 de la red, o null si el riel está apagado (sin dirección o sin relayer). */
export function contratoV3(network: SettlementNetwork): `0x${string}` | null {
  if (!relayer) return null
  return env.settlementV3[network]
}

/** Address del relayer (pública): para /health y logs. Nunca la llave. */
export const relayerAddress = relayer?.address ?? null

/**
 * El agente firmó la autorización EIP-3009 con `to` = el contrato. El
 * merchant sale del contexto del cobro (la wallet de cobro del negocio),
 * nunca del payload del agente. Ver liquidacion-v3.ts para el orden:
 * simulación, origen, envío.
 */
export async function settleAuthorization(
  network: SettlementNetwork,
  payload: AutorizacionFirmada,
  networkFee: bigint,
): Promise<{ reference: string }> {
  const contrato = contratoV3(network)
  const r = riel(network)
  if (!contrato || !r.relayerClient) throw new Error(`El riel de ${NETWORKS[network].label} está apagado: falta PeajeSettlementV3 o RELAYER_PRIVATE_KEY`)
  const contexto = contextoCobro.getStore()
  const rielV3: RielV3 = { publicClient: r.publicClient, relayer: r.relayerClient, contrato, token: r.token }

  try {
    const liquidado = await liquidarV3(
      rielV3,
      { merchant: contexto?.merchant, auth: payload, networkFee },
      {
        antesDeEnviar: contexto?.origen ?? undefined,
        // Un reintento después de un receipt lento: si el pago ya está en el ledger, ya se sirvió.
        yaRegistrado: async (hash) => (await store.findPaymentByReceiptRef(hash)) !== null,
        alAdelantado: async (info) => {
          const registro = await store.recordStray({
            network,
            contract: info.contrato,
            token: info.token,
            payer: info.payer,
            nonce: info.nonce,
            value: info.value.toString(),
            networkFee: info.networkFee.toString(),
            merchant: info.merchant,
            tenantId: contexto?.tenantId ?? null,
            path: contexto?.path ?? null,
          }).catch((error: unknown) => {
            // Sin la fila, el log de abajo es el registro: trae todo lo que pide settleStray.
            console.error('[settlement] no se pudo guardar el pago adelantado', error instanceof Error ? error.message : error)
            return null
          })
          console.warn('[settlement] PAGO ADELANTADO: fondos en PeajeSettlementV3, pendiente de settleStray por el Safe', {
            stray: registro?.stray.id ?? null,
            nuevo: registro?.nuevo ?? null,
            network,
            contrato: info.contrato,
            payer: info.payer,
            nonce: info.nonce,
            value: info.value.toString(),
            networkFee: info.networkFee.toString(),
            merchant: info.merchant,
            tenant: contexto?.tenantId ?? null,
          })
          // Se sirve solo si esta llamada creó la fila: la fila única por
          // (contrato, token, pagador, nonce) es lo que impide servir dos veces.
          return registro?.nuevo === true
        },
      },
    )
    if (contexto) {
      contexto.network = network
      contexto.networkFee = fromBaseUnits(networkFee, r.decimals)
      contexto.payoutAddress = liquidado.merchant
      contexto.reparto = { neto: fromBaseUnits(liquidado.net, r.decimals), fee: fromBaseUnits(liquidado.fee, r.decimals) }
    }
    return { reference: liquidado.hash }
  } catch (error) {
    if (contexto && error instanceof OrigenFallo) contexto.sinLiquidar = 'origen'
    else if (contexto && error instanceof PagoAdelantado) {
      contexto.sinLiquidar = 'adelantado'
      contexto.servirAdelantado = error.servir
      contexto.network = network
      contexto.payoutAddress = error.info.merchant
    } else if (contexto && error instanceof AutorizacionUsada) contexto.sinLiquidar = 'usada'
    else if (contexto && error instanceof LiquidacionPendiente) contexto.sinLiquidar = 'pendiente'
    else if (contexto && contexto.origenLlamado) contexto.sinLiquidar = 'envio'
    console.warn(`[settlement] ${NETWORKS[network].label}: no se liquidó`, error instanceof Error ? error.message : error)
    throw error
  }
}

/** El pagador real sale del evento PaymentSettled (v3 o v2): `tx.from` es el relayer. */
export async function resolveSettlementPayer(network: SettlementNetwork, txHash: string): Promise<string | null> {
  try {
    const receipt = await riel(network).publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` })
    return pagadorDeLogs(receipt.logs)
  } catch (error) {
    console.warn(`[${network}] no se pudo resolver el pagador de`, txHash, error)
    return null
  }
}

/** Fee recipient del contrato (lo fija el Safe, no el env). null si no se puede leer. */
export async function feeRecipientV3(network: SettlementNetwork): Promise<`0x${string}` | null> {
  const contrato = contratoV3(network)
  if (!contrato) return null
  try {
    return await riel(network).publicClient.readContract({ address: contrato, abi: settlementV3Abi, functionName: 'feeRecipient' })
  } catch {
    return null
  }
}

function vrs(signature: `0x${string}`) {
  const { r, s, v, yParity } = parseSignature(signature)
  return { v: v !== undefined ? Number(v) : yParity + 27, r, s }
}

/**
 * Transfer del stablecoin firmado por una wallet sin ETH (un agente que
 * devuelve su saldo): firma EIP-3009 y la treasury paga el gas.
 */
export async function relayTokenTransfer(
  network: SettlementNetwork,
  firmante: LocalAccount,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const { chain, treasuryClient, token, decimals } = riel(network)
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

  return treasuryClient.writeContract({
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

/** Transfer desde la treasury (su propio saldo, nunca el de un negocio). */
export async function sendTreasuryPayout(
  network: SettlementNetwork,
  to: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const { treasuryClient, token, decimals } = riel(network)
  return treasuryClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, decimals)],
  })
}

export async function treasuryTokenBalance(network: SettlementNetwork): Promise<string> {
  return tokenBalance(network, treasury.address)
}

export async function txConfirmed(network: SettlementNetwork, hash: `0x${string}`): Promise<boolean | null> {
  try {
    const receipt = await riel(network).publicClient.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}
