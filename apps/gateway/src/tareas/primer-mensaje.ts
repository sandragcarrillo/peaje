import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AgentTask, Tenant, Verificacion } from '@peaje/db'
import { dominioVerificable, type Chequeo, type Motivo } from '@peaje/shared'
import { z } from 'zod'
import { store } from '../store.js'
import { DASHBOARD } from '../monitor/reporte.js'
import { ARREGLO, PRIORIDAD } from '../reportes/visitas.js'
import { resumenCitacion, type ResumenCitacion } from '../citacion/medir.js'
import { programarVisitas } from './agente.js'

/**
 * El primer mensaje del agente al conectar un chat (Telegram, Slack): habla
 * él primero, con lo que Peaje ya sabe del sitio. En orden:
 *
 *   1. el puntaje de Ora y cuántas de las cosas que revisa Peaje pasan
 *   2. qué arreglar primero: si el kit no está puesto, instalarlo (con el
 *      enlace a Kit) y después lo que el kit no arregla; si está, los tres
 *      arreglos que más pesan
 *   3. dos o tres ideas de cómo presentarse ante la IA (una llamada a un
 *      modelo barato, solo con datos guardados: descripción, objetivo del
 *      plan, preguntas medidas, quién cita y qué formatos)
 *   4. qué mide después y la pregunta de cada cuánto mandar el resumen, con
 *      botones que programan el reporte de visitas
 *
 * Sin datos todavía, lo dice tal cual en vez de inventar números. No pasa por
 * `conversar`: no guarda un mensaje del dueño ni cobra créditos. Sale una vez
 * por negocio y destino (agent_intros).
 */

type Idioma = 'es' | 'en'

export type Cadencia = 'semanal' | 'diaria' | 'mensual' | 'no'
export const CADENCIAS: Cadencia[] = ['semanal', 'diaria', 'mensual', 'no']
export const esCadencia = (x: unknown): x is Cadencia => CADENCIAS.includes(x as Cadencia)

export type PrimerMensaje = {
  /** Markdown mínimo (**negrita**, viñetas "- ", lista "1."): cada canal lo convierte. */
  texto: string
  /** El enlace a Kit cuando el kit no está puesto: el canal lo agrega como botón. */
  kitUrl: string | null
  opciones: { clave: Cadencia; texto: string }[]
}

const MODELO = process.env.INTRO_MODEL ?? 'claude-haiku-4-5'

/**
 * Lo que el kit arregla solo (proxy al gateway, copias viejas que mueve,
 * JSON-LD, enlaces de descubrimiento, robots.txt que falta). Lo demás (bots
 * bloqueados por un firewall, un robots.txt que ya bloquea todo, el enlace
 * visible a /developers) queda como arreglo aparte.
 */
const KIT_ARREGLA = new Set<Motivo>(['proxy-nada', 'proxy-parcial', 'copias-viejas', 'jsonld-falta', 'links-falta', 'robots-falta'])

const T = {
  es: {
    hola: (n: string, conDatos: boolean) => `Ya estoy trabajando para ${n}.${conDatos ? ' Esto es lo que veo hoy.' : ''}`,
    sinDominio: 'Para revisar tu sitio necesito su dominio público. Agrégalo en Peaje y empiezo a revisarlo cada día.',
    midiendo: (d: string) => `Todavía no tengo la primera revisión de ${d}. Peaje revisa tu sitio una vez al día, así que en menos de 24 horas sé qué arreglar primero.`,
    puntaje: (s: number) => `Hoy tu sitio tiene **${s} de 100** en qué tan listo está para los agentes de IA, según Ora, un medidor independiente.`,
    chequeos: (ok: number, total: number) =>
      ok === total
        ? `Las ${total} cosas que Peaje revisa en tu sitio están bien.`
        : `De las ${total} cosas que Peaje revisa en tu sitio, ${ok === 0 ? 'ninguna está bien todavía' : ok === 1 ? '1 está bien' : `${ok} están bien`}.`,
    primero: 'Lo primero que conviene hacer:',
    kit: (url: string, arregla: number, fallan: number) =>
      `**Instala el kit de Peaje.** Pone en tu sitio lo que los agentes de IA leen para entender qué ofreces y cómo usarte, y nos deja contar sus visitas.${arregla ? ` Arregla ${arregla} de las ${fallan} cosas que hoy fallan en la revisión.` : ''} Está en Kit: ${url}`,
    robotsBot: (p: string) => `Tu robots.txt no deja que ${p} lea tu sitio. Déjalo entrar.`,
    firewall: (p: string) => `La protección de tu sitio (firewall) bloquea a ${p}. Déjalo pasar.`,
    posicion: 'Cómo te conviene presentarte ante la IA:',
    sinPreguntas: 'Lo próximo que mido: qué responden los asistentes de IA como ChatGPT, Claude o Perplexity cuando tus clientes preguntan por lo que ofreces. Elijo esas preguntas cuando armemos tu plan; escríbeme "arma mi plan" cuando quieras.',
    sinMedir: (n: number) => `Lo próximo que mido: si los asistentes de IA como ChatGPT, Claude o Perplexity te citan en ${n === 1 ? 'la pregunta' : `las ${n} preguntas`} que sigo por ti.`,
    midiendoCitas: (n: number) => `Sigo midiendo si los asistentes de IA te citan en ${n === 1 ? 'la pregunta' : `las ${n} preguntas`} que sigo por ti, y te aviso qué cambia.`,
    cadencia:
      '¿Cada cuánto quieres que te cuente cómo vas? Te mando qué agentes de IA entraron a tu sitio y qué leyeron, cómo cambió desde la vez anterior y, si no llegó ninguno, qué arreglar primero.',
    botones: { semanal: 'Cada lunes, 8 a. m.', diaria: 'Cada día, 8 a. m.', mensual: 'El 1 de cada mes', no: 'Ahora no' } as Record<Cadencia, string>,
    abrirKit: 'Abrir el kit',
    listo: (c: Exclude<Cadencia, 'no'>, zona: string) =>
      `Listo, te escribo ${c === 'semanal' ? 'todos los lunes' : c === 'diaria' ? 'todos los días' : 'el 1 de cada mes'} a las 8 a. m. (${zona}). Si prefieres otro día u hora, dímelo.`,
    ahoraNo: 'Bueno, no programo nada. Cuando quieras, dime cada cuánto y lo dejo listo.',
    noPude: 'No pude programarlo ahora. Prueba de nuevo en un rato o dime cada cuánto con tus palabras.',
  },
  en: {
    hola: (n: string, conDatos: boolean) => `I am already working for ${n}.${conDatos ? ' Here is what I see today.' : ''}`,
    sinDominio: 'To check your site I need its public domain. Add it in Peaje and I will start checking it every day.',
    midiendo: (d: string) => `I do not have the first check of ${d} yet. Peaje checks your site once a day, so within 24 hours I will know what to fix first.`,
    puntaje: (s: number) => `Today your site scores **${s} out of 100** on how ready it is for AI agents, according to Ora, an independent scanner.`,
    chequeos: (ok: number, total: number) =>
      ok === total
        ? `All ${total} things Peaje checks on your site are fine.`
        : ok === 0
          ? `None of the ${total} things Peaje checks on your site are fine yet.`
          : `${ok} of the ${total} things Peaje checks on your site ${ok === 1 ? 'is' : 'are'} fine.`,
    primero: 'What to do first:',
    kit: (url: string, arregla: number, fallan: number) =>
      `**Install the Peaje kit.** It puts on your site what AI agents read to understand what you offer and how to use you, and lets us count their visits.${arregla ? ` It fixes ${arregla} of the ${fallan} things failing in today's check.` : ''} It is in Kit: ${url}`,
    robotsBot: (p: string) => `Your robots.txt does not let ${p} read your site. Let it in.`,
    firewall: (p: string) => `Your site's protection (firewall) blocks ${p}. Let it through.`,
    posicion: 'How to present yourself to AI assistants:',
    sinPreguntas: 'What I measure next: what AI assistants like ChatGPT, Claude or Perplexity answer when your customers ask about what you offer. I pick those questions when we build your plan; write "build my plan" whenever you want.',
    sinMedir: (n: number) => `What I measure next: whether AI assistants like ChatGPT, Claude or Perplexity cite you for the ${n === 1 ? 'question' : `${n} questions`} I track for you.`,
    midiendoCitas: (n: number) => `I keep measuring whether AI assistants cite you for the ${n === 1 ? 'question' : `${n} questions`} I track for you, and I tell you what changes.`,
    cadencia: 'How often do you want me to tell you how it is going? I send which AI agents came to your site and what they read, how that changed since last time, and if none came, what to fix first.',
    botones: { semanal: 'Mondays, 8 am', diaria: 'Every day, 8 am', mensual: 'The 1st of each month', no: 'Not now' } as Record<Cadencia, string>,
    abrirKit: 'Open the kit',
    listo: (c: Exclude<Cadencia, 'no'>, zona: string) =>
      `Done, I will write ${c === 'semanal' ? 'every Monday' : c === 'diaria' ? 'every day' : 'on the 1st of each month'} at 8 am (${zona}). If you want another day or time, tell me.`,
    ahoraNo: 'Okay, nothing scheduled. Whenever you want, tell me how often and I will set it up.',
    noPude: 'I could not schedule it right now. Try again in a while or tell me how often in your own words.',
  },
}

export const textoBotonKit = (idioma: Idioma) => T[idioma].abrirKit

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Kit puesto según la última revisión: el proxy responde en alguna de sus rutas. */
export function estadoDelKit(v: Verificacion | null): 'puesto' | 'falta' | 'sin-datos' {
  const proxy = ((v?.checks ?? []) as Chequeo[]).find((c) => c.id === 'proxy')
  if (!proxy) return 'sin-datos'
  return proxy.motivo === 'proxy-nada' ? 'falta' : 'puesto'
}

/** Los arreglos en el orden en que conviene hacerlos, en palabras del dueño. */
function arreglos(chequeos: Chequeo[], tareas: AgentTask[], kit: 'puesto' | 'falta' | 'sin-datos', idioma: Idioma): string[] {
  const descartadas = new Set(tareas.filter((t) => t.status === 'dismissed').map((t) => t.key))
  const items: { rango: number; texto: string }[] = []
  for (const c of chequeos) {
    if (c.ok || c.id === 'dominio' || descartadas.has(`fix:${c.id}`)) continue
    if (kit === 'falta' && KIT_ARREGLA.has(c.motivo)) continue
    const t = ARREGLO[c.motivo]
    if (t) items.push({ rango: PRIORIDAD.indexOf(c.id), texto: mayuscula(t[idioma]) })
  }
  // Bots que responden y quedan afuera (revisión de acceso): van junto a "bots".
  for (const t of tareas.filter((x) => x.status === 'open' && x.kind === 'fix')) {
    const robots = /^fix:robots:/.test(t.key) ? /^Let (.+) read the site/.exec(t.title)?.[1] : undefined
    const firewall = /^fix:firewall:/.test(t.key) ? /^Your firewall blocks (.+?) \(/.exec(t.title)?.[1] : undefined
    if (robots) items.push({ rango: PRIORIDAD.indexOf('bots') + 0.5, texto: T[idioma].robotsBot(robots) })
    else if (firewall) items.push({ rango: PRIORIDAD.indexOf('bots') + 0.5, texto: T[idioma].firewall(firewall) })
  }
  return items.sort((a, b) => a.rango - b.rango).map((x) => x.texto)
}

// ---------------------------------------------------------------- posicionamiento

const IdeasSchema = z.object({ suggestions: z.array(z.string()) })
let anthropic: Anthropic | null = null

/** Los datos guardados que se le dan al modelo, como texto. Vacío si no hay con qué. */
function datosDePosicion(tenant: Tenant, o: { preguntas: string[]; citacion: ResumenCitacion | null; objetivo: string | null }): string {
  const lineas: string[] = []
  if (tenant.entityDescription?.trim()) lineas.push(`Description of the business (what AI agents read): ${tenant.entityDescription.trim()}`)
  if (o.objetivo) lineas.push(`Owner goal: ${o.objetivo}`)
  if (o.preguntas.length) lineas.push(`Questions customers ask AI assistants that Peaje tracks for this business:\n${o.preguntas.slice(0, 10).map((p) => `- ${p}`).join('\n')}`)
  const c = o.citacion
  if (c?.measuredAt) {
    const citada = c.byPrompt.filter((p) => Object.values(p.engines).some((e) => e.cited)).map((p) => p.prompt)
    const noCitada = c.byPrompt.filter((p) => !Object.values(p.engines).some((e) => e.cited)).map((p) => p.prompt)
    if (citada.length) lineas.push(`Questions where an AI assistant already cites the site: ${citada.slice(0, 5).join(' | ')}`)
    if (noCitada.length) lineas.push(`Questions where no AI assistant cites the site: ${noCitada.slice(0, 5).join(' | ')}`)
    if (c.competitors.length) lineas.push(`Sites cited instead: ${c.competitors.slice(0, 5).map((x) => x.domain).join(', ')}`)
    if (c.formats.formats.length) lineas.push(`Page formats AI assistants cite for these questions, most cited first: ${c.formats.formats.slice(0, 3).map((f) => f.format).join(', ')}`)
  }
  if (!lineas.length) return ''
  return [`Business: ${tenant.name} (${dominioVerificable(tenant.originUrl) ?? tenant.originUrl})`, ...lineas].join('\n')
}

/**
 * Dos o tres ideas cortas, solo con los datos guardados. Una llamada barata;
 * si falla o no hay datos, ninguna (el mensaje sale igual). Una idea con un
 * número que no está en los datos se descarta.
 */
export async function ideasDePosicion(tenant: Tenant, idioma: Idioma, o: { preguntas: string[]; citacion: ResumenCitacion | null; objetivo: string | null }): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []
  const datos = datosDePosicion(tenant, o)
  if (!datos) return []
  anthropic ??= new Anthropic()
  try {
    const res = await anthropic.messages.parse(
      {
        model: MODELO,
        max_tokens: 800,
        system: [
          'You give the owner of a small business two or three short, concrete suggestions on how to position their website so AI assistants like ChatGPT, Claude or Perplexity describe it well and recommend it.',
          `Write in ${idioma === 'es' ? 'Spanish (neutral Latin American, tú)' : 'English'}, for an owner who is not technical. Each suggestion is one or two short sentences.`,
          'Cover, in this order, as far as the data allows: how AI assistants should describe the business (one plain sentence they could say); which customer questions to aim to win first (quote one or two of the tracked questions exactly); which kind of page tends to get cited for those questions (use the measured formats if given, in plain words such as a guide, a comparison or a list of the best options).',
          'Use only the facts given. Never write a number, a price or a percentage. Never name a site, a competitor or a customer that is not in the data. Never promise results.',
          'If the data is thin, keep the suggestions general and practical instead of guessing what the business does.',
          'No hype, no em dashes, no "it is not X, it is Y" phrasing, no headings, no preamble.',
        ].join('\n'),
        messages: [{ role: 'user', content: datos }],
        output_config: { format: zodOutputFormat(IdeasSchema) },
      },
      { timeout: 15_000, maxRetries: 1 },
    )
    const numerosDeLosDatos = new Set(datos.match(/\d+/g) ?? [])
    return (res.parsed_output?.suggestions ?? [])
      .map((s) => s.replace(/\s+—\s+/g, ', ').replace(/—/g, ', ').replace(/^\s*[-*•\d.]+\s+/, '').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 12 && s.length <= 400)
      .filter((s) => (s.match(/\d+/g) ?? []).every((n) => numerosDeLosDatos.has(n)))
      .slice(0, 3)
  } catch (error) {
    console.warn('[primer mensaje] sin ideas de posicionamiento', tenant.slug, error instanceof Error ? error.message : error)
    return []
  }
}

// ---------------------------------------------------------------- el mensaje

export async function armarPrimerMensaje(tenant: Tenant, idioma: Idioma): Promise<PrimerMensaje> {
  const t = T[idioma]
  const dominio = dominioVerificable(tenant.originUrl)
  const [historial, tareas, preguntas, citacion, plan] = await Promise.all([
    store.verificationHistory(tenant.id, 10),
    store.listTasks(tenant.id, { statuses: [] }),
    store.listCitationPrompts(tenant.id),
    resumenCitacion(tenant).catch(() => null),
    store.getPlan(tenant.id),
  ])
  // La revisión del kit desde el dashboard guarda la corrida sin puntaje: el puntaje sale de la última que lo tenga.
  const v = historial[0] ?? null
  const puntaje = historial.find((x) => typeof x.score === 'number')?.score ?? null
  const chequeos = ((v?.checks ?? []) as Chequeo[]).filter((c) => c.id !== 'dominio')
  const kit = estadoDelKit(v)
  const kitUrl = kit === 'falta' ? `${DASHBOARD}/t/${tenant.slug}/kit` : null

  const partes: string[] = [t.hola(tenant.name, !!v && chequeos.length > 0)]
  if (!dominio) partes.push(t.sinDominio)
  else if (!v || chequeos.length === 0) partes.push(t.midiendo(dominio))
  else {
    const ok = chequeos.filter((c) => c.ok).length
    partes.push([puntaje !== null ? t.puntaje(puntaje) : '', t.chequeos(ok, chequeos.length)].filter(Boolean).join(' '))
    const lista = arreglos(chequeos, tareas, kit, idioma)
    const fallan = chequeos.filter((c) => !c.ok)
    const items = kitUrl ? [t.kit(kitUrl, fallan.filter((c) => KIT_ARREGLA.has(c.motivo)).length, fallan.length), ...lista].slice(0, 3) : lista.slice(0, 3)
    if (items.length) partes.push([t.primero, ...items.map((x, i) => `${i + 1}. ${x}`)].join('\n'))
  }

  const ideas = await ideasDePosicion(tenant, idioma, { preguntas: preguntas.map((p) => p.text), citacion, objetivo: plan ? `${plan.goal}: ${plan.goalDetail}` : null })
  if (ideas.length) partes.push([t.posicion, ...ideas.map((x) => `- ${x}`)].join('\n'))

  if (dominio) partes.push(preguntas.length === 0 ? t.sinPreguntas : citacion?.measuredAt ? t.midiendoCitas(preguntas.length) : t.sinMedir(preguntas.length))
  partes.push(t.cadencia)
  return { texto: partes.join('\n\n'), kitUrl, opciones: CADENCIAS.map((clave) => ({ clave, texto: t.botones[clave] })) }
}

// ---------------------------------------------------------------- envío y cadencia

/**
 * Reserva el primer mensaje para este negocio y destino. Un chat que ya estaba
 * ligado a ese negocio no lo vuelve a recibir. Sin la tabla (migración sin
 * correr), lo manda solo si el chat no estaba ligado.
 */
export async function reservarPrimerMensaje(tenantId: string, canal: string, destino: string, yaLigado: boolean): Promise<boolean> {
  if (yaLigado) return false
  try {
    return await store.claimAgentIntro(tenantId, canal, destino)
  } catch (error) {
    console.warn('[primer mensaje] sin reserva, se manda porque el chat es nuevo', { tenantId, canal }, error instanceof Error ? error.message : error)
    return true
  }
}

/** "hora de Colombia" / "Colombia Time"; si Intl no tiene nombre, la ciudad de la zona. */
export function nombreDeZona(zona: string, idioma: Idioma): string {
  try {
    const nombre = new Intl.DateTimeFormat(idioma, { timeZone: zona, timeZoneName: 'shortGeneric' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value
    if (nombre && !/^(GMT|UTC)/.test(nombre)) return nombre
  } catch {
    // zona rara: sigue con la ciudad
  }
  return (zona.split('/').pop() ?? zona).replace(/_/g, ' ')
}

/** Un botón de cadencia: programa el resumen de visitas en ese chat y devuelve la confirmación. */
export async function programarCadencia(tenant: Tenant, clave: Cadencia, destino: { canal: string; id: string }, idioma: Idioma): Promise<string> {
  const t = T[idioma]
  if (clave === 'no') return t.ahoraNo
  const agenda =
    clave === 'semanal'
      ? ({ frequency: 'weekly', hour: 8, weekday: 1 } as const)
      : clave === 'diaria'
        ? ({ frequency: 'daily', hour: 8 } as const)
        : ({ frequency: 'monthly', hour: 8, day_of_month: 1 } as const)
  try {
    const r = await programarVisitas(tenant, agenda, destino, idioma)
    if (!r.saved) {
      console.warn('[primer mensaje] no se programó', tenant.slug, r.error)
      return t.noPude
    }
    return t.listo(clave, nombreDeZona(r.saved.timezone, idioma))
  } catch (error) {
    console.warn('[primer mensaje] no se programó', tenant.slug, error instanceof Error ? error.message : error)
    return t.noPude
  }
}
