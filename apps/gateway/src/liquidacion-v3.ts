import {
  BaseError,
  ContractFunctionRevertedError,
  erc20Abi,
  parseAbi,
  parseEventLogs,
  parseSignature,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'
import { Errors } from 'mppx'
import { settlementV3Abi } from './abi/settlement-v3.js'

/**
 * Liquidación en PeajeSettlementV3, sin estado ni variables de entorno (así
 * se prueba contra un anvil). En la misma transacción el neto llega a la
 * wallet de cobro del negocio y el 2% más el costo de red al fee recipient
 * del contrato: Peaje no guarda nada y no hay retiros.
 *
 * Orden (la regla de reembolsos: se liquida solo si el origen respondió):
 *   1. Lee `authorizationState` y el saldo del pagador. Autorización usada con
 *      los fondos probadamente en el contrato (saldo que la cubre y ningún
 *      PaymentSettled de ese nonce) = pago adelantado (front-run): se registra
 *      para el Safe y el pedido se sirve una sola vez. Sin esa prueba no se sirve.
 *   2. Simula `settle` (eth_call desde el relayer): firma, saldo, tope de
 *      costo de red, merchant válido y pausa se chequean sin gastar nada.
 *   3. Pide al origen (`antesDeEnviar`). Si falla o responde 5xx, no se envía:
 *      la autorización vence sin usarse y el agente conserva su plata.
 *   4. Envía la tx y espera el receipt.
 */

export const eip3009Abi = parseAbi([
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
])

/** Evento de v2 (contratos viejos): solo para leer pagos anteriores al cambio. */
export const settlementV2EventAbi = parseAbi([
  'event PaymentSettled(bytes32 indexed nonce, address indexed token, address indexed merchant, address payer, uint256 amount, uint256 fee, uint256 networkFee)',
])

export type AutorizacionFirmada = {
  from: string
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: string
  signature: string
}

export type RielV3 = {
  publicClient: PublicClient
  relayer: WalletClient<Transport, Chain, Account>
  contrato: `0x${string}`
  token: `0x${string}`
}

export type PagoAdelantadoInfo = {
  contrato: `0x${string}`
  token: `0x${string}`
  payer: `0x${string}`
  nonce: `0x${string}`
  value: bigint
  networkFee: bigint
  merchant: `0x${string}`
}

export type HooksLiquidacion = {
  /** Corre entre la simulación y el envío. false = no enviar (el origen falló). */
  antesDeEnviar?: () => Promise<boolean>
  /**
   * Autorización usada por otro, con los fondos probadamente quietos en el
   * contrato. Devuelve true si este pedido se puede servir (la primera vez
   * que se registra ese pago adelantado; nunca dos veces).
   */
  alAdelantado?: (info: PagoAdelantadoInfo) => Promise<boolean>
}

export type Liquidado = { hash: `0x${string}`; net: bigint; fee: bigint; networkFee: bigint; merchant: `0x${string}` }

// Son errores de pago de mppx: mppx los devuelve como problema del 402 sin
// tratarlos como fallas internas. El texto lo puede leer el agente.

/** El origen falló o respondió 5xx: la tx no se envió y el agente no pagó. */
export class OrigenFallo extends Errors.VerificationFailedError {
  constructor() {
    super({ reason: 'the business origin failed, the payment was not settled' })
  }
}

/**
 * La autorización ya se usó fuera de Peaje y los fondos están en el contrato.
 * `servir`: es la primera vez que se registra, el pedido se sirve una vez.
 */
export class PagoAdelantado extends Errors.VerificationFailedError {
  constructor(
    readonly info: PagoAdelantadoInfo,
    readonly servir: boolean,
  ) {
    super({ reason: `authorization ${info.nonce} was submitted outside Peaje; the funds are held for the business` })
  }
}

/** El settle no pasa la simulación (o revirtió): nada se movió. */
export class LiquidacionRechazada extends Errors.VerificationFailedError {
  constructor(readonly motivo: string) {
    super({ reason: `settlement rejected (${motivo})` })
  }
}

/**
 * La autorización ya se usó y no se puede probar que la plata esté quieta en
 * el contrato (ya tiene un PaymentSettled, el contrato no la cubre o no se
 * pudieron leer los eventos). No se sirve.
 */
export class AutorizacionUsada extends LiquidacionRechazada {
  constructor() {
    super('authorization already used')
  }
}

const DIRECCION = /^0x[0-9a-fA-F]{40}$/

function vrs(signature: `0x${string}`) {
  const { r, s, v, yParity } = parseSignature(signature)
  return { v: v !== undefined ? Number(v) : yParity + 27, r, s }
}

/** Nombre del error del contrato (o del token) para logs y para clasificar. */
export function motivoRevert(error: unknown): string {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      return revert.data?.errorName ?? revert.reason ?? revert.shortMessage
    }
    return error.shortMessage
  }
  return error instanceof Error ? error.message : String(error)
}

/** Ventana en la que se buscan PaymentSettled de un nonce: la credencial vence en minutos. */
const VENTANA_EVENTOS_S = 2 * 60 * 60
/** Muchos RPC limitan getLogs a 10.000 bloques por llamada. */
const TRAMO_BLOQUES = 10_000n

/**
 * ¿Ya hay un PaymentSettled para este nonce en el contrato? Busca en las
 * últimas dos horas (por tramos). null si no se pudo leer: no prueba nada.
 */
export async function liquidadoAntes(riel: RielV3, nonce: `0x${string}`): Promise<boolean | null> {
  try {
    const ultimo = await riel.publicClient.getBlock()
    const muestra = ultimo.number > 1000n ? ultimo.number - 1000n : 0n
    const previo = muestra === ultimo.number ? ultimo : await riel.publicClient.getBlock({ blockNumber: muestra })
    const segundos = Number(ultimo.timestamp - previo.timestamp)
    const bloques = ultimo.number - previo.number
    // Bloques que entran en la ventana; con timestamps iguales (anvil) se busca todo.
    const atras = segundos > 0 ? (BigInt(VENTANA_EVENTOS_S) * bloques) / BigInt(segundos) + 1n : ultimo.number
    const desde = ultimo.number > atras ? ultimo.number - atras : 0n
    const evento = settlementV3Abi.find((x) => x.type === 'event' && x.name === 'PaymentSettled')!
    for (let hasta = ultimo.number; hasta >= desde; hasta -= TRAMO_BLOQUES) {
      const inicio = hasta - TRAMO_BLOQUES + 1n > desde ? hasta - TRAMO_BLOQUES + 1n : desde
      const logs = await riel.publicClient.getLogs({
        address: riel.contrato,
        event: evento as Extract<(typeof settlementV3Abi)[number], { type: 'event'; name: 'PaymentSettled' }>,
        args: { nonce },
        fromBlock: inicio,
        toBlock: hasta,
      })
      if (logs.length > 0) return true
      if (inicio === 0n) break
    }
    return false
  } catch {
    return null
  }
}

/**
 * Estado de una autorización que no se pudo liquidar: sin usar, usada con la
 * plata probadamente quieta en el contrato (adelanto), o usada sin prueba.
 */
async function adelantado(riel: RielV3, info: PagoAdelantadoInfo): Promise<'sin-usar' | 'probado' | 'sin-prueba'> {
  const [usada, enContrato] = await Promise.all([
    riel.publicClient.readContract({ address: riel.token, abi: eip3009Abi, functionName: 'authorizationState', args: [info.payer, info.nonce] }),
    riel.publicClient.readContract({ address: riel.token, abi: erc20Abi, functionName: 'balanceOf', args: [riel.contrato] }),
  ])
  if (!usada) return 'sin-usar'
  if (enContrato < info.value) return 'sin-prueba'
  return (await liquidadoAntes(riel, info.nonce)) === false ? 'probado' : 'sin-prueba'
}

/** Si la autorización se usó fuera de Peaje, lanza el error que corresponde. */
async function siUsada(riel: RielV3, info: PagoAdelantadoInfo, hooks: HooksLiquidacion): Promise<void> {
  const estado = await adelantado(riel, info).catch(() => 'sin-prueba' as const)
  if (estado === 'sin-usar') return
  if (estado === 'sin-prueba') throw new AutorizacionUsada()
  const servir = (await hooks.alAdelantado?.(info)) ?? false
  throw new PagoAdelantado(info, servir)
}

export async function liquidarV3(
  riel: RielV3,
  entrada: { merchant: string | null | undefined; auth: AutorizacionFirmada; networkFee: bigint },
  hooks: HooksLiquidacion = {},
): Promise<Liquidado> {
  const { merchant: merchantCrudo, auth, networkFee } = entrada
  // Sin wallet de cobro no hay a quién pagarle. Nunca se cae al relayer: con
  // v3 eso le mandaría el 98% a la llave caliente.
  if (!merchantCrudo || !DIRECCION.test(merchantCrudo)) throw new LiquidacionRechazada('the business has no payout address')
  const merchant = merchantCrudo as `0x${string}`

  const signature = auth.signature as `0x${string}`
  if ((signature.length - 2) / 2 !== 65) throw new LiquidacionRechazada('only 65-byte EOA signatures')

  const payer = auth.from as `0x${string}`
  const nonce = auth.nonce as `0x${string}`
  const value = BigInt(auth.value)
  const info: PagoAdelantadoInfo = { contrato: riel.contrato, token: riel.token, payer, nonce, value, networkFee, merchant }

  const args = [
    riel.token,
    merchant,
    {
      from: payer,
      value,
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce,
      ...vrs(signature),
    },
    networkFee,
  ] as const

  // 1. Estado de la autorización y saldo del pagador.
  const [usada, saldo] = await Promise.all([
    riel.publicClient.readContract({ address: riel.token, abi: eip3009Abi, functionName: 'authorizationState', args: [payer, nonce] }),
    riel.publicClient.readContract({ address: riel.token, abi: erc20Abi, functionName: 'balanceOf', args: [payer] }),
  ])
  if (usada) {
    await siUsada(riel, info, hooks)
    throw new AutorizacionUsada()
  }
  if (saldo < value) throw new LiquidacionRechazada('payer balance too low')

  // 2. Simulación del settle tal cual se va a enviar.
  let request
  try {
    ;({ request } = await riel.publicClient.simulateContract({
      account: riel.relayer.account,
      address: riel.contrato,
      abi: settlementV3Abi,
      functionName: 'settle',
      args,
    }))
  } catch (error) {
    throw new LiquidacionRechazada(motivoRevert(error))
  }

  // 3. El origen, antes de mover la plata.
  if (hooks.antesDeEnviar && !(await hooks.antesDeEnviar())) throw new OrigenFallo()

  // 4. Envío. Si entre la simulación y acá alguien adelantó la autorización,
  //    el envío falla y los fondos quedan en el contrato: se registra igual.
  let hash: `0x${string}`
  try {
    hash = await riel.relayer.writeContract(request)
  } catch (error) {
    await siUsada(riel, info, hooks)
    throw new LiquidacionRechazada(motivoRevert(error))
  }

  const receipt = await riel.publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })
  if (receipt.status !== 'success') {
    await siUsada(riel, info, hooks)
    throw new LiquidacionRechazada(`transaction reverted ${hash}`)
  }

  const [evento] = parseEventLogs({ abi: settlementV3Abi, eventName: 'PaymentSettled', logs: receipt.logs })
  const net = evento?.args.net ?? 0n
  const fee = evento?.args.fee ?? 0n
  return { hash, net, fee, networkFee, merchant }
}

/**
 * El pagador real de un pago liquidado en contrato (`tx.from` es el relayer).
 * Lee el evento de v3 y, para pagos viejos, el de v2.
 */
export function pagadorDeLogs(logs: Parameters<typeof parseEventLogs>[0]['logs']): `0x${string}` | null {
  const v3 = parseEventLogs({ abi: settlementV3Abi, eventName: 'PaymentSettled', logs })
  if (v3[0]) return v3[0].args.payer
  const v2 = parseEventLogs({ abi: settlementV2EventAbi, eventName: 'PaymentSettled', logs })
  return v2[0]?.args.payer ?? null
}
