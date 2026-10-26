import { accesoPro, COSTOS_CREDITOS, periodoCreditos, type AccionCreditos, type Tenant } from '@peaje/db'
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

export type Saldo = { total: number; usados: number; quedan: number; renueva: string }

export async function saldoCreditos(tenant: Tenant, ahora = new Date()): Promise<Saldo> {
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

export function sinCreditos(s: Saldo, costo: number, idioma: Idioma, ahora = new Date()): SinCreditos {
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
