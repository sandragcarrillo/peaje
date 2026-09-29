import type { AgentAction, Tenant } from '@peaje/db'
import { avisarIndexNow } from '../indexnow.js'
import { store } from '../store.js'

/**
 * Aplica (o descarta) un cambio que el agente propuso. Se lee la propuesta
 * guardada, nunca lo que mande el cliente. Lo usa Telegram; el dashboard
 * tiene su versión en la server action (misma lógica).
 */
export async function resolverAccion(tenant: Tenant, messageId: string, actionId: string, aplicar: boolean): Promise<AgentAction> {
  const mensaje = await store.getMessage(tenant.id, messageId)
  const accion = mensaje?.actions.find((a) => a.id === actionId)
  if (!mensaje || !accion) throw new Error('Proposal not found')
  if (accion.status !== 'pending') return accion
  if (aplicar) {
    const p = accion.params
    if (accion.type === 'route.create') {
      const existentes = await store.listRoutes(tenant.id)
      if (existentes.some((r) => r.method === p.method && r.pathPattern === p.path)) throw new Error('That route already exists')
      await store.createRoute({ tenantId: tenant.id, method: p.method ?? 'GET', pathPattern: p.path ?? '/', priceUsd: p.priceUsd ?? '0.01', description: p.description ?? null })
    } else if (accion.type === 'route.update') {
      await store.updateRoute(tenant.id, p.routeId ?? '', {
        ...(p.priceUsd !== undefined ? { priceUsd: p.priceUsd } : {}),
        ...(p.description !== undefined ? { description: p.description } : {}),
      })
    } else {
      await store.deleteRoute(tenant.id, p.routeId ?? '')
    }
    avisarIndexNow(tenant)
  }
  const resuelta: AgentAction = { ...accion, status: aplicar ? 'applied' : 'dismissed', result: aplicar ? 'Applied' : 'Dismissed' }
  await store.setMessageActions(tenant.id, messageId, mensaje.actions.map((a) => (a.id === actionId ? resuelta : a)))
  return resuelta
}
