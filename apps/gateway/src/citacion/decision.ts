import type { CitationPrompt, CitationRun, PageFormat, RadarCitasKind } from '@peaje/db'
import { contieneTermino, raizRegistrable, tipoPorReglas } from './radar.js'

/**
 * Preguntas de decisión en cada ronda de citación: "alternativas a X",
 * "X vs Y". Las preguntas guardadas del negocio casi nunca las traen, y sin
 * ellas el agente solo propone páginas de comparación cuando alguien nombra a
 * los competidores. Acá salen solas, con los nombres de los sitios que la IA
 * ya citó en lugar del negocio, sin llamar a ningún modelo:
 *
 *   competidores   de las rondas anteriores (citation_runs) y, si el dueño
 *                  pasó por el radar, de los que el radar clasificó como
 *                  competidor. Cuenta como competidor un sitio que vende algo
 *                  (alguna de sus páginas citadas es de producto, comparación
 *                  o documentación), no un medio, foro o gigante de la web.
 *   cupo           una de cada cinco preguntas, como mucho 4 (4 de 20, 2 de 10).
 *                  No suma preguntas por encima del tope del plan: si ya está
 *                  lleno, salen las últimas del agente, nunca las del dueño ni
 *                  las que siguen una tarea verificada.
 *   idioma         el de las demás preguntas del negocio.
 *
 * Sin competidores conocidos (primera ronda) no se inventa ninguno: las
 * preguntas sugeridas al empezar ya traen las de decisión por categoría
 * (sugerirPrompts en medir.ts).
 */

export type Idioma = 'es' | 'en' | 'pt'
export type Competidor = { domain: string; nombre: string }

/** Plataformas e infraestructura que salen citadas por su documentación: casi nunca son la alternativa a un negocio chico. */
const GIGANTES = new Set([
  'google.com', 'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'perplexity.ai', 'microsoft.com', 'bing.com', 'apple.com',
  'amazon.com', 'meta.com', 'github.com', 'gitlab.com', 'cloudflare.com', 'vercel.com', 'npmjs.com', 'mozilla.org', 'w3.org',
  // Medios de búsqueda y marketing que las reglas del radar no traen.
  'searchengineland.com', 'searchenginejournal.com',
])
/** Sin fines comerciales: estándares, gobiernos, universidades. */
const NO_COMERCIAL = /\.(org|gov|edu|mil|int)$|\.(gov|gob|edu|ac|mil|org)\.[a-z]{2}$/
/** Una página así es del que vende: su producto, su comparación o su documentación. */
const DE_VENDEDOR = new Set<PageFormat>(['product', 'comparison', 'docs'])

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const compacto = (t: string) => normalizar(t).replace(/[^\p{L}\p{N}]+/gu, '')
const clave = (t: string) => normalizar(t).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** El nombre como lo escribe la marca si algún título citado lo trae ("SE Ranking | ..."), si no la etiqueta del dominio con mayúscula. */
export function nombreDeMarca(dominio: string, titulos: string[] = []): string {
  const completa = dominio.split('.')[0] ?? dominio
  // tryprofound.com es Profound y usepeaje.com es Peaje: el prefijo de dominio no es parte del nombre.
  const etiqueta = completa.replace(/^(try|get|use|join|go)(?=[a-z0-9]{4,}$)/, '')
  const buscados = new Set([compacto(completa), compacto(etiqueta)])
  for (const t of titulos) {
    for (const parte of t.split(/\s+[|·•:–—-]\s+|:\s+/)) {
      const s = parte.trim()
      if (s.length >= 2 && s.length <= 30 && buscados.has(compacto(s))) return s
    }
  }
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)
}

/**
 * Los competidores que la IA ya citó en lugar del negocio, el más fuerte
 * primero: en cuántas preguntas distintas salió, más uno si alguna página es
 * de producto, más dos si el radar lo clasificó como competidor.
 */
export function competidoresConocidos(
  e: { runs: CitationRun[]; raiz: string | null; marcas: string[]; radar?: { domain: string; kind: RadarCitasKind }[] },
  limite = 3,
): Competidor[] {
  const propia = e.raiz ? raizRegistrable(e.raiz) : null
  const porDominio = new Map<string, { preguntas: Set<string>; vendedor: boolean; producto: boolean; radar: boolean; titulos: string[] }>()
  const entrada = (d: string) => {
    const x = porDominio.get(d) ?? { preguntas: new Set<string>(), vendedor: false, producto: false, radar: false, titulos: [] }
    porDominio.set(d, x)
    return x
  }
  for (const r of e.runs) {
    if (r.error || r.cited) continue
    for (const d of new Set(r.domains.map(raizRegistrable))) entrada(d).preguntas.add(clave(r.promptText))
    for (const p of r.pages) {
      const x = entrada(raizRegistrable(p.domain))
      if (p.format && DE_VENDEDOR.has(p.format)) x.vendedor = true
      if (p.format === 'product') x.producto = true
      if (p.title && x.titulos.length < 5) x.titulos.push(p.title)
    }
  }
  for (const c of e.radar ?? []) if (c.kind === 'competitor') entrada(raizRegistrable(c.domain)).radar = true

  const deLaMarca = (t: string) => e.marcas.some((m) => m.length >= 3 && contieneTermino(t, m))
  return [...porDominio.entries()]
    .filter(([d, x]) => {
      if (!d.includes('.') || d === propia || GIGANTES.has(d) || NO_COMERCIAL.test(d) || tipoPorReglas(d) === 'publisher') return false
      return x.vendedor || x.radar
    })
    .map(([domain, x]) => ({ domain, nombre: nombreDeMarca(domain, x.titulos), puntos: x.preguntas.size + (x.producto ? 1 : 0) + (x.radar ? 2 : 0) }))
    .filter((c) => !deLaMarca(c.nombre) && !deLaMarca(c.domain))
    .sort((a, b) => b.puntos - a.puntos || a.domain.localeCompare(b.domain))
    .slice(0, limite)
    .map(({ domain, nombre }) => ({ domain, nombre }))
}

const MARCAS_ES = /[¿¡ñ]|(?<!\p{L})(de|para|que|qué|cómo|cuál|cuáles|mejor|mejores|mi|mis|el|los|las|una|sin|hay|puedo|herramientas?)(?!\p{L})/giu
const MARCAS_EN = /(?<!\p{L})(the|for|to|how|what|which|best|my|with|without|is|are|can|tools?|and|of)(?!\p{L})/giu
const MARCAS_PT = /[ãõç]|(?<!\p{L})(você|não|melhor|melhores|qual|quais|meu|minha|uma|sem|ferramentas?|posso)(?!\p{L})/giu

/** El idioma en que están escritas la mayoría de las preguntas; `porDefecto` si no hay cómo saberlo. */
export function idiomaDePreguntas(textos: string[], porDefecto: Idioma = 'en'): Idioma {
  const votos: Record<Idioma, number> = { es: 0, en: 0, pt: 0 }
  for (const t of textos) {
    const puntos: Record<Idioma, number> = { es: t.match(MARCAS_ES)?.length ?? 0, en: t.match(MARCAS_EN)?.length ?? 0, pt: t.match(MARCAS_PT)?.length ?? 0 }
    const [mejor, segundo] = (Object.entries(puntos) as [Idioma, number][]).sort((a, b) => b[1] - a[1])
    if (mejor![1] > segundo![1]) votos[mejor![0]] += 1
  }
  const [ganador, otro] = (Object.entries(votos) as [Idioma, number][]).sort((a, b) => b[1] - a[1])
  return ganador![1] > otro![1] ? ganador![0] : porDefecto
}

const PLANTILLAS: Record<Idioma, { alternativas: (a: string) => string; vs: (a: string, b: string) => string; valeLaPena: (a: string) => string }> = {
  es: {
    alternativas: (a) => `¿Cuáles son las mejores alternativas a ${a}?`,
    vs: (a, b) => `${a} vs ${b}: ¿cuál me conviene?`,
    valeLaPena: (a) => `¿Vale la pena ${a} o hay algo mejor?`,
  },
  en: {
    alternativas: (a) => `What are the best alternatives to ${a}?`,
    vs: (a, b) => `${a} vs ${b}: which one should I pick?`,
    valeLaPena: (a) => `Is ${a} worth it or is there something better?`,
  },
  pt: {
    alternativas: (a) => `Quais são as melhores alternativas para ${a}?`,
    vs: (a, b) => `${a} ou ${b}: qual escolher?`,
    valeLaPena: (a) => `Vale a pena usar ${a} ou existe algo melhor?`,
  },
}

/** Una de cada cinco preguntas, como mucho 4. */
export const cupoDecision = (preguntas: number): number => Math.min(4, Math.floor(Math.max(0, preguntas) / 5))

/** Las preguntas de decisión con esos nombres, en orden: alternativas al primero, el primero contra el segundo, y así. */
export function preguntasDeDecision(nombres: string[], idioma: Idioma, cupo: number): string[] {
  const p = PLANTILLAS[idioma]
  const [a, b, c] = nombres
  if (!a || cupo <= 0) return []
  const candidatas = [p.alternativas(a), b && p.vs(a, b), b && p.alternativas(b), c && p.vs(a, c), c && p.alternativas(c), p.valeLaPena(a)]
  return [...new Set(candidatas.filter((x): x is string => !!x))].slice(0, cupo)
}

export type PreguntaElegida = { id: string | null; text: string }

/**
 * Las preguntas de la ronda: las guardadas hasta el tope y las de decisión en
 * su cupo. Las de decisión ocupan primero el lugar libre; si el tope ya está
 * lleno, sacan a las últimas del agente. Las del dueño y las `protegidas`
 * (seguimientos de tareas) no salen nunca. Las guardadas quedan en su orden.
 */
export function elegirPreguntas(prompts: CitationPrompt[], decision: string[], tope: number, protegidas: Set<string> = new Set()): PreguntaElegida[] {
  const vistas = new Set(prompts.map((p) => clave(p.text)))
  const nuevas: string[] = []
  for (const q of decision) {
    const k = clave(q)
    if (vistas.has(k)) continue
    vistas.add(k)
    nuevas.push(q)
  }
  const fija = (p: CitationPrompt) => p.source === 'owner' || protegidas.has(clave(p.text))
  const fijas = Math.min(prompts.filter(fija).length, tope)
  const extra = Math.min(nuevas.length, cupoDecision(tope), Math.max(0, tope - fijas))
  const lugares = Math.min(prompts.length, tope - extra)
  const quedan = new Set<CitationPrompt>()
  for (const p of prompts) if (fija(p) && quedan.size < lugares) quedan.add(p)
  for (const p of prompts) if (!fija(p) && quedan.size < lugares) quedan.add(p)
  return [...prompts.filter((p) => quedan.has(p)).map((p) => ({ id: p.id, text: p.text })), ...nuevas.slice(0, extra).map((text) => ({ id: null, text }))]
}

/** Para comparar textos de preguntas igual que elegirPreguntas. */
export const claveDePregunta = clave
