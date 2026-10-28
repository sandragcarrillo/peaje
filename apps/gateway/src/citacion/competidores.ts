import type { PageFormat, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { COMO_SE_ARMA } from './formatos.js'
import { esPropio, raizDe } from './medir.js'

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
