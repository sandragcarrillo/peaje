import { NETWORKS, SETTLEMENT_NETWORKS } from '@peaje/shared'
import { evm, tempo } from 'mppx/server'
import { settleArcAuthorization } from './arc.js'
import { settleAuthorization } from './settlement.js'
import { usdcStatus } from './chainlink.js'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'

/**
 * Métodos de cobro del gateway, compartidos por las instancias HTTP y MCP.
 * Un solo challenge 402 lleva las dos ofertas: el agente elige en qué red
 * paga (Tempo con pathUSD o Arc con USDC); al negocio le da igual el rail.
 */
export function chargeMethods() {
  const arc = NETWORKS.arc

  const depegGuard = async (rail: string) => {
    const { depegged, price } = await usdcStatus()
    if (depegged) throw new Error(`Rail de ${rail} pausado: USDC despegado ($${price}). Paga por Tempo.`)
  }

  const tempoRail = tempo.charge({
    testnet: env.testnet,
    currency: env.currency,
    recipient: env.treasuryAddress,
  })

  const arcRail = evm.charge({
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
      await depegGuard('Arc')
      const settled = await settleArcAuthorization(payload)
      const contexto = contextoCobro.getStore()
      if (contexto) contexto.network = 'arc'
      return settled
    },
  })

  // Una oferta por red con PeajeSettlement configurado. El recipient es el
  // contrato, no la treasury: el split negocio/Peaje ocurre on-chain en `settle`.
  const settlementRails = SETTLEMENT_NETWORKS.flatMap((network) => {
    const contrato = env.settlementContracts[network]
    if (!contrato) return []
    const def = NETWORKS[network]
    return [
      evm.charge({
        currency: def.token,
        chainId: def.testnet.chainId,
        decimals: def.decimals,
        authorization: def.eip3009!,
        recipient: contrato,
        settle: async ({ payload }) => {
          if (def.tokenSymbol === 'USDC') await depegGuard(def.label)
          return settleAuthorization(network, payload)
        },
      }),
    ]
  })

  // El tipo de la tupla no cambia con los rieles de settlement: todos comparten
  // el método `evm` con Arc, que es lo que mppx usa para tipar `mppx.charge`.
  return [tempoRail, arcRail, ...settlementRails] as unknown as readonly [typeof tempoRail, typeof arcRail]
}
