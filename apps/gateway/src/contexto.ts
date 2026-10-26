import { AsyncLocalStorage } from 'node:async_hooks'
import type { NetworkId } from '@peaje/shared'

/**
 * Datos del cobro en curso que el callback de settlement de mppx no recibe:
 * a qué comerciante pagarle on-chain y, de vuelta, en qué red se liquidó
 * (el Receipt de mppx solo dice `evm`, y hay más de una red EVM).
 */
export type ContextoCobro = {
  /** Wallet de cobro del negocio. null = sin dirección de cobro: no hay oferta. */
  merchant: `0x${string}` | null
  /** Cobro de Peaje (planes): la oferta de Tempo va a la treasury y no hay rieles de contrato. */
  propio: boolean
  tenantId: string | null
  path: string | null
  /** Red o riel donde se liquidó (NetworkId o GatewayRailId). */
  network: NetworkId | string | null
  /** Header x402 crudo (Payment-Signature), si el cliente pagó por x402. Lo necesita Circle. */
  x402Header: string | null
  /** Wallet del agente cuando el settlement ya la conoce (sin ir a la cadena). */
  payer: string | null
  /** Precio listado por el negocio, en USD decimal. El 402 puede pedir más (costo de red). */
  priceUsd: string | null
  /** Costo de red que pagó el agente encima del precio, en USD decimal. Lo anota el settlement. */
  networkFee: string | null
  /** Dirección a la que llegó el neto en la tx del pago. La anota el settlement. */
  payoutAddress: string | null
  /** Reparto que hizo PeajeSettlementV3 según su evento, en USD decimal. */
  reparto: { neto: string; fee: string } | null
  // ---- Tempo splits ----
  /**
   * Reparto que llevó la oferta de Tempo de este cobro (split nativo): neto a
   * la wallet del negocio, fee a Peaje, en USD decimal. null = cobro propio de Peaje.
   * mppx exige que la credencial pague exactamente estos transfers.
   */
  tempoSplit: { neto: string; fee: string } | null
  // ---- liquidar después del origen ----
  /**
   * Pedido al origen del negocio. En los rieles de contrato lo corre el
   * settlement entre la simulación y el envío; true = respondió sin 5xx.
   * Lo arma `prepararOrigen`.
   */
  origen: (() => Promise<boolean>) | null
  /** El settlement ya llamó al origen en este cobro. */
  origenLlamado: boolean
  /**
   * Por qué no se liquidó, cuando no fue la credencial: el origen falló
   * ('origen'), la autorización se usó fuera de Peaje con la plata en el
   * contrato ('adelantado'), se usó sin esa prueba ('usada') o el envío falló
   * después de que el origen respondió ('envio').
   */
  sinLiquidar: 'origen' | 'adelantado' | 'usada' | 'envio' | null
  /** Pago adelantado registrado por primera vez: el pedido se sirve una vez (ver cobro.ts). */
  servirAdelantado: boolean
}

export const contextoCobro = new AsyncLocalStorage<ContextoCobro>()

export function nuevoContexto(
  merchant: string | null,
  priceUsd?: string | number | null,
  opciones: { tenantId?: string | null; path?: string | null; propio?: boolean } = {},
): ContextoCobro {
  return {
    merchant: (merchant as `0x${string}` | null) ?? null,
    propio: opciones.propio ?? false,
    tenantId: opciones.tenantId ?? null,
    path: opciones.path ?? null,
    network: null,
    x402Header: null,
    payer: null,
    priceUsd: priceUsd == null ? null : String(priceUsd),
    networkFee: null,
    payoutAddress: null,
    reparto: null,
    tempoSplit: null,
    origen: null,
    origenLlamado: false,
    sinLiquidar: null,
    servirAdelantado: false,
  }
}

export type ResultadoOrigen<T> = { valor: T; fallo: boolean }

/**
 * Deja el pedido al origen listo para que lo corra quien llegue primero: el
 * settlement de un riel de contrato (antes de enviar la tx) o la ruta después
 * de cobrar (Tempo). Se corre una sola vez y las dos partes ven el mismo
 * resultado.
 */
export function prepararOrigen<T>(
  contexto: ContextoCobro,
  llamar: () => Promise<ResultadoOrigen<T>>,
): () => Promise<ResultadoOrigen<T>> {
  let pendiente: Promise<ResultadoOrigen<T>> | null = null
  const unaVez = () => (pendiente ??= llamar())
  contexto.origen = async () => {
    contexto.origenLlamado = true
    return !(await unaVez()).fallo
  }
  return unaVez
}

/** Dirección EVM bien formada. */
export function esDireccion(valor: string | null | undefined): valor is `0x${string}` {
  return !!valor && /^0x[0-9a-fA-F]{40}$/.test(valor)
}
