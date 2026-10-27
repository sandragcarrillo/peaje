import 'server-only'
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import zlib from 'node:zlib'
import type { EventoSonda, Hallazgo, PasoSonda, Tono } from './sondas-tipos'

/**
 * Sondas rápidas del radar: mientras Ora mide (unos 30 s), el server revisa
 * a mano lo básico del sitio y lo va contando. Todo lo que se cuenta sale de
 * una respuesta real del sitio; lo que no respondió se dice así.
 *
 * Es un fetch a un dominio que escribe cualquiera, así que va cerrado:
 *  - solo http(s), puertos 80/443, sin usuario ni clave en la URL;
 *  - solo el dominio que se pidió y su www (las redirecciones a otro host no se siguen);
 *  - el DNS se valida al conectar (lookup propio): si alguna IP es privada,
 *    de loopback, link-local, CGNAT, multicast o reservada, no se conecta.
 *    Va en el connect y no antes para que un DNS que cambia entre la
 *    validación y la conexión no pueda apuntar adentro;
 *  - timeouts cortos y tope de bytes por respuesta (también descomprimida).
 */

const UA = 'PeajeRadar/1.0 (+https://usepeaje.com/radar)'
const KB = 1024

// ---- guarda SSRF ----

// Una lista por familia: BlockList compara una IPv4 también contra las reglas
// IPv6 de IPv4 mapeadas (::ffff:0:0/96), y con una sola lista toda IPv4 pública
// salía como privada.
const BLOQUEADAS_V4 = new BlockList()
const BLOQUEADAS_V6 = new BlockList()
for (const [red, prefijo] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  BLOQUEADAS_V4.addSubnet(red, prefijo, 'ipv4')
for (const [red, prefijo] of [
  // ::/96 cubre ::, ::1 y las "IPv4 compatibles" viejas.
  ['::', 96],
  // IPv4 dentro de IPv6 (NAT64, 6to4, Teredo): un DNS público no las devuelve y pueden esconder una IP interna.
  // Las mapeadas (::ffff:0:0/96) se cortan aparte, en ipPrivada.
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['2002::', 16],
  ['2001::', 32],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const)
  BLOQUEADAS_V6.addSubnet(red, prefijo, 'ipv6')

/** true si la IP no es pública (o no es una IP): con esas no se conecta. */
export function ipPrivada(ip: string): boolean {
  const limpia = ip.replace(/^\[|\]$/g, '')
  const familia = isIP(limpia)
  if (familia === 4) return BLOQUEADAS_V4.check(limpia, 'ipv4')
  if (familia === 6) {
    // Forma canónica (::ffff:127.0.0.1 → ::ffff:7f00:1) para reconocer las mapeadas en cualquier escritura.
    let canonica = limpia.toLowerCase()
    try {
      canonica = new URL(`http://[${limpia}]/`).hostname.slice(1, -1)
    } catch {
      return true
    }
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(canonica)) return true
    return BLOQUEADAS_V6.check(canonica, 'ipv6')
  }
  return true
}

/** Terminaciones que nunca son un sitio público. */
const TLD_INTERNOS = /\.(localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid|example)$/i

/** El dominio se puede sondear: nombre público con TLD, sin IP literal ni nombres internos. */
export function dominioSondeable(dominio: string): boolean {
  const d = dominio.toLowerCase()
  if (d.length > 200 || isIP(d) || d === 'localhost' || TLD_INTERNOS.test(d)) return false
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)
}

/** Los únicos hosts a los que se le pega: el dominio y su www. */
export function hostsPermitidos(dominio: string): string[] {
  const raiz = dominio.toLowerCase().replace(/^www\./, '')
  return [raiz, `www.${raiz}`]
}

/**
 * La URL si se puede pedir para este dominio; null si no. Solo http(s),
 * puertos por defecto, sin credenciales, y el host tiene que ser el dominio
 * o su www (nunca una IP, localhost ni otro sitio).
 */
export function urlPermitida(entrada: string | URL, dominio: string): URL | null {
  if (!dominioSondeable(dominio)) return null
  let url: URL
  try {
    url = new URL(entrada)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null
  const host = url.hostname.toLowerCase()
  if (isIP(host.replace(/^\[|\]$/g, ''))) return null
  if (!hostsPermitidos(dominio).includes(host)) return null
  url.hash = ''
  return url
}

/** DNS validado en el momento de conectar: si alguna IP no es pública, no hay conexión. */
export function lookupSeguro(
  hostname: string,
  options: LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { ...options, all: true }, (err, direcciones) => {
    if (err) return callback(err, '')
    const lista = direcciones as LookupAddress[]
    if (lista.length === 0 || lista.some((d) => ipPrivada(d.address))) {
      const e: NodeJS.ErrnoException = new Error(`${hostname} no resuelve a una IP pública`)
      e.code = 'EADDRNOTPUBLIC'
      return callback(e, '')
    }
    if (options.all) return callback(null, lista)
    callback(null, lista[0]!.address, lista[0]!.family)
  })
}

// ---- pedidos ----

export type Respuesta = {
  status: number
  headers: http.IncomingHttpHeaders
  cuerpo: Buffer
  truncado: boolean
  url: URL
  /** Redirigió a otro host: no se siguió. */
  fuera?: boolean
}

type Opciones = {
  metodo?: 'GET' | 'POST'
  cuerpo?: string
  cabeceras?: Record<string, string>
  maxBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
}

/** Un pedido, sin seguir redirecciones. Rechaza si no conecta o se pasa del tiempo sin datos. */
function una(url: URL, o: Required<Pick<Opciones, 'metodo' | 'maxBytes' | 'timeoutMs'>> & Opciones): Promise<Respuesta> {
  return new Promise((resolve, reject) => {
    let listo = false
    const partes: Buffer[] = []
    let total = 0
    let truncado = false
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(
      url,
      {
        method: o.metodo,
        headers: {
          'user-agent': UA,
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br',
          ...(o.cuerpo !== undefined ? { 'content-length': String(Buffer.byteLength(o.cuerpo)) } : {}),
          ...o.cabeceras,
        },
        lookup: lookupSeguro,
        agent: false,
        signal: o.signal,
      },
      (res) => {
        const terminar = () => {
          if (listo) return
          listo = true
          clearTimeout(reloj)
          resolve({ status: res.statusCode ?? 0, headers: res.headers, cuerpo: Buffer.concat(partes), truncado, url })
          req.destroy()
        }
        const fallar = (e: Error) => {
          if (listo) return
          // Se cortó a mitad de camino: lo que llegó sirve, marcado como incompleto.
          if (total > 0) {
            truncado = true
            terminar()
            return
          }
          listo = true
          clearTimeout(reloj)
          reject(e)
        }
        const codificacion = String(res.headers['content-encoding'] ?? '').toLowerCase()
        let flujo: NodeJS.ReadableStream = res
        if (codificacion === 'gzip' || codificacion === 'x-gzip') flujo = res.pipe(zlib.createGunzip())
        else if (codificacion === 'deflate') flujo = res.pipe(zlib.createInflate())
        else if (codificacion === 'br') flujo = res.pipe(zlib.createBrotliDecompress())
        flujo.on('data', (b: Buffer) => {
          if (listo) return
          if (total + b.length > o.maxBytes) {
            partes.push(b.subarray(0, o.maxBytes - total))
            total = o.maxBytes
            truncado = true
            terminar()
            return
          }
          partes.push(b)
          total += b.length
        })
        flujo.on('end', terminar)
        flujo.on('error', fallar)
        res.on('error', fallar)
        res.on('close', () => {
          if (!res.complete) fallar(new Error('respuesta cortada'))
        })
      },
    )
    const reloj = setTimeout(() => req.destroy(new Error('timeout')), o.timeoutMs)
    req.on('error', (e) => {
      if (listo) return
      if (total > 0) return // lo resuelve el handler de la respuesta
      listo = true
      clearTimeout(reloj)
      reject(e)
    })
    if (o.cuerpo !== undefined) req.write(o.cuerpo)
    req.end()
  })
}

const REDIRECCIONES = new Set([301, 302, 303, 307, 308])

/**
 * Pide una URL del dominio. Sigue hasta 3 redirecciones si son GET y quedan
 * en el dominio o su www. null si no hubo respuesta (no conecta, timeout,
 * DNS a una IP privada o URL no permitida). Nunca lanza.
 */
export async function pedir(dominio: string, entrada: string | URL, o: Opciones = {}): Promise<Respuesta | null> {
  let url = urlPermitida(entrada, dominio)
  if (!url) return null
  const metodo = o.metodo ?? 'GET'
  const completas = { ...o, metodo, maxBytes: o.maxBytes ?? 256 * KB, timeoutMs: o.timeoutMs ?? 4_000 }
  try {
    for (let salto = 0; salto <= 3; salto++) {
      const r = await una(url, completas)
      const destino = r.headers.location
      if (metodo === 'GET' && REDIRECCIONES.has(r.status) && destino) {
        let siguiente: URL | null = null
        try {
          siguiente = urlPermitida(new URL(destino, url), dominio)
        } catch {
          siguiente = null
        }
        if (!siguiente) return { ...r, fuera: true }
        url = siguiente
        continue
      }
      return r
    }
    return null
  } catch {
    return null
  }
}

// ---- lectura de respuestas ----

const textoDe = (r: Respuesta) => r.cuerpo.toString('utf8')

/** HTML: muchos sitios devuelven su página (200) para cualquier ruta que no existe. */
function esHtml(r: Respuesta): boolean {
  if (/text\/html|application\/xhtml/i.test(String(r.headers['content-type'] ?? ''))) return true
  return /^\s*(<!doctype html|<html|<head|<body)/i.test(r.cuerpo.subarray(0, 512).toString('utf8'))
}

/** si: existe de verdad. no: 404, 410, otro 4xx, HTML en lugar del archivo o redirección afuera. nose: no respondió o respondió 401/403/429/5xx. */
type Presencia = 'si' | 'no' | 'nose'

function presencia(r: Respuesta | null, valido: (r: Respuesta) => boolean): Presencia {
  if (!r) return 'nose'
  if (r.fuera) return 'no'
  if (r.status >= 200 && r.status < 300) return valido(r) ? 'si' : 'no'
  if (r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) return 'nose'
  return 'no'
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function jsonDe(r: Respuesta): unknown {
  if (esHtml(r) || r.truncado) return undefined
  try {
    return JSON.parse(textoDe(r))
  } catch {
    return undefined
  }
}

const textoPlano = (r: Respuesta) => !esHtml(r) && textoDe(r).trim().length > 0

/** Los bots de IA que importan para que te lean. Los nombres son los de su user-agent. */
export const BOTS_IA = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
] as const

type Grupo = { agentes: string[]; reglas: { tipo: 'allow' | 'disallow'; ruta: string }[] }

function gruposDe(robots: string): Grupo[] {
  const grupos: Grupo[] = []
  let actual: Grupo | null = null
  let enReglas = false
  for (const cruda of robots.split(/\r?\n/)) {
    const linea = cruda.replace(/#.*$/, '').trim()
    const i = linea.indexOf(':')
    if (i <= 0) continue
    const clave = linea.slice(0, i).trim().toLowerCase()
    const valor = linea.slice(i + 1).trim()
    if (clave === 'user-agent') {
      if (!actual || enReglas) {
        actual = { agentes: [], reglas: [] }
        grupos.push(actual)
        enReglas = false
      }
      actual.agentes.push(valor.toLowerCase())
    } else if ((clave === 'allow' || clave === 'disallow') && actual) {
      enReglas = true
      if (valor) actual.reglas.push({ tipo: clave, ruta: valor })
    }
  }
  return grupos
}

/**
 * Qué bots de IA no pueden entrar a la página principal según robots.txt
 * (RFC 9309: el grupo con su nombre, si no el de `*`; para la raíz gana
 * Allow si empata). `todos`: los bloquea a todos y por la regla de `*`.
 */
export function bloqueadosPorRobots(robots: string, bots: readonly string[] = BOTS_IA): { bloqueados: string[]; todos: boolean } {
  const grupos = gruposDe(robots)
  const bloqueados: string[] = []
  let porComodin = 0
  for (const bot of bots) {
    const propios = grupos.filter((g) => g.agentes.includes(bot.toLowerCase()))
    const usados = propios.length > 0 ? propios : grupos.filter((g) => g.agentes.includes('*'))
    const reglas = usados.flatMap((g) => g.reglas)
    const cierra = reglas.some((r) => r.tipo === 'disallow' && (r.ruta === '/' || r.ruta === '/*'))
    const abre = reglas.some((r) => r.tipo === 'allow' && (r.ruta === '/' || r.ruta === '/*' || r.ruta === '/$'))
    if (cierra && !abre) {
      bloqueados.push(bot)
      if (propios.length === 0) porComodin++
    }
  }
  return { bloqueados, todos: bloqueados.length === bots.length && porComodin === bots.length }
}

/** Los `Sitemap:` de robots.txt. */
function sitemapsDe(robots: string): string[] {
  return robots
    .split(/\r?\n/)
    .map((l) => /^\s*sitemap\s*:\s*(\S+)/i.exec(l)?.[1])
    .filter((x): x is string => !!x)
}

/** Sitemap leído: urlset (con cuántas páginas, si llegó completo) o índice de sitemaps. */
function leerSitemap(r: Respuesta): { ok: boolean; paginas: number | null } {
  let cuerpo = r.cuerpo
  // .xml.gz servido como binario
  if (cuerpo[0] === 0x1f && cuerpo[1] === 0x8b) {
    try {
      cuerpo = zlib.gunzipSync(cuerpo, { maxOutputLength: 2 * 1024 * KB })
    } catch {
      return { ok: false, paginas: null }
    }
  }
  const xml = cuerpo.toString('utf8')
  if (/<urlset[\s>]/i.test(xml)) {
    return { ok: true, paginas: r.truncado ? null : (xml.match(/<loc[\s>]/gi) ?? []).length || null }
  }
  return { ok: /<sitemapindex[\s>]/i.test(xml), paginas: null }
}

const LD = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi

/** JSON-LD de la página: tipos que declara y si trae precios (Offer, price…). */
export function leerJsonLd(html: string): { bloques: number; validos: number; tipos: string[]; precios: boolean } {
  const tipos = new Set<string>()
  let bloques = 0
  let validos = 0
  let precios = false
  const recorrer = (x: unknown, profundidad: number) => {
    if (profundidad > 12) return
    if (Array.isArray(x)) {
      for (const y of x) recorrer(y, profundidad + 1)
      return
    }
    if (!esObjeto(x)) return
    const t = x['@type']
    for (const tipo of Array.isArray(t) ? t : [t]) {
      if (typeof tipo !== 'string') continue
      const corto = tipo.replace(/^.*[/:#]/, '')
      if (/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(corto)) tipos.add(corto)
      if (/^(Offer|AggregateOffer|PriceSpecification|UnitPriceSpecification)$/.test(corto)) precios = true
    }
    for (const [k, v] of Object.entries(x)) {
      if (/^(offers|price|lowPrice|highPrice|priceSpecification)$/.test(k) && v !== null && v !== '') precios = true
      if (typeof v === 'object') recorrer(v, profundidad + 1)
    }
  }
  for (const m of html.matchAll(LD)) {
    bloques++
    const crudo = (m[1] ?? '').trim().replace(/^<!--|-->$/g, '').replace(/^\/\/<!\[CDATA\[|\/\/\]\]>$/g, '').trim()
    try {
      recorrer(JSON.parse(crudo), 0)
      validos++
    } catch {
      // bloque roto: cuenta como bloque, no como válido
    }
  }
  return { bloques, validos, tipos: [...tipos].slice(0, 3), precios }
}

/** La página principal enlaza una página de precios del mismo sitio. */
export function enlazaPrecios(html: string, dominio: string): boolean {
  const raiz = dominio.replace(/^www\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `href\\s*=\\s*["'](?:https?://(?:www\\.)?${raiz})?/(?:[a-z]{2}(?:-[a-z]{2})?/)?(?:pricing|precios|planes|plans|tarifas|prices)(?:[/?#"'.])`,
    'i',
  )
  return re.test(html)
}

/** ¿Hay alguna operación con respuesta 402 (pago requerido) en el OpenAPI? */
function openapiCobra(doc: Record<string, unknown>): boolean {
  const paths = doc.paths
  if (!esObjeto(paths)) return false
  for (const ops of Object.values(paths)) {
    if (!esObjeto(ops)) continue
    for (const op of Object.values(ops)) {
      if (esObjeto(op) && esObjeto(op.responses) && '402' in op.responses) return true
    }
  }
  return false
}

const esOpenapi = (x: unknown): x is Record<string, unknown> => esObjeto(x) && (typeof x.openapi === 'string' || typeof x.swagger === 'string')

// ---- la ronda ----

const INICIO_MCP = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'peaje-radar', version: '1.0' } },
})

const tonoDe = (p: Presencia): Tono => (p === 'si' ? 'bien' : p === 'no' ? 'falta' : 'nota')
const estadoDe = (p: Presencia) => (p === 'si' ? 'ok' : p === 'no' ? 'falta' : 'nose') as 'ok' | 'falta' | 'nose'

/**
 * Corre las sondas del dominio y va emitiendo eventos: los tres pasos en
 * orden (cada uno con sus sondas en paralelo) y cada hallazgo apenas se sabe.
 * El dominio ya tiene que venir limpio (dominioDeRadar). Nunca lanza.
 */
export async function sondear(dominio: string, emitir: (e: EventoSonda) => void, o: { signal?: AbortSignal } = {}): Promise<void> {
  const hallazgo = (paso: PasoSonda, tono: Tono, h: Hallazgo) => emitir({ tipo: 'hallazgo', paso, tono, hallazgo: h })
  const paso = (p: PasoSonda, estado: 'revisando' | 'listo' | 'sin-datos') => emitir({ tipo: 'paso', paso: p, estado })
  const sinDatosDesde = (desde: number) => {
    for (const p of (['encuentran', 'usan', 'compran'] as const).slice(desde)) paso(p, 'sin-datos')
  }

  if (!dominioSondeable(dominio)) {
    hallazgo('encuentran', 'nota', { id: 'sitio', estado: 'inalcanzable' })
    sinDatosDesde(0)
    return
  }

  const base = `https://${dominio}`
  const get = (ruta: string, extra: Opciones = {}) => pedir(dominio, `${base}${ruta}`, { signal: o.signal, ...extra })

  // La página principal sirve a dos pasos (JSON-LD y precios): sale primero.
  const inicioP = get('/', { maxBytes: 1024 * KB, timeoutMs: 6_000 })

  // 1. ¿Te encuentran?
  paso('encuentran', 'revisando')
  const [inicio, robots, llms] = await Promise.all([inicioP, get('/robots.txt'), get('/llms.txt')])
  if (!inicio && !robots && !llms) {
    hallazgo('encuentran', 'nota', { id: 'sitio', estado: 'inalcanzable' })
    sinDatosDesde(0)
    return
  }
  const inicioHtml = inicio && inicio.status >= 200 && inicio.status < 300 && !inicio.fuera ? textoDe(inicio) : null
  if (inicio && (inicio.status === 401 || inicio.status === 403 || inicio.status === 429)) {
    hallazgo('encuentran', 'nota', { id: 'sitio', estado: 'bloqueado', status: inicio.status })
  }

  // robots.txt: sin archivo (o HTML en su lugar) nada bloquea.
  let robotsTexto: string | null = null
  const pr = presencia(robots, textoPlano)
  if (pr === 'nose') hallazgo('encuentran', 'nota', { id: 'robots', estado: 'nose' })
  else if (pr === 'no') hallazgo('encuentran', 'bien', { id: 'robots', estado: 'sin-archivo' })
  else {
    robotsTexto = textoDe(robots!)
    const { bloqueados, todos } = bloqueadosPorRobots(robotsTexto)
    if (bloqueados.length > 0) hallazgo('encuentran', 'falta', { id: 'robots', estado: 'bloquea', bots: bloqueados, todos, todosIa: bloqueados.length === BOTS_IA.length })
    else hallazgo('encuentran', 'bien', { id: 'robots', estado: 'abierto' })
  }

  const pl = presencia(llms, textoPlano)
  hallazgo('encuentran', tonoDe(pl), { id: 'llms', estado: estadoDe(pl) })

  // Sitemap: el que declara robots.txt (si es de este dominio) o los nombres de siempre.
  const candidatos = [
    ...(robotsTexto ? sitemapsDe(robotsTexto).filter((u) => urlPermitida(u, dominio)).slice(0, 1) : []),
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
  ]
  let sitemap: Hallazgo = { id: 'sitemap', estado: 'falta' }
  let sitemapNose = false
  for (const url of [...new Set(candidatos)].slice(0, 2)) {
    const r = await pedir(dominio, url, { signal: o.signal, maxBytes: 512 * KB })
    const p = presencia(r, (x) => leerSitemap(x).ok)
    if (p === 'si') {
      sitemap = { id: 'sitemap', estado: 'ok', paginas: leerSitemap(r!).paginas }
      sitemapNose = false
      break
    }
    if (p === 'nose') sitemapNose = true
  }
  if (sitemap.estado === 'ok') hallazgo('encuentran', 'bien', sitemap)
  else hallazgo('encuentran', sitemapNose ? 'nota' : 'falta', { id: 'sitemap', estado: sitemapNose ? 'nose' : 'falta' })
  paso('encuentran', 'listo')

  // 2. ¿Te pueden usar?
  paso('usan', 'revisando')
  const ld = inicioHtml ? leerJsonLd(inicioHtml) : null
  if (!ld) hallazgo('usan', 'nota', { id: 'jsonld', estado: 'nose' })
  else if (ld.validos > 0) hallazgo('usan', 'bien', { id: 'jsonld', estado: 'ok', tipos: ld.tipos })
  else if (ld.bloques > 0) hallazgo('usan', 'falta', { id: 'jsonld', estado: 'invalido' })
  else hallazgo('usan', 'falta', { id: 'jsonld', estado: 'falta' })

  let openapiDoc: Record<string, unknown> | null = null
  await Promise.all([
    (async () => {
      const [wk, wkJson, mcp] = await Promise.all([
        get('/.well-known/mcp', { maxBytes: 64 * KB }),
        get('/.well-known/mcp.json', { maxBytes: 64 * KB }),
        get('/mcp', {
          metodo: 'POST',
          cuerpo: INICIO_MCP,
          maxBytes: 64 * KB,
          cabeceras: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        }),
      ])
      const jsonObjeto = (r: Respuesta) => esObjeto(jsonDe(r))
      // Un MCP con OAuth contesta 401 con resource_metadata: existe, aunque pida login.
      const mcpVivo =
        !!mcp &&
        ((mcp.status >= 200 && mcp.status < 300 && /"jsonrpc"/.test(textoDe(mcp)) && /"(result|protocolVersion)"/.test(textoDe(mcp))) ||
          (mcp.status === 401 && /resource_metadata/i.test(String(mcp.headers['www-authenticate'] ?? ''))))
      const ps = [presencia(wk, jsonObjeto), presencia(wkJson, jsonObjeto)]
      const p: Presencia = mcpVivo || ps.includes('si') ? 'si' : ps.every((x) => x === 'nose') && !mcp ? 'nose' : 'no'
      hallazgo('usan', tonoDe(p), { id: 'mcp', estado: estadoDe(p) })
    })(),
    (async () => {
      const rs = await Promise.all([get('/openapi.json', { maxBytes: 512 * KB }), get('/.well-known/openapi.json', { maxBytes: 512 * KB })])
      const ps = rs.map((r) => presencia(r, (x) => esOpenapi(jsonDe(x))))
      const i = ps.indexOf('si')
      if (i >= 0) openapiDoc = jsonDe(rs[i]!) as Record<string, unknown>
      const p: Presencia = i >= 0 ? 'si' : ps.every((x) => x === 'nose') ? 'nose' : 'no'
      hallazgo('usan', tonoDe(p), { id: 'openapi', estado: estadoDe(p) })
    })(),
  ])
  paso('usan', 'listo')

  // 3. ¿Te pueden comprar? Precios que lea un agente y una forma publicada de pagarte.
  paso('compran', 'revisando')
  await Promise.all([
    (async () => {
      const md = await get('/pricing.md')
      const p = presencia(md, textoPlano)
      if (p === 'si') hallazgo('compran', 'bien', { id: 'precios', estado: 'pricing-md' })
      else if (ld?.precios) hallazgo('compran', 'bien', { id: 'precios', estado: 'datos' })
      else if (inicioHtml && enlazaPrecios(inicioHtml, dominio)) hallazgo('compran', 'falta', { id: 'precios', estado: 'pagina' })
      else if (p === 'nose' && !inicioHtml) hallazgo('compran', 'nota', { id: 'precios', estado: 'nose' })
      else hallazgo('compran', 'falta', { id: 'precios', estado: 'falta' })
    })(),
    (async () => {
      const [x402, bazar, ucp] = await Promise.all([
        get('/.well-known/x402', { maxBytes: 128 * KB }),
        get('/discovery/resources', { maxBytes: 256 * KB }),
        get('/.well-known/ucp', { maxBytes: 128 * KB }),
      ])
      const metodos: string[] = []
      const px = presencia(x402, (r) => {
        const j = jsonDe(r)
        return esObjeto(j) || Array.isArray(j)
      })
      const pb = presencia(bazar, (r) => {
        const j = jsonDe(r)
        return esObjeto(j) && (Array.isArray(j.items) || Array.isArray(j.resources))
      })
      const pu = presencia(ucp, (r) => esObjeto(jsonDe(r)))
      if (px === 'si' || pb === 'si') metodos.push('x402')
      if (pu === 'si') metodos.push('UCP')
      const api = openapiDoc as Record<string, unknown> | null
      if (api && openapiCobra(api)) metodos.push('HTTP 402')
      if (metodos.length > 0) hallazgo('compran', 'bien', { id: 'pagos', estado: 'ok', metodos })
      else if ([px, pb, pu].every((p) => p === 'nose')) hallazgo('compran', 'nota', { id: 'pagos', estado: 'nose' })
      else hallazgo('compran', 'falta', { id: 'pagos', estado: 'falta' })
    })(),
  ])
  paso('compran', 'listo')
}
