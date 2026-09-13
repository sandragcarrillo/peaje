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
        'usando solo los datos dados. Responde en el idioma de la misión, sin hype, sin viñetas. No inventes datos. ' +
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

/** HTML/JSON comprado → texto plano legible, acotado para el modelo. */
function textoPlano(crudo: string, max = 14_000): string {
  const sinHtml = crudo
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return sinHtml.slice(0, max)
}

/**
 * El paso final del agente: responder la MISIÓN con lo que compró. Sin esto,
 * el agente entregaba HTML crudo y la persona tenía que leerlo ella misma.
 *
 * Regla dura: responde SOLO con el contenido comprado. Si no alcanza para
 * cumplir la misión, lo dice tal cual; inventar el pronóstico sería peor que
 * no tenerlo. Falla suave a null (se entrega el contenido sin sintetizar).
 */
export async function sintetizarResultado(
  mision: string,
  servicio: string,
  contenido: string,
): Promise<string | null> {
  const anthropic = client()
  if (!anthropic) return null
  const texto = textoPlano(contenido)
  if (!texto) return null
  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        'Eres el paso final de un agente de compras autónomo. Acaba de pagar por un contenido para cumplir la misión de su dueño. Tu única tarea: responder la misión usando SOLO el contenido comprado. Si el contenido no contiene lo que la misión pide, dilo explícitamente en una línea y resume en dos líneas qué contiene en realidad (eso ayuda al dueño a ajustar la misión o el servicio). Responde en el idioma de la misión, directo y sin relleno.',
      messages: [
        {
          role: 'user',
          content: `Misión: ${mision}\n\nServicio comprado: ${servicio}\n\nContenido comprado (texto plano):\n${texto}`,
        },
      ],
    })
    const out = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return out || null
  } catch (err) {
    console.warn('[agents] síntesis falló, se entrega el contenido crudo:', err)
    return null
  }
}

// OJO: structured outputs exige esquemas cerrados; un z.record (propiedades
// abiertas) hace que la API rechace el formato y la consulta salga vacía.
// Por eso los parámetros van como lista de pares clave/valor.
const ConsultaSchema = z.object({
  parametros: z
    .array(
      z.object({
        clave: z.string().describe('Nombre del parámetro de query string'),
        valor: z.string().describe('Valor del parámetro'),
      }),
    )
    .describe('TODOS los parámetros que el endpoint necesita para devolver el dato de la misión'),
})

/**
 * Completa la query string de una ruta de API elegida (p. ej. lat/lon de la
 * ciudad que la misión menciona). El modelo no elige a quién pagar; solo
 * llena los parámetros de la llamada ya decidida. Falla suave a {}.
 */
export async function completarConsulta(
  mision: string,
  ruta: string,
  descripcion: string | null,
): Promise<Record<string, string>> {
  const anthropic = client()
  if (!anthropic) return {}
  try {
    const res = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 300,
      output_config: { format: zodOutputFormat(ConsultaSchema) },
      messages: [
        {
          role: 'user',
          content: `Un agente va a llamar el endpoint pago "${ruta}"${descripcion ? ` (${descripcion})` : ''} para cumplir esta misión: "${mision}". Devuelve TODOS los parámetros de query string que la llamada necesita para que la respuesta contenga el dato que la misión pide, usando los nombres estándar de ese endpoint. Ejemplo: para una API de pronóstico estilo Open-Meteo se necesitan latitude y longitude de la ciudad mencionada, daily con las variables (p. ej. temperature_2m_max,temperature_2m_min,precipitation_probability_max), forecast_days y timezone=auto; sin esos parámetros la API no devuelve pronóstico. Si el endpoint de verdad no necesita parámetros, devuelve la lista vacía.`,
        },
      ],
    })
    const pares = res.parsed_output?.parametros ?? []
    return Object.fromEntries(pares.map((p) => [p.clave, p.valor]))
  } catch (err) {
    // Sin parámetros la compra puede salir vacía: que quede en el log.
    console.warn('[agents] completarConsulta falló:', err)
    return {}
  }
}

const VeredictoSchema = z.object({
  compra: z.boolean().describe('true solo si el servicio entrega el dato que la misión pide'),
  motivo: z.string().describe('Una oración: por qué sí o por qué no, en el MISMO idioma de la misión'),
})

/**
 * El veto antes de pagar. El score encuentra "lo más parecido disponible",
 * pero comprar lo más parecido cuando nada sirve es tirar la plata (así se
 * compró documentación en vez de un pronóstico). Regla: no comprar nada
 * tiene que ganarle a comprar basura.
 *
 * Sin modelo configurado devuelve true: el comportamiento previo.
 */
export async function validarCompra(
  mision: string,
  candidato: { nombre: string; descripcion: string | null; url: string | null; precio: number | null },
): Promise<{ compra: boolean; motivo: string }> {
  const anthropic = client()
  if (!anthropic) return { compra: true, motivo: '' }
  // Un fallo transitorio del modelo no es un veredicto: se reintenta una vez
  // y, si persiste, se descarta el candidato SIN inventarle un motivo (la UI
  // no muestra jerga interna como "no se pudo validar").
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await anthropic.messages.parse({
        model: MODEL,
        max_tokens: 200,
        output_config: { format: zodOutputFormat(VeredictoSchema) },
        messages: [
          {
            role: 'user',
            content: `Un agente comprador tiene esta misión: "${mision}". El mejor candidato del mercado es el servicio pago "${candidato.nombre}" (${candidato.url ?? 'sin URL'})${candidato.descripcion ? `: ${candidato.descripcion}` : ''}, precio $${candidato.precio ?? '?'} por consulta. ¿Comprarlo entrega el DATO que la misión pide? Documentación, demos, páginas informativas o servicios de otro tema NO cumplen: en ese caso compra=false. Sé estricto: gastar en algo que no responde la misión es peor que no gastar. El campo motivo va en el MISMO idioma en que está escrita la misión.`,
          },
        ],
      })
      const v = res.parsed_output
      if (v) return { compra: v.compra, motivo: v.motivo }
    } catch (err) {
      if (intento === 1) console.warn('[agents] validación falló dos veces:', err)
    }
  }
  return { compra: false, motivo: '' }
}
