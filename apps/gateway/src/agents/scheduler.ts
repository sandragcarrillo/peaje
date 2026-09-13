import { isNetworkId } from '@peaje/shared'
import { store } from '../store.js'
import { payoutConfirmed } from '../treasury.js'
import { correrYReprogramar } from './runner.js'

/**
 * Scheduler de agentes: despierta a los que tienen corrida vencida.
 *
 * No hay motor de workflows: el gateway ya es un proceso largo, y la ejecución
 * es una función invocable, así que el "bucle" es solo quién la llama. El
 * botón del dashboard llama a la misma función.
 */

const INTERVALO_MS = Number(process.env.AGENTS_TICK_MS ?? 60_000)
let corriendo = false

async function tick() {
  if (corriendo) return // una corrida a la vez: evita solapar si una tarda
  corriendo = true
  try {
    const vencidos = await store.listDueAgents(new Date().toISOString(), 5)
    for (const agent of vencidos) {
      try {
        const run = await correrYReprogramar(agent)
        if (run) console.log(`[scheduler] ${agent.name}: ${run.status}`)
      } catch (error) {
        console.error(`[scheduler] falló la corrida de ${agent.name}`, error)
        // No dejamos el agente colgado: si explota, se pausa para revisión.
        await store.updateAgent(agent.id, { status: 'paused', nextRunAt: null }).catch(() => {})
      }
    }
  } catch (error) {
    console.error('[scheduler] no se pudieron listar agentes vencidos', error)
  } finally {
    corriendo = false
  }

  await reconciliarRetiros()
}

/**
 * Los retiros quedan pending al crearse y solo el detalle los actualizaba:
 * la lista del dashboard los mostraba PENDING para siempre aunque la tx ya
 * estuviera confirmada. Este barrido los reconcilia contra la chain.
 */
async function reconciliarRetiros() {
  try {
    const pendientes = await store.listPendingWithdrawals(20)
    for (const w of pendientes) {
      if (!w.txRef || !isNetworkId(w.network)) continue
      const confirmada = await payoutConfirmed(w.network, w.txRef as `0x${string}`).catch(() => null)
      if (confirmada === null) continue // sin receipt todavía: se reintenta en el próximo tick
      await store.updateWithdrawal(w.id, { status: confirmada ? 'confirmed' : 'failed' })
      console.log(`[scheduler] retiro ${w.id} → ${confirmada ? 'confirmed' : 'failed'}`)
    }
  } catch (error) {
    console.error('[scheduler] no se pudieron reconciliar retiros', error)
  }
}

export function iniciarScheduler() {
  if (process.env.AGENTS_SCHEDULER === 'off') {
    console.log('[scheduler] desactivado por AGENTS_SCHEDULER=off')
    return
  }
  setInterval(() => void tick(), INTERVALO_MS).unref()
  console.log(`[scheduler] agentes cada ${INTERVALO_MS / 1000}s`)
}
