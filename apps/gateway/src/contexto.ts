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
}

export const contextoCobro = new AsyncLocalStorage<ContextoCobro>()

export function nuevoContexto(merchant: string | null): ContextoCobro {
  return { merchant: (merchant as `0x${string}` | null) ?? null, network: null }
}
