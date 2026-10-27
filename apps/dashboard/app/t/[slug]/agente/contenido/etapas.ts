import type { AgentTask, CitationRun, TaskCheck, TaskFollowup, TaskStatus } from '@peaje/db'
import { borradorDe, direccionDe, esDeSerie, formatoDe, instruccionesDe, pendientesDe } from '../reportes'

/**
 * El pipeline de contenido: cada tarea de contenido del agente Pro, con sus
 * etapas, su evidencia y su prioridad, derivadas solo de los datos guardados
 * (la tarea, sus seguimientos a 2 y 6 semanas y las rondas de citación).
 * Funciones puras: sin store, sin gateway, sin modelo.
 *
 * Reglas de las etapas (una etapa sin datos que la prueben nunca sale hecha):
 *   identificada  la tarea existe
 *   brief         el cuerpo trae instrucciones antes de "## Draft"
 *   borrador      el cuerpo trae la página después de "## Draft"
 *   revision      hay borrador y la tarea sigue abierta o en curso (faltan
 *                 datos o espera que alguien la publique); hecha cuando el
 *                 dueño la marcó publicada
 *   publicada     verificada en vivo, o marcada hecha con su URL
 * Y abajo, el resultado: si Peaje la vio en vivo y los seguimientos.
 *
 * Prioridad: cuántos asistentes contestan la pregunta sin citar el sitio en
 * la última ronda que la midió; desempata cuántos sitios citan en su lugar.
 * Sin ronda que mida esa pregunta, no hay número.
 */

export const ETAPAS = ['identificada', 'brief', 'borrador', 'revision', 'publicada'] as const
export type EtapaId = (typeof ETAPAS)[number]
export type EstadoEtapa = 'hecha' | 'actual' | 'pendiente' | 'sin-dato'

/** El porqué de cada etapa, para la línea chica debajo del nombre. */
export type MotivoEtapa =
  | 'creada'
  | 'con-instrucciones'
  | 'sin-instrucciones'
  | 'con-borrador'
  | 'sin-borrador-aun'
  | 'sin-borrador'
  | 'no-lleva'
  | 'faltan'
  | 'lista'
  | 'en-curso'
  | 'esperando-borrador'
  | 'revisada'
  | 'revisada-con-faltan'
  | 'no-aplica'
  | 'publicada'
  | 'sin-direccion'
  | 'por-publicar'
  | 'descartada'

export type Etapa = { id: EtapaId; estado: EstadoEtapa; motivo: MotivoEtapa; fecha: string | null }

/** Los cuatro grupos del filtro. Las descartadas solo salen en "Todas". */
export type Filtro = 'listo' | 'pendiente' | 'publicada' | 'descartada'

export type Insignia = 'faltan' | 'lista' | 'en-curso' | 'sin-borrador' | 'por-actualizar' | 'revisando' | 'verificada' | 'descartada'

export type EstadoMotor = 'cita' | 'nombra' | 'no' | 'error'

export type PaginaCitada = { domain: string; url: string | null; title: string | null }

export type RespuestaMotor = { engine: string; estado: EstadoMotor; enTuLugar: PaginaCitada[] }

export type Evidencia = {
  roundId: string
  medidoEn: string
  motores: RespuestaMotor[]
  /** Formato de las páginas citadas en lugar del sitio, solo las de formato conocido, de más a menos. */
  formatos: { format: string; paginas: number }[]
  paginasConFormato: number
}

export type Prioridad = {
  /** Asistentes que contestaron y no citan el sitio (nombrarlo sin link no cuenta como cita). */
  noCitan: number
  /** Asistentes que contestaron esa pregunta en esa ronda. */
  respondieron: number
  /** Sitios distintos citados en las respuestas que no citan al negocio. */
  otros: number
}

export type Medicion = {
  kind: TaskFollowup['kind']
  dueAt: string
  doneAt: string | null
  /** Motores que citan el sitio en ese seguimiento. Null si no se pudo preguntar o no es una pregunta. */
  citan: string[] | null
  preguntados: number
  veredicto: string | null
  veredictoEs: string | null
}

export type Resultado = {
  /** 'vista': Peaje la abrió en vivo y pasó. 'no-vista': marcada hecha, todavía no pasa. */
  enVivo: 'vista' | 'no-vista' | null
  /** La citación al verificarla, si la pregunta ya se medía. */
  antes: { citan: string[]; preguntados: number } | null
  mediciones: Medicion[]
}

export type Pieza = {
  id: string
  titulo: string
  /** La pregunta que contesta. Null en las de frescura ("Refresh /x"). */
  pregunta: string | null
  tipo: 'nueva' | 'actualizar'
  formato: string | null
  modelo: string | null
  serie: boolean
  status: TaskStatus
  porQue: string
  nota: string | null
  instrucciones: string
  borrador: string | null
  pendientes: string[]
  /** El cuerpo completo, para copiar a la herramienta de IA del dueño. */
  cuerpo: string
  /** Nombre de archivo para bajar el borrador. */
  archivo: string
  /** Dónde va a vivir (criterio de aceptación). */
  direccion: string | null
  /** Dónde quedó publicada: la URL que dio el dueño, o la que Peaje verificó. */
  url: string | null
  criterios: TaskCheck[]
  creadaEn: string
  actualizadaEn: string
  hechaEn: string | null
  verificadaEn: string | null
  etapas: Etapa[]
  filtro: Filtro
  insignia: Insignia
  evidencia: Evidencia | null
  prioridad: Prioridad | null
  resultado: Resultado | null
}

/** Orden en que se muestran los motores. Los que no están acá van al final, por id. */
const ORDEN_MOTORES = ['chatgpt', 'perplexity', 'claude', 'gemini']

export const NOMBRE_MOTOR: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', claude: 'Claude', gemini: 'Gemini' }

export const nombreMotor = (id: string) => NOMBRE_MOTOR[id] ?? id

const ordenMotor = (id: string) => {
  const i = ORDEN_MOTORES.indexOf(id)
  return i === -1 ? ORDEN_MOTORES.length : i
}

export const esFrescura = (t: Pick<AgentTask, 'key'>) => t.key.startsWith('content:refresh:')

/** Los datos que faltan en un borrador, sin repetir: un mismo [TODO] en dos lugares es un solo dato. */
export const faltanDe = (borrador: string) => [...new Set(pendientesDe(borrador))]

/**
 * Misma pregunta: igual texto sin importar mayúsculas, tildes, signos ni
 * espacios. Es el vínculo que usa el gateway entre una tarea y su medición
 * (el título de la tarea es la pregunta), con signos y tildes de más.
 */
export const normalPregunta = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,:;"'«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const esPropio = (dominio: string, raiz: string | null) => !!raiz && (dominio === raiz || dominio.endsWith(`.${raiz}`))

/** Lo que citó una respuesta, sin el sitio propio y sin repetir. Sin páginas (corridas viejas), los dominios. */
function citadasEnLugar(r: CitationRun, raiz: string | null): PaginaCitada[] {
  const vistas = new Set<string>()
  const filas: PaginaCitada[] = r.pages.length ? r.pages.map((p) => ({ domain: p.domain, url: p.url, title: p.title })) : r.domains.map((d) => ({ domain: d, url: null, title: null }))
  return filas.filter((p) => {
    if (esPropio(p.domain, raiz)) return false
    const k = p.url ?? p.domain
    if (vistas.has(k)) return false
    vistas.add(k)
    return true
  })
}

/**
 * La última ronda que midió esta pregunta: qué contestó cada motor, a quién
 * citó en lugar del sitio y qué formato tenían esas páginas. Null si ninguna
 * ronda de las que hay la midió.
 */
export function evidenciaDe(pregunta: string, runs: CitationRun[], raiz: string | null): { evidencia: Evidencia; prioridad: Prioridad | null } | null {
  const clave = normalPregunta(pregunta)
  const deLaPregunta = runs.filter((r) => normalPregunta(r.promptText) === clave).sort((a, b) => b.runAt.localeCompare(a.runAt))
  const ultima = deLaPregunta[0]
  if (!ultima) return null
  const ronda = deLaPregunta.filter((r) => r.roundId === ultima.roundId)
  // Un motor por ronda; si hubiera dos filas, la más nueva.
  const porMotor = new Map<string, CitationRun>()
  for (const r of ronda) if (!porMotor.has(r.engine)) porMotor.set(r.engine, r)
  const filas = [...porMotor.values()].sort((a, b) => ordenMotor(a.engine) - ordenMotor(b.engine) || a.engine.localeCompare(b.engine))

  const motores: RespuestaMotor[] = filas.map((r) => ({
    engine: r.engine,
    estado: r.error ? 'error' : r.cited ? 'cita' : r.mentioned ? 'nombra' : 'no',
    enTuLugar: r.error ? [] : citadasEnLugar(r, raiz),
  }))

  const respondieron = filas.filter((r) => !r.error)
  const sinCita = respondieron.filter((r) => !r.cited)
  const otros = new Set(sinCita.flatMap((r) => citadasEnLugar(r, raiz).map((p) => p.domain)))

  const conteo = new Map<string, number>()
  for (const r of respondieron) {
    for (const p of r.pages) {
      if (!p.format || esPropio(p.domain, raiz)) continue
      conteo.set(p.format, (conteo.get(p.format) ?? 0) + 1)
    }
  }
  const formatos = [...conteo.entries()].map(([format, paginas]) => ({ format, paginas })).sort((a, b) => b.paginas - a.paginas || a.format.localeCompare(b.format))

  return {
    evidencia: { roundId: ultima.roundId, medidoEn: ultima.runAt, motores, formatos, paginasConFormato: formatos.reduce((s, f) => s + f.paginas, 0) },
    prioridad: respondieron.length ? { noCitan: sinCita.length, respondieron: respondieron.length, otros: otros.size } : null,
  }
}

const abierta = (s: TaskStatus) => s === 'open' || s === 'in_progress'
const hecha = (s: TaskStatus) => s === 'done' || s === 'verified'

/** Las cinco etapas de una tarea de contenido. */
export function etapasDe(t: Pick<AgentTask, 'key' | 'body' | 'status' | 'createdAt' | 'doneAt' | 'verifiedAt' | 'doneUrl'>): Etapa[] {
  const frescura = esFrescura(t)
  const borrador = borradorDe(t)
  const faltan = borrador ? faltanDe(borrador).length : 0
  const instrucciones = instruccionesDe(t).trim()
  const s = t.status

  const identificada: Etapa = { id: 'identificada', estado: 'hecha', motivo: 'creada', fecha: t.createdAt }

  const brief: Etapa = instrucciones ? { id: 'brief', estado: 'hecha', motivo: 'con-instrucciones', fecha: null } : { id: 'brief', estado: 'sin-dato', motivo: 'sin-instrucciones', fecha: null }

  let etapaBorrador: Etapa
  if (borrador) etapaBorrador = { id: 'borrador', estado: 'hecha', motivo: 'con-borrador', fecha: null }
  else if (frescura) etapaBorrador = { id: 'borrador', estado: 'sin-dato', motivo: 'no-lleva', fecha: null }
  else if (abierta(s)) etapaBorrador = { id: 'borrador', estado: 'actual', motivo: 'sin-borrador-aun', fecha: null }
  else etapaBorrador = { id: 'borrador', estado: 'sin-dato', motivo: 'sin-borrador', fecha: null }

  let revision: Etapa
  if (s === 'dismissed') revision = { id: 'revision', estado: 'sin-dato', motivo: 'no-aplica', fecha: null }
  else if (!borrador) revision = frescura || hecha(s) ? { id: 'revision', estado: 'sin-dato', motivo: 'no-aplica', fecha: null } : { id: 'revision', estado: 'pendiente', motivo: 'esperando-borrador', fecha: null }
  else if (hecha(s)) revision = { id: 'revision', estado: 'hecha', motivo: faltan ? 'revisada-con-faltan' : 'revisada', fecha: t.doneAt }
  else revision = { id: 'revision', estado: 'actual', motivo: s === 'in_progress' ? 'en-curso' : faltan ? 'faltan' : 'lista', fecha: null }

  let publicada: Etapa
  if (s === 'verified') publicada = { id: 'publicada', estado: 'hecha', motivo: 'publicada', fecha: t.doneAt ?? t.verifiedAt }
  else if (s === 'done') publicada = t.doneUrl ? { id: 'publicada', estado: 'hecha', motivo: 'publicada', fecha: t.doneAt } : { id: 'publicada', estado: 'actual', motivo: 'sin-direccion', fecha: t.doneAt }
  else if (s === 'dismissed') publicada = { id: 'publicada', estado: 'sin-dato', motivo: 'descartada', fecha: null }
  // Las de frescura no llevan borrador: lo que sigue es actualizar la página.
  else publicada = { id: 'publicada', estado: frescura ? 'actual' : 'pendiente', motivo: 'por-publicar', fecha: null }

  return [identificada, brief, etapaBorrador, revision, publicada]
}

export const etapa = (etapas: Etapa[], id: EtapaId) => etapas.find((e) => e.id === id)!

export function filtroDe(etapas: Etapa[], status: TaskStatus): Filtro {
  if (status === 'dismissed') return 'descartada'
  if (etapa(etapas, 'publicada').estado === 'hecha') return 'publicada'
  if (etapa(etapas, 'revision').estado === 'actual') return 'listo'
  return 'pendiente'
}

export function insigniaDe(t: Pick<AgentTask, 'key' | 'body' | 'status'>): Insignia {
  if (t.status === 'dismissed') return 'descartada'
  if (t.status === 'verified') return 'verificada'
  if (t.status === 'done') return 'revisando'
  if (t.status === 'in_progress') return 'en-curso'
  if (esFrescura(t)) return 'por-actualizar'
  const borrador = borradorDe(t)
  if (!borrador) return 'sin-borrador'
  return faltanDe(borrador).length ? 'faltan' : 'lista'
}

const motoresQueCitan = (c: Record<string, { cited: boolean }> | null | undefined) =>
  Object.entries(c ?? {})
    .filter(([, v]) => v.cited)
    .map(([k]) => k)
    .sort((a, b) => ordenMotor(a) - ordenMotor(b))

/** Si Peaje la vio en vivo y lo que midieron los seguimientos. Null mientras no se marque publicada. */
export function resultadoDe(t: Pick<AgentTask, 'id' | 'status'>, seguimientos: TaskFollowup[]): Resultado | null {
  const propios = seguimientos.filter((f) => f.taskId === t.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  if (!hecha(t.status) && propios.length === 0) return null
  const conFoto = propios.find((f) => f.before.citation && Object.keys(f.before.citation).length)
  return {
    enVivo: t.status === 'verified' ? 'vista' : t.status === 'done' ? 'no-vista' : null,
    antes: conFoto ? { citan: motoresQueCitan(conFoto.before.citation), preguntados: Object.keys(conFoto.before.citation!).length } : null,
    mediciones: propios.map((f) => {
      const c = f.doneAt ? f.after?.citation : null
      const preguntados = c ? Object.keys(c).length : 0
      return {
        kind: f.kind,
        dueAt: f.dueAt,
        doneAt: f.doneAt,
        citan: preguntados ? motoresQueCitan(c) : null,
        preguntados,
        veredicto: f.verdict,
        veredictoEs: f.after?.verdictEs ?? null,
      }
    }),
  }
}

function archivoDe(t: Pick<AgentTask, 'key' | 'title'>, direccion: string | null): string {
  let base = ''
  if (t.key.startsWith('content:') && !esFrescura(t)) base = t.key.slice('content:'.length)
  else if (direccion) {
    try {
      base = new URL(direccion).pathname.split('/').filter(Boolean).at(-1) ?? ''
    } catch {
      base = ''
    }
  }
  if (!base) base = t.title
  const limpio = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${limpio || 'pagina'}.md`
}

export function piezaDe(t: AgentTask, seguimientos: TaskFollowup[], runs: CitationRun[], raiz: string | null): Pieza {
  const frescura = esFrescura(t)
  const borrador = borradorDe(t)
  const { formato, modelo } = formatoDe(t)
  const direccion = direccionDe(t)
  const pregunta = frescura ? null : t.title.trim() || null
  const medida = pregunta ? evidenciaDe(pregunta, runs, raiz) : null
  const etapas = etapasDe(t)
  return {
    id: t.id,
    titulo: t.title,
    pregunta,
    tipo: frescura ? 'actualizar' : 'nueva',
    formato,
    modelo,
    serie: esDeSerie(t),
    status: t.status,
    porQue: t.summary,
    nota: t.note,
    instrucciones: instruccionesDe(t),
    borrador,
    pendientes: borrador ? faltanDe(borrador) : [],
    cuerpo: t.body,
    archivo: archivoDe(t, direccion),
    direccion,
    url: t.doneUrl ?? (t.status === 'verified' ? direccion : null),
    criterios: t.acceptance,
    creadaEn: t.createdAt,
    actualizadaEn: t.updatedAt,
    hechaEn: t.doneAt,
    verificadaEn: t.verifiedAt,
    etapas,
    filtro: filtroDe(etapas, t.status),
    insignia: insigniaDe(t),
    evidencia: medida?.evidencia ?? null,
    prioridad: medida?.prioridad ?? null,
    resultado: resultadoDe(t, seguimientos),
  }
}

const RANGO: Record<Filtro, number> = { listo: 0, pendiente: 0, publicada: 1, descartada: 2 }

/**
 * Orden de la lista: primero las que faltan publicar, por prioridad (las sin
 * medir al final, las más recientes primero); después las publicadas, la más
 * nueva arriba; al final las descartadas.
 */
export function compararPiezas(a: Pieza, b: Pieza): number {
  const r = RANGO[a.filtro] - RANGO[b.filtro]
  if (r) return r
  if (RANGO[a.filtro] === 0) {
    const pa = a.prioridad
    const pb = b.prioridad
    if (pa && pb) return pb.noCitan - pa.noCitan || pb.otros - pa.otros || b.actualizadaEn.localeCompare(a.actualizadaEn)
    if (pa) return -1
    if (pb) return 1
    return b.actualizadaEn.localeCompare(a.actualizadaEn)
  }
  const fa = a.verificadaEn ?? a.hechaEn ?? a.actualizadaEn
  const fb = b.verificadaEn ?? b.hechaEn ?? b.actualizadaEn
  return fb.localeCompare(fa)
}

/** Todas las tareas de contenido del negocio, como pipeline y en orden. */
export function armarPipeline(tareas: AgentTask[], seguimientos: TaskFollowup[], runs: CitationRun[], raiz: string | null): Pieza[] {
  return tareas
    .filter((t) => t.kind === 'content')
    .map((t) => piezaDe(t, seguimientos, runs, raiz))
    .sort(compararPiezas)
}

export function contarFiltros(piezas: Pieza[]): Record<'todas' | Exclude<Filtro, 'descartada'>, number> {
  return {
    todas: piezas.length,
    listo: piezas.filter((p) => p.filtro === 'listo').length,
    pendiente: piezas.filter((p) => p.filtro === 'pendiente').length,
    publicada: piezas.filter((p) => p.filtro === 'publicada').length,
  }
}
