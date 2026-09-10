import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { Evaluado } from './discovery.js'

/**
 * Capa de lenguaje del agente comprador. Hace dos cosas y ninguna es decidir:
 *
 * 1. Traduce la misión en lenguaje natural a términos de búsqueda (mejora el
 *    recall del matching, que a secas solo encuentra coincidencias literales).
 * 2. Redacta por qué se eligió lo que el motor determinista ya eligió.
 *
 * El modelo nunca elige a quién se le paga: podría alucinar un proveedor. El
 * ranking es determinista y auditable; esto es traducción y redacción.
 *
 * Todo falla suave: sin ANTHROPIC_API_KEY el agente sigue funcionando con las
 * palabras de la misión tal cual.
 */

const MODEL = 'claude-opus-5'

let cached: Anthropic | undefined

function client(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cached) cached = new Anthropic()
  return cached
}

const TerminosSchema = z.object({
  terminos: z
    .array(z.string())
    .describe('Palabras clave de búsqueda, en minúscula y sin tildes, incluyendo sinónimos'),
})

/**
 * Expande la misión a términos de búsqueda. Devuelve [] si no hay modelo:
 * el llamador cae a las palabras de la misión.
 */
export async function expandirMision(mision: string): Promise<string[]> {
  const anthropic = client()
  if (!anthropic) return []

  try {
    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1000,
      system:
        'Convierte la misión de un agente comprador en términos de búsqueda para un catálogo de servicios. ' +
        'Devuelve entre 4 y 10 términos de una sola palabra, en minúscula y sin tildes, incluyendo sinónimos ' +
        'y equivalentes en inglés y español. No expliques.',
      messages: [{ role: 'user', content: mision }],
      output_config: { format: zodOutputFormat(TerminosSchema) },
    })
    return (res.parsed_output?.terminos ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean)
  } catch (error) {
    console.warn('[agents] no se pudo expandir la misión con el modelo:', error)
    return []
  }
}

/**
 * Redacta la justificación de una decisión ya tomada. Devuelve null si no hay
 * modelo: el llamador muestra los motivos del motor.
 */
export async function explicarDecision(
  mision: string,
  elegido: Evaluado,
  /** Candidatos comprables comparados. Debe incluir al elegido. */
  comparados: Evaluado[],
): Promise<string | null> {
  const anthropic = client()
  if (!anthropic) return null

  // El elegido siempre va en la lista: si no, el modelo (con razón) se niega
  // a justificar una elección que no puede ver.
  const lista = comparados.some((c) => c.url === elegido.url)
    ? comparados
    : [elegido, ...comparados.slice(0, 3)]

  const contexto = lista
    .slice(0, 5)
    .map(
      (e) =>
        `- ${e.nombre}${e.url === elegido.url ? ' [ELEGIDO]' : ''} (${e.fuente}, score ${e.score}, precio ${e.precio ?? 'n/d'}, reputación ${e.reputacion ?? 'sin datos'}): ${e.motivos.join('; ')}`,
    )
    .join('\n')

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        'Eres el registro de decisiones de un agente que compra servicios pagando por request. ' +
        'Explica en dos o tres frases por qué se eligió el candidato marcado [ELEGIDO] frente a los otros, ' +
        'usando solo los datos dados. Español neutro, sin hype, sin viñetas. No inventes datos. ' +
        'Si un candidato no tiene reputación on-chain, eso significa que no está en el registro, no que sea malo.',
      messages: [
        {
          role: 'user',
          content: `Misión: ${mision}\n\nCandidatos comprables comparados:\n${contexto}`,
        },
      ],
    })
    const texto = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return texto || null
  } catch (error) {
    console.warn('[agents] no se pudo redactar la justificación:', error)
    return null
  }
}
