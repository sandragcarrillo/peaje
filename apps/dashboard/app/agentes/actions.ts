'use server'

import { revalidatePath } from 'next/cache'
import * as gateway from '@/lib/gateway'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'

/**
 * Acciones de agentes compradores. Todo pasa por el gateway, que es donde
 * viven las wallets de Privy y el scheduler.
 */

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string }

function fallo(error: unknown, porDefecto: string): { ok: false; error: string } {
  console.error('[agentes]', error)
  return { ok: false, error: error instanceof Error ? error.message : porDefecto }
}

export async function crearAgente(
  slug: string,
  formData: FormData,
): Promise<Resultado<{ id: string }>> {
  await requireTenant(slug)
  const name = String(formData.get('name') ?? '').trim()
  const mission = String(formData.get('mission') ?? '').trim()
  const network = String(formData.get('network') ?? 'arc')
  const frequency = String(formData.get('frequency') ?? 'once')
  const maxPerRun = String(formData.get('maxPerRun') ?? '0.05').replace(',', '.')
  const deliveryKind = String(formData.get('deliveryKind') ?? 'dashboard')
  const deliveryTarget = String(formData.get('deliveryTarget') ?? '').trim() || null

  const d = await getDict()
  if (!name) return { ok: false, error: d.agentes.errorNombre }
  if (mission.length < 5) return { ok: false, error: d.agentes.errorMision }

  try {
    const { agent } = await gateway.createAgent(slug, {
      name,
      mission,
      network,
      frequency,
      maxPerRun,
      deliveryKind,
      deliveryTarget,
    })
    revalidatePath('/agentes')
    return { ok: true, data: { id: agent.id } }
  } catch (error) {
    return fallo(error, d.agentes.errorCrear)
  }
}

export async function fondearAgente(
  slug: string,
  id: string,
  amount: string,
): Promise<Resultado<{ balance: string | null }>> {
  await requireTenant(slug)
  try {
    const { agent } = await gateway.fundAgent(slug, id, amount.replace(',', '.'))
    revalidatePath('/agentes')
    return { ok: true, data: { balance: agent.balance } }
  } catch (error) {
    return fallo(error, (await getDict()).agentes.errorFondear)
  }
}

export async function correrAgente(slug: string, id: string): Promise<Resultado<{ status: string }>> {
  await requireTenant(slug)
  try {
    const { run } = await gateway.runAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { status: run.status } }
  } catch (error) {
    return fallo(error, (await getDict()).agentes.errorCorrer)
  }
}

export async function barrerAgente(slug: string, id: string): Promise<Resultado<{ tx: string }>> {
  await requireTenant(slug)
  try {
    const { tx } = await gateway.sweepAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { tx } }
  } catch (error) {
    return fallo(error, (await getDict()).agentes.errorDevolver)
  }
}

export async function pausarAgente(slug: string, id: string): Promise<Resultado<{ status: string }>> {
  await requireTenant(slug)
  try {
    const { agent } = await gateway.toggleAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { status: agent.status } }
  } catch (error) {
    return fallo(error, (await getDict()).agentes.errorEstado)
  }
}

export async function borrarAgente(slug: string, id: string): Promise<Resultado<null>> {
  await requireTenant(slug)
  try {
    await gateway.deleteAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: null }
  } catch (error) {
    return fallo(error, (await getDict()).agentes.errorBorrar)
  }
}

export async function corridasDeAgente(slug: string, id: string) {
  await requireTenant(slug)
  const { runs } = await gateway.listAgentRuns(slug, id)
  return runs
}
