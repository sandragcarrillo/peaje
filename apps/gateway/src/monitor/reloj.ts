import { store } from '../store.js'

/**
 * El reloj del monitor. El gateway dispara solo lo que antes iba a llamar un
 * cron de Railway que nunca se creó (9 nov 2026: ningún reporte programado,
 * ninguna revisión diaria y ningún correo semanal había salido nunca):
 *
 *   agendas  (reportes programados) cada 5 minutos. Ya es seguro de por sí:
 *            cada agenda se toma con un update condicional antes de mandarse.
 *   diario   una vez por día UTC, desde las 11:00 UTC (6:00 en Bogotá).
 *   semanal  una vez por semana, desde el lunes 12:00 UTC (7:00 en Bogotá).
 *
 * Diario y semanal se toman en monitor_runs (job, period): otra réplica o un
 * reinicio no los repite. Si el gateway estuvo caído a esa hora, corren al
 * volver, dentro del mismo período. Una corrida que muere a la mitad queda
 * tomada sin finished_at y no se repite en ese período (se ve en la tabla).
 *
 * Prendido en Railway (RAILWAY_ENVIRONMENT_ID). MONITOR_RELOJ=off lo apaga y
 * MONITOR_RELOJ=on lo prende fuera de Railway. En local queda apagado: el
 * .env apunta a la base de producción y la laptop podría ganar la corrida.
 */

export const HORA_DIARIO_UTC = 11
/** Los lunes. */
export const HORA_SEMANAL_UTC = 12
const AGENDAS_MS = 5 * 60_000
const TICK_MS = 60_000

export type Job = 'diario' | 'semanal'
export type Corrida = { job: Job; period: string }
export type Trabajos = Record<Job, () => Promise<unknown>> & { agendas: (ahora: Date) => Promise<unknown> }

/** Las corridas cuyo período ya empezó a esta hora, corrieran o no. */
export function corridasDebidas(ahora: Date): Corrida[] {
  const out: Corrida[] = []
  if (ahora.getUTCHours() >= HORA_DIARIO_UTC) out.push({ job: 'diario', period: ahora.toISOString().slice(0, 10) })
  const desdeLunes = (ahora.getUTCDay() + 6) % 7
  const lunes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - desdeLunes, HORA_SEMANAL_UTC))
  if (ahora >= lunes) out.push({ job: 'semanal', period: lunes.toISOString().slice(0, 10) })
  return out
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Lo que se guarda del resultado: entero si es chico, si no solo que terminó. */
function detalle(r: unknown): Record<string, unknown> {
  const json = JSON.stringify(r ?? null)
  return json.length <= 20_000 && r && typeof r === 'object' ? (r as Record<string, unknown>) : { truncated: true, size: json.length }
}

export function crearReloj(t: Trabajos) {
  // Lo que este proceso ya tomó o vio tomado: así no pregunta a la base cada minuto.
  const vistas = new Set<string>()
  const enCurso = new Set<string>()
  let ultimaAgenda = 0

  async function correr(nombre: string, fn: () => Promise<void>): Promise<void> {
    enCurso.add(nombre)
    try {
      await fn()
    } catch (error) {
      console.error(`[reloj] ${nombre} falló:`, mensaje(error))
    } finally {
      enCurso.delete(nombre)
    }
  }

  /** Una vuelta: arranca lo que toca y espera a que termine (los tests la esperan; el intervalo no). */
  async function tick(ahora: Date = new Date()): Promise<void> {
    const tareas: Promise<void>[] = []
    if (ahora.getTime() - ultimaAgenda >= AGENDAS_MS && !enCurso.has('agendas')) {
      ultimaAgenda = ahora.getTime()
      tareas.push(
        correr('agendas', async () => {
          const r = (await t.agendas(ahora)) as { due?: number; results?: unknown[] } | undefined
          if (r?.due) console.log('[reloj] agendas', JSON.stringify(r.results ?? []).slice(0, 2_000))
        }),
      )
    }
    for (const c of corridasDebidas(ahora)) {
      const k = `${c.job}:${c.period}`
      if (vistas.has(k) || enCurso.has(c.job)) continue
      let tomada: boolean
      try {
        tomada = await store.claimMonitorRun(c.job, c.period)
      } catch (error) {
        // Sin la tabla (migración pendiente) o sin base: no corre, para no repetir. Se reintenta en la próxima vuelta.
        console.error('[reloj] no se pudo tomar', k, mensaje(error))
        continue
      }
      vistas.add(k)
      if (!tomada) continue
      console.log('[reloj] corre', k)
      tareas.push(
        correr(c.job, async () => {
          let resultado: { ok: boolean; detail: Record<string, unknown> } = { ok: false, detail: {} }
          try {
            resultado = { ok: true, detail: detalle(await t[c.job]()) }
          } catch (error) {
            resultado = { ok: false, detail: { error: mensaje(error) } }
            throw error
          } finally {
            await store.finishMonitorRun(c.job, c.period, resultado).catch((e) => console.error('[reloj] no se pudo cerrar', k, mensaje(e)))
            console.log('[reloj] terminó', k, resultado.ok ? 'ok' : 'con error')
          }
        }),
      )
    }
    await Promise.all(tareas)
  }

  return { tick }
}

let temporizador: ReturnType<typeof setInterval> | null = null

/** Prende el reloj si corresponde (ver arriba). Llamarlo dos veces no duplica nada. */
export async function iniciarReloj(): Promise<void> {
  const modo = process.env.MONITOR_RELOJ
  const prendido = modo === 'on' || (modo !== 'off' && !!process.env.RAILWAY_ENVIRONMENT_ID)
  if (!prendido) {
    console.log('[reloj] apagado (fuera de Railway o MONITOR_RELOJ=off): el diario, el semanal y las agendas no corren solos')
    return
  }
  if (temporizador) return
  // Import diferido: los tests usan crearReloj sin cargar el monitor entero.
  const [{ correrDiario, correrSemanal }, { correrVencidos }] = await Promise.all([import('./index.js'), import('../reportes/entregar.js')])
  const reloj = crearReloj({ diario: correrDiario, semanal: correrSemanal, agendas: correrVencidos })
  temporizador = setInterval(() => void reloj.tick(), TICK_MS)
  temporizador.unref?.()
  console.log(`[reloj] prendido: agendas cada 5 min, diario desde las ${HORA_DIARIO_UTC}:00 UTC, semanal los lunes desde las ${HORA_SEMANAL_UTC}:00 UTC`)
  void reloj.tick()
}
