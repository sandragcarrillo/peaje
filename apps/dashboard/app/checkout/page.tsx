import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getDict } from '@/lib/i18n'
import { PagoPaddle } from './pago-paddle'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.pago.meta, robots: { index: false, follow: false } }
}

/**
 * Link de pago por defecto de Paddle (usepeaje.com/checkout). Paddle manda acá
 * a quien debe actualizar la tarjeta o reintentar un cobro que falló: el correo
 * trae ?_ptxn=<transacción> y Paddle.js abre ese checkout. No pide sesión: el
 * link ya identifica al cliente. La suscripción normal se abre desde Mi agente.
 */
export default function Checkout() {
  return (
    <Suspense fallback={null}>
      <PagoPaddle
        token={process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || null}
        environment={process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox'}
      />
    </Suspense>
  )
}
