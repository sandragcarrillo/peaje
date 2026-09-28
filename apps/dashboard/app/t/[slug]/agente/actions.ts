'use server'

import { apiKeyPrefix, generateApiKey, hashApiKey } from '@peaje/shared'
import { revalidatePath } from 'next/cache'
import { buscarTareas, completarTarea } from '@/lib/gateway'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/** Crea (o rota) la clave del agente. Se devuelve una sola vez; en la base queda el hash. */
export async function crearClaveAgente(slug: string): Promise<string> {
  const tenant = await requireTenant(slug)
  const clave = generateApiKey()
  await store.setTenantApiKey(tenant.id, await hashApiKey(clave), apiKeyPrefix(clave))
  revalidatePath(`/t/${slug}/agente`)
  return clave
}

export async function buscarTareasAhora(slug: string) {
  await requireTenant(slug)
  const r = await buscarTareas(slug)
  revalidatePath(`/t/${slug}/agente`)
  return r
}

export async function tareaHecha(slug: string, id: string, url: string) {
  await requireTenant(slug)
  const r = await completarTarea(slug, id, url.trim() || undefined)
  revalidatePath(`/t/${slug}/agente`)
  return r.task
}

export async function descartarTarea(slug: string, id: string, motivo: string) {
  const tenant = await requireTenant(slug)
  await store.updateTask(tenant.id, id, { status: 'dismissed', note: motivo.trim().slice(0, 500) || 'Dismissed by the owner' })
  revalidatePath(`/t/${slug}/agente`)
}
