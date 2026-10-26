import { NextResponse, type NextRequest } from 'next/server'
import { estadoPagoListo, estadoSimulado, puedeSimular, SIMULACIONES, type Simulacion } from '@/lib/pago-listo'

/**
 * Estado liviano del pago para /pago/listo: la página lo consulta cada 3 s
 * mientras el webhook de Paddle activa el plan. Lee la sesión (cookie), así
 * que solo responde por los negocios de quien pregunta.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const sim = q.get('simular') as Simulacion | null
  const estado =
    puedeSimular() && sim && SIMULACIONES.includes(sim)
      ? estadoSimulado(sim, Number(q.get('desde')) || null)
      : await estadoPagoListo(q.get('txn'), q.get('slug'))
  return NextResponse.json(estado, { headers: { 'cache-control': 'no-store' } })
}
