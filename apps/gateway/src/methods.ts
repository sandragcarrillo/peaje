import { GATEWAY_RAIL_IDS, GATEWAY_RAILS, NETWORKS, SETTLEMENT_NETWORKS, splitPrecio, TOKEN_DECIMALS } from '@peaje/shared'
import { evm, tempo } from 'mppx/server'
import { contratoV3, settleAuthorization } from './settlement.js'
import { conCostoRed } from './costoRed.js'
import { settleGateway } from './circle.js'
import { formatUnits, parseUnits } from 'viem'
import { usdcStatus } from './chainlink.js'
import { contextoCobro, esDireccion, type ContextoCobro } from './contexto.js'
import { env } from './env.js'

/**
 * A quién le paga este cobro. Un negocio sin dirección de cobro no tiene
 * ninguna oferta: el 98% no tiene a dónde ir y Peaje ya no lo guarda.
 * La treasury no sirve de wallet de cobro (sería volver a la custodia).
 */
export function merchantDelCobro(contexto: Pick<ContextoCobro, 'merchant'> | undefined): `0x${string}` | null {
  const merchant = contexto?.merchant
  if (!esDireccion(merchant)) return null
  if (merchant.toLowerCase() === env.treasuryAddress.toLowerCase()) return null
  return merchant
}

/**
 * Métodos de cobro del gateway, compartidos por las instancias HTTP y MCP.
 * Un solo challenge 402 lleva una oferta por riel: el agente elige dónde
 * paga (Tempo con pathUSD, o USDC/USDG vía PeajeSettlementV3 en Arbitrum,
 * Robinhood y Arc). En todos el neto llega directo a la wallet del negocio.
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

  // ---- Tempo splits ----
  // La oferta de Tempo usa el split nativo de mppx: una sola transacción del
  // agente con dos transfers, el neto a la wallet del negocio y el 2% a la
  // treasury. mppx verifica que la transacción traiga exactamente esos
  // transfers (y el reparto va en la parte del challenge que no puede cambiar
  // entre el 402 y el pago). Sin wallet de cobro no hay oferta de Tempo: ya
  // no hay cobro custodial. Solo los cobros de Peaje (planes) van enteros a
  // la treasury. El gas lo paga el agente en su propia transacción.
  Object.assign(tempoRail, {
    canOffer: async () => {
      const contexto = contextoCobro.getStore()
      return !!contexto && (contexto.propio || merchantDelCobro(contexto) !== null)
    },
    adjust: (opciones: { amount: string | number }) => {
      const contexto = contextoCobro.getStore()
      if (!contexto || contexto.propio) return opciones
      const merchant = merchantDelCobro(contexto)
      // Sin merchant la oferta no se muestra (canOffer); si llegara una
      // credencial igual, su challenge no coincide con este y mppx la rechaza.
      if (!merchant) return opciones
      const { netMicro, feeMicro } = splitPrecio(
        parseUnits(String(opciones.amount), TOKEN_DECIMALS),
        BigInt(Math.round(env.feePct * 10_000)),
      )
      contexto.tempoSplit = { neto: formatUnits(netMicro, TOKEN_DECIMALS), fee: formatUnits(feeMicro, TOKEN_DECIMALS) }
      contexto.payoutAddress = merchant
      return {
        ...opciones,
        recipient: merchant,
        ...(feeMicro > 0n
          ? { splits: [{ recipient: env.treasuryAddress, amount: formatUnits(feeMicro, TOKEN_DECIMALS) }] }
          : {}),
      }
    },
  })

  // Una oferta por red con PeajeSettlementV3 y relayer configurados. El
  // recipient es el contrato: el reparto negocio/Peaje ocurre on-chain en
  // `settle`, en la misma transacción. Los cobros de Peaje (planes) no usan
  // estos rieles: el contrato no acepta al fee recipient como merchant.
  const settlementRails = SETTLEMENT_NETWORKS.flatMap((network) => {
    const contrato = contratoV3(network)
    if (!contrato) return []
    const def = NETWORKS[network]
    const rail = evm.charge({
      currency: def.token,
      chainId: def.testnet.chainId,
      decimals: def.decimals,
      authorization: def.eip3009!,
      recipient: contrato,
      canOffer: async () => {
        const contexto = contextoCobro.getStore()
        return !!contexto && !contexto.propio && merchantDelCobro(contexto) !== null
      },
      settle: async ({ payload, request }) => {
        if (def.tokenSymbol === 'USDC') await depegGuard(def.label)
        // El agente firmó precio + costo de red. El contrato le manda al
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

  // Circle Nanopayments: apagado por defecto (CIRCLE_NANOPAYMENTS_ENABLED).
  // Junta los pagos en el saldo Gateway de la treasury y el negocio tendría
  // que retirar: no encaja con el pago directo. El código queda para cuando
  // Circle permita liquidar a la wallet de cada negocio.
  const gatewayRails = env.circleNanopayments
    ? GATEWAY_RAIL_IDS.map((rail) => {
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
    : []

  // Todos los rieles EVM comparten el método `evm`: la tupla que mppx usa para
  // tipar `mppx.charge` es Tempo más un EVM, sin importar cuántos haya.
  return [tempoRail, ...settlementRails, ...gatewayRails] as unknown as readonly [typeof tempoRail, (typeof settlementRails)[number]]
}
