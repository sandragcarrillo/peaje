import type { Metadata } from 'next'
import { getDict } from '@/lib/i18n'
import { estadoPagoListo, estadoSimulado, puedeSimular, SIMULACIONES, TXN, type Simulacion } from '@/lib/pago-listo'
import { EstadoPago } from './estado'

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDict()
  return { title: d.pago.exito.meta, robots: { index: false, follow: false } }
}

type Props = { searchParams: Promise<{ txn?: string; slug?: string; simular?: string }> }

/**
 * /pago/listo?txn=txn_...&slug=: adonde llega el cliente al terminar el
 * checkout de Paddle (desde Mi agente o desde /checkout?_ptxn=). Reemplaza la
 * pantalla genérica de Paddle. Si el webhook todavía no activó el plan, el
 * componente consulta /api/pago/estado cada 3 s hasta 60 s.
 *
 * En `next dev`, ?simular=activo|activando|lento|sin_sesion|desconocido.
 */
export default async function PagoListo({ searchParams }: Props) {
  const { txn: crudo, slug, simular } = await searchParams
  const txn = crudo && TXN.test(crudo) ? crudo : null
  const sim = puedeSimular() && SIMULACIONES.includes(simular as Simulacion) ? (simular as Simulacion) : null
  const inicial = sim ? estadoSimulado(sim, null) : await estadoPagoListo(txn, slug ?? null)
  return <EstadoPago inicial={inicial} txn={txn ?? (sim ? 'txn_01simulado' : null)} slug={slug ?? null} simular={sim} />
}
