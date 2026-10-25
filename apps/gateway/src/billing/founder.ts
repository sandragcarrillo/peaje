import { CUPOS_FOUNDER, type Tenant } from '@peaje/db'
import { store } from '../store.js'

/**
 * Founder renueva a su precio solo mientras el plan founder siga vigente. Si
 * lo deja vencer (cancela) y vuelve, paga Pro aunque queden cupos (decisión de
 * San, 24 oct 2026). Un negocio que nunca fue founder entra si quedan cupos.
 *
 * Vale igual para el checkout de Paddle (lo decide el dashboard al ofrecer el
 * precio) y para el webhook (lo vuelve a mirar al llegar el cobro).
 */
export async function founderDisponible(tenant: Tenant): Promise<{ ok: boolean; cupos: number; yaFounder: boolean }> {
  const [usados, pagos] = await Promise.all([store.countFounders(), store.listBillingPayments(tenant.id, 100)])
  const yaFounder = tenant.plan === 'founder' && !!tenant.planUntil && new Date(tenant.planUntil).getTime() > Date.now()
  const loFue = pagos.some((p) => p.plan === 'founder')
  const cupos = Math.max(0, CUPOS_FOUNDER - usados)
  return { ok: yaFounder || (!loFue && cupos > 0), cupos, yaFounder }
}

/**
 * El cobro en USDC de la suscripción (402 de /_billing y pago con saldo).
 * Apagado por defecto desde el 24 oct 2026: Pro se vende con tarjeta por
 * Paddle. Los pagos de agentes a las rutas de los negocios no dependen de esto.
 */
export const cryptoActivo = () => ['1', 'true', 'on'].includes((process.env.BILLING_CRYPTO_ENABLED ?? '').toLowerCase())
