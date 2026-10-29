'use server'

import { permiso, rechazo, revisarPedido } from '@/lib/oauth'
import { currentUserId, tenantIfMine } from '@/lib/session'

/**
 * Los dos botones de la pantalla de permiso. Devuelven la URL de vuelta a la
 * herramienta y la página navega con location (no un redirect del form: la
 * CSP tiene form-action 'self' y bloquearía volver a otro origen o a una app).
 * Todo se vuelve a revisar acá: lo que llega del navegador no se cree.
 */
export async function permitirConexion(pedido: string, slug: string): Promise<{ url: string } | { error: 'cliente' | 'negocio' }> {
  const r = await revisarPedido(Object.fromEntries(new URLSearchParams(pedido)))
  if (!r.ok) return 'volver' in r ? { url: r.volver } : { error: 'cliente' }
  const [tenant, userId] = await Promise.all([tenantIfMine(slug), currentUserId()])
  if (!tenant || !userId) return { error: 'negocio' }
  return { url: await permiso(r.pedido, tenant.id, userId) }
}

export async function rechazarConexion(pedido: string): Promise<{ url: string } | { error: 'cliente' }> {
  const r = await revisarPedido(Object.fromEntries(new URLSearchParams(pedido)))
  if (!r.ok) return 'volver' in r ? { url: r.volver } : { error: 'cliente' }
  return { url: rechazo(r.pedido) }
}
