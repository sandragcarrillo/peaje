import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Los artículos del blog: un .md por artículo en content/blog/. El nombre del
 * archivo es el slug, salvo que el frontmatter traiga otro. Sirve tal cual el
 * .md que entrega el agente (Contenido → Descargar .md, o el adjunto de
 * Telegram y Slack): ya trae title, description, slug y date.
 *
 *   ---
 *   title: ¿Cómo hago que ChatGPT recomiende mi sitio web?
 *   description: Una o dos frases, sale debajo del título.
 *   date: 2026-10-26
 *   lang: es            (opcional: si falta, se deduce del texto)
 *   categoria: Guía     (opcional: sale junto a la fecha en las tarjetas)
 *   portada: 2          (opcional: 1 a 4, el degradado de la portada)
 *   portada_titulo: Recomendado por ChatGPT   (opcional: el texto corto de la portada; sin él va el título)
 *   portada_icono: check                      (opcional: un ícono junto al texto de la portada)
 *   traduccion: how-do-i-get-chatgpt-to-recommend-my-website   (opcional: el slug del mismo artículo en el otro idioma)
 *   ---
 *
 * Antes de publicar, el .md no puede tener [TODO: ...]: un artículo con
 * pendientes no se lista (ver `pendiente`).
 */

const CARPETA = path.join(process.cwd(), 'content', 'blog')

export type Articulo = {
  slug: string
  titulo: string
  descripcion: string
  /** YYYY-MM-DD */
  fecha: string
  actualizado: string
  idioma: 'es' | 'en'
  portada: number
  /** El texto corto de la portada (como "Grok Voice 3.0" en x.ai/news). */
  tituloPortada: string
  iconoPortada: 'check' | null
  categoria: string | null
  /** El slug del mismo artículo en el otro idioma. */
  traduccion: string | null
  /** El cuerpo en markdown, sin el H1 (el título va aparte). */
  cuerpo: string
}

function frontmatter(texto: string): { datos: Record<string, string>; resto: string } {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { datos: {}, resto: texto }
  const datos: Record<string, string> = {}
  for (const linea of m[1]!.split(/\r?\n/)) {
    const i = linea.indexOf(':')
    if (i <= 0) continue
    datos[linea.slice(0, i).trim().toLowerCase()] = linea
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return { datos, resto: texto.slice(m[0].length) }
}

const fechaValida = (x: string | undefined) => (x && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null)

/** Un hash chico y estable del slug, para que cada artículo tenga siempre la misma portada. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function leer(nombre: string, texto: string): Articulo | null {
  const { datos, resto } = frontmatter(texto)
  // Sin H1 en el cuerpo: el título se pinta aparte. Si no hay title, el H1 lo es.
  const h1 = resto.match(/^\s*#\s+(.+)\s*$/m)
  const cuerpo = resto.replace(/^\s*#\s+.+\r?\n+/, '').trim()
  const titulo = datos.title?.trim() || h1?.[1]?.trim()
  const fecha = fechaValida(datos.date)
  if (!titulo || !fecha || !cuerpo) return null
  const slug = (datos.slug || nombre.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  const idioma = datos.lang === 'es' || datos.lang === 'en' ? datos.lang : /[¿¡ñáéíóú]/i.test(`${titulo} ${cuerpo.slice(0, 400)}`) ? 'es' : 'en'
  const portada = Number(datos.portada)
  return {
    slug,
    titulo,
    descripcion: datos.description?.trim() ?? '',
    fecha,
    actualizado: fechaValida(datos.updated) ?? fecha,
    idioma,
    portada: portada >= 1 && portada <= 4 ? portada : (hash(slug) % 4) + 1,
    tituloPortada: datos.portada_titulo?.trim() || titulo,
    iconoPortada: datos.portada_icono?.trim() === 'check' ? 'check' : null,
    categoria: datos.categoria?.trim() || null,
    traduccion: datos.traduccion?.trim() || null,
    cuerpo,
  }
}

/** Un artículo con datos sin completar no se publica. */
export const pendiente = (a: Articulo) => /\[TODO:/i.test(a.cuerpo) || /\[TODO:/i.test(a.titulo)

/** Los artículos publicables, del más nuevo al más viejo. */
export async function articulos(): Promise<Articulo[]> {
  const nombres = await readdir(CARPETA).catch(() => [] as string[])
  const todos = await Promise.all(
    nombres
      .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
      .map(async (n) => leer(n, await readFile(path.join(CARPETA, n), 'utf8'))),
  )
  // Los empates de fecha se desempatan por el slug en español (en inglés, el de
  // su traducción), para que los dos idiomas salgan en el mismo orden.
  const orden = (a: Articulo) => (a.idioma === 'en' && a.traduccion) || a.slug
  return todos
    .filter((a): a is Articulo => a !== null && !pendiente(a))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || orden(a).localeCompare(orden(b)))
}

export async function articulo(slug: string): Promise<Articulo | null> {
  return (await articulos()).find((a) => a.slug === slug) ?? null
}

/** "26 oct 2026" / "Oct 26, 2026". */
export function fechaCorta(fecha: string, idioma: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(idioma === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${fecha}T12:00:00Z`),
  )
}
