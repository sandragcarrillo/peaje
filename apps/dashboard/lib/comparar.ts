import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fechaValida, frontmatter, sinH1 } from './markdown'

/**
 * Las comparativas: un .md por página en content/comparar/, con la misma forma
 * que los del blog (title, description, slug, date, lang, traduccion) más:
 *
 *   updated: 2026-11-22     la última revisión de precios y datos de terceros (sale visible en la página)
 *   corto: Peaje vs Peec    el nombre corto para el índice y las migas
 *   orden: 1                el lugar en el índice (/comparar, /compare)
 *
 * Las de español viven en /comparar/<slug> y las de inglés en /compare/<slug>.
 * La sección "## Preguntas frecuentes" (o "## Frequently asked questions") con
 * sus "### pregunta" sale además como FAQPage en el JSON-LD: una sola fuente.
 */

const CARPETA = path.join(process.cwd(), 'content', 'comparar')

export type Idioma = 'es' | 'en'
export const RUTA: Record<Idioma, string> = { es: '/comparar', en: '/compare' }

export type Comparativa = {
  slug: string
  titulo: string
  corto: string
  descripcion: string
  fecha: string
  revisado: string
  idioma: Idioma
  traduccion: string | null
  orden: number
  cuerpo: string
  faq: { p: string; r: string }[]
}

/** Texto plano para el JSON-LD: sin enlaces, negritas ni código. */
const plano = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

function preguntas(cuerpo: string): { p: string; r: string }[] {
  const inicio = cuerpo.search(/^##\s+(Preguntas frecuentes|Frequently asked questions)\s*$/im)
  if (inicio < 0) return []
  const resto = cuerpo.slice(inicio).replace(/^##.*\r?\n/, '')
  const fin = resto.search(/^##\s/m)
  const bloque = fin < 0 ? resto : resto.slice(0, fin)
  return bloque
    .split(/^###\s+/m)
    .slice(1)
    .map((trozo) => {
      const [p = '', ...r] = trozo.split(/\r?\n/)
      return { p: plano(p), r: plano(r.join('\n')) }
    })
    .filter((x) => x.p && x.r)
}

function leer(nombre: string, texto: string): Comparativa | null {
  const { datos, resto } = frontmatter(texto)
  const { h1, cuerpo } = sinH1(resto)
  const titulo = datos.title?.trim() || h1
  const fecha = fechaValida(datos.date)
  const idioma = datos.lang === 'es' || datos.lang === 'en' ? datos.lang : null
  if (!titulo || !fecha || !cuerpo || !idioma) return null
  if (/\[TODO:/i.test(cuerpo) || /\[TODO:/i.test(titulo)) return null
  const slug = (datos.slug || nombre.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  return {
    slug,
    titulo,
    corto: datos.corto?.trim() || titulo,
    descripcion: datos.description?.trim() ?? '',
    fecha,
    revisado: fechaValida(datos.updated) ?? fecha,
    idioma,
    traduccion: datos.traduccion?.trim() || null,
    orden: Number(datos.orden) || 99,
    cuerpo,
    faq: preguntas(cuerpo),
  }
}

/** Las comparativas publicables de un idioma, en el orden del índice. */
export async function comparativas(idioma: Idioma): Promise<Comparativa[]> {
  const nombres = await readdir(CARPETA).catch(() => [] as string[])
  const todas = await Promise.all(
    nombres
      .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
      .map(async (n) => leer(n, await readFile(path.join(CARPETA, n), 'utf8'))),
  )
  return todas
    .filter((c): c is Comparativa => c !== null && c.idioma === idioma)
    .sort((a, b) => a.orden - b.orden || a.slug.localeCompare(b.slug))
}

export async function comparativa(idioma: Idioma, slug: string): Promise<Comparativa | null> {
  return (await comparativas(idioma)).find((c) => c.slug === slug) ?? null
}
