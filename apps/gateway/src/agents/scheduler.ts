import { store } from '../store.js'
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
}

export function iniciarScheduler() {
  if (process.env.AGENTS_SCHEDULER === 'off') {
    console.log('[scheduler] desactivado por AGENTS_SCHEDULER=off')
    return
  }
  setInterval(() => void tick(), INTERVALO_MS).unref()
  console.log(`[scheduler] agentes cada ${INTERVALO_MS / 1000}s`)
}
