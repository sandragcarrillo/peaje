import 'server-only'
import { PAQUETES_KIT, type PaqueteKit, type UltimasVersionesKit } from '@peaje/shared'

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/**
 * Última versión publicada en npm de @peaje/next y @peaje/proxy, para decirle
 * al dueño si su sitio corre una más vieja. Es la misma para todos los
 * negocios, así que se cachea una hora (Next solo cachea los 200). Si npm no
 * responde o devuelve algo raro, ese paquete queda sin dato y la UI no dice
 * nada: un "actualiza" equivocado es peor que ninguno.
 */
export async function ultimasVersionesKit(): Promise<UltimasVersionesKit> {
  const pares = await Promise.all(
    PAQUETES_KIT.map(async (paquete): Promise<[PaqueteKit, string] | null> => {
      try {
        const res = await fetch(`https://registry.npmjs.org/-/package/${encodeURIComponent(paquete)}/dist-tags`, {
          signal: AbortSignal.timeout(5_000),
          next: { revalidate: 3600 },
        })
        if (!res.ok) return null
        const { latest } = (await res.json()) as { latest?: unknown }
        return typeof latest === 'string' && VERSION.test(latest) ? [paquete, latest] : null
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(pares.filter((p) => p !== null))
}
