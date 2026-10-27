import { store } from '../store.js'
import { registrarCanal, type Idioma } from '../reportes/entregar.js'
import { descifrar, slack } from './api.js'
import { bloquesBotones, enviarAlHilo } from './bot.js'
// Y la entrega de los trabajos largos del agente (página lista, serie lista), en el hilo del pedido.
import './trabajos.js'

/**
 * Slack como canal de los reportes programados. El target es `<team>:<canal>`
 * (el mismo `destino.id` que recibe conversar). Se importa una vez desde
 * slack/router.ts. Los reportes van al canal, no a un hilo. También trae la
 * entrega de los trabajos largos del agente (slack/trabajos.ts).
 */

const idiomaDe = (x: string): Idioma => (x === 'es' ? 'es' : 'en')

function partirTarget(target: string): { teamId: string; channelId: string } | null {
  const [teamId, channelId] = target.split(':')
  return teamId && channelId ? { teamId, channelId } : null
}

registrarCanal('slack', {
  async destino(s) {
    const t = partirTarget(s.target)
    if (!t) return null
    const link = (await store.listSlackChannel(t.teamId, t.channelId)).find((l) => l.tenantId === s.tenantId)
    return link ? { idioma: idiomaDe(link.language) } : null
  },

  async enviar(s, tenant, entrega, idioma) {
    const t = partirTarget(s.target)
    if (!t) throw new Error(`slack: target inválido ${s.target}`)
    const install = await store.getSlackInstall(t.teamId)
    if (!install) throw new Error(`slack: sin instalación para ${t.teamId}`)
    const token = descifrar(install.botTokenEnc)
    const h = { token, channel: t.channelId }
    const varios = (await store.listSlackChannel(t.teamId, t.channelId)).length > 1
    const encabezar = (texto: string) => (varios ? `**${tenant.name}**\n${texto}` : texto)
    if (entrega.tipo === 'reporte') {
      const botones = entrega.botones.length
        ? [
            {
              type: 'actions',
              block_id: 'peaje_links',
              elements: entrega.botones.slice(0, 5).map((b, i) => ({
                type: 'button',
                text: { type: 'plain_text', text: b.text.slice(0, 75), emoji: true },
                action_id: `peaje_link_${i}`,
                url: b.url.slice(0, 3_000),
              })),
            },
          ]
        : []
      return void (await enviarAlHilo(h, encabezar(entrega.texto), botones))
    }
    // Pedido programado: primero lo que pidió, después la respuesta del agente en su hilo.
    const r = await slack('chat.postMessage', { channel: t.channelId, text: `› ${entrega.pedido}` }, token)
    // Los botones llevan el negocio adentro: funcionan aunque el activo del canal sea otro.
    await enviarAlHilo({ ...h, ...(r?.ts ? { threadTs: r.ts } : {}) }, encabezar(entrega.mensaje.text), bloquesBotones(tenant.id, entrega.mensaje, idioma))
  },

  async destinos(tenantId) {
    const links = await store.listSlackLinks(tenantId)
    const nombres = new Map<string, string | null>()
    for (const l of links) if (!nombres.has(l.teamId)) nombres.set(l.teamId, (await store.getSlackInstall(l.teamId))?.teamName ?? null)
    return links.map((l) => {
      const equipo = nombres.get(l.teamId) ?? l.teamId
      return {
        target: `${l.teamId}:${l.channelId}`,
        nombre: l.channelId.startsWith('D') ? `Slack ${equipo} (mensaje directo)` : `Slack ${equipo} (canal ${l.channelId})`,
        idioma: idiomaDe(l.language),
      }
    })
  },
})
