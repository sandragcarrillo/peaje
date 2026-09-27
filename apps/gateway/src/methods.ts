import { GATEWAY_RAIL_IDS, GATEWAY_RAILS, NETWORKS, SETTLEMENT_NETWORKS } from '@peaje/shared'
import { evm, tempo } from 'mppx/server'
import { settleAuthorization } from './settlement.js'
import { conCostoRed } from './costoRed.js'
import { settleGateway } from './circle.js'
import { parseUnits } from 'viem'
import { usdcStatus } from './chainlink.js'
import { contextoCobro } from './contexto.js'
import { env } from './env.js'

/**
 * Métodos de cobro del gateway, compartidos por las instancias HTTP y MCP.
 * Un solo challenge 402 lleva una oferta por riel: el agente elige dónde
 * paga (Tempo con pathUSD, o USDC/USDG vía PeajeSettlement en Arbitrum,
 * Robinhood y Arc); al negocio le da igual el rail.
 */
export function chargeMethods() {
  const depegGuard = async (rail: string) => {
    const { depegged, price } = await usdcStatus()
    if (depegged) throw new Error(`Rail de ${rail} pausado: USDC despegado ($${price}). Paga por Tempo.`)
  }

  const tempoRail = tempo.charge({
    testnet: env.testnet,
    currency: env.currency,
    recipient: env.treasuryAddress,
  })

  // Una oferta por red con PeajeSettlement configurado. El recipient es el
  // contrato, no la treasury: el split negocio/Peaje ocurre on-chain en `settle`.
  const settlementRails = SETTLEMENT_NETWORKS.flatMap((network) => {
    const contrato = env.settlementContracts[network]
    if (!contrato) return []
    const def = NETWORKS[network]
    const rail = evm.charge({
      currency: def.token,
      chainId: def.testnet.chainId,
      decimals: def.decimals,
      authorization: def.eip3009!,
      recipient: contrato,
      settle: async ({ payload, request }) => {
        if (def.tokenSymbol === 'USDC') await depegGuard(def.label)
        // El agente firmó precio + costo de red. El contrato acredita al
        // negocio el precio menos el 2% y a Peaje el 2% más el costo de red.
        const contexto = contextoCobro.getStore()
        const precio = contexto?.priceUsd ? parseUnits(contexto.priceUsd, def.decimals) : BigInt(request.amount)
        const networkFee = BigInt(request.amount) > precio ? BigInt(request.amount) - precio : 0n
        return settleAuthorization(network, payload, networkFee)
      },
    })
    // El recargo es por riel (cada cadena cuesta distinto), así que este
    // método ajusta el monto de la oferta antes de que mppx la arme. El hook
    // `adjust` viene del parche a mppx (patches/mppx@0.8.19.patch).
    return [
      Object.assign(rail, {
        adjust: (opciones: { amount: string | number }) => ({ ...opciones, amount: conCostoRed(opciones.amount, network) }),
      }),
    ]
  })

  // Circle Nanopayments: una oferta x402 por cadena soportada. El agente firma
  // contra el Gateway Wallet de Circle (no contra el token), Circle liquida en
  // lote y el gas es de ellos: sin costo de red. Van al final para que un
  // cliente MPP nativo, que toma la primera oferta de su cadena, use el
  // contrato; el cliente de Circle busca la oferta por su dominio.
  const gatewayRails = GATEWAY_RAIL_IDS.map((rail) => {
    const def = GATEWAY_RAILS[rail]
    return evm.charge({
      currency: def.token,
      chainId: def.chainId,
      decimals: def.decimals,
      authorization: { name: 'GatewayWalletBatched', version: '1', verifyingContract: def.verifyingContract } as { name: string; version: string },
      recipient: env.treasuryAddress,
      // Circle exige autorizaciones válidas 7 días; el cliente firma con este valor.
      x402: { maxTimeoutSeconds: 604_900 },
      settle: async ({ request }) => {
        await depegGuard(def.label)
        return settleGateway(rail)({ request })
      },
    })
  })

  // Todos los rieles EVM comparten el método `evm`: la tupla que mppx usa para
  // tipar `mppx.charge` es Tempo más un EVM, sin importar cuántos haya.
  return [tempoRail, ...settlementRails, ...gatewayRails] as unknown as readonly [typeof tempoRail, (typeof settlementRails)[number]]
}
