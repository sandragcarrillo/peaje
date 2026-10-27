import type { AgentJob } from '@peaje/db'
import { store } from '../store.js'
import { avisoEditado, registrarEntrega } from '../tareas/trabajos.js'
import { entregaDeBorrador, sinLinea, textoSinArchivo, type PaginaEntregable } from '../ciclo/entrega.js'
import { aHtml, tg, tgArchivos } from './api.js'
import { enviarRespuesta } from './bot.js'

/**
 * Telegram como canal de entrega de los trabajos largos del agente: cuando
 * termina un borrador o una serie pedida desde este chat, el aviso llega acá
 * con sus tarjetas como botones. Se importa una vez desde telegram/router.ts.
 *
 * Un borrador listo llega así (ciclo/entrega.ts):
 *   1. el "estoy en eso" editado a "✅ Listo en 8 min 8 s" (si no se puede
 *      editar, esa línea va arriba del resumen)
 *   2. el resumen, como respuesta al mensaje del pedido
 *   3. la página en un .md (sendDocument); una serie, todas en un solo
 *      álbum de documentos (sendMediaGroup, hasta 10 por álbum)
 * Si el archivo no sale, un mensaje con el link a la tarea en el dashboard.
 */

type Idioma = 'es' | 'en'

const respuestaA = (responderA?: number) => (responderA ? { reply_parameters: { message_id: responderA, allow_sending_without_reply: true } } : {})

/** El "estoy en eso" del trabajo pasa a decir "✅ Listo en …". False si no hay cuál editar o Telegram no lo aceptó. */
async function editarAviso(chatId: number, job: AgentJob, idioma: Idioma, linea: string): Promise<boolean> {
  const e = avisoEditado(job, idioma, linea)
  if (!e) return false
  const r = await tg('editMessageText', {
    chat_id: chatId,
    message_id: Number(e.aviso.id),
    text: aHtml(e.texto),
    parse_mode: 'HTML',
    // Se mandan de nuevo los botones (solo de URL) para no perderlos con la edición.
    ...(e.aviso.botones ? { reply_markup: e.aviso.botones } : {}),
  })
  if (!r) return false
  e.aviso.texto = e.texto
  return true
}

/** Sube los .md. Devuelve las páginas que no salieron (para mandarles el link). */
async function enviarArchivos(chatId: number, paginas: PaginaEntregable[], responderA?: number): Promise<PaginaEntregable[]> {
  const fallidas = paginas.filter((p) => !p.archivo)
  const con = paginas.filter((p) => p.archivo)
  for (let i = 0; i < con.length; i += 10) {
    const grupo = con.slice(i, i + 10)
    const archivo = (p: PaginaEntregable) => ({ nombre: p.archivo!.nombre, contenido: p.archivo!.contenido })
    const r =
      grupo.length === 1
        ? await tgArchivos('sendDocument', { chat_id: chatId, document: archivo(grupo[0]!), ...respuestaA(responderA) })
        : await tgArchivos('sendMediaGroup', {
            chat_id: chatId,
            media: grupo.map((_, k) => ({ type: 'document', media: `attach://pagina${k}` })),
            ...Object.fromEntries(grupo.map((p, k) => [`pagina${k}`, archivo(p)])),
            ...respuestaA(responderA),
          })
    if (!r.ok) fallidas.push(...grupo)
  }
  return fallidas
}

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
  const encabezado = links.length > 1 ? tenant?.name : undefined
  const entrega = tenant ? await entregaDeBorrador(job, tenant).catch(() => null) : null
  if (!entrega) return void (await enviarRespuesta(chatId, mensaje, idioma, encabezado, activo))

  const responderA = Number(job.input.responderA) || undefined
  const estado = entrega.estado[idioma]
  const editado = await editarAviso(chatId, job, idioma, estado)
  await enviarRespuesta(chatId, { ...mensaje, text: editado ? sinLinea(mensaje.text, estado) : mensaje.text }, idioma, encabezado, activo, responderA)
  // Un archivo que no sale no rompe nada: el trabajo ya terminó y la página está en la tarea.
  const fallidas = await enviarArchivos(chatId, entrega.paginas, responderA).catch(() => entrega.paginas)
  if (fallidas.length) await tg('sendMessage', { chat_id: chatId, text: aHtml(textoSinArchivo(fallidas, idioma)), parse_mode: 'HTML' })
})
