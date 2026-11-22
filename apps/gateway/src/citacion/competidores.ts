import type { PageFormat, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { COMO_SE_ARMA } from './formatos.js'
import { esPropio, raizDe } from './medir.js'
import { raizRegistrable, tipoPorReglas } from './radar.js'

/** Un sitio que la IA cita en vez del negocio, con las páginas que le ganan. */
export type Competidor = {
  domain: string
  /** Respuestas de la última ronda que lo citan y no citan al negocio. */
  answersWon: number
  questions: string[]
  engines: string[]
  /** Sus páginas citadas en esas respuestas, las más citadas primero. */
  pages: { title: string | null; url: string | null; format: PageFormat | null; citations: number }[]
}

const delDominio = (pagina: string, dominio: string) => pagina === dominio || pagina.endsWith(`.${dominio}`) || dominio.endsWith(`.${pagina}`)

/**
 * Los competidores uno por uno, para que el agente conteste "¿a quién cita la
 * IA en vez de mí y por qué?" con nombres y páginas, sin mandar al panel.
 * Sale de la última ronda de medición; `formatNotes` dice cómo se arma cada
 * formato que les gana (lo mismo que usan los borradores).
 */
export async function competidoresCitados(tenant: Tenant, limite = 5) {
  const runs = (await store.listCitationRuns(tenant.id, 1)).filter((r) => !r.error)
  const raiz = raizDe(tenant)
  const porDominio = new Map<string, { won: number; preguntas: Set<string>; motores: Set<string>; paginas: Map<string, Competidor['pages'][number]> }>()
  for (const r of runs) {
    if (r.cited) continue
    for (const d of new Set(r.domains)) {
      if (raiz && esPropio(d, raiz)) continue
      const c = porDominio.get(d) ?? { won: 0, preguntas: new Set(), motores: new Set(), paginas: new Map() }
      c.won += 1
      c.preguntas.add(r.promptText)
      c.motores.add(r.engine)
      for (const p of r.pages) {
        if (!delDominio(p.domain, d)) continue
        const clave = p.url ?? p.title ?? ''
        if (!clave) continue
        const e = c.paginas.get(clave) ?? { title: p.title, url: p.url, format: p.format, citations: 0 }
        e.citations += 1
        c.paginas.set(clave, e)
      }
      porDominio.set(d, c)
    }
  }
  const competitors: Competidor[] = [...porDominio.entries()]
    .sort((a, b) => b[1].won - a[1].won)
    .slice(0, limite)
    .map(([domain, c]) => ({
      domain,
      answersWon: c.won,
      questions: [...c.preguntas].slice(0, 5),
      engines: [...c.motores],
      pages: [...c.paginas.values()].sort((a, b) => b.citations - a.citations).slice(0, 3),
    }))
  const formatos = new Set(competitors.flatMap((c) => c.pages.map((p) => p.format)).filter((f): f is PageFormat => !!f && f !== 'other'))
  return {
    measuredAt: runs[0]?.runAt ?? null,
    answersMeasured: runs.length,
    answersWithoutYou: runs.filter((r) => !r.cited).length,
    competitors,
    formatNotes: [...formatos].map((format) => ({ format, whatTheyHaveInCommon: COMO_SE_ARMA[format] })),
  }
}

/** Las páginas que la IA citó para este negocio en las últimas rondas: lo único que el agente puede leer afuera. */
export async function paginasCitadas(tenant: Tenant): Promise<Set<string>> {
  const runs = await store.listCitationRuns(tenant.id, 3)
  return new Set(runs.flatMap((r) => r.pages.map((p) => p.url).filter((u): u is string => !!u)))
}

/** Una pregunta donde la IA no cita al negocio y sí cita páginas de terceros (listas, reseñas, directorios, foros). */
export type PreguntaSinCita = {
  question: string
  /** Direcciones de todas las páginas citadas para la pregunta, de quien sean. */
  pageUrls: string[]
  /** Los sitios de terceros citados, el más citado primero, con hasta tres páginas de ejemplo. */
  publishers: { domain: string; citations: number; pages: { title: string | null; url: string | null }[] }[]
  /** Suma de citas a esos sitios: ordena las preguntas. */
  publisherCitations: number
}

/** Formatos que casi siempre son de un tercero que lista o comenta opciones. */
const FORMATO_DE_TERCERO = new Set<PageFormat>(['roundup', 'forum'])

/**
 * Las preguntas de la última ronda donde ningún asistente citó al negocio, con
 * los sitios de terceros que sí citaron. Un sitio cuenta como tercero por las
 * reglas del radar (medios, reseñas, directorios, foros, redes) o porque la
 * página citada es una lista o un foro. Sin modelo: lo dudoso queda afuera.
 * Primero la pregunta con más citas a terceros.
 */
export async function preguntasSinCita(tenant: Tenant): Promise<PreguntaSinCita[]> {
  const runs = (await store.listCitationRuns(tenant.id, 1)).filter((r) => !r.error)
  const raiz = raizDe(tenant)
  const porPregunta = new Map<string, typeof runs>()
  for (const r of runs) porPregunta.set(r.promptText, [...(porPregunta.get(r.promptText) ?? []), r])
  const salida: PreguntaSinCita[] = []
  for (const [question, rs] of porPregunta) {
    if (rs.some((r) => r.cited)) continue
    const sitios = new Map<string, { citations: number; pages: Map<string, { title: string | null; url: string | null; n: number }> }>()
    const pageUrls = new Set<string>()
    for (const r of rs) {
      const contados = new Set<string>()
      for (const p of r.pages) {
        if (p.url) pageUrls.add(p.url)
        const d = raizRegistrable(p.domain)
        if (!d || (raiz && esPropio(p.domain, raiz))) continue
        if (tipoPorReglas(d) !== 'publisher' && !(p.format && FORMATO_DE_TERCERO.has(p.format))) continue
        const s = sitios.get(d) ?? { citations: 0, pages: new Map() }
        // Una respuesta que cita dos páginas del mismo sitio cuenta una vez.
        if (!contados.has(d)) s.citations += 1
        contados.add(d)
        const clave = p.url ?? p.title ?? ''
        if (clave) {
          const e = s.pages.get(clave) ?? { title: p.title, url: p.url, n: 0 }
          e.n += 1
          s.pages.set(clave, e)
        }
        sitios.set(d, s)
      }
    }
    const publishers = [...sitios.entries()]
      .sort((a, b) => b[1].citations - a[1].citations || a[0].localeCompare(b[0]))
      .map(([domain, s]) => ({ domain, citations: s.citations, pages: [...s.pages.values()].sort((a, b) => b.n - a.n).slice(0, 3).map(({ title, url }) => ({ title, url })) }))
    salida.push({ question, pageUrls: [...pageUrls], publishers, publisherCitations: publishers.reduce((n, x) => n + x.citations, 0) })
  }
  return salida.sort((a, b) => b.publisherCitations - a.publisherCitations)
}
