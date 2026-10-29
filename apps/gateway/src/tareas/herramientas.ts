import type { Tenant } from '@peaje/db'
import { marcaDeCliente } from '@peaje/shared/herramientas'
import { store } from '../store.js'

export { marcaDeCliente }

/** El clientInfo.name del `initialize`, si el body lo trae (suelto o en un lote). */
export function clienteMcp(body: unknown): string | null {
  const mensajes = Array.isArray(body) ? body : [body]
  for (const m of mensajes) {
    if (!m || typeof m !== 'object' || (m as { method?: unknown }).method !== 'initialize') continue
    const nombre = (m as { params?: { clientInfo?: { name?: unknown } } }).params?.clientInfo?.name
    if (typeof nombre === 'string' && nombre.trim()) return nombre.trim().slice(0, 60)
  }
  return null
}

/** Una vez cada 12 h por herramienta y clave: los clientes mandan `initialize` en cada sesión. */
const CADA_MS = 12 * 60 * 60 * 1000

/** Guarda que la herramienta se conectó. Nunca tira: el MCP sigue aunque esto falle. */
export async function anotarHerramienta(tenant: Tenant, nombre: string, ahora = new Date()): Promise<void> {
  // Las que no conocemos van cada una con su nombre, para que no se pisen entre sí.
  const marca = marcaDeCliente(nombre) === 'otra' ? `otra:${nombre.toLowerCase()}` : marcaDeCliente(nombre)
  const previas = tenant.herramientas ?? {}
  const previa = previas[marca]
  if (previa && previa.prefijo === tenant.apiKeyPrefix && ahora.getTime() - Date.parse(previa.at) < CADA_MS) return
  await store
    .setTenantHerramientas(tenant.id, { ...previas, [marca]: { nombre, at: ahora.toISOString(), prefijo: tenant.apiKeyPrefix ?? null } })
    .catch((e) => console.warn('[mcp] no se pudo anotar la herramienta', tenant.slug, e instanceof Error ? e.message : e))
}
