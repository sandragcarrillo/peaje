/**
 * `peaje verify`: lo que el gateway mide en el dominio del negocio. Los
 * códigos vienen de shared; acá solo se les pone texto.
 */
import type { Chequeo, Motivo } from '@peaje/shared'
import type { Fetch } from './kit'
import { ErrorCli } from './tipos'

export type Verificacion = { domain: string | null; ok: boolean; checks: Chequeo[]; measuredAt: string }

/**
 * Parcial a propósito: shared puede sumar chequeos antes de que este CLI se
 * republique, y un código sin texto se imprime tal cual en vez de romper.
 */
const TEXTOS: Partial<Record<Motivo, string>> = {
  ok: 'ok',
  'sin-dominio': 'the business has no public domain configured in Peaje',
  'proxy-nada': 'none of the proxied paths answer from the gateway: the rewrites are not deployed',
  'proxy-parcial': 'some proxied paths do not answer: a rule is missing or a middleware matcher swallows it',
  'copias-viejas': 'static copies are served by the site instead of the gateway: delete them (peaje clean)',
  'jsonld-falta': 'no JSON-LD WebAPI block on the homepage',
  'links-falta': 'the discovery <link> tags are missing from the homepage',
  'links-sin-home': 'the homepage has no visible link to /developers',
  'robots-falta': 'no robots.txt',
  'robots-bloquea': 'robots.txt blocks the answer-engine bots',
  'bots-bloqueados': 'WAF or bot fight mode blocks search bots',
  'bots-challenge': 'Cloudflare challenge served to search bots',
  'bots-sin-html': 'homepage is an empty shell without JS',
}

const NOMBRES: Partial<Record<Chequeo['id'], string>> = {
  dominio: 'domain',
  proxy: 'proxy rewrites',
  frescura: 'no stale copies',
  'json-ld': 'JSON-LD',
  links: 'head links and footer link',
  robots: 'robots.txt',
  bots: 'answer engine bots can read the site',
}

export async function pedirVerificacion(gateway: string, slug: string, fetchFn: Fetch = fetch): Promise<Verificacion> {
  const url = `${gateway}/${encodeURIComponent(slug)}/kit/verify`
  let res: Response
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(60_000), headers: { accept: 'application/json' } })
  } catch (e) {
    throw new ErrorCli(`Could not reach the Peaje gateway at ${gateway} (${(e as Error).message}).`)
  }
  if (res.status === 404) throw new ErrorCli(`No business with slug "${slug}" at ${gateway}.`)
  if (!res.ok) throw new ErrorCli(`The gateway answered ${res.status} for ${url}.`)
  return (await res.json()) as Verificacion
}

export function lineasVerificacion(v: Verificacion): string[] {
  const lineas: string[] = []
  for (const c of v.checks) {
    const estado = c.ok ? ' ok ' : 'FAIL'
    let detalle = c.ok ? '' : `: ${TEXTOS[c.motivo] ?? c.motivo}`
    if (!c.ok && c.faltantes && c.faltantes.length > 0) {
      const total = c.total ? ` (${c.total - c.faltantes.length}/${c.total})` : ''
      detalle += `${total}\n         ${c.faltantes.join('\n         ')}`
    }
    lineas.push(`  [${estado}] ${NOMBRES[c.id] ?? c.id}${detalle}`)
  }
  return lineas
}

export const RECORDATORIO_VERIFY =
  'Every check is measured on the business domain, not on the gateway. If something fails right after a deploy, wait for the CDN and run again.'

const INTERVALO_MS = 15_000

/** Con `--wait N`: reintenta cada 15 s hasta que todo pase o se agoten los N segundos. */
export async function verificarConEspera(
  gateway: string,
  slug: string,
  esperaSeg: number,
  fetchFn: Fetch = fetch,
  onIntento?: (v: Verificacion, intento: number) => void,
  dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Verificacion> {
  const limite = Date.now() + esperaSeg * 1000
  let intento = 0
  for (;;) {
    intento++
    const v = await pedirVerificacion(gateway, slug, fetchFn)
    onIntento?.(v, intento)
    if (v.ok || Date.now() + INTERVALO_MS > limite) return v
    await dormir(INTERVALO_MS)
  }
}
