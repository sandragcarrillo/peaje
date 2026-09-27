import { AsyncLocalStorage } from 'node:async_hooks'
import type { NetworkId } from '@peaje/shared'

/**
 * Datos del cobro en curso que el callback de settlement de mppx no recibe:
 * a qué comerciante acreditar on-chain y, de vuelta, en qué red se liquidó
 * (el Receipt de mppx solo dice `evm`, y hay más de una red EVM).
 */
export type ContextoCobro = {
  merchant: `0x${string}` | null
  network: NetworkId | null
  /** Precio listado por el negocio, en USD decimal. El 402 puede pedir más (costo de red). */
  priceUsd: string | null
  /** Costo de red que pagó el agente encima del precio, en USD decimal. Lo anota el settlement. */
  networkFee: string | null
}

export const contextoCobro = new AsyncLocalStorage<ContextoCobro>()

export function nuevoContexto(merchant: string | null, priceUsd?: string | number | null): ContextoCobro {
  return {
    merchant: (merchant as `0x${string}` | null) ?? null,
    network: null,
    priceUsd: priceUsd == null ? null : String(priceUsd),
    networkFee: null,
  }
}
