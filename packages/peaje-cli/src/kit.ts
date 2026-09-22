/**
 * Descarga del kit. Inyectable para que los tests no dependan de red y para
 * que un agente pueda servirlo desde un archivo si hace falta.
 */
import { ErrorCli, type Host, type Kit } from './tipos'

export const GATEWAY_POR_DEFECTO = 'https://peaje-gateway.up.railway.app'

export type Fetch = typeof fetch

export function gatewayDe(flag: string | undefined): string {
  return (flag ?? process.env.PEAJE_GATEWAY_URL ?? GATEWAY_POR_DEFECTO).replace(/\/+$/, '')
}

export function urlKit(gateway: string, slug: string, host: Host | null): string {
  const q = new URLSearchParams({ all: '1' })
  if (host) q.set('host', host)
  return `${gateway}/${encodeURIComponent(slug)}/kit.json?${q}`
}

export type DescargarKit = (gateway: string, slug: string, host: Host | null) => Promise<Kit>

export function descargarKitCon(fetchFn: Fetch = fetch): DescargarKit {
  return async (gateway, slug, host) => {
    const url = urlKit(gateway, slug, host)
    let res: Response
    try {
      res = await fetchFn(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } })
    } catch (e) {
      throw new ErrorCli(
        `Could not reach the Peaje gateway at ${gateway} (${(e as Error).message}). Check your network or pass --gateway <url>.`,
      )
    }
    if (res.status === 404) {
      throw new ErrorCli(`No business with slug "${slug}" at ${gateway}. The slug is the one shown in your Peaje dashboard.`)
    }
    if (!res.ok) throw new ErrorCli(`The gateway answered ${res.status} for ${url}.`)
    const kit = (await res.json()) as Partial<Kit>
    if (!Array.isArray(kit.files) || typeof kit.gateway !== 'string') {
      throw new ErrorCli(`Unexpected kit.json shape from ${url}. Update the CLI: npx peaje@1.`)
    }
    return { remove: [], manual: [], paidPath: null, ...kit } as Kit
  }
}

export const descargarKit: DescargarKit = descargarKitCon()
