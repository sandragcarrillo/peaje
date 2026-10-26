/**
 * HTML a markdown legible, para las tools MCP de links (mcp.ts). Un agente
 * que paga por un artículo necesita el texto, no 30 KB de clases de Tailwind,
 * scripts y el menú del sitio.
 *
 * Sin dependencias: un parser tolerante (no valida, cierra lo obvio: p, li,
 * td, tr) y un renderer que saca título, encabezados, párrafos, listas,
 * tablas, citas, código y links como `[texto](url absoluta)`. Descarta
 * scripts, estilos, formularios, lo oculto y el ruido de navegación que se
 * puede detectar sin adivinar: <nav>, <aside>, <footer>, el <header> del
 * sitio y los roles ARIA equivalentes. Si la página tiene <main> (o un solo
 * <article>) se queda con eso.
 *
 * JSON, texto, markdown y lo demás pasan tal cual (ver `legible`).
 */

type Nodo = { tag: string; attrs: Record<string, string>; hijos: Hijo[] }
type Hijo = Nodo | string

/** Sin etiqueta de cierre. */
const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'keygen'])
/** Lo de adentro es texto, no HTML (un `<` en un script no abre nada). */
const CRUDOS = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'xmp', 'iframe', 'noembed', 'noframes'])
/** Se descartan enteros, con todo lo que tengan adentro. */
const FUERA = new Set([
  'head', 'title', 'meta', 'link', 'base', 'script', 'style', 'noscript', 'template', 'iframe', 'noembed', 'noframes', 'svg', 'math', 'canvas', 'object', 'embed',
  'button', 'select', 'input', 'textarea', 'option', 'optgroup', 'datalist', 'dialog', 'video', 'audio', 'map', 'nav', 'aside', 'footer',
])
/** Roles ARIA de navegación, cabecera y pie del sitio, y ventanas. */
const ROLES_FUERA = new Set(['navigation', 'banner', 'contentinfo', 'complementary', 'search', 'dialog', 'alertdialog', 'menu', 'menubar', 'toolbar'])
/** Elementos de bloque: cortan el párrafo en curso. */
const BLOQUES = new Set([
  'address', 'article', 'blockquote', 'body', 'caption', 'center', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'html', 'legend', 'li', 'main', 'menu', 'ol', 'p', 'pre', 'section', 'summary',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', '#raiz',
])
/** Abrir uno de estos cierra un <p> abierto (como hace el navegador). */
const CIERRAN_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul',
])

// ---------------------------------------------------------------- entidades

// Latin-1, de U+00A0 a U+00FF, en orden.
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ' +
  'ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring ' +
  'aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc ' +
  'uuml yacute thorn yuml'

export const ENTIDADES: Record<string, string> = {
  ...Object.fromEntries(LATIN1.split(' ').map((nombre, i) => [nombre, String.fromCharCode(0xa0 + i)])),
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201a', ldquo: '\u201c', rdquo: '\u201d',
  bdquo: '\u201e', bull: '\u2022', trade: '\u2122', euro: '\u20ac', larr: '\u2190', rarr: '\u2192', uarr: '\u2191', darr: '\u2193',
  harr: '\u2194', thinsp: '\u2009', ensp: '\u2002', emsp: '\u2003', zwj: '', zwnj: '', lrm: '', rlm: '', dagger: '\u2020', Dagger: '\u2021',
  permil: '\u2030', prime: '\u2032', Prime: '\u2033', oelig: '\u0153', OElig: '\u0152', scaron: '\u0161', Scaron: '\u0160', Yuml: '\u0178',
  fnof: '\u0192', circ: '\u02c6', tilde: '\u02dc', check: '\u2713',
}
ENTIDADES.shy = ''

export function decodificar(texto: string): string {
  if (!texto.includes('&')) return texto
  return texto.replace(/&(?:#(\d{1,7});?|#[xX]([0-9a-fA-F]{1,6});?|([a-zA-Z][a-zA-Z0-9]{1,31});)/g, (todo, dec?: string, hex?: string, nombre?: string) => {
    if (nombre) return ENTIDADES[nombre] ?? todo
    const cp = dec ? Number(dec) : parseInt(hex!, 16)
    if (!cp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '\ufffd'
    return String.fromCodePoint(cp)
  })
}

// ---------------------------------------------------------------- parser

const TOKEN = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][^\s/>]*)[^>]*>|<([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function atributos(texto: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of texto.matchAll(ATRIBUTO)) {
    const nombre = m[1]!.toLowerCase()
    if (!(nombre in attrs)) attrs[nombre] = decodificar(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

const INLINE_ESCAPABLE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'font', 'i', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var'])

export function parsear(html: string): Nodo {
  const raiz: Nodo = { tag: '#raiz', attrs: {}, hijos: [] }
  const pila: Nodo[] = [raiz]
  const actual = () => pila[pila.length - 1]!
  /** Cierra hasta `tag` si está abierto antes de toparse con uno de `limites`. */
  const cerrarSi = (tags: string[], limites: string[]) => {
    for (let j = pila.length - 1; j > 0; j--) {
      const t = pila[j]!.tag
      if (tags.includes(t)) {
        pila.length = j
        return
      }
      if (limites.includes(t)) return
    }
  }
  const re = new RegExp(TOKEN.source, 'g')
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m.index > i) actual().hijos.push(html.slice(i, m.index))
    i = re.lastIndex
    const [token, cierre, apertura, attrsTexto] = m
    if (cierre) {
      const tag = cierre.toLowerCase()
      for (let j = pila.length - 1; j > 0; j--) {
        if (pila[j]!.tag === tag) {
          pila.length = j
          break
        }
      }
      continue
    }
    if (!apertura) continue // comentario, doctype, <?xml ?>
    const tag = apertura.toLowerCase()

    // Cierres implícitos de lo más común.
    if (CIERRAN_P.has(tag)) {
      for (let j = pila.length - 1; j > 0; j--) {
        const t = pila[j]!.tag
        if (t === 'p') {
          pila.length = j
          break
        }
        if (!INLINE_ESCAPABLE.has(t)) break
      }
    }
    if (tag === 'li') cerrarSi(['li'], ['ul', 'ol', 'menu'])
    if (tag === 'dt' || tag === 'dd') cerrarSi(['dt', 'dd'], ['dl'])
    if (tag === 'tr') cerrarSi(['tr'], ['table', 'thead', 'tbody', 'tfoot'])
    if (tag === 'td' || tag === 'th') cerrarSi(['td', 'th'], ['tr', 'table'])
    if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') cerrarSi(['thead', 'tbody', 'tfoot'], ['table'])
    if (tag === 'option') cerrarSi(['option'], ['select', 'datalist'])

    const nodo: Nodo = { tag, attrs: atributos(attrsTexto ?? ''), hijos: [] }
    actual().hijos.push(nodo)

    if (CRUDOS.has(tag)) {
      const fin = new RegExp(`</${tag}\\s*>`, 'ig')
      fin.lastIndex = i
      const f = fin.exec(html)
      nodo.hijos.push(html.slice(i, f ? f.index : html.length))
      i = f ? f.index + f[0].length : html.length
      re.lastIndex = i
      continue
    }
    if (VACIOS.has(tag) || token.endsWith('/>')) continue
    pila.push(nodo)
  }
  if (i < html.length) actual().hijos.push(html.slice(i))
  return raiz
}

// ---------------------------------------------------------------- renderer

type Ctx = { base: string | null; enContenido: boolean }

function buscar(n: Nodo, cumple: (x: Nodo) => boolean, hasta?: (x: Nodo) => boolean): Nodo | null {
  for (const h of n.hijos) {
    if (typeof h === 'string') continue
    if (cumple(h)) return h
    if (hasta?.(h)) continue
    const r = buscar(h, cumple, hasta)
    if (r) return r
  }
  return null
}

function todos(n: Nodo, cumple: (x: Nodo) => boolean, salida: Nodo[] = []): Nodo[] {
  for (const h of n.hijos) {
    if (typeof h === 'string') continue
    if (cumple(h)) salida.push(h)
    else todos(h, cumple, salida)
  }
  return salida
}

/** El texto crudo de un nodo (para <title>, <pre>, <code>). */
function textoCrudo(n: Nodo): string {
  return n.hijos.map((h) => (typeof h === 'string' ? h : h.tag === 'br' ? '\n' : textoCrudo(h))).join('')
}

const unaLinea = (t: string) => t.replace(/\s+/g, ' ').trim()

function limpiar(t: string): string {
  return t
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function descartar(n: Nodo, ctx: Ctx): boolean {
  if (FUERA.has(n.tag)) return true
  // El <header> del sitio (logo y menú) fuera del contenido; el de un artículo queda.
  if (n.tag === 'header' && !ctx.enContenido) return true
  const a = n.attrs
  if ('hidden' in a || a['aria-hidden'] === 'true') return true
  if (a.role && ROLES_FUERA.has(a.role.toLowerCase())) return true
  if (a.style && /display\s*:\s*none|visibility\s*:\s*hidden/i.test(a.style)) return true
  return false
}

function resolver(href: string | undefined, base: string | null): string | null {
  const h = (href ?? '').trim()
  if (!h || h.startsWith('#') || /^javascript:/i.test(h)) return null
  try {
    const url = base ? new URL(h, base) : new URL(h)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/** Envuelve con `marca` lo que tenga texto, dejando los espacios de los bordes afuera. */
function envolver(t: string, marca: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t)!
  return m[2] ? `${m[1]}${marca}${m[2]}${marca}${m[3]}` : t
}

/** Marcas de formato: pegadas a lo de al lado no separan palabras. */
const DE_FORMATO = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'mark', 'code', 'kbd', 'samp', 'abbr', 'br', 'wbr'])

/**
 * Suma un pedazo inline. Dos elementos hermanos sin espacio entre medio
 * (`<span>/llms.txt</span><span>no traffic</span>` en un flex) se leen
 * separados en pantalla: acá también, con un espacio. El formato (negrita,
 * subíndice) queda pegado.
 */
function pegar(acum: string, pieza: string, previo: string | null, tag: string | null): string {
  if (!pieza) return acum
  const separar = previo && tag && !DE_FORMATO.has(previo) && !DE_FORMATO.has(tag) && acum && !/\s$/.test(acum) && !/^\s/.test(pieza)
  return separar ? `${acum} ${pieza}` : acum + pieza
}

function inlineDe(n: Nodo, ctx: Ctx): string {
  let acum = ''
  let previo: string | null = null
  for (const h of n.hijos) {
    if (typeof h === 'string') {
      acum += decodificar(h).replace(/\s+/g, ' ')
      previo = null
      continue
    }
    if (descartar(h, ctx)) continue
    // Un bloque adentro de algo inline (una tarjeta entera dentro de un <a>): texto corrido.
    const pieza = BLOQUES.has(h.tag) ? ` ${inlineDe(h, ctx)} ` : inline(h, ctx)
    if (!pieza) continue
    acum = pegar(acum, pieza, previo, h.tag)
    previo = h.tag
  }
  return acum
}

function inline(n: Nodo, ctx: Ctx): string {
  switch (n.tag) {
    case 'br':
      return '\n'
    case 'wbr':
      return ''
    case 'img': {
      const alt = unaLinea(n.attrs.alt ?? '')
      if (!alt) return ''
      const src = resolver(n.attrs.src, ctx.base)
      return src && !src.startsWith('data:') ? `![${alt}](${src})` : alt
    }
    case 'a': {
      const texto = unaLinea(inlineDe(n, ctx)) || unaLinea(n.attrs['aria-label'] ?? n.attrs.title ?? '')
      if (!texto) return ''
      const url = resolver(n.attrs.href, ctx.base)
      return url ? `[${texto}](${url})` : texto
    }
    case 'strong':
    case 'b':
      return envolver(inlineDe(n, ctx), '**')
    case 'em':
    case 'i':
      return envolver(inlineDe(n, ctx), '*')
    case 'code':
    case 'kbd':
    case 'samp': {
      const t = unaLinea(decodificar(textoCrudo(n)))
      return t ? `\`${t}\`` : ''
    }
    default:
      return inlineDe(n, ctx)
  }
}

function bloques(n: Nodo, ctx: Ctx): string[] {
  const salida: string[] = []
  let linea = ''
  let previo: string | null = null
  const vaciar = () => {
    const t = limpiar(linea)
    if (t) salida.push(t)
    linea = ''
    previo = null
  }
  for (const h of n.hijos) {
    if (typeof h === 'string') {
      linea += decodificar(h).replace(/\s+/g, ' ')
      previo = null
      continue
    }
    if (descartar(h, ctx)) continue
    if (BLOQUES.has(h.tag)) {
      vaciar()
      salida.push(...bloque(h, ctx))
    } else {
      const pieza = inline(h, ctx)
      if (!pieza) continue
      linea = pegar(linea, pieza, previo, h.tag)
      previo = h.tag
    }
  }
  vaciar()
  return salida
}

function bloque(n: Nodo, ctx: Ctx): string[] {
  switch (n.tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const t = unaLinea(inlineDe(n, ctx))
      return t ? [`${'#'.repeat(Number(n.tag[1]))} ${t}`] : []
    }
    case 'ul':
    case 'ol':
    case 'menu': {
      const t = lista(n, ctx)
      return t ? [t] : []
    }
    case 'li': {
      const t = bloques(n, ctx).join('\n')
      return t ? [`- ${t.replace(/\n/g, '\n  ')}`] : []
    }
    case 'blockquote': {
      const t = bloques(n, ctx).join('\n\n')
      return t ? [t.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')] : []
    }
    case 'pre': {
      const t = decodificar(textoCrudo(n)).replace(/^\n+|\s+$/g, '')
      if (!t) return []
      const codigo = buscar(n, (x) => x.tag === 'code')
      const lenguaje = /(?:^|\s)(?:language|lang)-([\w+-]+)/.exec(codigo?.attrs.class ?? '')?.[1] ?? ''
      const valla = t.includes('```') ? '~~~' : '```'
      return [`${valla}${lenguaje}\n${t}\n${valla}`]
    }
    case 'hr':
      return ['---']
    case 'table':
      return tabla(n, ctx)
    case 'dt':
    case 'summary':
    case 'legend':
    case 'caption': {
      const t = unaLinea(inlineDe(n, ctx))
      return t ? [`**${t}**`] : []
    }
    case 'main':
    case 'article':
    case 'section':
      return bloques(n, { ...ctx, enContenido: true })
    default:
      return bloques(n, ctx)
  }
}

function lista(n: Nodo, ctx: Ctx): string {
  const ordenada = n.tag === 'ol'
  const inicio = Number(n.attrs.start)
  let k = Number.isFinite(inicio) && n.attrs.start ? inicio : 1
  const lineas: string[] = []
  for (const h of n.hijos) {
    if (typeof h === 'string') {
      const t = unaLinea(decodificar(h))
      if (t) lineas.push(t)
      continue
    }
    if (descartar(h, ctx)) continue
    // Una lista dentro de otra sin <li> (HTML inválido pero común): va anidada.
    const t = h.tag === 'ul' || h.tag === 'ol' ? lista(h, ctx) : bloques(h, ctx).join('\n')
    if (!t) continue
    if (h.tag === 'ul' || h.tag === 'ol') {
      lineas.push(t.replace(/^/gm, '  '))
      continue
    }
    const marca = ordenada ? `${k++}. ` : '- '
    lineas.push(marca + t.replace(/\n/g, `\n${' '.repeat(marca.length)}`))
  }
  return lineas.join('\n')
}

function tabla(n: Nodo, ctx: Ctx): string[] {
  const filas: string[][] = []
  let titulo = ''
  const recorrer = (x: Nodo) => {
    for (const h of x.hijos) {
      if (typeof h === 'string' || descartar(h, ctx)) continue
      if (h.tag === 'tr') {
        filas.push(
          h.hijos
            .filter((c): c is Nodo => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th') && !descartar(c, ctx))
            .map((c) => unaLinea(inlineDe(c, ctx)).replace(/\|/g, '\\|')),
        )
      } else if (h.tag === 'caption') titulo = unaLinea(inlineDe(h, ctx))
      else if (h.tag === 'thead' || h.tag === 'tbody' || h.tag === 'tfoot') recorrer(h)
    }
  }
  recorrer(n)
  const llenas = filas.filter((f) => f.some(Boolean))
  if (llenas.length === 0) return titulo ? [`**${titulo}**`] : []
  const ancho = Math.max(...llenas.map((f) => f.length))
  const salida: string[] = titulo ? [`**${titulo}**`] : []
  // Tabla de una columna (maquetación vieja): líneas sueltas.
  if (ancho === 1) return [...salida, llenas.map((f) => f[0]).join('\n')]
  const fila = (f: string[]) => `| ${Array.from({ length: ancho }, (_, i) => f[i] ?? '').join(' | ')} |`
  const [cabecera, ...resto] = llenas
  salida.push([fila(cabecera!), fila(Array(ancho).fill('---')), ...resto.map(fila)].join('\n'))
  return salida
}

// ---------------------------------------------------------------- entrada

function metaDe(doc: Nodo, nombres: string[]): string {
  const m = buscar(doc, (x) => x.tag === 'meta' && nombres.includes((x.attrs.name ?? x.attrs.property ?? '').toLowerCase()) && !!x.attrs.content)
  return unaLinea(m?.attrs.content ?? '')
}

/**
 * Markdown legible de una página HTML. `url`: la de la página, para volver
 * absolutos los links relativos (y la base de `<base href>`).
 */
export function htmlAMarkdown(html: string, url?: string | null): string {
  const doc = parsear(html)
  let base: string | null = url || null
  const etiquetaBase = buscar(doc, (x) => x.tag === 'base' && !!x.attrs.href)
  if (etiquetaBase) base = resolver(etiquetaBase.attrs.href, base) ?? base

  const nodoTitulo = buscar(doc, (x) => x.tag === 'title', (x) => x.tag === 'svg')
  const titulo = unaLinea(decodificar(nodoTitulo ? textoCrudo(nodoTitulo) : '')) || metaDe(doc, ['og:title'])

  // El contenido: <main>, o el único <article>, o el <body> entero.
  const main = buscar(doc, (x) => x.tag === 'main' || x.attrs.role === 'main')
  const articulos = main ? [] : todos(doc, (x) => x.tag === 'article')
  const body = buscar(doc, (x) => x.tag === 'body') ?? doc
  const raiz = main ?? (articulos.length === 1 ? articulos[0]! : null)
  let cuerpo = raiz ? bloques(raiz, { base, enContenido: true }).join('\n\n') : ''
  if (!cuerpo) cuerpo = bloques(body, { base, enContenido: false }).join('\n\n')
  // Una app que se arma en el navegador no trae texto: al menos la descripción.
  if (!cuerpo) cuerpo = metaDe(doc, ['description', 'og:description'])

  const partes = [titulo && !/^# /m.test(cuerpo) ? `# ${titulo}` : '', cuerpo].filter(Boolean)
  return partes.join('\n\n').trim()
}

/** HTML de verdad: por el content-type, o por el comienzo del cuerpo si el servidor no dijo qué es. */
export function esHtml(contentType: string | null | undefined, cuerpo: string): boolean {
  const tipo = (contentType ?? '').split(';')[0]!.trim().toLowerCase()
  if (tipo === 'text/html' || tipo === 'application/xhtml+xml') return true
  if (tipo && tipo !== 'application/octet-stream') return false
  return /^\s*(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(cuerpo.slice(0, 1024))
}

/**
 * Lo que devuelve una tool de link: el HTML pasado a markdown, lo demás tal
 * cual. Nunca tira: si la conversión falla por algo raro, va el cuerpo crudo.
 */
export function legible(cuerpo: string, contentType: string | null | undefined, url?: string | null): string {
  if (!esHtml(contentType, cuerpo)) return cuerpo
  try {
    return htmlAMarkdown(cuerpo, url) || 'The page has no readable text.'
  } catch (error) {
    console.warn('[legible] no se pudo convertir el HTML; va crudo', error instanceof Error ? error.message : error)
    return cuerpo
  }
}

/** Lee una respuesta y la deja legible. */
export async function leerLegible(res: Response, url: string): Promise<string> {
  return legible(await res.text(), res.headers.get('content-type'), res.url || url)
}
