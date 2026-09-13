'use server'

import { revalidatePath } from 'next/cache'
import * as gateway from '@/lib/gateway'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { sendFromMerchantWallet } from '@/lib/walletops'
import { isNetworkId } from '@peaje/shared'

/**
 * Acciones de agentes compradores. Todo pasa por el gateway, que es donde
 * viven las wallets de Privy y el scheduler.
 */

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Los mensajes del gateway vienen en español; el dashboard es bilingüe. Los
 * errores frecuentes traen un `code` estable y acá se traducen con el
 * diccionario del usuario. Sin code, se muestra el mensaje tal cual.
 */
async function fallo(error: unknown, porDefecto: string): Promise<{ ok: false; error: string }> {
  console.error('[agentes]', error)
  const code = (error as { code?: string }).code
  if (code) {
    const d = await getDict()
    const porCodigo: Record<string, string> = {
      busy: d.agentes.ocupado,
      'fondos-negocio': d.agentes.faltaSaldoNegocio,
    }
    if (porCodigo[code]) return { ok: false, error: porCodigo[code] }
  }
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
    return await fallo(error, d.agentes.errorCrear)
  }
}

export async function fondearAgente(
  slug: string,
  id: string,
  amount: string,
  red?: string,
  fromSlug?: string,
): Promise<Resultado<{ balance: string | null }>> {
  await requireTenant(slug)
  // El origen también tiene que ser un negocio del usuario: sin esto,
  // cualquier sesión podría drenar saldos ajenos por slug.
  if (fromSlug && fromSlug !== slug) await requireTenant(fromSlug)
  try {
    const { agent } = await gateway.fundAgent(slug, id, amount.replace(',', '.'), red, fromSlug)
    revalidatePath('/agentes')
    return { ok: true, data: { balance: agent.balance } }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorFondear)
  }
}

export async function correrAgente(slug: string, id: string): Promise<Resultado<{ status: string }>> {
  await requireTenant(slug)
  try {
    const { run } = await gateway.runAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { status: run.status } }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorCorrer)
  }
}

export async function barrerAgente(slug: string, id: string): Promise<Resultado<{ tx: string }>> {
  await requireTenant(slug)
  try {
    const { tx } = await gateway.sweepAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { tx } }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorDevolver)
  }
}

export async function pausarAgente(slug: string, id: string): Promise<Resultado<{ status: string }>> {
  await requireTenant(slug)
  try {
    const { agent } = await gateway.toggleAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: { status: agent.status } }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorEstado)
  }
}

export async function borrarAgente(slug: string, id: string): Promise<Resultado<null>> {
  await requireTenant(slug)
  try {
    await gateway.deleteAgent(slug, id)
    revalidatePath('/agentes')
    return { ok: true, data: null }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorBorrar)
  }
}

export async function corridasDeAgente(slug: string, id: string) {
  await requireTenant(slug)
  const { runs } = await gateway.listAgentRuns(slug, id)
  return runs
}

/** Plan sin compra: el agente muestra qué compraría antes de gastar. */
export async function planearParaAgente(
  slug: string,
  id: string,
  texto: string,
): Promise<Resultado<gateway.PlanDeCompra>> {
  await requireTenant(slug)
  try {
    const { plan } = await gateway.askAgent(slug, id, texto)
    return { ok: true, data: plan }
  } catch (error) {
    return await fallo(error, (await getDict()).agentes.errorPlanear)
  }
}

/** Confirmación del plan: la misión se actualiza y se compra ESE servicio. */
export async function confirmarCompra(
  slug: string,
  id: string,
  body: { mission: string; url: string },
): Promise<Resultado<{ status: string; respuesta: string | null; error: string | null }>> {
  await requireTenant(slug)
  const d = await getDict()
  try {
    const { run } = await gateway.runAgent(slug, id, body)
    revalidatePath('/agentes')
    let error = run.error
    if (run.status === 'skipped' && error) {
      const codigo = (run.decision as { codigo?: string } | null)?.codigo
      if (codigo === 'fondos' || error.startsWith('Sin presupuesto') || error.startsWith('Falta saldo')) {
        error = d.agentes.faltaSaldoCompra
      } else if (codigo === 'sin-match' || error.startsWith('Ningún servicio') || error.startsWith('No compré nada')) {
        error = d.agentes.sinPlan
      }
    }
    return {
      ok: true,
      data: { status: run.status, respuesta: run.result ?? run.resultExcerpt, error },
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'busy') {
      return { ok: false, error: d.agentes.ocupado }
    }
    return await fallo(error, d.agentes.errorCorrer)
  }
}


/**
 * Fondeo desde la wallet PERSONAL (custodiada): transferencia directa de la
 * wallet del usuario a la del agente, sin pasar por el ledger del negocio.
 */
export async function fondearDesdeWallet(
  slug: string,
  agentId: string,
  amount: string,
  red: string,
): Promise<Resultado<{ tx: string }>> {
  const tenant = await requireTenant(slug)
  const d = await getDict()
  if (!tenant.payoutWallet) return { ok: false, error: d.agentes.errorFondear }
  if (!isNetworkId(red)) return { ok: false, error: d.agentes.errorFondear }

  const { agents } = await gateway.listAgents(slug)
  const agente = agents.find((a) => a.id === agentId)
  if (!agente) return { ok: false, error: d.agentes.errorFondear }

  try {
    const tx = await sendFromMerchantWallet(
      tenant.payoutWallet as `0x${string}`,
      red,
      agente.walletAddress as `0x${string}`,
      Number(amount.replace(',', '.')).toFixed(6),
    )
    revalidatePath('/agentes')
    return { ok: true, data: { tx } }
  } catch (error) {
    return await fallo(error, d.agentes.errorFondear)
  }
}
