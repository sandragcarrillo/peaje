import type { Tenant } from '@peaje/db'

/**
 * Lo que necesita el checkout de Paddle (Paddle.js, overlay) para un negocio.
 * Se arma en el server y baja como prop al componente del plan.
 *
 * - NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: client-side token (test_... en sandbox, live_... en producción).
 * - NEXT_PUBLIC_PADDLE_ENV: 'sandbox' | 'production'. Tiene que coincidir con el token y los precios.
 * - PADDLE_PRICE_FOUNDER / PADDLE_PRICE_PRO: ids de precio (pri_...) de cada plan. Los mismos que el gateway.
 */
export type PaddleCliente = {
  clientToken: string | null
  environment: 'sandbox' | 'production'
  prices: { founder: string | null; pro: string | null }
  tenantId: string
  slug: string
  email: string | null
  /** active, past_due, paused, canceled, trialing; null si nunca se suscribió con tarjeta. */
  status: string | null
  cancelAt: string | null
  /** Tiene cliente de Paddle: el portal abre aunque la suscripción ya haya terminado (facturas). */
  canManage: boolean
}

/** Estados en los que hay una suscripción viva: no se ofrece otro checkout. */
export const SUSCRIPCION_VIVA = ['active', 'trialing', 'past_due'] as const

export const suscripcionViva = (status: string | null) => (SUSCRIPCION_VIVA as readonly string[]).includes(status ?? '')

export function paddleDelNegocio(tenant: Tenant): PaddleCliente {
  return {
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || null,
    environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
    prices: { founder: process.env.PADDLE_PRICE_FOUNDER || null, pro: process.env.PADDLE_PRICE_PRO || null },
    tenantId: tenant.id,
    slug: tenant.slug,
    email: tenant.email ?? null,
    status: tenant.paddleStatus ?? null,
    cancelAt: tenant.paddleCancelAt ?? null,
    canManage: !!tenant.paddleCustomerId,
  }
}
