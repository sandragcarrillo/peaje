import type { Tenant } from '@peaje/db'
import { env } from './env.js'

/**
 * La URL con la que un documento de discovery se nombra a sí mismo.
 *
 * Tiene que ser el dominio del NEGOCIO, no el del gateway. Un spec que declara
 * `servers: [peaje-gateway...]` manda al agente que lo leyó en tu dominio a
 * sondear otro host: el auditor concluye "documenta que cobra pero no hay
 * superficie viva" y la capa de pagos queda en cero aunque tu dominio devuelva
 * 402 perfecto. Con el proxy del kit puesto, todas estas rutas responden en el
 * origen, así que nombrarlas ahí es además lo correcto.
 *
 * Si el origen no es un dominio público (localhost, una IP, un puerto de dev)
 * no hay nada que anclar y volvemos al gateway.
 */
export function docsBase(tenant: Tenant): string {
  const origen = origenPublico(tenant.originUrl)
  return origen ?? `${env.publicUrl}/${tenant.slug}`
}

/** El gateway sigue siendo la dirección real: es el segundo `server` del spec. */
export function gatewayBase(tenant: Tenant): string {
  return `${env.publicUrl}/${tenant.slug}`
}

function origenPublico(originUrl: string): string | null {
  try {
    const u = new URL(originUrl)
    if (u.protocol !== 'https:') return null
    const host = u.hostname
    // Sin punto no es FQDN; localhost y las IP privadas no las ve nadie.
    if (!host.includes('.')) return null
    if (host === 'localhost' || host.endsWith('.local')) return null
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null
    return u.origin
  } catch {
    return null
  }
}
