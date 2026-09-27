import { GATEWAY_RAILS, fromBaseUnits, type GatewayRailId } from '@peaje/shared'
import { GatewayClient } from '@circle-fin/x402-batching/client'
import { createPublicClient, http } from 'viem'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'

/**
 * Rieles de Circle Nanopayments (Gateway). El agente deposita USDC una vez
 * en el contrato Gateway de Circle y después cada pago es una firma EIP-3009
 * contra ese contrato, sin gas: Circle la verifica al instante, descuenta el
 * saldo del comprador y liquida on-chain en lote. El pago se acredita al
 * saldo Gateway de la treasury, así que el reparto por negocio va por el
 * ledger (como Tempo) y los retiros salen de ese saldo (ver `retirarGateway`).
 *
 * Medido en Arbitrum Sepolia: 250 ms por pago, cero transacciones del
 * comprador. El depósito inicial tardó 10 minutos en acreditarse.
 */

type PaymentPayload = {
  x402Version: number
  resource?: { url: string; description?: string; mimeType?: string }
  accepted?: { payTo?: string; amount?: string; network?: string; asset?: string }
  payload?: { authorization?: { from?: string }; signature?: string }
}

function facilitador(rail: GatewayRailId): string {
  return process.env.CIRCLE_FACILITATOR_URL ?? GATEWAY_RAILS[rail].facilitatorUrl
}

async function circle(rail: GatewayRailId, ruta: 'verify' | 'settle', body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${facilitador(rail)}/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(`Circle ${ruta} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  return json
}

/**
 * Liquida un pago Gateway. mppx ya verificó la firma contra el contrato de
 * Circle y que `accepted` coincide con nuestra oferta; acá mandamos el
 * payload x402 tal cual llegó (Circle exige `resource` y `accepted`) y Circle
 * decide con el saldo del comprador.
 */
export function settleGateway(rail: GatewayRailId) {
  return async ({ request }: { request: { amount: string; recipient: string } }): Promise<{ reference: string }> => {
    const contexto = contextoCobro.getStore()
    const header = contexto?.x402Header
    if (!header) throw new Error(`${GATEWAY_RAILS[rail].label} solo acepta clientes x402 (Payment-Signature)`)

    let paymentPayload: PaymentPayload
    try {
      paymentPayload = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as PaymentPayload
    } catch {
      throw new Error('Payment-Signature no es JSON base64')
    }
    // Circle exige `resource` completo (url, description, mimeType) aunque la
    // firma no lo cubra; mppx solo publica la url y el cliente la devuelve así.
    paymentPayload.resource = {
      url: paymentPayload.resource?.url ?? request.recipient,
      description: (paymentPayload.resource as { description?: string } | undefined)?.description ?? 'Peaje paid request',
      mimeType: (paymentPayload.resource as { mimeType?: string } | undefined)?.mimeType ?? 'application/json',
    } as PaymentPayload['resource']
    const acc = paymentPayload.accepted
    if (!acc || (acc.payTo ?? '').toLowerCase() !== env.treasuryAddress.toLowerCase() || acc.amount !== request.amount) {
      throw new Error('el payload x402 no coincide con la oferta Gateway')
    }

    const verified = await circle(rail, 'verify', { paymentPayload, paymentRequirements: acc })
    if (verified.isValid !== true) throw new Error(`Circle rechazó la firma: ${verified.invalidReason ?? 'invalid'}`)
    const settled = await circle(rail, 'settle', { paymentPayload, paymentRequirements: acc })
    if (settled.success !== true) throw new Error(`Circle no liquidó: ${settled.errorReason ?? 'unknown'}`)

    if (contexto) {
      contexto.network = rail
      contexto.payer = paymentPayload.payload?.authorization?.from ?? null
      contexto.networkFee = '0'
    }
    // La referencia es el id de transferencia de Circle, no un hash: la
    // liquidación on-chain llega después, en lote.
    return { reference: String(settled.transaction) }
  }
}

const clientes = new Map<GatewayRailId, GatewayClient>()

/** Cliente Gateway de la treasury para saldos y retiros. */
function cliente(rail: GatewayRailId): GatewayClient {
  let c = clientes.get(rail)
  if (!c) {
    c = new GatewayClient({ chain: GATEWAY_RAILS[rail].sdkChain as never, privateKey: env.treasuryPrivateKey })
    clientes.set(rail, c)
  }
  return c
}

/** Saldo Gateway disponible de la treasury en ese riel, en decimal. */
export async function saldoGatewayTreasury(rail: GatewayRailId): Promise<string> {
  const b = await cliente(rail).getBalances()
  return fromBaseUnits(BigInt(b.gateway.available), 6)
}

/**
 * Retiro del saldo Gateway hacia `to`, en la misma cadena del riel. Circle
 * firma la atestación y la treasury envía el `gatewayMint` (una tx con gas).
 */
export async function retirarGateway(rail: GatewayRailId, to: `0x${string}`, amount: string): Promise<`0x${string}`> {
  const r = (await cliente(rail).withdraw(amount, { recipient: to })) as { transactionHash?: string; txHash?: string } | string
  const hash = typeof r === 'string' ? r : (r.transactionHash ?? r.txHash)
  if (!hash) throw new Error('Circle no devolvió el hash del retiro')
  return hash as `0x${string}`
}

const publicos = new Map<GatewayRailId, ReturnType<typeof createPublicClient>>()

export async function retiroGatewayConfirmado(rail: GatewayRailId, hash: `0x${string}`): Promise<boolean | null> {
  let p = publicos.get(rail)
  if (!p) {
    p = createPublicClient({ transport: http(GATEWAY_RAILS[rail].rpcUrl) })
    publicos.set(rail, p)
  }
  try {
    const receipt = await p.getTransactionReceipt({ hash })
    return receipt.status === 'success'
  } catch {
    return null
  }
}
