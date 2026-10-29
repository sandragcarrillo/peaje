'use server'

import { apiKeyPrefix, claveAgente, hashApiKey } from '@peaje/shared'
import { revalidatePath } from 'next/cache'
import { desconectarTelegram, enlaceTelegram, agregarPreguntas, buscarTareas, completarTarea, enviarAlAgente, medirCitacion, quitarPregunta } from '@/lib/gateway'
import { avisarIndexNow } from '@/lib/indexnow'
import { getLocale } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/** Crea (o rota) la clave del agente. Se devuelve una sola vez; en la base queda el hash. */
export async function crearClaveAgente(slug: string): Promise<string> {
  const tenant = await requireTenant(slug)
  // Derivada (no al azar): Integraciones la puede volver a mostrar, tapada, como el secreto del origen.
  const clave = await claveAgente(tenant.embedSecret)
  await store.setTenantApiKey(tenant.id, await hashApiKey(clave), apiKeyPrefix(clave))
  // La clave se muestra en Integraciones.
  revalidatePath(`/t/${slug}/integraciones`)
  return clave
}

export async function buscarTareasAhora(slug: string) {
  await requireTenant(slug)
  const r = await buscarTareas(slug, await getLocale())
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

export async function enviarMensaje(slug: string, texto: string) {
  await requireTenant(slug)
  const { message } = await enviarAlAgente(slug, texto, await getLocale())
  revalidatePath(`/t/${slug}/agente`)
  return message
}

/**
 * Aplica un cambio que el agente propuso. Se lee la propuesta guardada, no lo
 * que mande el cliente: el botón solo dice cuál.
 */
export async function resolverAccion(slug: string, messageId: string, actionId: string, aplicar: boolean) {
  const tenant = await requireTenant(slug)
  const mensaje = await store.getMessage(tenant.id, messageId)
  const accion = mensaje?.actions.find((a) => a.id === actionId)
  if (!mensaje || !accion) throw new Error('Proposal not found')
  if (accion.status !== 'pending') return mensaje.actions
  let result = 'Dismissed'
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
    result = 'Applied'
  }
  const acciones = mensaje.actions.map((a) => (a.id === actionId ? { ...a, status: aplicar ? ('applied' as const) : ('dismissed' as const), result } : a))
  await store.setMessageActions(tenant.id, messageId, acciones)
  revalidatePath(`/t/${slug}/agente`)
  revalidatePath(`/t/${slug}/rutas`)
  return acciones
}

export async function agregarPregunta(slug: string, texto: string) {
  await requireTenant(slug)
  await agregarPreguntas(slug, texto.trim() ? { texts: [texto.trim()] } : { suggest: true })
  revalidatePath(`/t/${slug}/agente`)
}

export async function borrarPregunta(slug: string, id: string) {
  await requireTenant(slug)
  await quitarPregunta(slug, id)
  revalidatePath(`/t/${slug}/agente`)
}

export async function medirAhora(slug: string) {
  await requireTenant(slug)
  const r = await medirCitacion(slug, await getLocale())
  revalidatePath(`/t/${slug}/agente`)
  return r
}

// ---- M7: comprador misterioso ----
export async function probarComprador(slug: string) {
  await requireTenant(slug)
  const { correrComprador } = await import('@/lib/gateway')
  const r = await correrComprador(slug, await getLocale())
  revalidatePath(`/t/${slug}/agente`)
  return { error: r.error, retryInSeconds: r.retryInSeconds, message: r.message }
}
// ---- fin M7 ----

export async function conectarTelegram(slug: string) {
  await requireTenant(slug)
  return enlaceTelegram(slug)
}

export async function quitarTelegram(slug: string) {
  await requireTenant(slug)
  await desconectarTelegram(slug)
  revalidatePath(`/t/${slug}/agente`)
}

// ---- Slack ----
export async function conectarSlack(slug: string) {
  await requireTenant(slug)
  const { enlaceSlack } = await import('@/lib/gateway')
  return enlaceSlack(slug, (await getLocale()) === 'es' ? 'es' : 'en')
}

export async function quitarSlack(slug: string, canal?: { teamId: string; channelId: string }) {
  await requireTenant(slug)
  const { desconectarSlack } = await import('@/lib/gateway')
  await desconectarSlack(slug, canal)
  revalidatePath(`/t/${slug}/agente`)
}
// ---- fin Slack ----

// ---- reportes programados ----
export async function programarReporte(slug: string, cambio: import('@/lib/gateway').CambioReporte) {
  await requireTenant(slug)
  const { guardarReporte } = await import('@/lib/gateway')
  const r = await guardarReporte(slug, cambio)
  revalidatePath(`/t/${slug}/agente`)
  return r.schedule
}

export async function quitarReporte(slug: string, filtro: { id: string } | { channel: string; target: string; kind?: 'agent_visits' | 'custom' }) {
  await requireTenant(slug)
  const { borrarReporte } = await import('@/lib/gateway')
  await borrarReporte(slug, filtro)
  revalidatePath(`/t/${slug}/agente`)
}
// ---- fin reportes programados ----

// ---- Paddle: botón "Gestionar suscripción" ----
/** El cliente de Paddle sale del negocio del dueño con sesión (requireTenant), nunca del navegador. */
export async function abrirPortal(slug: string) {
  await requireTenant(slug)
  const { abrirPortalPaddle } = await import('@/lib/gateway')
  try {
    const r = await abrirPortalPaddle(slug)
    return { url: r.url, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : String(e) }
  }
}
// ---- fin Paddle ----

/** Corta una herramienta conectada con inicio de sesión (Integraciones, Activas). */
export async function desconectarHerramienta(slug: string, id: string): Promise<void> {
  const tenant = await requireTenant(slug)
  await store.revokeOauthGrant(tenant.id, id, new Date().toISOString())
  revalidatePath(`/t/${slug}/integraciones`)
}
