import { accesoPro, conRegalo, COSTOS_CREDITOS, periodoCreditos, REGALO, type AccionCreditos, type Regalo, type Tenant } from '@peaje/db'
import { store } from '../store.js'

/**
 * Créditos del agente Pro. Cada plan trae un cupo por mes calendario (UTC);
 * cada respuesta paga al terminar por lo que hizo (ver COSTOS_CREDITOS en
 * @peaje/db). El saldo es el cupo menos la suma de cargos del mes.
 *
 * Si la tabla todavía no existe (migración 20261026100000 sin correr) o la
 * lectura falla, el mes cuenta como sin usar y el cargo se pierde con un
 * aviso en el log: el chat no se corta por la contabilidad.
 */

type Idioma = 'es' | 'en'

/** `regalo`: el saldo es el paquete gratis (no se renueva); trae lo que queda de cada cosa y dónde suscribirse. */
export type Saldo = { total: number; usados: number; quedan: number; renueva: string; regalo?: Regalo & { planUrl: string } }

// Igual que billing/acceso.ts (urlPlan); copiado para no traer ese módulo y su env a los tests de créditos.
const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')
const urlPlan = (slug: string) => `${DASHBOARD}/t/${slug}/agente#plan`

const creditosDe = (r: Regalo) => r.informes * COSTOS_CREDITOS.informe + r.respuestas * COSTOS_CREDITOS.consulta

export async function saldoCreditos(sinRegalo: Tenant, ahora = new Date()): Promise<Saldo> {
  // El paquete gratis se lee siempre fresco: lo que haya usado otro negocio del mismo dominio también cuenta.
  const tenant = await conRegalo(store, sinRegalo, ahora)
  if (accesoPro(tenant, ahora).plan === 'regalo' && tenant.regalo) {
    const total = creditosDe(REGALO)
    const quedan = creditosDe(tenant.regalo)
    return { total, usados: total - quedan, quedan, renueva: '', regalo: { ...tenant.regalo, planUrl: urlPlan(tenant.slug) } }
  }
  const total = accesoPro(tenant, ahora).limites.creditos
  const { desde, renueva } = periodoCreditos(ahora)
  let usados = 0
  try {
    usados = Math.max(0, await store.creditsUsedSince(tenant.id, desde))
  } catch (error) {
    console.warn('[créditos] no se pudo leer el saldo; cuenta como sin usar', tenant.slug, error instanceof Error ? error.message : error)
  }
  return { total, usados, quedan: Math.max(0, total - usados), renueva }
}

/** Anota un cargo (o una devolución, negativa). Nunca tira. */
export async function anotarCreditos(tenantId: string, creditos: number, motivo: string): Promise<boolean> {
  if (!creditos) return true
  try {
    await store.addCreditCharge({ tenantId, credits: creditos, reason: motivo })
    return true
  } catch (error) {
    console.warn('[créditos] no se pudo anotar', { tenantId, creditos, motivo }, error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * Qué del paquete gratis cubre una acción. Null si la cubre; si no, por qué.
 * `yaInformes`: informes que esta misma respuesta ya entregó.
 */
export function fueraDelRegalo(s: Saldo, accion: AccionCreditos, yaInformes = 0): 'no-incluido' | 'agotado' | null {
  if (!s.regalo) return null
  if (accion === 'consulta') return s.regalo.respuestas > 0 ? null : 'agotado'
  if (accion !== 'informe') return 'no-incluido'
  return s.regalo.informes - yaInformes > 0 ? null : 'agotado'
}

/** La línea bajo la respuesta cuando el paquete gratis no cubre lo pedido. */
export function lineaRegalo(s: Saldo, motivo: 'no-incluido' | 'agotado', idioma: Idioma): string {
  const url = s.regalo?.planUrl ?? ''
  if (motivo === 'no-incluido') {
    return idioma === 'es'
      ? `Eso no entra en el paquete gratis: es parte del plan. Lo activas en ${url}`
      : `That is not in the free package: it is part of the plan. Turn it on at ${url}`
  }
  return idioma === 'es'
    ? `Ya usaste esa parte de tu paquete gratis. Con el plan, Peaje sigue midiendo y trabajando cada semana: ${url}`
    : `You already used that part of your free package. With the plan, Peaje keeps measuring and working every week: ${url}`
}

/** Lo que queda del paquete gratis, en una línea. */
export function restoRegalo(r: Regalo, idioma: Idioma): string {
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`
  return idioma === 'es'
    ? `Paquete gratis: te quedan ${n(r.informes, 'informe', 'informes')} y ${n(r.respuestas, 'respuesta', 'respuestas')} del agente.`
    : `Free package: ${n(r.informes, 'report', 'reports')} and ${n(r.respuestas, 'agent answer', 'agent answers')} left.`
}

/** "1 de noviembre" / "November 1": el día en que vuelve el cupo, en UTC. */
export function fechaRenovacion(iso: string, idioma: Idioma): string {
  return new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(iso))
}

/** La línea bajo la respuesta cuando algo no se pudo hacer por falta de créditos. */
export function lineaSinCreditos(o: { costo: number; quedan: number; renueva: string }, idioma: Idioma): string {
  const fecha = fechaRenovacion(o.renueva, idioma)
  return idioma === 'es'
    ? `Eso cuesta ${o.costo} ${o.costo === 1 ? 'crédito' : 'créditos'} y te ${o.quedan === 1 ? 'queda 1' : `quedan ${o.quedan}`} este mes. Tus créditos se renuevan el ${fecha}; mientras tanto podemos seguir conversando.`
    : `That costs ${o.costo} ${o.costo === 1 ? 'credit' : 'credits'} and you have ${o.quedan} left this month. Your credits renew on ${fecha}; until then we can keep talking.`
}

/** Desde el 80 % del cupo usado, una línea con lo que queda. Null antes. */
export function avisoCreditos(s: Saldo, idioma: Idioma): string | null {
  if (s.regalo) return restoRegalo(s.regalo, idioma)
  if (s.total <= 0 || s.usados < Math.ceil(s.total * 0.8)) return null
  const fecha = fechaRenovacion(s.renueva, idioma)
  if (s.quedan === 0) {
    return idioma === 'es'
      ? `Usaste los ${s.total} créditos de este mes. Se renuevan el ${fecha}; hasta entonces puedo conversar, pero no consultar datos ni hacer entregas nuevas.`
      : `You used this month's ${s.total} credits. They renew on ${fecha}; until then I can talk, but not look up data or make new deliverables.`
  }
  return idioma === 'es'
    ? `Te ${s.quedan === 1 ? 'queda 1 crédito' : `quedan ${s.quedan} créditos`} de ${s.total} este mes. Se renuevan el ${fecha}.`
    : `You have ${s.quedan} of ${s.total} credits left this month. They renew on ${fecha}.`
}

/**
 * Lo que devuelven el dashboard y el MCP del dueño cuando no alcanza: el
 * mismo texto que la línea del chat. `retryInSeconds` (hasta que se renueva
 * el cupo) va para las pantallas que ya muestran una espera.
 */
export type SinCreditos = {
  error: 'not-enough-credits'
  message: string
  cost: number
  remaining: number
  renewsAt: string
  retryInSeconds: number
}

export function sinCreditos(s: Saldo, costo: number, idioma: Idioma, ahora = new Date(), motivo: 'no-incluido' | 'agotado' = 'agotado'): SinCreditos {
  if (s.regalo) return { error: 'not-enough-credits', message: lineaRegalo(s, motivo, idioma), cost: costo, remaining: s.quedan, renewsAt: '', retryInSeconds: 0 }
  return {
    error: 'not-enough-credits',
    message: lineaSinCreditos({ costo, quedan: s.quedan, renueva: s.renueva }, idioma),
    cost: costo,
    remaining: s.quedan,
    renewsAt: s.renueva,
    retryInSeconds: Math.max(0, Math.ceil((new Date(s.renueva).getTime() - ahora.getTime()) / 1000)),
  }
}

/**
 * Cobra una acción pedida fuera del chat (botones del dashboard, MCP del
 * dueño) al mismo precio que en el chat. Reserva antes de correr, así dos
 * clics seguidos no gastan dos veces el mismo saldo, y devuelve lo cobrado si
 * la acción falla o no entrega nada (`entrego`, igual que COBRO en
 * agente.ts), como trabajos.ts con un trabajo fallido. Las corridas
 * programadas del monitor no pasan por acá: siguen gratis.
 */
export async function cobrarAccion<T>(
  tenant: Tenant,
  accion: AccionCreditos,
  o: { idioma: Idioma; motivo: string; entrego: (r: T) => boolean },
  correr: () => Promise<T>,
): Promise<{ sinCreditos: SinCreditos } | { valor: T }> {
  const costo = COSTOS_CREDITOS[accion]
  const saldo = await saldoCreditos(tenant)
  const fuera = fueraDelRegalo(saldo, accion)
  if (fuera) return { sinCreditos: sinCreditos(saldo, costo, o.idioma, new Date(), fuera) }
  if (costo > saldo.quedan) return { sinCreditos: sinCreditos(saldo, costo, o.idioma) }
  const cobrado = await anotarCreditos(tenant.id, costo, o.motivo)
  const devolver = () => (cobrado ? anotarCreditos(tenant.id, -costo, `devolución:${o.motivo}`) : Promise.resolve(true))
  let valor: T
  try {
    valor = await correr()
  } catch (error) {
    await devolver()
    throw error
  }
  if (!o.entrego(valor)) await devolver()
  return { valor }
}

/** Lo que ven el dashboard y el agente: saldo y lista de precios. */
export function usoPublico(s: Saldo) {
  return { credits: s.total, used: s.usados, remaining: s.quedan, renewsAt: s.renueva, costs: COSTOS_CREDITOS }
}
