import type { Tenant } from './types'

/**
 * Planes del agente Pro (M9). Una sola fuente para el gateway y el dashboard:
 * quién tiene Pro, hasta cuándo y con qué límites.
 *
 * - free: kit, rutas con precio y 402, visitas, monitor diario y sus tareas de arreglo.
 * - founder: US$19/mes, solo los primeros 50 negocios que se suscriben.
 * - pro: US$29/mes.
 * - trial: 14 días de Pro para todo negocio nuevo (y los que ya existían al migrar).
 */

export type PlanPago = 'founder' | 'pro'
export type PlanVigente = 'free' | 'trial' | PlanPago

export const PRECIOS_USD: Record<PlanPago, number> = { founder: 19, pro: 29 }

export type Limites = { preguntas: number; mensajes: number }

export const LIMITES: Record<PlanVigente, Limites> = {
  free: { preguntas: 0, mensajes: 0 },
  trial: { preguntas: 20, mensajes: 150 },
  founder: { preguntas: 10, mensajes: 60 },
  pro: { preguntas: 20, mensajes: 150 },
}

/** Cupo del plan founder: negocios distintos que lo pagaron alguna vez. */
export const CUPOS_FOUNDER = 50
/** Cada pago extiende el plan 30 días. */
export const DIAS_PERIODO = 30
export const DIAS_PRUEBA = 14

export const esPlanPago = (x: unknown): x is PlanPago => x === 'founder' || x === 'pro'

export type AccesoPro = {
  activo: boolean
  plan: PlanVigente
  /** Hasta cuándo vale (ISO). Null en free. */
  hasta: string | null
  limites: Limites
}

const vigente = (fecha: string | null | undefined, ahora: Date) => !!fecha && new Date(fecha).getTime() > ahora.getTime()

/** Activo = plan pago vigente, o prueba vigente. El plan pago manda sobre la prueba. */
export function accesoPro(tenant: Pick<Tenant, 'plan' | 'planUntil' | 'trialUntil'>, ahora = new Date()): AccesoPro {
  if (esPlanPago(tenant.plan) && vigente(tenant.planUntil, ahora)) {
    return { activo: true, plan: tenant.plan, hasta: tenant.planUntil, limites: LIMITES[tenant.plan] }
  }
  if (vigente(tenant.trialUntil, ahora)) {
    return { activo: true, plan: 'trial', hasta: tenant.trialUntil, limites: LIMITES.trial }
  }
  return { activo: false, plan: 'free', hasta: null, limites: LIMITES.free }
}

/** El nuevo vencimiento: 30 días desde hoy o desde el vencimiento actual, lo que sea más tarde. */
export function extenderPlan(planUntil: string | null, ahora = new Date()): { desde: string; hasta: string } {
  const base = Math.max(ahora.getTime(), planUntil ? new Date(planUntil).getTime() : 0)
  return { desde: new Date(base).toISOString(), hasta: new Date(base + DIAS_PERIODO * 86_400_000).toISOString() }
}
