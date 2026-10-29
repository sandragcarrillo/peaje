import type { Tenant } from './types'

/**
 * Planes del agente Pro (M9). Una sola fuente para el gateway y el dashboard:
 * quién tiene Pro, hasta cuándo y con qué límites.
 *
 * - free: kit, rutas con precio y 402, visitas, monitor diario y sus tareas de arreglo.
 * - founder: US$30/mes, solo los primeros 50 negocios que se suscriben (precio desde el 24 oct 2026).
 * - pro: US$69/mes.
 * - trial: 14 días de Pro para todo negocio nuevo (y los que ya existían al migrar).
 */

export type PlanPago = 'founder' | 'pro'
export type PlanVigente = 'free' | 'trial' | PlanPago

export const PRECIOS_USD: Record<PlanPago, number> = { founder: 30, pro: 69 }

/**
 * Créditos del agente por mes calendario (UTC), iguales en founder, pro y
 * prueba. 800: decisión de San, 29 oct 2026, para que entre el paquete que
 * promete la tarjeta (PAQUETE_MENSUAL, abajo). Cambiar el número acá cambia todo.
 */
export const CREDITOS_MENSUALES = 800

export type Limites = {
  preguntas: number
  creditos: number
  /** @deprecated Ya no limita nada: el chat se paga con créditos. Queda mientras el dashboard lo muestre. */
  mensajes: number
}

export const LIMITES: Record<PlanVigente, Limites> = {
  free: { preguntas: 0, creditos: 0, mensajes: 0 },
  trial: { preguntas: 20, creditos: CREDITOS_MENSUALES, mensajes: 150 },
  // Founder es Pro con descuento: mismos límites, otro precio (decisión del 24 oct 2026).
  founder: { preguntas: 20, creditos: CREDITOS_MENSUALES, mensajes: 150 },
  pro: { preguntas: 20, creditos: CREDITOS_MENSUALES, mensajes: 150 },
}

/**
 * Lo que cuesta cada cosa que hace el agente, en créditos. Se cobra al
 * terminar la respuesta, por lo que hizo de verdad. Una respuesta que entrega
 * algo (tarea, página, serie, informe) paga eso y nada más; si solo consultó
 * datos, paga `consulta` una vez por respuesta. Conversar sin herramientas,
 * los reportes programados, lo que no es del negocio y el primer mensaje de
 * Telegram no cuestan nada.
 */
export const COSTOS_CREDITOS = {
  /** Una respuesta que consultó datos del negocio (una vez por respuesta, no por herramienta). */
  consulta: 2,
  /** Una tarea nueva para el desarrollador o la herramienta de IA del dueño (un arreglo, una ruta, una página por escribir). */
  tarea: 8,
  /** Una página completa escrita por el agente. */
  pagina: 10,
  /** Una serie de páginas sobre un tema (la principal y 3 a 5 más): nunca más cara por página que una suelta. */
  serie: 40,
  /** Un informe hecho a pedido: el plan, una medición de citación. */
  informe: 30,
  /** Una corrida del comprador misterioso. */
  comprador: 30,
} as const

/**
 * Lo que la tarjeta de precios promete por mes, todo junto. Sale de los mismos
 * créditos, así que tiene que caber en CREDITOS_MENSUALES (lo prueba el test
 * de planes): 40 páginas, 6 informes y 100 respuestas con datos, más un margen
 * para tareas. Decisión de San, 29 oct 2026.
 */
export const PAQUETE_MENSUAL = { paginas: 40, informes: 6, respuestas: 100 } as const

export type AccionCreditos = keyof typeof COSTOS_CREDITOS

/** El mes de créditos: del 1 a las 00:00 UTC al 1 del mes siguiente. */
export function periodoCreditos(ahora = new Date()): { desde: string; renueva: string } {
  return {
    desde: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString(),
    renueva: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1)).toISOString(),
  }
}

/** Cupo del plan founder: negocios distintos que lo pagaron alguna vez. */
export const CUPOS_FOUNDER = 50
/** Cada pago extiende el plan 30 días. */
export const DIAS_PERIODO = 30
/** Sin prueba gratis desde el 24 oct 2026: los sitios nuevos arrancan en free. Las pruebas ya dadas siguen hasta su fecha. */
export const DIAS_PRUEBA = 0
/** Ventana para pedir el reembolso completo del primer pago. */
export const DIAS_REEMBOLSO = 7

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
