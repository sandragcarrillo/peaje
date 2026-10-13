import Anthropic from '@anthropic-ai/sdk'
import type { Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { leerSitio } from './monitor/reporte.js'
import { store } from './store.js'

/**
 * La descripción que leen los agentes (llms.txt, agents.md, openapi, MCP,
 * agent card) sale del sitio del negocio, no de una plantilla. Antes, si el
 * dueño no la escribía a mano en el Kit, todos los sitios decían lo mismo:
 * "Pay-per-request API for agents…", que no le dice a un agente qué hace el
 * sitio ni cuándo usarlo.
 *
 * Se genera una vez, leyendo la home y unas pocas páginas, y queda guardada
 * en `entity_description`. Lo que el dueño escribió nunca se pisa.
 */

const MODELO = process.env.AGENT_MODEL ?? 'claude-sonnet-5'
const MAX = 300

let anthropic: Anthropic | null = null

/** Dos frases en inglés, a partir del texto del sitio: qué es y cuándo usarlo. */
export async function describirSitio(tenant: Pick<Tenant, 'name' | 'originUrl'>): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) return null
  const sitio = await leerSitio(dominio).catch(() => '')
  if (sitio.length < 200) return null
  anthropic ??= new Anthropic()
  let res: Anthropic.Messages.Message
  try {
    res = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 2_000,
      system: [
        'You write the short description that AI agents read to decide whether to use a website or API.',
        'Write exactly two sentences in English, under 280 characters in total.',
        'Sentence 1: what this business or site is and what it offers, concretely.',
        'Sentence 2: starts with "Use it when" and says the situation in which an agent should use it.',
        'Use only facts present in the site text. No marketing words, no superlatives, no em dashes, no quotes, no preamble.',
        'Reply with the two sentences only.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `Name: ${tenant.name}\nDomain: ${dominio}\n\nSite text (each block starts with its URL):\n${sitio.slice(0, 10_000)}`,
        },
      ],
    })
  } catch (error) {
    // Sin descripción no se rompe nada: los documentos usan la plantilla y se reintenta otro día.
    console.warn('[describir]', tenant.name, error instanceof Error ? error.message : error)
    return null
  }
  const texto = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .replace(/\s+—\s+/g, ', ')
    .replace(/—/g, ', ')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.length >= 40 ? texto.slice(0, MAX) : null
}

/**
 * La descripción del negocio: la del dueño si existe; si no, la genera y la
 * guarda. Devuelve null si el sitio no se pudo leer (se reintenta otro día).
 */
export async function asegurarDescripcion(tenant: Tenant): Promise<string | null> {
  if (tenant.entityDescription?.trim()) return tenant.entityDescription
  const descripcion = await describirSitio(tenant)
  if (descripcion) await store.updateTenantEntity(tenant.id, { entityDescription: descripcion })
  return descripcion
}
