/**
 * Las tareas que el agente de Peaje deja para el coding agent del dueño.
 *   peaje tasks                lista las abiertas
 *   peaje task <id>            el prompt completo, para ejecutarlo en este repo
 *   peaje done <id> [--url u]  la marca hecha; Peaje la verifica en el sitio en vivo
 * Autenticación: la clave del agente (dashboard, "My agent"), en --key o PEAJE_AGENT_KEY.
 */
import { ErrorCli } from './tipos'

export type TareaResumen = { id: string; kind: string; title: string; summary: string; status: string; note: string | null; doneUrl: string | null }
export type TareaCompleta = TareaResumen & { prompt: string; acceptance: unknown[] }

export function claveDe(flag: string | undefined): string {
  const clave = flag ?? process.env.PEAJE_AGENT_KEY
  if (!clave) {
    throw new ErrorCli('Missing the agent key. Create it in the Peaje dashboard ("My agent") and pass --key <key> or set PEAJE_AGENT_KEY.')
  }
  return clave
}

async function llamar<T>(gateway: string, clave: string, path: string, init?: RequestInit, f: typeof fetch = fetch): Promise<T> {
  let res: Response
  try {
    res = await f(`${gateway}/_owner${path}`, {
      ...init,
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    throw new ErrorCli(`Could not reach the Peaje gateway at ${gateway}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (res.status === 401) throw new ErrorCli('The agent key was rejected. Create a new one in the Peaje dashboard ("My agent").')
  if (!res.ok) throw new ErrorCli(data.error ?? `Gateway answered ${res.status}`)
  return data
}

export function listarTareas(gateway: string, clave: string, estado?: string, f?: typeof fetch) {
  return llamar<{ business: string; tasks: TareaResumen[] }>(gateway, clave, `/tasks${estado ? `?status=${encodeURIComponent(estado)}` : ''}`, undefined, f)
}

export function verTarea(gateway: string, clave: string, id: string, f?: typeof fetch) {
  return llamar<{ task: TareaCompleta }>(gateway, clave, `/tasks/${encodeURIComponent(id)}`, undefined, f)
}

export function marcarHecha(gateway: string, clave: string, id: string, url?: string, f?: typeof fetch) {
  return llamar<{ task: TareaResumen }>(gateway, clave, `/tasks/${encodeURIComponent(id)}/done`, { method: 'POST', body: JSON.stringify(url ? { url } : {}) }, f)
}

const ESTADO: Record<string, string> = {
  open: 'open',
  in_progress: 'in progress',
  done: 'done, waiting for Peaje to verify it live',
  verified: 'verified',
  dismissed: 'dismissed',
}

export function lineasTareas(r: { business: string; tasks: TareaResumen[] }): string[] {
  if (r.tasks.length === 0) return [`No open tasks for ${r.business}.`]
  return [
    `${r.tasks.length} task(s) for ${r.business}:`,
    '',
    ...r.tasks.flatMap((t) => [`  ${t.id}  [${t.kind}] ${t.title}`, `      ${ESTADO[t.status] ?? t.status}${t.note ? ` · ${t.note}` : ''}`]),
    '',
    'Read one with `peaje task <id>`, implement it in this repo, deploy, then `peaje done <id> --url <live url>`.',
  ]
}
