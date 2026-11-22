import type { AgentTask, TaskPriority } from '@peaje/db'
import type { Chequeo } from '@peaje/shared'
import type { Oportunidad } from '../google/oportunidades.js'
import { ARREGLO } from '../reportes/visitas.js'

/**
 * La prioridad de cada tarea: un puntaje para ordenar la cola, impacto y
 * esfuerzo relativos, y la evidencia en palabras del dueño. De acá salen "las
 * 3 de esta semana" que Peaje propone sin que nadie pregunte.
 *
 * El orden de fondo: primero lo que impide que la IA lea el sitio (sin eso
 * nada más sirve), después las preguntas de compra donde la IA no cita al
 * negocio (que lo nombren donde ella ya busca, y la página que falta),
 * después lo que Google ya muestra y no rinde, después páginas nuevas, y al
 * final el mantenimiento. Una página informativa (una guía del blog) que
 * Google muestra pesa la mitad que una de compra: trae lecturas, no
 * recomendaciones. El impacto nunca es un pronóstico: dice cuánto pesa la
 * causa dentro del propio sitio.
 */

type Idioma = 'es' | 'en'

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const NOMBRE_ES: Record<string, string> = {
  proxy: 'el kit de Peaje',
  frescura: 'las copias viejas',
  'json-ld': 'los datos que la IA lee de tu negocio',
  links: 'los enlaces que guían a los agentes',
  robots: 'tu robots.txt',
  bots: 'el bloqueo a los bots de búsqueda',
}
const NOMBRE_EN: Record<string, string> = {
  proxy: 'the Peaje kit',
  frescura: 'the stale copies',
  'json-ld': 'the data AI reads about your business',
  links: 'the links that guide agents',
  robots: 'your robots.txt',
  bots: 'the block on search bots',
}

export function prioridadFix(c: Pick<Chequeo, 'id' | 'motivo'>): TaskPriority {
  const t = ARREGLO[c.motivo]
  // Que los bots puedan entrar va antes que cualquier otro arreglo.
  const score = c.id === 'bots' || c.id === 'robots' ? 92 : c.id === 'proxy' ? 90 : 85
  return {
    score,
    impact: 'high',
    effort: 'small',
    label: { es: `Arreglar ${NOMBRE_ES[c.id] ?? c.id}`, en: `Fix ${NOMBRE_EN[c.id] ?? c.id}` },
    why: {
      es: t ? mayuscula(t.es) : 'La revisión diaria de Peaje encontró que esto falla en tu sitio.',
      en: t ? mayuscula(t.en) : "Peaje's daily check found this failing on your site.",
    },
  }
}

export function prioridadBloqueo(b: { bot: string; producto: string; por: 'robots' | 'firewall' }): TaskPriority {
  return {
    score: 95,
    impact: 'high',
    effort: 'small',
    label: { es: `Dejar que ${b.producto} lea tu sitio`, en: `Let ${b.producto} read your site` },
    why:
      b.por === 'robots'
        ? {
            es: `Tu robots.txt le dice a ${b.bot} que no lea el sitio, así que ${b.producto} no puede citarte con un enlace.`,
            en: `Your robots.txt tells ${b.bot} not to read the site, so ${b.producto} cannot cite you with a link.`,
          }
        : {
            es: `Peaje abrió tu sitio como ${b.bot} y quedó bloqueado, mientras que un navegador normal sí entra. ${b.producto} no puede citar lo que no puede abrir.`,
            en: `Peaje opened your site as ${b.bot} and got blocked, while a normal browser gets in. ${b.producto} cannot cite what it cannot open.`,
          },
  }
}

export function prioridadFrescura(p: { ruta: string; fecha: string | null }): TaskPriority {
  return {
    score: p.fecha ? 30 : 25,
    impact: 'low',
    effort: 'small',
    label: p.fecha ? { es: `Actualizar ${p.ruta}`, en: `Refresh ${p.ruta}` } : { es: `Ponerle fecha visible a ${p.ruta}`, en: `Add a visible date to ${p.ruta}` },
    why: p.fecha
      ? { es: `La fecha más reciente de la página es ${p.fecha}. Los asistentes de IA tienden a citar páginas recientes.`, en: `The newest date on the page is ${p.fecha}. AI assistants tend to cite recent pages.` }
      : { es: 'La página no muestra cuándo se actualizó. Los asistentes de IA tienden a citar páginas con fecha.', en: 'The page does not show when it was updated. AI assistants tend to cite dated pages.' },
  }
}

export function prioridadRuta(r: { path: string; visitas: number }): TaskPriority {
  return {
    score: Math.min(70, 40 + r.visitas),
    impact: r.visitas >= 20 ? 'high' : 'medium',
    effort: 'medium',
    label: { es: `Responder ${r.path}`, en: `Serve ${r.path}` },
    why: {
      es: `En los últimos 30 días los agentes pidieron ${r.path} ${r.visitas} veces y tu sitio respondió que no existe.`,
      en: `In the last 30 days agents asked for ${r.path} ${r.visitas} times and your site answered that it does not exist.`,
    },
  }
}

/** Lo que suma una página que responde una pregunta de compra donde la IA hoy no cita al negocio. */
const POR_PREGUNTA_SIN_CITA = 20

/**
 * Una página nueva que propuso el agente. Con el borrador listo, publicar es
 * corto. `sinCita`: sale de la medición de citas, para una pregunta de compra
 * donde la IA no cita al negocio; va antes que retocar una guía del blog.
 */
export function prioridadPagina(s: { pregunta: string; porQue: string }, conBorrador: boolean, sinCita = false): TaskPriority {
  return {
    score: (conBorrador ? 55 : 50) + (sinCita ? POR_PREGUNTA_SIN_CITA : 0),
    impact: sinCita ? 'high' : 'medium',
    effort: conBorrador ? 'small' : 'medium',
    label: { es: `Publicar la página "${s.pregunta}"`, en: `Publish the page "${s.pregunta}"` },
    // La razón la escribe el modelo en el idioma del sitio: va igual en los dos.
    why: { es: s.porQue, en: s.porQue },
  }
}

/** Pedir que te nombren en las páginas de terceros que la IA ya cita para una pregunta de compra. */
export function prioridadMencion(m: { pregunta: string; sitios: string[]; citas: number }): TaskPriority {
  const lista = m.sitios.slice(0, 3).join(', ')
  return {
    // Arriba de la página nueva para la misma pregunta: la IA ya lee esas páginas.
    score: Math.min(80, 72 + m.citas),
    impact: 'high',
    effort: 'medium',
    label: { es: `Pedir que te incluyan donde la IA busca "${m.pregunta}"`, en: `Ask to be included where AI looks for "${m.pregunta}"` },
    why: {
      es: `Para esta pregunta los asistentes de IA no citan tu sitio y sí citan páginas de otros (${lista}). Si esas páginas te nombran, la IA tiene de dónde leer sobre tu negocio.`,
      en: `For this question AI assistants do not cite your site and do cite third-party pages (${lista}). If those pages name you, AI has somewhere to read about your business.`,
    },
  }
}

/** Palabras de quien está por decidir una compra: comparar, alternativas, precio, "el mejor". */
const DE_COMPRA = /(^|[^a-záéíóúñ])(vs|versus|compar[a-z]*|alternativ[a-z]*|precios?|pricing|prices?|planes|plans|tarifas?|cu[aá]nto cuesta|costos?|costs?|mejor(es)?|best|rese[ñn]as?|reviews?|opiniones|comprar|buy|cotiza[a-z]*)(?![a-záéíóúñ])/i

/**
 * Si una página que Google muestra es de compra o informativa. De compra: la
 * portada, o la ruta o alguna de sus búsquedas habla de comparar, precio o
 * alternativas. El resto (guías del blog) es informativa.
 */
export function esDeCompra(o: Pick<Oportunidad, 'ruta' | 'consultas'>): boolean {
  if (o.ruta === '/' || o.ruta === '') return true
  return DE_COMPRA.test(o.ruta.replace(/[-_/]+/g, ' ')) || o.consultas.some((c) => DE_COMPRA.test(c.texto))
}

/** El puntaje de Search Console. Una página informativa conserva su orden entre las suyas, pero lo que suma sobre la base (45) vale la mitad: queda entre 45 y 65. */
const puntajeDeBusqueda = (o: Oportunidad) => (esDeCompra(o) ? o.puntaje : Math.round(45 + (o.puntaje - 45) / 2))

const busquedas = (o: Oportunidad, idioma: Idioma) => {
  const top = o.consultas.slice(0, 2).map((c) => `"${c.texto}"`)
  if (top.length === 0) return ''
  return idioma === 'es' ? ` La gente llega buscando ${top.join(' y ')}.` : ` People get there searching ${top.join(' and ')}.`
}

/** En qué página de resultados de Google cae un puesto promedio: 6.5 es la primera, 68.1 la séptima. */
export const paginaDeGoogle = (posicion: number) => Math.max(1, Math.ceil(posicion / 10))

/**
 * Lo que Peaje midió en Search Console, dicho para alguien que no sabe de SEO:
 * cuántas veces mostró Google la página, en qué página de resultados y cuánta
 * gente entró. Nada de "puesto promedio" ni "impresiones".
 */
export function prioridadBusqueda(o: Oportunidad): TaskPriority {
  const impact: TaskPriority['impact'] = o.parte >= 0.2 ? 'high' : o.parte >= 0.05 ? 'medium' : 'low'
  const pct = Math.max(1, Math.round(o.parte * 100))
  if (o.tipo === 'titulo') {
    return {
      score: puntajeDeBusqueda(o),
      impact,
      effort: 'small',
      label: { es: `Cambiar el título y la descripción de ${o.ruta}`, en: `Rewrite the title and description of ${o.ruta}` },
      why: {
        es: `En los últimos 28 días Google mostró esta página ${o.impresiones} veces en su primera página de resultados y ${o.clics === 0 ? 'nadie hizo clic' : o.clics === 1 ? 'solo 1 persona hizo clic' : `solo ${o.clics} personas hicieron clic`}. Lo que la gente ve ahí es el título y la descripción, así que conviene reescribirlos.${busquedas(o, 'es')}`,
        en: `In the last 28 days Google showed this page ${o.impresiones} times on its first page of results and ${o.clics === 0 ? 'nobody clicked' : o.clics === 1 ? 'only 1 person clicked' : `only ${o.clics} people clicked`}. What people see there is the title and the description, so those are worth rewriting.${busquedas(o, 'en')}`,
      },
    }
  }
  const pagina = paginaDeGoogle(o.posicion)
  return {
    score: puntajeDeBusqueda(o),
    impact,
    effort: 'medium',
    label: { es: `Mejorar ${o.ruta}`, en: `Improve ${o.ruta}` },
    why: {
      es: `En los últimos 28 días Google mostró esta página ${o.impresiones} veces, pero en la página ${pagina} de sus resultados, donde casi nadie llega. Es el ${pct}% de todas las veces que Google muestra tu sitio.${busquedas(o, 'es')}`,
      en: `In the last 28 days Google showed this page ${o.impresiones} times, but on page ${pagina} of its results, where almost nobody looks. It is ${pct}% of all the times Google shows your site.${busquedas(o, 'en')}`,
    },
  }
}

/**
 * La prioridad de una tarea guardada. Las de antes de la columna no la tienen:
 * se deriva de la clave, con el título como etiqueta, para que igual entren en
 * el orden.
 */
export function prioridadDe(t: Pick<AgentTask, 'key' | 'kind' | 'title' | 'summary' | 'priority'>): TaskPriority {
  if (t.priority) return t.priority
  const base = { label: { es: t.title, en: t.title }, why: { es: t.summary, en: t.summary } }
  if (t.kind === 'fix') return { score: 88, impact: 'high', effort: 'small', ...base }
  if (t.kind === 'route') return { score: 42, impact: 'medium', effort: 'medium', ...base }
  if (t.key.startsWith('content:refresh:')) return { score: 28, impact: 'low', effort: 'small', ...base }
  if (t.key.startsWith('content:mention:')) return { score: 72, impact: 'high', effort: 'medium', ...base }
  return { score: 50, impact: 'medium', effort: 'medium', ...base }
}

/** La cola en el orden en que conviene trabajarla; a igual puntaje, la más nueva. */
export function ordenar<T extends Pick<AgentTask, 'key' | 'kind' | 'title' | 'summary' | 'priority' | 'createdAt'>>(tareas: T[]): T[] {
  return [...tareas].sort((a, b) => prioridadDe(b).score - prioridadDe(a).score || b.createdAt.localeCompare(a.createdAt))
}

export type Propuesta = { id: string; kind: AgentTask['kind']; titulo: string; porQue: string; impacto: TaskPriority['impact']; esfuerzo: TaskPriority['effort'] }

/** Cuántas propone Peaje por semana: pocas, para que se hagan. */
export const POR_SEMANA = 3

/** Las que Peaje propone esta semana: las abiertas con más puntaje, en el idioma del dueño. */
export function lasDeLaSemana(tareas: AgentTask[], idioma: Idioma, n = POR_SEMANA): Propuesta[] {
  return ordenar(tareas.filter((t) => t.status === 'open'))
    .slice(0, n)
    .map((t) => {
      const p = prioridadDe(t)
      return { id: t.id, kind: t.kind, titulo: p.label[idioma], porQue: p.why[idioma], impacto: p.impact, esfuerzo: p.effort }
    })
}

export const TEXTO_IMPACTO: Record<Idioma, Record<TaskPriority['impact'], string>> = {
  es: { high: 'impacto alto', medium: 'impacto medio', low: 'impacto bajo' },
  en: { high: 'high impact', medium: 'medium impact', low: 'low impact' },
}
export const TEXTO_ESFUERZO: Record<Idioma, Record<TaskPriority['effort'], string>> = {
  es: { small: 'poco trabajo', medium: 'trabajo medio', large: 'mucho trabajo' },
  en: { small: 'small effort', medium: 'medium effort', large: 'large effort' },
}
