import type { AgentJob } from '@peaje/db'
import { store } from '../store.js'
import { avisoEditado, registrarEntrega } from '../tareas/trabajos.js'
import { entregaDeBorrador, sinLinea, textoSinArchivo } from '../ciclo/entrega.js'
import { aMrkdwn, descifrar, respaldo, slack, subirArchivos } from './api.js'
import { bloquesBotones, enviarAlHilo, seccion, type Hilo } from './bot.js'

/**
 * Slack como canal de entrega de los trabajos largos del agente (página
 * lista, serie lista). Vuelve al hilo donde se pidió (`input.responderA`, el
 * thread_ts de la mención); sin hilo, al canal. Se importa desde
 * slack/reportes.ts, que se importa una vez desde slack/router.ts.
 *
 * Un borrador listo llega como en Boring Marketing (ciclo/entrega.ts):
 *   1. el "estoy en eso" editado a "✅ Listo en 8 min 8 s" (chat.update; si no
 *      se puede, la línea va arriba del resumen)
 *   2. el resumen con las tarjetas, en el hilo
 *   3. los .md en el mismo hilo, todos en un solo files.completeUploadExternal
 * Si los archivos no salen (por ejemplo, una instalación sin files:write), un
 * mensaje con el link a cada tarea en el dashboard.
 */

type Idioma = 'es' | 'en'
const idiomaDe = (x: string): Idioma => (x === 'es' ? 'es' : 'en')

function partirTarget(target: string): { teamId: string; channelId: string } | null {
  const [teamId, channelId] = target.split(':')
  return teamId && channelId ? { teamId, channelId } : null
}

/** El "estoy en eso" del trabajo pasa a decir "✅ Listo en …". False si no hay cuál editar o Slack no lo aceptó. */
async function editarAviso(h: Hilo, job: AgentJob, idioma: Idioma, linea: string): Promise<boolean> {
  const e = avisoEditado(job, idioma, linea)
  if (!e) return false
  const botones = Array.isArray(e.aviso.botones) ? (e.aviso.botones as Record<string, unknown>[]) : []
  const r = await slack('chat.update', { channel: h.channel, ts: e.aviso.id, text: respaldo(e.texto), blocks: [seccion(aMrkdwn(e.texto)), ...botones] }, h.token)
  if (!r?.ok) return false
  e.aviso.texto = e.texto
  return true
}

registrarEntrega('slack', async (job, mensaje) => {
  const t = job.destino ? partirTarget(job.destino.id) : null
  if (!t) return
  const install = await store.getSlackInstall(t.teamId)
  if (!install) return
  const enCanal = await store.listSlackChannel(t.teamId, t.channelId)
  const link = enCanal.find((l) => l.tenantId === job.tenantId)
  if (!link) return
  const tenant = await store.getTenantById(job.tenantId)
  const idioma = idiomaDe(job.destino?.idioma ?? link.language)
  const hilo = typeof job.input.responderA === 'string' && job.input.responderA ? job.input.responderA : undefined
  const h: Hilo = { token: descifrar(install.botTokenEnc), channel: t.channelId, ...(hilo ? { threadTs: hilo } : {}) }
  const encabezar = (texto: string) => (enCanal.length > 1 && tenant ? `**${tenant.name}**\n${texto}` : texto)
  const botones = bloquesBotones(job.tenantId, mensaje, idioma)
  const entrega = tenant ? await entregaDeBorrador(job, tenant).catch(() => null) : null
  if (!entrega) return void (await enviarAlHilo(h, encabezar(mensaje.text), botones))

  const estado = entrega.estado[idioma]
  const editado = await editarAviso(h, job, idioma, estado)
  await enviarAlHilo(h, encabezar(editado ? sinLinea(mensaje.text, estado) : mensaje.text), botones)
  // Un archivo que no sale no rompe nada: el trabajo ya terminó y la página está en la tarea.
  const con = entrega.paginas.filter((p) => p.archivo)
  const r = await subirArchivos(
    h.token,
    { channel: t.channelId, threadTs: hilo },
    con.map((p) => ({ nombre: p.archivo!.nombre, contenido: p.archivo!.contenido, titulo: p.titulo })),
  )
  if (!r.ok) console.warn('[slack] no salieron los archivos', job.id, r.error)
  const fallidas = r.ok ? entrega.paginas.filter((p) => !p.archivo) : entrega.paginas
  if (fallidas.length) await enviarAlHilo(h, textoSinArchivo(fallidas, idioma))
})
