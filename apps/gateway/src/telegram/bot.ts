import type { AgentMessage, Tenant } from '@peaje/db'
import { randomBytes } from 'node:crypto'
import { store } from '../store.js'
import { conversar } from '../tareas/agente.js'
import { resolverAccion } from '../tareas/acciones.js'
import { aHtml, nombreBot, partir, tg } from './api.js'
// ---- M9 ----
import { esActivo, mensajeSinPro } from '../billing/acceso.js'

/**
 * El agente de Peaje en Telegram: el mismo de "Mi agente" (mismas
 * herramientas, mismo historial por negocio). Las opciones del agente y las
 * propuestas de cambio llegan como botones.
 */

type Chat = { id: number; username?: string }
type Mensaje = { chat: Chat; from?: { language_code?: string; username?: string }; text?: string }
type Callback = { id: string; data?: string; message?: { chat: Chat; message_id: number }; from?: { language_code?: string } }
export type Update = { message?: Mensaje; callback_query?: Callback }

const idiomaDe = (codigo?: string): 'es' | 'en' => (codigo?.toLowerCase().startsWith('es') ? 'es' : 'en')

const T = {
  es: {
    sinLigar: 'Hola. Soy el agente de Peaje. Para conectarme a tu negocio, abre "Mi agente" en el dashboard de Peaje y toca "Conectar Telegram".',
    codigoMalo: 'Ese enlace ya se usó o venció. Genera uno nuevo en "Mi agente" → "Conectar Telegram".',
    ligado: (n: string) => `Listo, estoy conectado a ${n}. Escríbeme lo que quieras sobre tu negocio, o toca una opción.`,
    desligado: 'Listo, desconecté este chat. Puedes volver a conectarlo desde el dashboard cuando quieras.',
    ayuda: 'Escríbeme en palabras normales: "¿cómo voy?", "¿por qué ChatGPT no me recomienda?", "¿qué publico esta semana?". /negocios cambia de negocio si tienes más de uno. /stop desconecta el negocio activo.',
    varios: (activo: string, otros: string[]) => `Ahora tengo ${otros.length + 1} negocios en este chat: ${activo} (activo), ${otros.join(', ')}. Te respondo sobre el activo; cambia con /negocios.`,
    elegir: 'Elige de qué negocio hablamos:',
    cambiado: (n: string) => `Listo, ahora hablamos de ${n}.`,
    solo: (n: string) => `Solo tengo un negocio en este chat: ${n}. Para sumar otro, toca "Conectar Telegram" en el "Mi agente" de ese negocio.`,
    desligadoUno: (n: string, sigue: string) => `Desconecté ${n}. Sigo con ${sigue}.`,
    sugerencias: ['¿Cómo voy?', 'Arma mi plan', '¿Qué publico esta semana?'],
    aplicar: 'Aplicar',
    descartar: 'Descartar',
    aplicado: 'Aplicado.',
    descartado: 'Descartado.',
    error: 'No pude responder ahora. Prueba de nuevo en un momento.',
  },
  en: {
    sinLigar: 'Hi. I am the Peaje agent. To connect me to your business, open "My agent" in the Peaje dashboard and tap "Connect Telegram".',
    codigoMalo: 'That link was already used or expired. Get a new one in "My agent" → "Connect Telegram".',
    ligado: (n: string) => `Done, I am connected to ${n}. Ask me anything about your business, or tap an option.`,
    desligado: 'Done, this chat is disconnected. You can connect it again from the dashboard anytime.',
    ayuda: 'Write in plain words: "how am I doing?", "why doesn\'t ChatGPT recommend me?", "what should I publish this week?". /businesses switches business if you have more than one. /stop disconnects the active business.',
    varios: (activo: string, otros: string[]) => `I now have ${otros.length + 1} businesses in this chat: ${activo} (active), ${otros.join(', ')}. I answer about the active one; switch with /businesses.`,
    elegir: 'Pick the business we talk about:',
    cambiado: (n: string) => `Done, we now talk about ${n}.`,
    solo: (n: string) => `There is only one business in this chat: ${n}. To add another, tap "Connect Telegram" in that business's "My agent".`,
    desligadoUno: (n: string, sigue: string) => `Disconnected ${n}. I keep going with ${sigue}.`,
    sugerencias: ['How am I doing?', 'Build my plan', 'What should I publish this week?'],
    aplicar: 'Apply',
    descartar: 'Dismiss',
    aplicado: 'Applied.',
    descartado: 'Dismissed.',
    error: 'I could not answer right now. Try again in a moment.',
  },
}

/** Botones: primero las propuestas (aplicar/descartar), después las opciones. */
function teclado(m: AgentMessage, idioma: 'es' | 'en') {
  const filas: { text: string; callback_data: string }[][] = []
  for (const a of m.actions.filter((x) => x.status === 'pending')) {
    filas.push([
      { text: `${T[idioma].aplicar}: ${a.summary}`.slice(0, 60), callback_data: `a:${a.id.slice(0, 8)}:y` },
      { text: T[idioma].descartar, callback_data: `a:${a.id.slice(0, 8)}:n` },
    ])
  }
  m.options.forEach((o, i) => filas.push([{ text: o.slice(0, 60), callback_data: `o:${i}` }]))
  return filas.length ? { inline_keyboard: filas } : undefined
}

async function enviarRespuesta(chatId: number, m: AgentMessage, idioma: 'es' | 'en', encabezado?: string) {
  const partes = partir(encabezado ? `**${encabezado}**\n${m.text}` : m.text)
  for (let i = 0; i < partes.length; i++) {
    const ultima = i === partes.length - 1
    await tg('sendMessage', { chat_id: chatId, text: aHtml(partes[i]!), parse_mode: 'HTML', ...(ultima && teclado(m, idioma) ? { reply_markup: teclado(m, idioma) } : {}) })
  }
}

async function responder(chatId: number, tenant: Tenant, texto: string, idioma: 'es' | 'en') {
  // ---- M9: el agente en Telegram es Pro ----
  if (!esActivo(tenant)) return void (await tg('sendMessage', { chat_id: chatId, text: mensajeSinPro(tenant, idioma) }))
  // "Escribiendo…" mientras el agente trabaja: Telegram lo muestra 5 s por llamada.
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' })
  const latido = setInterval(() => void tg('sendChatAction', { chat_id: chatId, action: 'typing' }), 4_500)
  try {
    const m = await conversar(tenant, texto, { idioma, canal: 'telegram' })
    // Con varios negocios en el chat, cada respuesta dice de cuál es.
    const varios = (await store.listTelegramChat(chatId)).length > 1
    await enviarRespuesta(chatId, m, idioma, varios ? tenant.name : undefined)
  } catch (error) {
    const msj = error instanceof Error ? error.message : ''
    await tg('sendMessage', { chat_id: chatId, text: /mensajes|messages/i.test(msj) ? msj : T[idioma].error })
  } finally {
    clearInterval(latido)
  }
}

export async function procesarUpdate(u: Update): Promise<void> {
  if (u.callback_query) return procesarBoton(u.callback_query)
  const m = u.message
  if (!m?.text) return
  const chatId = m.chat.id
  const texto = m.text.trim()
  const link = await store.getTelegramLink(chatId)
  const idioma = (link?.language as 'es' | 'en' | undefined) ?? idiomaDe(m.from?.language_code)

  if (texto.startsWith('/start')) {
    const codigo = texto.split(/\s+/)[1]
    if (!codigo) return void (await tg('sendMessage', { chat_id: chatId, text: link ? T[idioma].ayuda : T[idioma].sinLigar }))
    const tenantId = await store.consumeTelegramCode(codigo)
    const tenant = tenantId ? await store.getTenantById(tenantId) : null
    if (!tenant) return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].codigoMalo }))
    const idiomaNuevo = idiomaDe(m.from?.language_code)
    await store.linkTelegram({ chatId, tenantId: tenant.id, username: m.from?.username ?? m.chat.username ?? null, language: idiomaNuevo })
    const otros = (await store.listTelegramChat(chatId)).filter((l) => l.tenantId !== tenant.id)
    const nombresOtros = (await Promise.all(otros.map((l) => store.getTenantById(l.tenantId)))).map((t) => t?.name).filter((n): n is string => !!n)
    return void (await tg('sendMessage', {
      chat_id: chatId,
      text: nombresOtros.length ? `${T[idiomaNuevo].ligado(tenant.name)}\n\n${T[idiomaNuevo].varios(tenant.name, nombresOtros)}` : T[idiomaNuevo].ligado(tenant.name),
      reply_markup: { inline_keyboard: T[idiomaNuevo].sugerencias.map((s, i) => [{ text: s, callback_data: `s:${i}` }]) },
    }))
  }
  if (!link) return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].sinLigar }))
  if (texto === '/stop') {
    await store.unlinkTelegram({ chatId, tenantId: link.tenantId })
    const quedan = await store.listTelegramChat(chatId)
    if (quedan[0]) {
      await store.setActiveTelegram(chatId, quedan[0].tenantId)
      const [ido, sigue] = await Promise.all([store.getTenantById(link.tenantId), store.getTenantById(quedan[0].tenantId)])
      return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].desligadoUno(ido?.name ?? '', sigue?.name ?? '') }))
    }
    return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].desligado }))
  }
  if (texto === '/negocios' || texto === '/businesses') {
    const todos = await store.listTelegramChat(chatId)
    const negocios = await Promise.all(todos.map(async (l) => ({ l, t: await store.getTenantById(l.tenantId) })))
    if (negocios.length < 2) return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].solo(negocios[0]?.t?.name ?? '') }))
    return void (await tg('sendMessage', {
      chat_id: chatId,
      text: T[idioma].elegir,
      reply_markup: { inline_keyboard: negocios.map(({ l, t }) => [{ text: `${l.active ? '● ' : ''}${t?.name ?? l.tenantId}`, callback_data: `b:${l.tenantId}` }]) },
    }))
  }
  if (texto === '/help') return void (await tg('sendMessage', { chat_id: chatId, text: T[idioma].ayuda }))
  const tenant = await store.getTenantById(link.tenantId)
  if (!tenant) return
  await responder(chatId, tenant, texto, idioma)
}

async function procesarBoton(c: Callback): Promise<void> {
  const chatId = c.message?.chat.id
  const data = c.data ?? ''
  await tg('answerCallbackQuery', { callback_query_id: c.id })
  if (!chatId) return
  const link = await store.getTelegramLink(chatId)
  if (!link) return
  const tenant = await store.getTenantById(link.tenantId)
  if (!tenant) return
  const idioma = (link.language as 'es' | 'en') ?? 'en'
  // Los botones quedan usados: se sacan del mensaje para que no se toquen dos veces.
  if (c.message) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: c.message.message_id, reply_markup: { inline_keyboard: [] } })

  if (data.startsWith('b:')) {
    const destino = data.slice(2)
    if ((await store.listTelegramChat(chatId)).some((l) => l.tenantId === destino)) {
      await store.setActiveTelegram(chatId, destino)
      const t = await store.getTenantById(destino)
      await tg('sendMessage', { chat_id: chatId, text: T[idioma].cambiado(t?.name ?? '') })
    }
    return
  }
  if (data.startsWith('s:')) {
    const s = T[idioma].sugerencias[Number(data.slice(2))]
    if (s) await responder(chatId, tenant, s, idioma)
    return
  }
  const recientes = (await store.listMessages(tenant.id, 20)).filter((m) => m.role === 'assistant')
  if (data.startsWith('o:')) {
    const ultimo = recientes[recientes.length - 1]
    const opcion = ultimo?.options[Number(data.slice(2))]
    if (opcion) {
      await tg('sendMessage', { chat_id: chatId, text: `› ${opcion}` })
      await responder(chatId, tenant, opcion, idioma)
    }
    return
  }
  if (data.startsWith('a:')) {
    const [, corto, decision] = data.split(':')
    const mensaje = [...recientes].reverse().find((m) => m.actions.some((a) => a.id.startsWith(corto ?? '---')))
    const accion = mensaje?.actions.find((a) => a.id.startsWith(corto ?? '---'))
    if (!mensaje || !accion) return
    try {
      const r = await resolverAccion(tenant, mensaje.id, accion.id, decision === 'y')
      await tg('sendMessage', { chat_id: chatId, text: `${r.status === 'applied' ? T[idioma].aplicado : T[idioma].descartado} ${accion.summary}` })
    } catch (error) {
      await tg('sendMessage', { chat_id: chatId, text: error instanceof Error ? error.message : T[idioma].error })
    }
  }
}

/** Código de un solo uso (15 min) y el enlace que lo abre en Telegram. */
export async function enlaceParaConectar(tenant: Tenant): Promise<{ url: string; expiresAt: string }> {
  const codigo = randomBytes(12).toString('base64url')
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
  await store.createTelegramCode(tenant.id, codigo, expiresAt)
  return { url: `https://t.me/${await nombreBot()}?start=${codigo}`, expiresAt }
}

/** Mensaje proactivo a todos los chats ligados al negocio (resumen semanal, alertas). */
export async function avisarPorTelegram(tenantId: string, texto: string, botones?: { text: string; url: string }[]): Promise<number> {
  const links = await store.listTelegramLinks(tenantId)
  const tenant = await store.getTenantById(tenantId)
  for (const l of links) {
    await tg('sendMessage', {
      chat_id: l.chatId,
      // El nombre adelante: un dueño con dos negocios sabe de cuál es la alerta.
      text: aHtml(tenant ? `**${tenant.name}**\n${texto}` : texto),
      parse_mode: 'HTML',
      ...(botones?.length ? { reply_markup: { inline_keyboard: botones.map((b) => [b]) } } : {}),
    })
  }
  return links.length
}
