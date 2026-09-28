import type { Tenant, Verificacion } from '@peaje/db'
import { dominioVerificable, verificarIntegracion, type Chequeo } from '@peaje/shared'
import { createHash } from 'node:crypto'
import { store } from '../store.js'

/**
 * Una corrida del monitor para un negocio: verificador (los 7 chequeos del
 * kit), score de Ora, hash de robots.txt y llms.txt, y la comparación con la
 * corrida anterior para saber qué cambió.
 *
 * Eventos:
 *   new_failure:<id>    pasaba y ahora falla, confirmado con una segunda medición
 *   still_failing:<id>  fallaba y sigue fallando (va al resumen semanal, no a la alerta)
 *   robots_changed      el robots.txt cambió (informativo)
 *   llms_changed        el llms.txt cambió (informativo)
 *
 * Contra los blips de red: un fallo nuevo se vuelve a medir a los 60 s antes
 * de contarlo. Si en la segunda medición pasa, no se avisa ni se guarda como
 * fallo. Es más simple que esperar 10 minutos con estado pendiente, y cubre
 * el caso real (un timeout del origen o del RPC).
 */

const ORA = 'https://ora.ai/api'
const RECHEQUEO_MS = Number(process.env.MONITOR_RECHECK_MS ?? 60_000)

export type Corrida = {
  verificacion: Verificacion
  previa: Verificacion | null
  eventos: string[]
  chequeos: Chequeo[]
  dominio: string
}

async function scoreOra(domain: string): Promise<number | null> {
  try {
    const res = await fetch(`${ORA}/score/${domain}`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { score?: number; code?: string }
    if (data.code === 'DOMAIN_NOT_SCANNED' || typeof data.score !== 'number') return null
    return Math.round(data.score)
  } catch {
    return null
  }
}

async function hashDe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { 'user-agent': 'peaje-monitor/1.0' } })
    if (!res.ok) return null
    return createHash('sha256').update(await res.text()).digest('hex').slice(0, 32)
  } catch {
    return null
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function correrTenant(tenant: Tenant): Promise<Corrida | null> {
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) return null

  const previa = await store.lastVerification(tenant.id)
  const previos = new Map<string, boolean>((previa?.checks as Chequeo[] | undefined)?.map((c) => [c.id, c.ok]) ?? [])

  let chequeos = await verificarIntegracion(tenant.originUrl)
  let nuevos = chequeos.filter((c) => !c.ok && previos.get(c.id) === true)
  if (nuevos.length > 0 && RECHEQUEO_MS > 0) {
    // Segunda medición antes de dar por roto algo que ayer estaba bien.
    await dormir(RECHEQUEO_MS)
    const otra = await verificarIntegracion(tenant.originUrl)
    const confirmados = new Set(otra.filter((c) => !c.ok).map((c) => c.id))
    // La corrida que guardamos es la segunda: es la que refleja el estado real.
    chequeos = otra
    nuevos = nuevos.filter((c) => confirmados.has(c.id))
  }

  const [score, robotsHash, llmsHash] = await Promise.all([
    scoreOra(dominio),
    hashDe(`https://${dominio}/robots.txt`),
    hashDe(`https://${dominio}/llms.txt`),
  ])

  const eventos: string[] = []
  for (const c of nuevos) eventos.push(`new_failure:${c.id}`)
  for (const c of chequeos) if (!c.ok && previos.get(c.id) === false) eventos.push(`still_failing:${c.id}`)
  if (previa?.robotsHash && robotsHash && previa.robotsHash !== robotsHash) eventos.push('robots_changed')
  if (previa?.llmsHash && llmsHash && previa.llmsHash !== llmsHash) eventos.push('llms_changed')

  const verificacion = await store.recordVerification({
    tenantId: tenant.id,
    checks: chequeos,
    ok: chequeos.every((c) => c.ok),
    score,
    robotsHash,
    llmsHash,
    alerted: [],
    pending: [],
  })

  return { verificacion, previa, eventos, chequeos, dominio }
}

/** Eventos que merecen un correo inmediato (no el resumen semanal). */
export function eventosAlertables(eventos: string[]): string[] {
  return eventos.filter((e) => e.startsWith('new_failure:') || e === 'robots_changed' || e === 'llms_changed')
}
