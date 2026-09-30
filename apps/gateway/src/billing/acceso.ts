import { accesoPro, type AccesoPro, type PlanPago, type Tenant } from '@peaje/db'
import { env } from '../env.js'

/**
 * El único lugar del gateway que decide si un negocio tiene Pro (M9). Todo lo
 * que es Pro (chat, Telegram, plan, citación, borradores, comprador
 * misterioso, correo semanal y alertas) pregunta acá. Las tareas de arreglo y
 * el monitor diario siguen gratis.
 */
export { accesoPro, type AccesoPro }

export const esActivo = (tenant: Tenant) => accesoPro(tenant).activo

// Igual que monitor/reporte.ts; copiado para no importar ese módulo (y su ciclo) desde acá.
const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://peaje-dashboard.vercel.app').replace(/\/$/, '')

/** Dónde se suscribe el dueño: la sección Plan de "Mi agente". */
export const urlPlan = (slug: string) => `${DASHBOARD}/t/${slug}/agente#plan`

/** El 402 de la suscripción: cualquier cliente x402 o MPP lo paga. */
export const urlCheckout = (slug: string, plan: PlanPago) => `${env.publicUrl.replace(/\/$/, '')}/_billing/${slug}/${plan}`

export function mensajeSinPro(tenant: Tenant, idioma: 'es' | 'en'): string {
  return idioma === 'es'
    ? `Esto es parte del agente Pro y tu prueba terminó. Las tareas de arreglo y el monitor diario siguen gratis. Para seguir con el chat, la citación y el resto, suscríbete en ${urlPlan(tenant.slug)}`
    : `This is part of the Pro agent and your trial ended. Fix tasks and the daily monitor stay free. To keep the chat, citation tracking and the rest, subscribe at ${urlPlan(tenant.slug)}`
}

/** Null si tiene Pro; si no, el cuerpo del 403 que devuelven las rutas Pro. */
export function sinPro(tenant: Tenant, idioma: 'es' | 'en' = 'en') {
  const acceso = accesoPro(tenant)
  if (acceso.activo) return null
  return {
    error: 'pro-required' as const,
    message: mensajeSinPro(tenant, idioma),
    plan: acceso.plan,
    upgradeUrl: urlPlan(tenant.slug),
    checkout: { founder: urlCheckout(tenant.slug, 'founder'), pro: urlCheckout(tenant.slug, 'pro') },
  }
}
