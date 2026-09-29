import type { Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'

/**
 * Acceso y frescura, lo que decide si un asistente de IA puede leer y citar
 * el sitio:
 *   1. robots.txt bot por bot, separando los que responden (ChatGPT search,
 *      Perplexity, Claude search, Google, Bing) de los que solo entrenan.
 *      Bloquear entrenamiento no afecta recomendaciones; bloquear a los que
 *      responden, sí.
 *   2. El borde: entrar a la home con el user-agent de cada bot que responde.
 *      El toggle "Block AI bots" de Cloudflare bloquea a los dos tipos.
 *   3. Frescura: fecha visible o lastmod en las páginas clave. Las páginas
 *      citadas son en promedio más nuevas; sin fecha legible pesan menos.
 */

export type Proposito = 'answers' | 'training' | 'user-fetch'

export const BOTS: { bot: string; producto: string; proposito: Proposito; ua: string }[] = [
  { bot: 'OAI-SearchBot', producto: 'ChatGPT search', proposito: 'answers', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot' },
  { bot: 'ChatGPT-User', producto: 'ChatGPT (when a user asks it to open a page)', proposito: 'user-fetch', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' },
  { bot: 'GPTBot', producto: 'OpenAI model training', proposito: 'training', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot' },
  { bot: 'PerplexityBot', producto: 'Perplexity', proposito: 'answers', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
  { bot: 'Claude-SearchBot', producto: 'Claude search', proposito: 'answers', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)' },
  { bot: 'Claude-User', producto: 'Claude (when a user asks it to open a page)', proposito: 'user-fetch', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://www.anthropic.com)' },
  { bot: 'ClaudeBot', producto: 'Anthropic model training', proposito: 'training', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  { bot: 'Googlebot', producto: 'Google search and AI Overviews', proposito: 'answers', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.0.0 Safari/537.36' },
  { bot: 'bingbot', producto: 'Bing, which ChatGPT search leans on', proposito: 'answers', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/130.0.0.0 Safari/537.36' },
]

export type EstadoBot = {
  bot: string
  producto: string
  proposito: Proposito
  /** robots.txt deja leer la home. */
  robotsPermite: boolean
  /** La línea de robots.txt que decide, si alguna lo hace. */
  robotsRegla: string | null
  /** Status al entrar con su user-agent (solo los que responden o leen por un usuario). */
  status: number | null
  challenge: boolean
}

export type PaginaFresca = { url: string; fecha: string | null; fuente: 'visible' | 'meta' | 'sitemap' | null; dias: number | null; vieja: boolean }

export type Acceso = {
  dominio: string
  bots: EstadoBot[]
  /** Bots que responden bloqueados por robots o por el borde: lo grave. */
  bloqueados: { bot: string; producto: string; por: 'robots' | 'firewall' }[]
  sitemap: { encontrado: boolean; urls: number }
  paginas: PaginaFresca[]
  revisadoEn: string
}

const UA_NAVEGADOR = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const UN_ANIO_MS = 365 * 86_400_000

async function traer(url: string, ua = UA_NAVEGADOR): Promise<{ status: number; texto: string; challenge: boolean }> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8_000), headers: { 'user-agent': ua, accept: 'text/html,application/xml,*/*' } })
    const texto = (await res.text()).slice(0, 300_000)
    const challenge = (res.headers.get('cf-mitigated') ?? '').toLowerCase() === 'challenge' || /just a moment\.\.\./i.test(texto)
    return { status: res.status, texto, challenge }
  } catch {
    return { status: 0, texto: '', challenge: false }
  }
}

/**
 * ¿robots.txt deja a este bot leer `path`? Gana el grupo cuyo User-agent
 * nombra al bot; si ninguno lo hace, el de `*`. Dentro del grupo gana la
 * regla más larga que matchee, y Allow sobre Disallow en empate.
 */
export function robotsPermite(robots: string, bot: string, path = '/'): { permite: boolean; regla: string | null } {
  const grupos: { agentes: string[]; reglas: { tipo: 'allow' | 'disallow'; ruta: string; linea: string }[] }[] = []
  let actual: (typeof grupos)[number] | null = null
  let leyendoAgentes = false
  for (const cruda of robots.split(/\r?\n/)) {
    const linea = cruda.replace(/#.*/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linea)
    if (!m) continue
    const campo = m[1]!.toLowerCase()
    const valor = m[2]!.trim()
    if (campo === 'user-agent') {
      if (!actual || !leyendoAgentes) {
        actual = { agentes: [], reglas: [] }
        grupos.push(actual)
      }
      actual.agentes.push(valor.toLowerCase())
      leyendoAgentes = true
    } else if ((campo === 'allow' || campo === 'disallow') && actual) {
      leyendoAgentes = false
      if (campo === 'disallow' && valor === '') continue
      actual.reglas.push({ tipo: campo, ruta: valor, linea: `${m[1]}: ${valor}` })
    } else {
      leyendoAgentes = false
    }
  }
  const b = bot.toLowerCase()
  const grupo = grupos.find((g) => g.agentes.some((a) => a !== '*' && b.includes(a))) ?? grupos.find((g) => g.agentes.includes('*'))
  if (!grupo) return { permite: true, regla: null }
  const matchea = (ruta: string) => {
    const patron = ruta.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    return new RegExp(`^${patron.endsWith('\\$') ? patron.slice(0, -2) + '$' : patron}`).test(path)
  }
  const aplicables = grupo.reglas.filter((r) => matchea(r.ruta)).sort((x, y) => y.ruta.length - x.ruta.length || (x.tipo === 'allow' ? -1 : 1))
  const decide = aplicables[0]
  return { permite: !decide || decide.tipo === 'allow', regla: decide ? `User-agent: ${grupo.agentes.join(', ')} → ${decide.linea}` : null }
}

/** La fecha más nueva que un lector (o un modelo) puede ver en la página. */
export function fechaDePagina(html: string): { fecha: string; fuente: 'visible' | 'meta' } | null {
  const meta = /<meta[^>]+(?:property|name)=["'](?:article:modified_time|og:updated_time|last-modified|dateModified)["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1]
  const ld = /"dateModified"\s*:\s*"([^"]+)"/i.exec(html)?.[1]
  const times = [...html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi)].map((m) => m[1]!)
  const texto = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  const visibles = [...texto.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map((m) => m[0])
  const MESES = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic'
  for (const m of texto.matchAll(new RegExp(`\\b(\\d{1,2})?\\s*(${MESES})[a-z]*\\.?\\s+(\\d{1,2},?\\s+)?(20\\d{2})\\b`, 'gi'))) {
    const d = new Date(`${m[2]} ${m[1] ?? m[3] ?? '1'} ${m[4]}`.replace(/,/g, ''))
    if (!Number.isNaN(d.getTime())) visibles.push(d.toISOString().slice(0, 10))
  }
  const validas = (xs: string[]) => xs.map((x) => new Date(x)).filter((d) => !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 86_400_000)
  const visible = [...validas(times), ...validas(visibles)].sort((a, b) => b.getTime() - a.getTime())[0]
  if (visible) return { fecha: visible.toISOString().slice(0, 10), fuente: 'visible' }
  const metaFecha = validas([meta, ld].filter((x): x is string => !!x)).sort((a, b) => b.getTime() - a.getTime())[0]
  return metaFecha ? { fecha: metaFecha.toISOString().slice(0, 10), fuente: 'meta' } : null
}

async function leerSitemap(sitio: string): Promise<{ encontrado: boolean; urls: { loc: string; lastmod: string | null }[] }> {
  const primero = await traer(`${sitio}/sitemap.xml`)
  if (primero.status !== 200 || !/<(urlset|sitemapindex)/i.test(primero.texto)) return { encontrado: false, urls: [] }
  let xml = primero.texto
  if (/<sitemapindex/i.test(xml)) {
    const hijo = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(xml)?.[1]
    xml = hijo ? (await traer(hijo)).texto : ''
  }
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => ({
    loc: /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(m[1]!)?.[1] ?? '',
    lastmod: /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(m[1]!)?.[1] ?? null,
  }))
  return { encontrado: true, urls: urls.filter((u) => u.loc) }
}

export async function revisarAcceso(tenant: Tenant): Promise<Acceso | null> {
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) return null
  const sitio = `https://${dominio}`
  const [robots, normal] = await Promise.all([traer(`${sitio}/robots.txt`), traer(`${sitio}/`)])
  const robotsTxt = robots.status === 200 && !/<html/i.test(robots.texto) ? robots.texto : ''

  const bots: EstadoBot[] = await Promise.all(
    BOTS.map(async (b) => {
      const r = robotsPermite(robotsTxt, b.bot, '/')
      // Solo se entra con los que leen para responder: los de entrenamiento no importan acá.
      const sonda = b.proposito === 'training' ? null : await traer(`${sitio}/`, b.ua)
      return { bot: b.bot, producto: b.producto, proposito: b.proposito, robotsPermite: r.permite, robotsRegla: r.regla, status: sonda?.status ?? null, challenge: sonda?.challenge ?? false }
    }),
  )

  const sitioResponde = normal.status > 0 && normal.status < 400
  const bloqueados: Acceso['bloqueados'] = []
  for (const b of bots) {
    if (b.proposito !== 'answers') continue
    if (!b.robotsPermite) bloqueados.push({ bot: b.bot, producto: b.producto, por: 'robots' })
    else if (sitioResponde && (b.challenge || b.status === 403 || b.status === 429 || b.status === 503)) bloqueados.push({ bot: b.bot, producto: b.producto, por: 'firewall' })
  }

  // Frescura: la home y hasta 7 páginas del sitemap, las de ruta más corta primero.
  const sm = await leerSitemap(sitio)
  // Legales, cuentas y carrito no son páginas que un asistente vaya a citar.
  const NO_CONTENIDO = /\/(terms|privacy|legal|cookies?|login|signin|signup|register|account|cart|checkout|terminos|privacidad|politica|aviso-legal)(\/|$)/i
  const candidatas = sm.urls
    .filter((u) => dominioVerificable(u.loc) === dominio && !/\.(xml|pdf|jpg|png)$/i.test(u.loc) && !NO_CONTENIDO.test(new URL(u.loc).pathname))
    .sort((a, b) => new URL(a.loc).pathname.length - new URL(b.loc).pathname.length)
    .slice(0, 8)
  const paginas: PaginaFresca[] = await Promise.all(
    [{ loc: `${sitio}/`, lastmod: null as string | null }, ...candidatas.filter((u) => new URL(u.loc).pathname !== '/')].slice(0, 8).map(async (u) => {
      const html = u.loc === `${sitio}/` ? normal.texto : (await traer(u.loc)).texto
      const f = html ? fechaDePagina(html) : null
      const fecha = f?.fecha ?? (u.lastmod ? u.lastmod.slice(0, 10) : null)
      const fuente = f?.fuente ?? (u.lastmod ? 'sitemap' : null)
      const dias = fecha ? Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000) : null
      // La home no se juzga: sus fechas suelen ser de novedades, no de la página.
      const esHome = new URL(u.loc).pathname === '/'
      return { url: u.loc, fecha, fuente, dias, vieja: !esHome && (fecha === null || Date.now() - new Date(fecha).getTime() > UN_ANIO_MS) }
    }),
  )

  return { dominio, bots, bloqueados, sitemap: { encontrado: sm.encontrado, urls: sm.urls.length }, paginas, revisadoEn: new Date().toISOString() }
}
