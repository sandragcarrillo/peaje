import { NETWORKS } from '@peaje/shared'
import { evm, tempo } from 'mppx/server'
import { settleArcAuthorization } from './arc.js'
import { usdcStatus } from './chainlink.js'
import { env } from './env.js'

/**
 * Métodos de cobro del gateway, compartidos por las instancias HTTP y MCP.
 * Un solo challenge 402 lleva las dos ofertas: el agente elige en qué red
 * paga (Tempo con pathUSD o Arc con USDC); al negocio le da igual el rail.
 */
export function chargeMethods() {
  const arc = NETWORKS.arc
  return [
    tempo.charge({
      testnet: env.testnet,
      currency: env.currency,
      recipient: env.treasuryAddress,
    }),
    evm.charge({
      currency: arc.token,
      chainId: arc.testnet.chainId,
      decimals: arc.decimals,
      authorization: arc.eip3009!,
      recipient: env.treasuryAddress,
      // Sin facilitator externo: el gateway broadcastea la autorización
      // EIP-3009 él mismo (ver arc.ts) y la referencia es el hash de la tx.
      // El depeg guard corta acá también: cubre el MCP (que no tiene
      // selectOffers) y la ventana entre challenge emitido y pago.
      settle: async ({ payload }) => {
        const { depegged, price } = await usdcStatus()
        if (depegged) {
          throw new Error(`Rail de Arc pausado: USDC despegado ($${price}). Paga por Tempo.`)
        }
        return settleArcAuthorization(payload)
      },
    }),
  ] as const
}
