/**
 * Qué del kit está realmente publicado en el dominio del negocio.
 *
 * Sin sesión ni diccionario: devuelve códigos, y cada consumidor (dashboard,
 * gateway, CLI) les pone texto. Antes vivía como server action del dashboard y
 * el coding agent tenía que reproducirlo con seis curl y adivinar.
 */
import { PEAJE_VERIFICADOR_HEADER } from './bots'
import { PEAJE_KIT_HEADER } from './rutas'

export type ChequeoId = 'dominio' | 'proxy' | 'frescura' | 'json-ld' | 'links' | 'robots' | 'bots'

export type Motivo =
  | 'ok'
  | 'sin-dominio'
  | 'proxy-nada'
  | 'proxy-parcial'
  | 'copias-viejas'
  | 'jsonld-falta'
  | 'links-falta'
  | 'links-sin-home'
  | 'robots-falta'
  | 'robots-bloquea'
  | 'bots-bloqueados'
  | 'bots-sin-html'
  | 'bots-challenge'

/** Los paquetes del kit que se instalan desde npm. */
export type PaqueteKit = '@peaje/next' | '@peaje/proxy'

export const PAQUETES_KIT: PaqueteKit[] = ['@peaje/next', '@peaje/proxy']

/**
 * Primera versión de cada paquete que manda `x-peaje-kit`. Un proxy que
 * funciona sin el header es anterior a esa, o no usa ningún paquete (reglas
 * pegadas a mano en vercel.json, nginx, Caddy o un Worker).
 */
export const KIT_CON_HEADER: Record<PaqueteKit, string> = { '@peaje/next': '0.3.3', '@peaje/proxy': '0.2.3' }

export type KitInstalado = { paquete: PaqueteKit; version: string }

export type Chequeo = {
  id: ChequeoId
  ok: boolean
  motivo: Motivo
  /** Para el proxy: rutas que no responden. Para frescura: copias que tapan. */
  faltantes?: string[]
  total?: number
  /**
   * Solo en el proxy, y solo si pasa: qué paquete y versión dice servir el
   * dominio. `'anterior'`: responde pero sin `x-peaje-kit`. Sin el campo: no
   * se sabe (proxy caído, o un header que esta versión no entiende).
   */
  kit?: KitInstalado | 'anterior'
}

export type Sonda = { path: string; esperado: number; post?: boolean }

/**
 * Rutas que prueban que el proxy está puesto. No están todas a propósito:
 * estas seis son las que mueven el score, y una lista de veinte vueltas
 * convierte un semáforo en una auditoría.
 */
export const SONDAS_PROXY: Sonda[] = [
  { path: '/.well-known/ard.json', esperado: 200 },
  { path: '/openapi.json', esperado: 200 },
  { path: '/discovery/resources', esperado: 200 },
  { path: '/.well-known/ucp', esperado: 200 },
  { path: '/developers', esperado: 200 },
  { path: '/mcp', esperado: 200, post: true },
]

/**
 * Rutas donde una copia congelada hace más daño. Un 200 no alcanza: la copia
 * también responde 200. Lo que la delata es que no viene del gateway, y eso
 * se ve en la cabecera RateLimit-Policy que el gateway firma en todo.
 */
export const TAPABLES = ['/.well-known/ard.json', '/openapi.json', '/.well-known/api-catalog', '/llms.txt']

export const USER_AGENT_VERIFICADOR = 'peaje-verificador/1.0'

/**
 * Los user-agents reales de los bots que citan. Se prueban tal cual porque
 * los WAF y los "bot fight modes" filtran por esta cadena, y un robots.txt
 * perfecto no sirve si el borde devuelve 403 antes de leerlo.
 */
export const BOTS_UA: { bot: string; ua: string }[] = [
  {
    bot: 'OAI-SearchBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  },
  {
    bot: 'PerplexityBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  },
  {
    bot: 'Googlebot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36',
  },
]

/** Páginas que un motor de respuesta tiene que poder leer: la home y el portal. */
export const PATHS_BOTS = ['/', '/developers'] as const

/** Dominio auditable a partir del originUrl del tenant, o null si es local. */
export function dominioVerificable(originUrl: string): string | null {
  try {
    let host = new URL(originUrl).hostname
    if (host === 'localhost' || host.endsWith('.local') || /^[0-9.]+$/.test(host)) return null
    host = host.replace(/^(www|api|gw|gateway|developers?|docs|data)\./, '')
    return host
  } catch {
    return null
  }
}

/** Fetch que reporta el status, no solo si fue 2xx: un 402 es un éxito acá. */
async function sonda(
  url: string,
  init?: RequestInit,
  userAgent = USER_AGENT_VERIFICADOR,
): Promise<{ status: number; text: string; delGateway: boolean; kit: string | null }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      ...init,
      headers: { 'user-agent': userAgent, ...(init?.headers ?? {}) },
    })
    const text = res.status < 400 ? await res.text() : ''
    return {
      status: res.status,
      text,
      delGateway: res.headers.has('ratelimit-policy'),
      kit: res.headers.get(PEAJE_KIT_HEADER),
    }
  } catch {
    return { status: 0, text: '', delGateway: false, kit: null }
  }
}

const KIT_VALOR = /^(@peaje\/(?:next|proxy))@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

/**
 * `@peaje/next@0.3.3` → paquete y versión. Si dos capas lo ponen, `get` los
 * junta con coma: vale el primero que se entienda.
 */
export function parsearKit(valor: string | null | undefined): KitInstalado | null {
  for (const parte of (valor ?? '').split(',')) {
    const m = KIT_VALOR.exec(parte.trim())
    if (m) return { paquete: m[1] as PaqueteKit, version: m[2] as string }
  }
  return null
}

/**
 * El kit que dice servir el dominio, con los `x-peaje-kit` de las sondas del
 * proxy que respondieron. Ninguno: `'anterior'`. Uno que no se entiende es de
 * un paquete más nuevo que esta verificación: sin dato, nunca "anterior".
 */
export function kitDeSondas(valores: (string | null)[]): KitInstalado | 'anterior' | undefined {
  for (const v of valores) {
    const kit = parsearKit(v)
    if (kit) return kit
  }
  return valores.some((v) => (v ?? '').trim() !== '') ? undefined : 'anterior'
}

function partirVersion(v: string): { nums: number[]; pre: string } {
  const sinBuild = v.trim().replace(/^v/, '').split('+')[0] ?? ''
  const guion = sinBuild.indexOf('-')
  const nucleo = guion === -1 ? sinBuild : sinBuild.slice(0, guion)
  return {
    nums: nucleo.split('.').map((n) => Number.parseInt(n, 10) || 0),
    pre: guion === -1 ? '' : sinBuild.slice(guion + 1),
  }
}

/** Orden de `x.y.z`: negativo si `a` es anterior. Una prerelease va antes que su versión. */
export function compararVersiones(a: string, b: string): number {
  const x = partirVersion(a)
  const y = partirVersion(b)
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0)
    if (d !== 0) return Math.sign(d)
  }
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

/** Última versión publicada de cada paquete; el que falta es que npm no respondió. */
export type UltimasVersionesKit = Partial<Record<PaqueteKit, string>>

export type EstadoVersionKit =
  | { tipo: 'al-dia'; paquete: PaqueteKit; version: string }
  | { tipo: 'nueva'; paquete: PaqueteKit; version: string; ultima: string }
  /** Se sabe la instalada pero no hay con qué compararla: solo se muestra. */
  | { tipo: 'instalada'; paquete: PaqueteKit; version: string }
  /** Sin header: si el sitio usa alguno de estos paquetes, hay una más nueva. */
  | { tipo: 'anterior'; nuevas: { paquete: PaqueteKit; ultima: string }[] }

/**
 * Qué decirle al dueño sobre la versión del kit. Antes que un "actualiza"
 * equivocado, nada: sin la última de npm no se compara, y una instalada más
 * nueva que la última (cache de npm) se muestra sin juicio. Para un sitio sin
 * header solo cuentan los paquetes cuya última ya lo manda: si npm todavía
 * tiene la anterior, ese sitio puede estar al día.
 */
export function estadoVersionKit(
  kit: KitInstalado | 'anterior' | undefined,
  ultimas: UltimasVersionesKit,
): EstadoVersionKit | null {
  if (!kit) return null
  if (kit === 'anterior') {
    const nuevas = PAQUETES_KIT.flatMap((paquete) => {
      const ultima = ultimas[paquete]
      return ultima && compararVersiones(ultima, KIT_CON_HEADER[paquete]) >= 0 ? [{ paquete, ultima }] : []
    })
    return nuevas.length > 0 ? { tipo: 'anterior', nuevas } : null
  }
  const ultima = ultimas[kit.paquete]
  if (!ultima) return { tipo: 'instalada', ...kit }
  const orden = compararVersiones(kit.version, ultima)
  if (orden < 0) return { tipo: 'nueva', ...kit, ultima }
  return orden === 0 ? { tipo: 'al-dia', ...kit } : { tipo: 'instalada', ...kit }
}

const BLOQUEA_TODO = /^Disallow:\s*\/\s*$/m

type SondaBot = { bot: string; path: string; status: number; challenge: boolean; sinHtml: boolean }

/**
 * GET con el UA de un bot. Lee headers y cuerpo aunque sea 4xx/5xx: el
 * challenge de Cloudflare llega como 403 con `cf-mitigated: challenge` y un
 * HTML que dice "Just a moment". Solo la home se juzga por `<title`/`<h1`:
 * un 200 sin ninguno de los dos es el shell de una SPA que espera JS, y los
 * motores no lo ejecutan.
 */
async function sondaBot(site: string, bot: string, ua: string, path: string): Promise<SondaBot> {
  try {
    const res = await fetch(`${site}${path}`, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
      // El header avisa que es una sonda: con el UA del bot, el kit la contaría como visita.
      headers: { 'user-agent': ua, accept: 'text/html,*/*', [PEAJE_VERIFICADOR_HEADER]: '1' },
    })
    const text = (await res.text()).slice(0, 200_000)
    const challenge =
      (res.headers.get('cf-mitigated') ?? '').toLowerCase() === 'challenge' || /just a moment/i.test(text)
    const sinHtml = path === '/' && res.status === 200 && !/<title[\s>]/i.test(text) && !/<h1[\s>]/i.test(text)
    return { bot, path, status: res.status, challenge, sinHtml }
  } catch {
    // Red o timeout: no es evidencia de bloqueo, no se cuenta.
    return { bot, path, status: 0, challenge: false, sinHtml: false }
  }
}

const STATUS_BLOQUEO = new Set([403, 429, 503])

/**
 * Un solo chequeo para los seis GET: qué falló manda el motivo, en orden de
 * gravedad (bloqueado > challenge > shell sin HTML). `faltantes` lista cada
 * caso como "<bot> <path> <status|challenge|sin-html>".
 */
export function evaluarBots(sondas: SondaBot[]): Chequeo {
  const faltantes: string[] = []
  let motivo: Motivo = 'ok'
  const peor = (m: Motivo) => {
    const orden: Motivo[] = ['ok', 'bots-sin-html', 'bots-challenge', 'bots-bloqueados']
    if (orden.indexOf(m) > orden.indexOf(motivo)) motivo = m
  }
  for (const s of sondas) {
    if (s.challenge) {
      faltantes.push(`${s.bot} ${s.path} challenge`)
      peor('bots-challenge')
    } else if (STATUS_BLOQUEO.has(s.status)) {
      faltantes.push(`${s.bot} ${s.path} ${s.status}`)
      peor('bots-bloqueados')
    } else if (s.sinHtml) {
      faltantes.push(`${s.bot} ${s.path} sin-html`)
      peor('bots-sin-html')
    }
  }
  return { id: 'bots', ok: faltantes.length === 0, motivo, faltantes, total: sondas.length }
}

export async function verificarIntegracion(originUrl: string): Promise<Chequeo[]> {
  const domain = dominioVerificable(originUrl)
  if (!domain) return [{ id: 'dominio', ok: false, motivo: 'sin-dominio' }]

  const site = `https://${domain}`

  const [proxy, frescura, home, robots, bots] = await Promise.all([
    Promise.all(
      SONDAS_PROXY.map(async (s) => {
        const r = await sonda(
          `${site}${s.path}`,
          s.post
            ? {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  accept: 'application/json, text/event-stream',
                },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
              }
            : undefined,
        )
        return { path: s.path, ok: r.status === s.esperado, kit: r.kit }
      }),
    ),
    Promise.all(
      TAPABLES.map(async (path) => {
        const r = await sonda(`${site}${path}`)
        // Un 404 no es una copia: eso lo reporta el chequeo del proxy.
        return { path, vieja: r.status === 200 && !r.delGateway }
      }),
    ),
    sonda(site),
    sonda(`${site}/robots.txt`),
    Promise.all(BOTS_UA.flatMap((b) => PATHS_BOTS.map((path) => sondaBot(site, b.bot, b.ua, path)))),
  ])

  const faltantes = proxy.filter((p) => !p.ok).map((p) => p.path)
  // La versión sale de las mismas sondas: todas son rutas que el proxy reenvía.
  const kit = faltantes.length === 0 ? kitDeSondas(proxy.map((p) => p.kit)) : undefined
  const viejas = frescura.filter((f) => f.vieja).map((f) => f.path)
  const html = home.text
  const tieneJsonLd = html.includes('application/ld+json')
  // `service-desc` es la relación registrada; la vieja `payment-discovery`
  // sigue contando para no marcar en rojo a quien aplicó la versión anterior.
  const tieneLinks = html.includes('rel="service-desc"') || html.includes('payment-discovery')

  return [
    {
      id: 'proxy',
      ok: faltantes.length === 0,
      motivo:
        faltantes.length === 0 ? 'ok' : faltantes.length === SONDAS_PROXY.length ? 'proxy-nada' : 'proxy-parcial',
      faltantes,
      total: SONDAS_PROXY.length,
      ...(kit ? { kit } : {}),
    },
    { id: 'frescura', ok: viejas.length === 0, motivo: viejas.length === 0 ? 'ok' : 'copias-viejas', faltantes: viejas },
    { id: 'json-ld', ok: tieneJsonLd, motivo: tieneJsonLd ? 'ok' : 'jsonld-falta' },
    {
      id: 'links',
      ok: tieneLinks,
      motivo: tieneLinks ? 'ok' : home.status === 200 ? 'links-falta' : 'links-sin-home',
    },
    {
      id: 'robots',
      ok: robots.status === 200 && !BLOQUEA_TODO.test(robots.text),
      motivo: robots.status !== 200 ? 'robots-falta' : BLOQUEA_TODO.test(robots.text) ? 'robots-bloquea' : 'ok',
    },
    evaluarBots(bots),
  ]
}
