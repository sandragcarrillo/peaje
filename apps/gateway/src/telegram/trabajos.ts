import { store } from '../store.js'
import { registrarEntrega } from '../tareas/trabajos.js'
import { enviarRespuesta } from './bot.js'

/**
 * Telegram como canal de entrega de los trabajos largos del agente: cuando
 * termina un borrador o una serie pedida desde este chat, el aviso llega acá
 * con sus tarjetas como botones. Se importa una vez desde telegram/router.ts.
 */
registrarEntrega('telegram', async (job, mensaje) => {
  const chatId = Number(job.destino?.id)
  if (!Number.isFinite(chatId)) return
  const links = await store.listTelegramChat(chatId)
  // El chat se desconectó de ese negocio mientras corría: no se le manda nada.
  if (!links.some((l) => l.tenantId === job.tenantId)) return
  const tenant = await store.getTenantById(job.tenantId)
  const idioma = job.destino?.idioma === 'en' ? 'en' : 'es'
  // Con varios negocios en el chat, el aviso dice de cuál es; opciones y propuestas solo si es el activo.
  const activo = (links.find((l) => l.active) ?? links[0])?.tenantId === job.tenantId
  await enviarRespuesta(chatId, mensaje, idioma, links.length > 1 ? tenant?.name : undefined, activo)
})
