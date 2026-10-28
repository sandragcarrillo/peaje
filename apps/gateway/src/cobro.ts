import type { Tenant } from '@peaje/db'
import type { ContextoCobro, ResultadoOrigen } from './contexto.js'
import { merchantDelCobro } from './methods.js'

/**
 * Piezas compartidas por las rutas que cobran (HTTP y MCP): qué pasa cuando
 * el negocio no tiene dirección de cobro y cuando un pago no se liquidó.
 */

const panel = () => process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'

/** El negocio tiene a dónde recibir el 98%. Sin esto no hay ninguna oferta. */
export function tieneDireccionDeCobro(tenant: Pick<Tenant, 'payoutWallet'>): boolean {
  return merchantDelCobro({ merchant: tenant.payoutWallet as `0x${string}` | null }) !== null
}

/** Cuerpo para el agente (y para el dueño que prueba su ruta) cuando falta la dirección de cobro. */
export function sinDireccionDeCobro(tenant: Pick<Tenant, 'slug' | 'name'>) {
  return {
    error: `${tenant.name} cannot take payments yet: it has no payout address.`,
    hint: `If you own this business, set your payout address in Peaje: ${panel()}/t/${tenant.slug}/ingresos. Payments go straight to that address.`,
    code: 'no-payout-address',
  }
}

export function respuestaSinDireccion(tenant: Pick<Tenant, 'slug' | 'name'>): Response {
  return Response.json(sinDireccionDeCobro(tenant), { status: 503, headers: { 'retry-after': '3600' } })
}

/** Texto para el agente según por qué el pago no se liquidó. */
export function motivoNoLiquidado(motivo: NonNullable<ContextoCobro['sinLiquidar']>): { error: string; hint: string; code: string } {
  switch (motivo) {
    case 'origen':
      return {
        error: 'The business origin failed, so your payment was not settled.',
        hint: 'You were not charged: the payment authorization expires unused. Retry later.',
        code: 'origin-failed-not-charged',
      }
    case 'envio':
      return {
        error: 'Your payment could not be settled on-chain.',
        hint: 'You were not charged. Retry with a new payment.',
        code: 'settlement-failed-not-charged',
      }
    case 'adelantado':
      return {
        error: 'This payment authorization was submitted to the token outside Peaje, and the request it paid for was already served once.',
        hint: 'The funds are held in the Peaje settlement contract and will be sent to the business. Pay again with a new authorization.',
        code: 'authorization-front-run',
      }
    case 'pendiente':
      return {
        error: 'Your payment was sent on-chain and is still confirming.',
        hint: 'Do not pay again. Retry this same request with the same payment credential in a minute: once it confirms, it is served without a new charge.',
        code: 'settlement-pending',
      }
    case 'usada':
      return {
        error: 'This payment authorization was already used, and Peaje cannot confirm the funds are held for the business.',
        hint: 'This request was not served. Pay again with a new authorization.',
        code: 'authorization-used',
      }
  }
}

/**
 * Si mppx devolvió 402 porque el settlement no se envió (no por una
 * credencial mala), la respuesta explica que no se cobró. Con el origen caído
 * o en 5xx se devuelve lo que respondió el origen, marcado como no cobrado.
 * null = 402 normal.
 */
export async function respuestaNoLiquidada(
  cobro: ContextoCobro,
  origen: () => Promise<ResultadoOrigen<Response>>,
): Promise<Response | null> {
  if (!cobro.sinLiquidar) return null
  // Pago adelantado con la plata probadamente en el contrato, registrado por
  // primera vez: el agente pagó, se le sirve una sola vez. El Safe reparte
  // después con settleStray (no hay Payment-Receipt: no hubo tx de Peaje).
  if (cobro.sinLiquidar === 'adelantado' && cobro.servirAdelantado) {
    const { valor } = await origen()
    const headers = new Headers(valor.headers)
    headers.set('x-peaje-payment', 'pending-split')
    return new Response(valor.body, { status: valor.status, statusText: valor.statusText, headers })
  }
  const cuerpo = motivoNoLiquidado(cobro.sinLiquidar)
  if (cobro.sinLiquidar === 'origen') {
    const { valor } = await origen()
    if (valor.status >= 500 && !valor.headers.has('x-peaje-origin-error')) {
      const headers = new Headers(valor.headers)
      headers.set('x-peaje-payment', 'not-charged')
      return new Response(valor.body, { status: valor.status, statusText: valor.statusText, headers })
    }
    return Response.json(cuerpo, { status: 502, headers: { 'x-peaje-payment': 'not-charged' } })
  }
  const cabecera = { adelantado: 'held-for-business', usada: 'not-verified', envio: 'not-charged', pendiente: 'pending' } as const
  if (cobro.sinLiquidar === 'pendiente') {
    return Response.json(cuerpo, { status: 503, headers: { 'x-peaje-payment': cabecera.pendiente, 'retry-after': '30' } })
  }
  return Response.json(cuerpo, {
    status: cobro.sinLiquidar === 'envio' ? 502 : 409,
    headers: { 'x-peaje-payment': cabecera[cobro.sinLiquidar] },
  })
}

/** El origen no respondió (excepción de red): respuesta de error propia, marcada para no confundirla con un 5xx del origen. */
export function origenCaido(mensaje: string): Response {
  return Response.json(
    { error: mensaje, hint: 'If you were charged, keep the receipt and contact support.' },
    { status: 502, headers: { 'x-peaje-origin-error': '1' } },
  )
}
