import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { CUPOS_FOUNDER, DIAS_REEMBOLSO, LIMITES, PAQUETE_MENSUAL, PRECIOS_USD, REGALO } from '@peaje/db'
import { fechaValida, frontmatter, sinH1 } from './markdown'

/**
 * Las páginas "Para" por tipo de negocio: un .md por página en content/para/,
 * con la misma forma que las comparativas (title, description, slug, date,
 * updated, lang, corto, orden, traduccion). Las de español viven en
 * /para/<slug> y las de inglés en /for/<slug>; las de inglés terminan en .en.md.
 *
 * Los números de Peaje no se escriben a mano: el .md usa marcadores que se
 * llenan desde @peaje/db (los mismos que /precios y /preguntas):
 *
 *   {{founder}}  precio de fundador en US$        {{pro}}       precio normal en US$
 *   {{cupos}}    cupos con precio de fundador      {{dias}}      días para el reembolso del primer pago
 *   {{paginas}}  páginas escritas al mes en Pro    {{preguntas}} preguntas medidas por sitio en Pro
 *   {{creditos}} créditos al mes en Pro            {{regaloInformes}} / {{regaloRespuestas}} el paquete gratis
 *
 * Un marcador que no existe deja la página sin publicar, para que nunca salga
 * un "{{algo}}" en vivo. La sección "## Preguntas frecuentes" (o "## Frequently
 * asked questions") sale además como FAQPage en el JSON-LD.
 */

const CARPETA = path.join(process.cwd(), 'content', 'para')

export type Idioma = 'es' | 'en'
export const RUTA: Record<Idioma, string> = { es: '/para', en: '/for' }

export type PaginaPara = {
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

const NUMEROS: Record<string, number> = {
  founder: PRECIOS_USD.founder,
  pro: PRECIOS_USD.pro,
  cupos: CUPOS_FOUNDER,
  dias: DIAS_REEMBOLSO,
  paginas: PAQUETE_MENSUAL.paginas,
  preguntas: LIMITES.pro.preguntas,
  creditos: LIMITES.pro.creditos,
  regaloInformes: REGALO.informes,
  regaloRespuestas: REGALO.respuestas,
}

/** Llena los marcadores; null si alguno no existe. */
export function conNumeros(texto: string): string | null {
  let falta = false
  const lleno = texto.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, clave: string) => {
    const n = NUMEROS[clave]
    if (n === undefined) {
      falta = true
      return ''
    }
    return String(n)
  })
  return falta ? null : lleno
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

function leer(nombre: string, bruto: string): PaginaPara | null {
  const texto = conNumeros(bruto)
  if (!texto) return null
  const { datos, resto } = frontmatter(texto)
  const { h1, cuerpo } = sinH1(resto)
  const titulo = datos.title?.trim() || h1
  const fecha = fechaValida(datos.date)
  const idioma = datos.lang === 'es' || datos.lang === 'en' ? datos.lang : null
  if (!titulo || !fecha || !cuerpo || !idioma) return null
  if (/\[TODO:/i.test(cuerpo) || /\[TODO:/i.test(titulo)) return null
  const slug = (datos.slug || nombre.replace(/(\.en)?\.md$/, '')).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
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

/** Las páginas publicables de un idioma, en el orden del índice. */
export async function paginasPara(idioma: Idioma): Promise<PaginaPara[]> {
  const nombres = await readdir(CARPETA).catch(() => [] as string[])
  const todas = await Promise.all(
    nombres
      .filter((n) => n.endsWith('.md') && !n.startsWith('_'))
      .map(async (n) => leer(n, await readFile(path.join(CARPETA, n), 'utf8'))),
  )
  return todas
    .filter((c): c is PaginaPara => c !== null && c.idioma === idioma)
    .sort((a, b) => a.orden - b.orden || a.slug.localeCompare(b.slug))
}

export async function paginaPara(idioma: Idioma, slug: string): Promise<PaginaPara | null> {
  return (await paginasPara(idioma)).find((c) => c.slug === slug) ?? null
}
