/**
 * Qué del kit está realmente publicado en el dominio del negocio.
 *
 * Sin sesión ni diccionario: devuelve códigos, y cada consumidor (dashboard,
 * gateway, CLI) les pone texto. Antes vivía como server action del dashboard y
 * el coding agent tenía que reproducirlo con seis curl y adivinar.
 */

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

export type Chequeo = {
  id: ChequeoId
  ok: boolean
  motivo: Motivo
  /** Para el proxy: rutas que no responden. Para frescura: copias que tapan. */
  faltantes?: string[]
  total?: number
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
): Promise<{ status: number; text: string; delGateway: boolean }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      ...init,
      headers: { 'user-agent': userAgent, ...(init?.headers ?? {}) },
    })
    const text = res.status < 400 ? await res.text() : ''
    return { status: res.status, text, delGateway: res.headers.has('ratelimit-policy') }
  } catch {
    return { status: 0, text: '', delGateway: false }
  }
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
      headers: { 'user-agent': ua, accept: 'text/html,*/*' },
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
      SONDAS_PROXY.map(async (s) => ({
        path: s.path,
        ok:
          (
            await sonda(
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
          ).status === s.esperado,
      })),
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
