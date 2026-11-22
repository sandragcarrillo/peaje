import { accesoPro, COSTOS_CREDITOS } from './planes'
import type { Store, Tenant } from './types'

/**
 * El paquete gratis: lo que un negocio puede probar del agente sin pagar, una
 * sola vez por dominio. Es fijo y no créditos libres porque lo caro son las
 * respuestas del agente: con un cupo libre alguien gastaba todo en preguntas.
 *
 * - 2 informes: el plan y una medición de quién aparece en su lugar.
 * - 10 respuestas del agente que consultan datos.
 * - Nada de páginas redactadas, tareas a pedido, comprador misterioso ni
 *   trabajo semanal: eso es el plan pago.
 *
 * Va atado al dominio, no a la cuenta: registrar el mismo sitio otra vez no
 * da otro paquete. No hay tabla nueva: lo usado sale de los cargos de crédito
 * de todos los negocios con ese dominio. Decisión de San, 21 nov 2026.
 */
export const REGALO = { informes: 2, respuestas: 10 } as const

export type Regalo = { informes: number; respuestas: number }

/** El dominio al que se ata el paquete. Null si el origen no es un sitio público (localhost, una IP, sin punto). */
export function dominioDeRegalo(originUrl: string): string | null {
  try {
    const host = new URL(originUrl).hostname.toLowerCase().replace(/^www\./, '')
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null
    return host
  } catch {
    return null
  }
}

/** Lo que queda del paquete dados todos los cargos del dominio. Una consulta es una respuesta; todo lo demás cuenta como informe. */
export function regaloRestante(cargos: { credits: number; reason: string }[]): Regalo {
  const esConsulta = (r: string) => r === 'consulta' || r === 'devolución:consulta'
  const enRespuestas = cargos.filter((c) => esConsulta(c.reason)).reduce((n, c) => n + c.credits, 0)
  const enInformes = cargos.filter((c) => !esConsulta(c.reason)).reduce((n, c) => n + c.credits, 0)
  return {
    informes: Math.max(0, REGALO.informes - Math.ceil(Math.max(0, enInformes) / COSTOS_CREDITOS.informe)),
    respuestas: Math.max(0, REGALO.respuestas - Math.ceil(Math.max(0, enRespuestas) / COSTOS_CREDITOS.consulta)),
  }
}

/**
 * El negocio con lo que le queda del paquete gratis. Con plan pago o prueba
 * vigente vuelve igual. Si la lectura falla vuelve sin paquete: nunca regala
 * de más por un error.
 */
export async function conRegalo(store: Pick<Store, 'listTenants' | 'creditCharges'>, tenant: Tenant, ahora = new Date()): Promise<Tenant> {
  if (accesoPro({ ...tenant, regalo: null }, ahora).activo) return tenant
  const dominio = dominioDeRegalo(tenant.originUrl)
  if (!dominio) return { ...tenant, regalo: null }
  try {
    const mismos = (await store.listTenants()).filter((t) => dominioDeRegalo(t.originUrl) === dominio)
    const ids = [...new Set([tenant.id, ...mismos.map((t) => t.id)])]
    const cargos = (await Promise.all(ids.map((id) => store.creditCharges(id)))).flat()
    return { ...tenant, regalo: regaloRestante(cargos) }
  } catch {
    return { ...tenant, regalo: null }
  }
}
