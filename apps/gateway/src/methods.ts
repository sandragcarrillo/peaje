import { NETWORKS } from '@peaje/shared'
import { evm, tempo } from 'mppx/server'
import { settleArcAuthorization } from './arc.js'
import { settleArbitrumAuthorization } from './arbitrum.js'
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
  const arbitrum = NETWORKS.arbitrum
  const settlement = env.arbitrumSettlement

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

  // Sin contrato desplegado el riel no se ofrece. El tipo de la tupla es el
  // mismo con o sin Arbitrum: ambos rieles EVM comparten método.
  if (!settlement) return [tempoRail, arcRail] as const

  const arbitrumRail = evm.charge({
    currency: arbitrum.token,
    chainId: arbitrum.testnet.chainId,
    decimals: arbitrum.decimals,
    authorization: arbitrum.eip3009!,
    // El recipient es el contrato, no la treasury: el split negocio/Peaje
    // ocurre on-chain dentro de PeajeSettlement.settle.
    recipient: settlement,
    settle: async ({ payload }) => {
      await depegGuard('Arbitrum')
      return settleArbitrumAuthorization(payload)
    },
  })

  return [tempoRail, arcRail, arbitrumRail] as unknown as readonly [typeof tempoRail, typeof arcRail]
}
