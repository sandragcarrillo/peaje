import type { AgentMessage, SlackInstall, Tenant } from '@peaje/db'
import { randomBytes } from 'node:crypto'
import { store } from '../store.js'
import { conversar } from '../tareas/agente.js'
import { resolverAccion } from '../tareas/acciones.js'
import { aMrkdwn, descifrar, partir, respaldo, slack, urlInstalar } from './api.js'
// ---- M9 ----
import { esActivo, mensajeSinPro } from '../billing/acceso.js'

/**
 * El agente de Peaje en Slack: el mismo de "Mi agente" y de Telegram (mismas
 * herramientas, mismo historial por negocio). Responde en el hilo de la
 * mención. Cualquiera del canal pregunta; las propuestas de cambio de precio
 * o de rutas solo las aprueba (o descarta) quien instaló la app.
 */

type Idioma = 'es' | 'en'
type Bloque = Record<string, unknown>

export type EventoSlack = {
  type: string
  user?: string
  bot_id?: string
  subtype?: string
  text?: string
  ts?: string
  thread_ts?: string
  channel?: string
  channel_type?: string
}
export type SobreEventos = { type: string; challenge?: string; team_id?: string; event_id?: string; event?: EventoSlack }

export type AccionBloque = { action_id: string; value?: string; url?: string }
export type PayloadInteraccion = {
  type: string
  user?: { id: string; team_id?: string }
  team?: { id: string } | null
  channel?: { id: string }
  container?: { message_ts?: string; channel_id?: string; thread_ts?: string }
  message?: { ts?: string; thread_ts?: string; blocks?: Bloque[]; text?: string }
  actions?: AccionBloque[]
}

const T = {
  es: {
    sinLigar:
      'Este canal todavía no está conectado a un negocio de Peaje. Quien instaló Peaje lo conecta desde "Mi agente" en el dashboard: toca "Agregar a Slack" y después menciona a @Peaje en este canal.',
    ligado: (n: string) => `Listo, este canal quedó conectado a ${n}. Cualquiera de aquí puede preguntarme mencionándome. Los cambios de precio o de rutas solo los aprueba quien instaló Peaje.`,
    varios: (activo: string, otros: string[]) => `Ahora hay ${otros.length + 1} negocios en este canal: ${activo} (activo), ${otros.join(', ')}. Respondo sobre el activo; cambia con "@Peaje negocios".`,
    ayuda: 'Mencióname con una pregunta en palabras normales: "@Peaje ¿cómo voy?", "@Peaje ¿qué publico esta semana?". "@Peaje negocios" cambia de negocio si hay más de uno. "@Peaje desconectar" desconecta el negocio activo (solo quien instaló).',
    elegir: 'Elige de qué negocio hablamos:',
    cambiado: (n: string) => `Listo, ahora hablamos de ${n}.`,
    solo: (n: string) => `Solo hay un negocio en este canal: ${n}.`,
    desligado: 'Listo, desconecté este canal. Se puede volver a conectar desde el dashboard.',
    desligadoUno: (n: string, sigue: string) => `Desconecté ${n}. Sigo con ${sigue}.`,
    soloInstalador: 'Solo quien instaló Peaje en este Slack puede aprobar cambios de precio o de rutas.',
    soloInstaladorDesligar: 'Solo quien instaló Peaje en este Slack puede desconectar el canal.',
    pensando: 'Un momento, lo reviso…',
    propuesta: 'Propuesta',
    aplicar: 'Aplicar',
    descartar: 'Descartar',
    aplicado: (s: string, u: string) => `Aplicado por <@${u}>: ${s}`,
    descartado: (s: string, u: string) => `Descartado por <@${u}>: ${s}`,
    yaResuelta: 'Esa propuesta ya se resolvió.',
    sugerencias: ['¿Cómo voy?', 'Arma mi plan', '¿Qué publico esta semana?'],
    error: 'No pude responder ahora. Prueba de nuevo en un momento.',
  },
  en: {
    sinLigar:
      'This channel is not connected to a Peaje business yet. Whoever installed Peaje connects it from "My agent" in the dashboard: tap "Add to Slack" and then mention @Peaje in this channel.',
    ligado: (n: string) => `Done, this channel is connected to ${n}. Anyone here can ask me by mentioning me. Price or route changes can only be approved by whoever installed Peaje.`,
    varios: (activo: string, otros: string[]) => `This channel now has ${otros.length + 1} businesses: ${activo} (active), ${otros.join(', ')}. I answer about the active one; switch with "@Peaje businesses".`,
    ayuda: 'Mention me with a question in plain words: "@Peaje how am I doing?", "@Peaje what should I publish this week?". "@Peaje businesses" switches business if there is more than one. "@Peaje disconnect" disconnects the active business (only whoever installed).',
    elegir: 'Pick the business we talk about:',
    cambiado: (n: string) => `Done, we now talk about ${n}.`,
    solo: (n: string) => `There is only one business in this channel: ${n}.`,
    desligado: 'Done, this channel is disconnected. You can connect it again from the dashboard.',
    desligadoUno: (n: string, sigue: string) => `Disconnected ${n}. I keep going with ${sigue}.`,
    soloInstalador: 'Only the person who installed Peaje in this Slack can approve price or route changes.',
    soloInstaladorDesligar: 'Only the person who installed Peaje in this Slack can disconnect the channel.',
    pensando: 'One moment, checking…',
    propuesta: 'Proposal',
    aplicar: 'Apply',
    descartar: 'Dismiss',
    aplicado: (s: string, u: string) => `Applied by <@${u}>: ${s}`,
    descartado: (s: string, u: string) => `Dismissed by <@${u}>: ${s}`,
    yaResuelta: 'That proposal was already resolved.',
    sugerencias: ['How am I doing?', 'Build my plan', 'What should I publish this week?'],
    error: 'I could not answer right now. Try again in a moment.',
  },
}

const idiomaDe = (x: string | undefined): Idioma => (x === 'es' ? 'es' : 'en')
/** Clave de conversación y target de los reportes: `<team>:<canal>`. */
export const destinoSlack = (teamId: string, channelId: string) => `${teamId}:${channelId}`

/** Texto de un botón: 75 caracteres como máximo (Block Kit). */
const boton = (texto: string, action_id: string, value: string, style?: 'primary' | 'danger'): Bloque => ({
  type: 'button',
  text: { type: 'plain_text', text: texto.length > 75 ? `${texto.slice(0, 74)}…` : texto, emoji: true },
  action_id,
  value: value.slice(0, 2_000),
  ...(style ? { style } : {}),
})

const seccion = (mrkdwn: string): Bloque => ({ type: 'section', text: { type: 'mrkdwn', text: mrkdwn.slice(0, 3_000) } })

/** Los botones de un mensaje del agente: propuestas (aplicar/descartar), opciones y enlaces. */
export function bloquesBotones(tenantId: string, m: AgentMessage, idioma: Idioma): Bloque[] {
  const bloques: Bloque[] = []
  m.actions
    .filter((a) => a.status === 'pending')
    .forEach((a, i) => {
      const valor = JSON.stringify({ t: tenantId, m: m.id, a: a.id })
      bloques.push(seccion(`*${T[idioma].propuesta}:* ${aMrkdwn(a.summary)}`))
      bloques.push({
        type: 'actions',
        block_id: `peaje_prop_${a.id.slice(0, 8)}`,
        elements: [boton(T[idioma].aplicar, `peaje_aprobar_${i}`, valor, 'primary'), boton(T[idioma].descartar, `peaje_descartar_${i}`, valor)],
      })
    })
  if (m.options.length) {
    bloques.push({
      type: 'actions',
      block_id: 'peaje_opciones',
      elements: m.options.slice(0, 5).map((o, i) => boton(o, `peaje_opcion_${i}`, JSON.stringify({ t: tenantId, m: m.id, i }))),
    })
  }
  // Tarjetas con URL que el agente adjunta (reporte, tarea, página), si el mensaje las trae.
  const links = m.links ?? []
  if (links.length) {
    bloques.push({
      type: 'actions',
      block_id: 'peaje_links',
      elements: links.slice(0, 5).map((l, i) => ({ ...boton(l.label, `peaje_link_${i}`, l.url), url: l.url.slice(0, 3_000) })),
    })
  }
  return bloques
}

type Hilo = { token: string; channel: string; threadTs?: string }

const enHilo = (h: Hilo) => (h.threadTs ? { thread_ts: h.threadTs } : {})

/** Manda texto (markdown del agente) y botones al hilo. Si hay un mensaje provisorio, lo reemplaza con la primera parte. */
export async function enviarAlHilo(h: Hilo, texto: string, botones: Bloque[] = [], provisorio?: string): Promise<void> {
  const partes = partir(texto, 2_700)
  // Hasta 5 secciones por mensaje: lejos del tope de 50 bloques y de los 40.000 caracteres.
  const grupos: string[][] = []
  for (let i = 0; i < partes.length; i += 5) grupos.push(partes.slice(i, i + 5))
  for (let g = 0; g < grupos.length; g++) {
    const ultimo = g === grupos.length - 1
    const blocks = [...grupos[g]!.map((p) => seccion(aMrkdwn(p))), ...(ultimo ? botones : [])]
    const cuerpo = { channel: h.channel, text: respaldo(grupos[g]!.join('\n\n')), blocks, unfurl_links: false, ...enHilo(h) }
    if (g === 0 && provisorio) {
      const r = await slack('chat.update', { channel: h.channel, ts: provisorio, text: cuerpo.text, blocks }, h.token)
      if (r?.ok) continue
    }
    await slack('chat.postMessage', cuerpo, h.token)
  }
}

async function decir(h: Hilo, texto: string, botones: Bloque[] = []) {
  await enviarAlHilo(h, texto, botones)
}

async function responder(h: Hilo, teamId: string, tenant: Tenant, texto: string, idioma: Idioma): Promise<void> {
  // ---- M9: el agente en Slack es Pro, como en Telegram ----
  if (!esActivo(tenant)) return decir(h, mensajeSinPro(tenant, idioma))
  const provisorio = (await slack('chat.postMessage', { channel: h.channel, text: T[idioma].pensando, ...enHilo(h) }, h.token))?.ts
  // Los estados del agente ("Revisando tus tareas…") van al mensaje provisorio, a lo sumo uno cada 1,5 s.
  let ultimoEstado = 0
  let cola = Promise.resolve()
  const alEstado = (estado: string) => {
    if (!provisorio || Date.now() - ultimoEstado < 1_500) return
    ultimoEstado = Date.now()
    cola = cola.then(async () => void (await slack('chat.update', { channel: h.channel, ts: provisorio, text: estado }, h.token)))
  }
  try {
    // destino: los reportes programados y los trabajos largos vuelven a este canal.
    const m = await conversar(tenant, texto, { idioma, canal: 'slack', alEstado, destino: { canal: 'slack', id: destinoSlack(teamId, h.channel) } })
    await cola
    const varios = (await store.listSlackChannel(teamId, h.channel)).length > 1
    await enviarAlHilo(h, varios ? `**${tenant.name}**\n${m.text}` : m.text, bloquesBotones(tenant.id, m, idioma), provisorio)
  } catch (error) {
    await cola
    const msj = error instanceof Error ? error.message : ''
    const texto = /mensajes|messages|Pro/i.test(msj) ? msj : T[idioma].error
    if (provisorio) {
      const r = await slack('chat.update', { channel: h.channel, ts: provisorio, text: texto }, h.token)
      if (r?.ok) return
    }
    await decir(h, texto)
  }
}

/** Saca las menciones al bot y normaliza: "<@U123> ¿cómo voy?" → "¿cómo voy?". */
export function limpiarMencion(texto: string, botUserId?: string): string {
  const sinBot = botUserId ? texto.split(`<@${botUserId}>`).join(' ') : texto.replace(/^\s*<@[A-Z0-9]+>/, ' ')
  return sinBot.replace(/\s+/g, ' ').trim()
}

const comando = (t: string) => t.toLowerCase().replace(/[¿?¡!.]/g, '').trim()

async function tokenDe(install: SlackInstall): Promise<string | null> {
  try {
    return descifrar(install.botTokenEnc)
  } catch (error) {
    console.error('[slack] no se pudo descifrar el token de', install.teamId, error instanceof Error ? error.message : error)
    return null
  }
}

/** Una mención en un canal o un mensaje directo al bot. */
export async function procesarEvento(sobre: SobreEventos): Promise<void> {
  const e = sobre.event
  const teamId = sobre.team_id
  if (!e || !teamId) return
  if (e.type === 'app_uninstalled') return void (await store.deleteSlackInstall(teamId))
  const esMencion = e.type === 'app_mention'
  const esDirecto = e.type === 'message' && e.channel_type === 'im'
  if (!esMencion && !esDirecto) return
  // Nada de bots (incluido el propio) ni ediciones o borrados: evita bucles.
  if (e.bot_id || e.subtype || !e.user || !e.channel || !e.ts) return
  const install = await store.getSlackInstall(teamId)
  if (!install || e.user === install.botUserId) return
  const token = await tokenDe(install)
  if (!token) return
  // En un canal se responde en el hilo de la mención; en el directo, en el hilo solo si ya era un hilo.
  const h: Hilo = { token, channel: e.channel, threadTs: esMencion ? e.thread_ts ?? e.ts : e.thread_ts }
  const texto = limpiarMencion(e.text ?? '', install.botUserId)

  // Quien instaló y tiene un código pendiente: su primera mención conecta este canal a ese negocio.
  const codigo = await store.consumeSlackCode(teamId, e.user)
  if (codigo) {
    const tenant = await store.getTenantById(codigo.tenantId)
    if (tenant) {
      const idioma = idiomaDe(codigo.language)
      if (!esActivo(tenant)) return decir(h, mensajeSinPro(tenant, idioma))
      await store.linkSlack({ teamId, channelId: e.channel, tenantId: tenant.id, language: idioma, linkedBy: e.user })
      const otros = (await store.listSlackChannel(teamId, e.channel)).filter((l) => l.tenantId !== tenant.id)
      const nombres = (await Promise.all(otros.map((l) => store.getTenantById(l.tenantId)))).map((t) => t?.name).filter((n): n is string => !!n)
      const sugerencias: Bloque = {
        type: 'actions',
        block_id: 'peaje_sugerencias',
        elements: T[idioma].sugerencias.map((s, i) => boton(s, `peaje_sugerencia_${i}`, JSON.stringify({ t: tenant.id, i }))),
      }
      return decir(h, nombres.length ? `${T[idioma].ligado(tenant.name)}\n\n${T[idioma].varios(tenant.name, nombres)}` : T[idioma].ligado(tenant.name), [sugerencias])
    }
  }

  const link = await store.getSlackLink(teamId, e.channel)
  if (!link) return decir(h, `${T.es.sinLigar}\n\n${T.en.sinLigar}`)
  const idioma = idiomaDe(link.language)
  const cmd = comando(texto)

  if (cmd === 'ayuda' || cmd === 'help' || cmd === '') return decir(h, T[idioma].ayuda)
  if (cmd === 'negocios' || cmd === 'businesses') {
    const todos = await store.listSlackChannel(teamId, e.channel)
    const negocios = await Promise.all(todos.map(async (l) => ({ l, t: await store.getTenantById(l.tenantId) })))
    if (negocios.length < 2) return decir(h, T[idioma].solo(negocios[0]?.t?.name ?? ''))
    return decir(h, T[idioma].elegir, [
      {
        type: 'actions',
        block_id: 'peaje_negocios',
        elements: negocios.map(({ l, t }, i) => boton(`${l.active ? '● ' : ''}${t?.name ?? l.tenantId}`, `peaje_negocio_${i}`, l.tenantId)),
      },
    ])
  }
  if (cmd === 'desconectar' || cmd === 'disconnect' || cmd === 'stop') {
    if (e.user !== install.installerUserId) return decir(h, T[idioma].soloInstaladorDesligar)
    await store.unlinkSlack({ teamId, channelId: e.channel, tenantId: link.tenantId })
    await store.deleteReportSchedules(link.tenantId, { channel: 'slack', target: destinoSlack(teamId, e.channel) }).catch(() => 0)
    const quedan = await store.listSlackChannel(teamId, e.channel)
    if (quedan[0]) {
      await store.setActiveSlack(teamId, e.channel, quedan[0].tenantId)
      const [ido, sigue] = await Promise.all([store.getTenantById(link.tenantId), store.getTenantById(quedan[0].tenantId)])
      return decir(h, T[idioma].desligadoUno(ido?.name ?? '', sigue?.name ?? ''))
    }
    return decir(h, T[idioma].desligado)
  }
  const tenant = await store.getTenantById(link.tenantId)
  if (!tenant) return
  await responder(h, teamId, tenant, texto, idioma)
}

/** Lee el JSON del `value` de un botón sin romperse. */
function valor<T>(a: AccionBloque): T | null {
  try {
    return JSON.parse(a.value ?? '') as T
  } catch {
    return null
  }
}

/** Saca del mensaje original los botones de una propuesta ya resuelta y deja una línea en su lugar. */
function sinBotonesDe(blocks: Bloque[] | undefined, actionId: string, linea: string): Bloque[] | null {
  if (!Array.isArray(blocks)) return null
  const id = `peaje_prop_${actionId.slice(0, 8)}`
  if (!blocks.some((b) => b.block_id === id)) return null
  return blocks.map((b) => (b.block_id === id ? { type: 'context', elements: [{ type: 'mrkdwn', text: linea }] } : b))
}

/** Un clic en un botón de Block Kit. */
export async function procesarInteraccion(p: PayloadInteraccion): Promise<void> {
  if (p.type !== 'block_actions') return
  const a = p.actions?.[0]
  const teamId = p.team?.id ?? p.user?.team_id
  const channelId = p.channel?.id ?? p.container?.channel_id
  const userId = p.user?.id
  if (!a || !teamId || !channelId || !userId) return
  if (a.action_id.startsWith('peaje_link_')) return // botón con URL: Slack abre el enlace, acá solo se acusa recibo
  const install = await store.getSlackInstall(teamId)
  if (!install) return
  const token = await tokenDe(install)
  if (!token) return
  const ts = p.container?.message_ts ?? p.message?.ts
  const h: Hilo = { token, channel: channelId, threadTs: p.message?.thread_ts ?? p.container?.thread_ts ?? ts }
  const enCanal = await store.listSlackChannel(teamId, channelId)
  const activo = enCanal.find((l) => l.active) ?? enCanal[0]
  if (!activo) return decir(h, `${T.es.sinLigar}\n\n${T.en.sinLigar}`)
  const ligado = (tenantId: string) => enCanal.find((l) => l.tenantId === tenantId)

  // Cambio de negocio: cualquiera del canal (los dos ya están conectados a él).
  if (a.action_id.startsWith('peaje_negocio_')) {
    const l = ligado(a.value ?? '')
    if (!l) return
    await store.setActiveSlack(teamId, channelId, l.tenantId)
    const t = await store.getTenantById(l.tenantId)
    return decir(h, T[idiomaDe(l.language)].cambiado(t?.name ?? ''))
  }

  if (a.action_id.startsWith('peaje_sugerencia_') || a.action_id.startsWith('peaje_opcion_')) {
    const v = valor<{ t: string; m?: string; i: number }>(a)
    const l = v ? ligado(v.t) : undefined
    if (!v || !l) return
    const idioma = idiomaDe(l.language)
    const tenant = await store.getTenantById(l.tenantId)
    if (!tenant) return
    let texto: string | undefined
    if (a.action_id.startsWith('peaje_sugerencia_')) texto = T[idioma].sugerencias[v.i]
    else texto = v.m ? (await store.getMessage(tenant.id, v.m))?.options[v.i] : undefined
    if (!texto) return
    await slack('chat.postMessage', { channel: channelId, text: `<@${userId}>: ${texto}`, ...enHilo(h) }, token)
    return responder(h, teamId, tenant, texto, idioma)
  }

  if (a.action_id.startsWith('peaje_aprobar_') || a.action_id.startsWith('peaje_descartar_')) {
    const v = valor<{ t: string; m: string; a: string }>(a)
    const l = v ? ligado(v.t) : undefined
    if (!v || !l) return
    const idioma = idiomaDe(l.language)
    // La regla de San: preguntar es abierto; aprobar o descartar un cambio de precio o de rutas, solo quien instaló.
    if (userId !== install.installerUserId) return decir(h, T[idioma].soloInstalador)
    const tenant = await store.getTenantById(l.tenantId)
    if (!tenant) return
    const aplicar = a.action_id.startsWith('peaje_aprobar_')
    try {
      const previa = (await store.getMessage(tenant.id, v.m))?.actions.find((x) => x.id === v.a)
      if (previa && previa.status !== 'pending') return decir(h, T[idioma].yaResuelta)
      const r = await resolverAccion(tenant, v.m, v.a, aplicar)
      const linea = (r.status === 'applied' ? T[idioma].aplicado : T[idioma].descartado)(r.summary, userId)
      const blocks = sinBotonesDe(p.message?.blocks, v.a, linea)
      if (blocks && ts) await slack('chat.update', { channel: channelId, ts, text: p.message?.text ?? linea, blocks }, token)
      await decir(h, linea)
    } catch (error) {
      await decir(h, error instanceof Error ? error.message : T[idioma].error)
    }
  }
}

/** Código de un solo uso (60 min para el OAuth; el callback lo alarga a 24 h) y el enlace que instala la app. */
export async function enlaceParaInstalar(tenant: Tenant, idioma: Idioma): Promise<{ url: string; expiresAt: string }> {
  const codigo = randomBytes(16).toString('base64url')
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString()
  await store.createSlackCode(tenant.id, codigo, expiresAt, idioma)
  return { url: urlInstalar(codigo), expiresAt }
}
