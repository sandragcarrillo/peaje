import type { AgentTask, Tenant } from '@peaje/db'
import { verificarIntegracion } from '@peaje/shared'
import { agendarSeguimientos } from '../ciclo/seguimiento.js'

/** La nota de una tarea que Peaje no puede revisar en el sitio del dueño. */
export const SIN_CRITERIOS = 'Marked done. Peaje cannot check this one on the live site.'

/** Las tareas de "que te nombren": pasan fuera del sitio del dueño. */
export const esMencion = (t: Pick<AgentTask, 'key'>) => t.key.startsWith('content:mention:')

/**
 * Revisa los criterios de aceptación de una tarea contra el sitio en vivo.
 * `url` (la que el coding agent reporta al marcarla hecha) reemplaza la URL
 * del primer criterio de tipo url: el agente pudo elegir otro slug.
 */
export async function verificarTarea(tenant: Tenant, task: AgentTask, url?: string | null): Promise<{ ok: boolean; note: string }> {
  // Sin criterios (pedir una mención en un sitio ajeno): Peaje no tiene qué abrir. Vale la palabra del dueño, y la nota lo dice.
  if (task.acceptance.length === 0) return { ok: true, note: SIN_CRITERIOS }
  const fallas: string[] = []
  let urlUsada = false
  let chequeos: Awaited<ReturnType<typeof verificarIntegracion>> | null = null

  for (const c of task.acceptance) {
    if (c.type === 'check') {
      chequeos ??= await verificarIntegracion(tenant.originUrl)
      const ch = chequeos.find((x) => x.id === c.id)
      if (!ch?.ok) fallas.push(`check "${c.id}" still fails${ch?.motivo ? ` (${ch.motivo})` : ''}`)
      continue
    }
    const destino = !urlUsada && url ? url : c.url
    urlUsada = true
    try {
      const res = await fetch(destino, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'peaje-verificador/1.0' } })
      if (c.notStatus !== undefined ? res.status === c.notStatus : res.status >= 400) {
        fallas.push(`${destino} answers ${res.status}`)
        continue
      }
      if (c.contains) {
        const texto = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase()
        if (!texto.includes(c.contains.toLowerCase())) fallas.push(`${destino} does not contain "${c.contains}"`)
      }
    } catch (error) {
      fallas.push(`${destino} did not answer (${error instanceof Error ? error.message : String(error)})`)
    }
  }
  return fallas.length === 0 ? { ok: true, note: 'All acceptance checks pass on the live site.' } : { ok: false, note: fallas.join('; ') }
}

/**
 * Marca una tarea hecha y la verifica en el acto. Si todavía no pasa (el
 * deploy no terminó), queda en `done` con la nota y el monitor diario la
 * vuelve a revisar.
 */
export async function completarTarea(tenant: Tenant, task: AgentTask, url: string | null, store: { updateTask: (t: string, id: string, p: Partial<AgentTask>) => Promise<AgentTask> }) {
  const ahora = new Date().toISOString()
  const r = await verificarTarea(tenant, task, url)
  const actualizada = await store.updateTask(tenant.id, task.id, {
    status: r.ok ? 'verified' : 'done',
    note: r.ok ? r.note : `Not live yet: ${r.note}. Peaje checks again every day.`,
    doneUrl: url ?? task.doneUrl,
    doneAt: task.doneAt ?? ahora,
    verifiedAt: r.ok ? ahora : null,
  })
  // Ciclo cerrado: al quedar verificada, re-medir a las 2 y 6 semanas (idempotente).
  // Las de mención no: el seguimiento toma el título como pregunta a medir, y el de estas no es una pregunta.
  if (r.ok && !esMencion(task)) await agendarSeguimientos(tenant, actualizada)
  return actualizada
}
