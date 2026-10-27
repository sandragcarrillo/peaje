import type { AgentJob, AgentTask, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { motoresDisponibles } from '../citacion/motores.js'
import { tarjetaTarea } from '../tareas/tarjetas.js'
import { borradorDe, slugDeTarea, tieneBorrador } from './borrador.js'
import { lineaDeRevision, type RevisionVoz } from './revision-voz.js'

/**
 * La entrega de un borrador terminado en el chat donde se pidió, como lo hace
 * Boring Marketing en Slack:
 *   1. "✅ Listo en 8 min 8 s" con el tiempo real del trabajo
 *   2. un resumen corto: qué página es, por qué, qué falta (las preguntas que
 *      el dueño contesta en el chat) y qué sigue (la medición a las 2 y 6 semanas)
 *   3. la página como archivo .md con frontmatter (title, description, slug, date)
 * Acá vive lo que no depende del canal; Telegram y Slack lo mandan con su API
 * (telegram/trabajos.ts, slack/trabajos.ts). Entregar no cobra créditos: el
 * borrador ya se pagó al pedirlo.
 */

type Idioma = 'es' | 'en'
type Texto = { es: string; en: string }

// ---- tiempo ----

/** "8 min 8 s" / "8m 8s". Redondea al segundo; nunca menos de 1 s. */
export function duracion(ms: number, idioma: Idioma): string {
  const total = Math.max(1, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (idioma === 'es') {
    if (h) return `${h} h${m ? ` ${m} min` : ''}`
    if (m) return `${m} min${s ? ` ${s} s` : ''}`
    return `${s} s`
  }
  if (h) return `${h}h${m ? ` ${m}m` : ''}`
  if (m) return `${m}m${s ? ` ${s}s` : ''}`
  return `${s}s`
}

/** La línea de estado al terminar, en los dos idiomas. */
export const lineaListo = (ms: number): Texto => ({ es: `✅ Listo en ${duracion(ms, 'es')}`, en: `✅ Done in ${duracion(ms, 'en')}` })

/** El texto sin la línea de estado de arriba (cuando ya quedó en el mensaje "estoy en eso", editado). */
export const sinLinea = (texto: string, linea: string) => (texto.startsWith(linea) ? texto.slice(linea.length).replace(/^\s+/, '') : texto)

// ---- resumen ----

const cerrar = (frase: string) => {
  const f = frase.trim().replace(/\s+/g, ' ')
  return f && !/[.!?…]$/.test(f) ? `${f}.` : f
}
const citar = (t: string, idioma: Idioma) => (idioma === 'es' ? `«${t}»` : `"${t}"`)

/** Los asistentes que Peaje mide de verdad (los que tienen clave en el gateway), en lista: "ChatGPT, Perplexity o Claude". */
function listaMotores(idioma: Idioma): { texto: string; n: number } | null {
  const nombres = motoresDisponibles().map((m) => m.nombre)
  if (!nombres.length) return null
  const y = idioma === 'es' ? ' o ' : ' or '
  return { texto: nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')}${y}${nombres.at(-1)}` : nombres[0]!, n: nombres.length }
}

/** Qué pasa después: Peaje mide a las 2 y a las 6 semanas. Solo nombra asistentes que mide. */
export function lineaSiguiente(idioma: Idioma, varias = false): string {
  const m = listaMotores(idioma)
  if (idioma === 'es') {
    if (!m) return varias ? 'Cuando estén publicadas, Peaje las revisa en tu sitio y mide las visitas de los asistentes de IA a las 2 y a las 6 semanas.' : 'Cuando esté publicada, Peaje la revisa en tu sitio y mide las visitas de los asistentes de IA a las 2 y a las 6 semanas.'
    return varias
      ? `Cuando estén publicadas, Peaje revisa a las 2 y a las 6 semanas si ${m.texto} las ${m.n > 1 ? 'citan' : 'cita'}.`
      : `Cuando esté publicada, Peaje revisa a las 2 y a las 6 semanas si ${m.texto} la ${m.n > 1 ? 'citan' : 'cita'}.`
  }
  if (!m) return varias ? "Once they're live, Peaje checks them on your site and measures visits from AI assistants at 2 and 6 weeks." : "Once it's live, Peaje checks it on your site and measures visits from AI assistants at 2 and 6 weeks."
  return varias ? `Once they're live, Peaje checks at 2 and 6 weeks whether ${m.texto} cites them.` : `Once it's live, Peaje checks at 2 and 6 weeks whether ${m.texto} cites it.`
}

const MAX_PREGUNTAS = 12

/** Las preguntas numeradas (seguidas entre páginas, para contestar "1: …, 2: …"). Con título por página en una serie. */
function listaPreguntas(grupos: { titulo?: string; preguntas: string[] }[], idioma: Idioma): string {
  const lineas: string[] = []
  let n = 0
  const total = grupos.reduce((s, g) => s + g.preguntas.length, 0)
  for (const g of grupos) {
    if (!g.preguntas.length || n >= MAX_PREGUNTAS) continue
    if (g.titulo) lineas.push(citar(g.titulo, idioma))
    for (const p of g.preguntas) {
      if (n >= MAX_PREGUNTAS) break
      lineas.push(`${++n}. ${p.trim().replace(/\s+/g, ' ')}`)
    }
  }
  if (total > n) lineas.push(idioma === 'es' ? `…y ${total - n} más en las tareas.` : `…and ${total - n} more in the tasks.`)
  return lineas.join('\n')
}

export type DatosPagina = {
  pregunta: string
  /** Por qué esta página, con datos del negocio (lo que dijo el agente al pedirla, o el resumen de la tarea). */
  porQue?: string
  /** Una por [TODO] de la página. */
  preguntas: string[]
  revision?: RevisionVoz | null
}

/** El resumen de una página lista (sin la línea de estado): 2 a 4 frases, las preguntas y, si hubo, la línea de la revisión de voz. */
export function resumenPagina(p: DatosPagina, idioma: Idioma): string {
  const n = p.preguntas.length
  const porQue = p.porQue?.trim()
    ? cerrar(p.porQue)
    : idioma === 'es'
      ? 'La gente le pregunta esto a la IA y hoy tu sitio no tiene una página que lo responda.'
      : 'People ask AI assistants this and your site has no page that answers it today.'
  const que = idioma === 'es' ? `Es la página que responde ${citar(p.pregunta, idioma)}. ${porQue}` : `It's the page that answers ${citar(p.pregunta, idioma)}. ${porQue}`
  const faltan =
    idioma === 'es'
      ? n
        ? `Le ${n === 1 ? 'falta 1 dato que no está' : `faltan ${n} datos que no están`} en tu sitio; contéstame aquí y la completo:\n${listaPreguntas([{ preguntas: p.preguntas }], idioma)}`
        : 'Tiene todos los datos; revísala y publícala.'
      : n
        ? `It needs ${n} fact${n === 1 ? ' that is' : 's that are'} not on your site; answer here and I will fill ${n === 1 ? 'it' : 'them'} in:\n${listaPreguntas([{ preguntas: p.preguntas }], idioma)}`
        : 'It has every fact it needs; review it and publish it.'
  return [que, faltan, lineaSiguiente(idioma), lineaDeRevision(p.revision, idioma)].filter(Boolean).join('\n\n')
}

export type DatosSerie = {
  tema: string
  hub: { title: string; todos: string[] } | null
  spokes: { title: string; todos: string[] }[]
  /** Páginas que ya tenían una tarea más allá de abierta y no se tocaron. */
  viejas: number
  /** Las preguntas que no se pudieron redactar. */
  fallidas: string[]
  revision?: RevisionVoz | null
}

/** El resumen de una serie lista (sin la línea de estado). */
export function resumenSerie(s: DatosSerie, idioma: Idioma): string {
  const k = s.spokes.length
  const paginas = [...(s.hub ? [s.hub] : []), ...s.spokes]
  const n = paginas.reduce((t, p) => t + p.todos.length, 0)
  const grupos = paginas.map((p) => ({ titulo: p.title, preguntas: p.todos }))
  if (idioma === 'es') {
    const que = s.hub
      ? `Es la serie sobre ${citar(s.tema, idioma)}: la página principal ${citar(s.hub.title, idioma)} y ${k} página${k === 1 ? '' : 's'} que la apoya${k === 1 ? '' : 'n'}, enlazadas entre sí.`
      : `Es la serie sobre ${citar(s.tema, idioma)}: ${k} página${k === 1 ? '' : 's enlazadas entre sí'}.`
    const porQue = s.hub ? 'Así la IA encuentra una respuesta para cada forma de preguntar por el tema, y todas llevan a la principal.' : 'Así la IA encuentra una respuesta para cada forma de preguntar por el tema.'
    const faltan = n
      ? `${n === 1 ? 'Falta 1 dato' : `Faltan ${n} datos en total`}; contéstame aquí y ${n === 1 ? 'lo' : 'los'} completo:\n${listaPreguntas(grupos, idioma)}`
      : 'Tienen todos los datos; revísalas y publícalas.'
    const viejas = s.viejas ? `${s.viejas} ya tenía${s.viejas === 1 ? '' : 'n'} tarea en curso y no la${s.viejas === 1 ? '' : 's'} toqué.` : ''
    const fallidas = s.fallidas.length ? `No pude escribir ${s.fallidas.length}: ${s.fallidas.map((f) => citar(f, idioma)).join(', ')}.` : ''
    return [`${que} ${porQue}`, faltan, lineaSiguiente(idioma, true), [viejas, fallidas].filter(Boolean).join(' '), lineaDeRevision(s.revision, idioma, true)].filter(Boolean).join('\n\n')
  }
  const que = s.hub
    ? `It's the series on ${citar(s.tema, idioma)}: the main page ${citar(s.hub.title, idioma)} and ${k} supporting page${k === 1 ? '' : 's'}, linked to each other.`
    : `It's the series on ${citar(s.tema, idioma)}: ${k} page${k === 1 ? '' : 's linked to each other'}.`
  const porQue = s.hub ? 'That way AI assistants find an answer for each way people ask about it, and they all lead to the main page.' : 'That way AI assistants find an answer for each way people ask about it.'
  const faltan = n
    ? `${n === 1 ? '1 fact is missing' : `${n} facts are missing in total`}; answer here and I will fill ${n === 1 ? 'it' : 'them'} in:\n${listaPreguntas(grupos, idioma)}`
    : 'They have every fact they need; review them and publish them.'
  const viejas = s.viejas ? `${s.viejas} already had a task in progress and I left ${s.viejas === 1 ? 'it as it was' : 'them as they were'}.` : ''
  const fallidas = s.fallidas.length ? `I could not write ${s.fallidas.length}: ${s.fallidas.map((f) => citar(f, idioma)).join(', ')}.` : ''
  return [`${que} ${porQue}`, faltan, lineaSiguiente(idioma, true), [viejas, fallidas].filter(Boolean).join(' '), lineaDeRevision(s.revision, idioma, true)].filter(Boolean).join('\n\n')
}

// ---- el archivo ----

/**
 * La meta description: la respuesta directa del primer párrafo, en frases
 * enteras mientras quepan en `max` (bajo los 160 caracteres); si la primera
 * ya no cabe, se corta en una palabra con "…".
 */
export function descripcionMeta(markdown: string, max = 155): string {
  const parrafos = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const parrafo =
    parrafos.find((p) => !/^(#|[-*+]\s|\d+\.\s|\||>|```)/.test(p) && !/^(actualizado|updated)\b/i.test(p.replace(/[*_]/g, '').trim())) ?? ''
  const plano = parrafo
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plano.length <= max) return plano
  let salida = ''
  for (const f of plano.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? []) {
    if ((salida + f).trim().length > max) break
    salida += f
  }
  if (salida.trim()) return salida.trim()
  const corte = plano.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).replace(/[,;:\s]+$/, '')}…`
}

export type ArchivoMd = { nombre: string; contenido: string }

/** La página como archivo: "<slug>.md" con frontmatter YAML (title, description, slug, date) y el borrador. */
export function archivoMd(t: Pick<AgentTask, 'title' | 'body' | 'acceptance' | 'key'>, fecha: string): ArchivoMd {
  const md = borradorDe(t)
  const slug = slugDeTarea(t)
  // Las comillas de JSON son un string de YAML válido (escapa comillas y barras).
  const frente = ['---', `title: ${JSON.stringify(t.title)}`, `description: ${JSON.stringify(descripcionMeta(md))}`, `slug: ${JSON.stringify(slug)}`, `date: ${fecha}`, '---'].join('\n')
  const nombre = `${slug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'pagina'}.md`
  return { nombre, contenido: `${frente}\n\n${md}\n` }
}

// ---- lo que se entrega de un trabajo ----

export type PaginaEntregable = { taskId: string; titulo: string; url: string; archivo: ArchivoMd | null }
export type EntregaBorrador = { estado: Texto; paginas: PaginaEntregable[] }

/**
 * Lo que un canal entrega de un trabajo de borrador terminado: la línea de
 * estado y cada página nueva con su archivo, leída de la tarea (lo mismo que
 * ve el dashboard). Null si el trabajo no dejó páginas para entregar (falló,
 * o la tarea ya estaba tomada y no se cambió): el canal manda el aviso de siempre.
 */
export async function entregaDeBorrador(job: AgentJob, tenant: Pick<Tenant, 'id' | 'slug'>): Promise<EntregaBorrador | null> {
  if (job.status !== 'done' || !job.result) return null
  const datos = (job.result as { datos?: { estado?: Partial<Texto>; paginas?: unknown } }).datos
  const estado = datos?.estado
  if (typeof estado?.es !== 'string' || typeof estado.en !== 'string') return null
  const ids = Array.isArray(datos?.paginas) ? datos.paginas.filter((x): x is string => typeof x === 'string') : []
  const fecha = (job.finishedAt ?? new Date().toISOString()).slice(0, 10)
  const paginas = await Promise.all(
    ids.map(async (id): Promise<PaginaEntregable> => {
      const t = await store.getTask(tenant.id, id).catch(() => null)
      const url = tarjetaTarea(tenant, { id, title: t?.title ?? '', kind: 'content' }).url
      if (!t || !tieneBorrador(t)) return { taskId: id, titulo: t?.title ?? id, url, archivo: null }
      return { taskId: id, titulo: t.title, url, archivo: archivoMd(t, fecha) }
    }),
  )
  return { estado: { es: estado.es, en: estado.en }, paginas }
}

/** Cuando el archivo no sale: el link a la tarea en el dashboard, donde está la página completa. */
export function textoSinArchivo(paginas: Pick<PaginaEntregable, 'titulo' | 'url'>[], idioma: Idioma): string {
  if (paginas.length === 1) {
    return idioma === 'es'
      ? `No pude adjuntar el archivo aquí. La página completa está en tu dashboard: ${paginas[0]!.url}`
      : `I could not attach the file here. The full page is in your dashboard: ${paginas[0]!.url}`
  }
  const lista = paginas.map((p) => `- ${citar(p.titulo, idioma)}: ${p.url}`).join('\n')
  return idioma === 'es'
    ? `No pude adjuntar los archivos aquí. Las páginas completas están en tu dashboard:\n${lista}`
    : `I could not attach the files here. The full pages are in your dashboard:\n${lista}`
}
