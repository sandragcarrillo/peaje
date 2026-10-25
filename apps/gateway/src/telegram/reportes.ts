import { store } from '../store.js'
import { registrarCanal, type Idioma } from '../reportes/entregar.js'
import { aHtml, partir, tg } from './api.js'
import { enviarRespuesta } from './bot.js'

/**
 * Telegram como canal de los reportes programados. El target es el chat id.
 * Se importa una vez desde telegram/router.ts; Slack hace lo mismo desde su módulo.
 */

const idiomaDe = (x: string): Idioma => (x === 'es' ? 'es' : 'en')

registrarCanal('telegram', {
  async destino(s) {
    const chatId = Number(s.target)
    if (!Number.isFinite(chatId)) return null
    const link = (await store.listTelegramChat(chatId)).find((l) => l.tenantId === s.tenantId)
    return link ? { idioma: idiomaDe(link.language) } : null
  },

  async enviar(s, tenant, entrega, idioma) {
    const chatId = Number(s.target)
    const links = await store.listTelegramChat(chatId)
    const varios = links.length > 1
    if (entrega.tipo === 'reporte') {
      const partes = partir(entrega.texto)
      for (let i = 0; i < partes.length; i++) {
        const ultima = i === partes.length - 1
        await tg('sendMessage', {
          chat_id: chatId,
          text: aHtml(partes[i]!),
          parse_mode: 'HTML',
          ...(ultima && entrega.botones.length ? { reply_markup: { inline_keyboard: entrega.botones.map((b) => [b]) } } : {}),
        })
      }
      return
    }
    // Pedido programado: primero lo que pidió (como cuando toca una opción), después la respuesta.
    await tg('sendMessage', { chat_id: chatId, text: `› ${entrega.pedido}` })
    // Los botones del chat (opciones, aplicar) leen el negocio activo: solo van si es este.
    const activo = (links.find((l) => l.active) ?? links[0])?.tenantId === tenant.id
    await enviarRespuesta(chatId, entrega.mensaje, idioma, varios ? tenant.name : undefined, activo)
  },

  async destinos(tenantId) {
    const links = await store.listTelegramLinks(tenantId)
    return links.map((l) => ({ target: String(l.chatId), nombre: l.username ? `Telegram @${l.username}` : 'Telegram', idioma: idiomaDe(l.language) }))
  },
})
