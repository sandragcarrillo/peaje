import type { Tenant } from '@peaje/db'
import { creditReceipt, refundOriginFailure } from './charge.js'
import { origenCaido, respuestaNoLiquidada, respuestaSinDireccion, tieneDireccionDeCobro } from './cobro.js'
import { contextoCobro, nuevoContexto, prepararOrigen } from './contexto.js'
import { cortado, registrarFalloOrigen, respuestaCortado } from './cortacircuito.js'
import { mppx } from './mpp.js'

/**
 * Cobro HTTP de una ruta o link con precio: 402 con una oferta por riel, y
 * con credencial, el pago y el origen en este orden:
 *
 * - Rieles de contrato (PeajeSettlementV3): mppx verifica la credencial, el
 *   settlement simula `settle`, se llama al origen y la tx se envía solo si
 *   el origen respondió sin 5xx. Si falla, el agente no paga (la autorización
 *   vence sin usarse) y recibe la respuesta del origen marcada `not-charged`.
 * - Tempo: el pago ocurre al verificar la credencial y el origen se llama
 *   después. Si falla, la treasury le devuelve al agente lo que pagó, con
 *   topes (reembolsos.ts).
 * - Pago adelantado (front-run) con la plata probadamente en el contrato: se
 *   sirve una sola vez, marcado `pending-split` (cobro.ts).
 *
 * Sin dirección de cobro no hay ofertas: 503 con el aviso para el dueño. Con
 * el origen caído N veces en M minutos tampoco (cortacircuito.ts).
 */
export async function cobrarYServir(o: {
  tenant: Tenant
  /** Request con la URL externa (la que nombra el 402). */
  cobrable: Request
  priceUsd: string
  description: string
  routeId: string | null
  path: string
  /** Llama al origen (o a la URL del link). Puede lanzar. */
  pedirOrigen: () => Promise<Response>
  /** Mensaje si el origen no responde. */
  mensajeCaido: string
}): Promise<Response> {
  const { tenant } = o
  if (!tieneDireccionDeCobro(tenant)) return respuestaSinDireccion(tenant)
  // Origen caído varias veces seguidas: sin 402 hasta que pase el enfriamiento.
  const hasta = cortado(tenant.id)
  if (hasta) return respuestaCortado(tenant, hasta)

  const cobro = nuevoContexto(tenant.payoutWallet, o.priceUsd, { tenantId: tenant.id, path: o.path })
  cobro.x402Header = o.cobrable.headers.get('payment-signature')
  const origen = prepararOrigen(cobro, async () => {
    try {
      const upstream = await o.pedirOrigen()
      if (upstream.status >= 500) registrarFalloOrigen(tenant)
      return { valor: upstream, fallo: upstream.status >= 500 }
    } catch (err) {
      console.error('[cobro] el origen no respondió', { tenant: tenant.slug, path: o.path, err })
      registrarFalloOrigen(tenant)
      return { valor: origenCaido(o.mensajeCaido), fallo: true }
    }
  })

  const result = await contextoCobro.run(cobro, () => mppx.charge({ amount: o.priceUsd, description: o.description })(o.cobrable))
  if (result.status === 402) return (await respuestaNoLiquidada(cobro, origen)) ?? result.challenge

  const { valor: upstream, fallo } = await origen()
  const sealed = result.withReceipt(upstream)

  const payment = await creditReceipt(sealed, {
    tenantId: tenant.id,
    routeId: o.routeId,
    path: o.path,
    priceUsd: o.priceUsd,
    network: cobro.network,
    networkFee: cobro.networkFee,
    tempoSplit: cobro.tempoSplit, // ---- Tempo splits ----
    reparto: cobro.reparto,
    payoutAddress: cobro.payoutAddress,
    payer: cobro.payer,
  })

  // Un fallo del origen con el pago ya cobrado solo pasa en Tempo: reembolso con topes.
  if (fallo && payment) {
    const refund = await refundOriginFailure(payment)
    if (refund) {
      try {
        sealed.headers.set('Payment-Refund', refund)
      } catch {
        // headers inmutables: el refund igual quedó registrado y on-chain
      }
    }
  }
  return sealed
}
