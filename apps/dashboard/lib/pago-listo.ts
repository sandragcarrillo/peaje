import 'server-only'
import { accesoPro, type Tenant } from '@peaje/db'
import { currentUserId, listMyTenants } from './session'
import { store } from './store'

/**
 * Estado de /pago/listo?txn=: lo que ve el cliente al cerrar el checkout de
 * Paddle. La fuente es el cobro que deja el webhook del gateway en
 * billing_payments (method 'paddle', reference txn_...): ahí están plan y
 * monto, sin llamar a Paddle desde el dashboard (la API key vive solo en el
 * gateway). Hasta que llega el webhook el pago "se está activando".
 *
 * Solo se muestra el detalle a la sesión dueña del negocio que pagó: el txn
 * de la URL no basta para ver el pago de otro.
 */

export const TXN = /^txn_[a-z0-9]+$/i

export type DestinoAgente = { slug: string; dominio: string | null }

export type EstadoPagoListo =
  | { estado: 'sin_sesion' }
  | { estado: 'desconocido'; destino: DestinoAgente | null }
  | { estado: 'activando'; destino: DestinoAgente | null }
  | { estado: 'activo'; destino: DestinoAgente; plan: 'founder' | 'pro'; montoUsd: string; hasta: string | null }

export type Simulacion = 'activo' | 'activando' | 'lento' | 'sin_sesion' | 'desconocido'
export const SIMULACIONES: Simulacion[] = ['activo', 'activando', 'lento', 'sin_sesion', 'desconocido']

/** Solo en `next dev`: ?simular= muestra cada estado sin pagar ni tener el gateway. */
export const puedeSimular = () => process.env.NODE_ENV === 'development'

function dominioDe(tenant: Tenant): string | null {
  try {
    return new URL(tenant.originUrl).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const destinoDe = (tenant: Tenant | undefined): DestinoAgente | null => (tenant ? { slug: tenant.slug, dominio: dominioDe(tenant) } : null)

export async function estadoPagoListo(txn: string | null, slugPista: string | null): Promise<EstadoPagoListo> {
  if (!(await currentUserId())) return { estado: 'sin_sesion' }
  const negocios = await listMyTenants()
  // El negocio del checkout (viene en la URL desde Mi agente) si es del usuario; si no, el más reciente.
  const pista = negocios.find((t) => t.slug === slugPista) ?? negocios[0]
  if (!txn || !TXN.test(txn)) return { estado: 'desconocido', destino: destinoDe(pista) }

  const pago = await store.findBillingPayment('paddle', txn).catch(() => null)
  if (!pago) return { estado: 'activando', destino: destinoDe(pista) }

  const negocio = negocios.find((t) => t.id === pago.tenantId)
  // El pago existe pero es de un negocio de otra persona: no se muestra nada de él.
  if (!negocio) return { estado: 'desconocido', destino: destinoDe(pista) }
  const acceso = accesoPro(negocio)
  return {
    estado: 'activo',
    destino: destinoDe(negocio)!,
    plan: pago.plan,
    montoUsd: Number(pago.amountUsd).toFixed(2),
    hasta: acceso.activo ? acceso.hasta : pago.periodEnd,
  }
}

/** Datos de mentira para ?simular= en desarrollo. `activando` pasa a activo a los 8 s de `desde`. */
export function estadoSimulado(sim: Simulacion, desde: number | null, ahora = Date.now()): EstadoPagoListo {
  const destino = { slug: 'demo', dominio: 'tunegocio.com' }
  const activo: EstadoPagoListo = { estado: 'activo', destino, plan: 'pro', montoUsd: '69.00', hasta: new Date(ahora + 30 * 86_400_000).toISOString() }
  if (sim === 'activo') return activo
  if (sim === 'sin_sesion') return { estado: 'sin_sesion' }
  if (sim === 'desconocido') return { estado: 'desconocido', destino }
  if (sim === 'activando' && desde && ahora - desde > 8000) return activo
  return { estado: 'activando', destino }
}
