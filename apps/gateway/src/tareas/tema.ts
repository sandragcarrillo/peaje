import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AgentMessage, Tenant } from '@peaje/db'
import { asistentesMedidos, dominioVerificable } from '@peaje/shared'
import { z } from 'zod'

/**
 * Filtro de tema antes del modelo grande: un modelo barato lee el mensaje del
 * dueño (con los últimos mensajes como contexto) y dice si es del negocio, si
 * es charla que no necesita datos, o si no tiene nada que ver. Lo que no
 * tiene que ver se contesta acá en una línea, sin herramientas y sin cobrar.
 *
 * Ante la duda pasa: una respuesta corta a la última pregunta del agente
 * ("sí", "dale", "la segunda") es del negocio. Si el filtro falla o tarda, la
 * conversación sigue con el modelo grande como si no existiera.
 */

const MODELO = process.env.TOPIC_MODEL ?? 'claude-haiku-4-5'
const ESPERA_MS = Number(process.env.TOPIC_TIMEOUT_MS ?? 4_000)
const CONTEXTO = 3

type Idioma = 'es' | 'en'

export type Tema = { tipo: 'negocio' } | { tipo: 'charla' } | { tipo: 'fuera'; respuesta: string }

const TemaSchema = z.object({
  topic: z.enum(['business', 'chat', 'off_topic']),
  reply: z.string(),
})

export const RESPUESTA_FUERA: Record<Idioma, string> = {
  es: 'Eso no es algo con lo que te pueda ayudar. Si quieres, volvemos a tu sitio y a cómo te recomiendan los asistentes de IA.',
  en: 'That is not something I can help with. If you want, we can get back to your site and how AI assistants recommend you.',
}

let anthropic: Anthropic | null = null

/** Null si no se pudo clasificar: quien llama sigue como si fuera del negocio. */
export async function clasificarTema(tenant: Tenant, texto: string, previos: AgentMessage[], idioma: Idioma): Promise<Tema | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  anthropic ??= new Anthropic()
  const recientes = previos
    .slice(-CONTEXTO)
    .map((m) => `${m.role === 'user' ? 'Owner' : 'Agent'}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}${m.options.length ? ` [choices offered: ${m.options.join(' | ')}]` : ''}`)
  try {
    const res = await anthropic.messages.parse(
      {
        model: MODELO,
        max_tokens: 300,
        system: [
          `You route messages that the owner of ${tenant.name} (${dominioVerificable(tenant.originUrl) ?? tenant.originUrl}) sends to their Peaje agent.`,
          'The agent helps only with: this business and its website; being found and recommended by AI assistants (' + asistentesMedidos('en') + ' or any other); AI agents that visit the site or pay for its data or API; the tasks, pages, reports, plan, credits and schedule the agent handles; and Peaje itself (the product, its kit, plans and billing).',
          'Classify only the LAST owner message, using the recent conversation as context:',
          '- business: about any of those topics, or it could be. Short follow-ups and answers to the agent\'s last question ("yes", "sí", "dale", "the second one", "do it", a number, a URL, a name) are always business. When in doubt, business.',
          '- chat: on topic but needs no data at all: a greeting, thanks, "ok", asking who you are or what you can do.',
          '- off_topic: clearly unrelated to all of the above, for example recipes, homework, general trivia, news, jokes, coding that has nothing to do with their site, personal advice.',
          'reply: only for off_topic, one short sentence in the language of the owner\'s message (neutral Latin American Spanish with tú if Spanish) saying it is not something you help with and offering to get back to their site. No em dashes. For business and chat, an empty string.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `${recientes.length ? `Recent conversation:\n${recientes.join('\n')}\n\n` : ''}Last owner message:\n${texto.slice(0, 1_500)}`,
          },
        ],
        output_config: { format: zodOutputFormat(TemaSchema) },
      },
      { timeout: ESPERA_MS, maxRetries: 0 },
    )
    const r = res.parsed_output
    if (!r) return null
    if (r.topic === 'off_topic') {
      const linea = r.reply.replace(/\s+—\s+/g, ', ').replace(/—/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 300)
      return { tipo: 'fuera', respuesta: linea || RESPUESTA_FUERA[idioma] }
    }
    return { tipo: r.topic === 'chat' ? 'charla' : 'negocio' }
  } catch (error) {
    console.warn('[tema] sin clasificar, sigue el modelo grande', tenant.slug, error instanceof Error ? error.message : error)
    return null
  }
}
