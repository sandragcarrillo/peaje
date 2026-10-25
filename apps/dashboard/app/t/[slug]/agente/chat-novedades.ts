'use server'

import type { AgentMessage } from '@peaje/db'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/**
 * Lo que llegó al chat después de `desde` (un aviso de "página lista" que dejó
 * un trabajo en segundo plano) y si queda algún trabajo corriendo. El chat lo
 * consulta mientras haya trabajos pendientes.
 */
export async function novedadesChat(slug: string, desde: string | null): Promise<{ mensajes: AgentMessage[]; pendientes: boolean }> {
  const tenant = await requireTenant(slug)
  const [mensajes, trabajos] = await Promise.all([
    store.listMessages(tenant.id, 20).catch((): AgentMessage[] => []),
    store.listJobs(tenant.id, 10).catch(() => []),
  ])
  return {
    mensajes: desde ? mensajes.filter((m) => m.createdAt > desde) : [],
    pendientes: trabajos.some((j) => j.status === 'queued' || j.status === 'running'),
  }
}
