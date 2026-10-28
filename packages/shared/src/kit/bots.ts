/**
 * Los bots de IA que cuentan como visita, con el tipo que ve el panel. Una
 * sola lista para el gateway (clasifica cada request que le llega) y para el
 * proxy del kit (decide qué lecturas de página le reporta): un bot que entra
 * acá, el kit lo reporta y el gateway lo acepta. El orden importa: gana el
 * primero que coincide.
 */
export const BOTS_DE_VISITA = [
  { patron: /OAI-SearchBot/i, tipo: 'openai-searchbot' },
  { patron: /PerplexityBot/i, tipo: 'perplexitybot' },
  { patron: /Googlebot/i, tipo: 'googlebot' },
  { patron: /ClaudeBot|anthropic-ai/i, tipo: 'claudebot' },
  { patron: /GPTBot/i, tipo: 'gptbot' },
] as const

export type TipoBot = (typeof BOTS_DE_VISITA)[number]['tipo']

export function tipoDeBot(ua: string | null | undefined): TipoBot | null {
  if (!ua) return null
  for (const b of BOTS_DE_VISITA) if (b.patron.test(ua)) return b.tipo
  return null
}

/**
 * Lo manda el verificador del kit en las sondas que salen con el user-agent
 * real de un bot (tiene que ser el real: los WAF filtran por esa cadena). Ni
 * el kit ni el gateway cuentan esas sondas como visita. Falsificarlo solo
 * esconde la visita de quien lo manda.
 */
export const PEAJE_VERIFICADOR_HEADER = 'x-peaje-verificador'

/**
 * Lo que el proxy del kit le reporta al gateway cuando un bot lee una página
 * que el sitio sirve solo (la home, el blog): el gateway nunca ve esas
 * requests, y sin el reporte el registro de visitas solo contaba los archivos
 * de discovery. Va la ruta sin query y el user-agent del bot; ni la IP, ni
 * cookies, ni nada de visitas de personas.
 */
export type LecturaDeBot = { path: string; method: string; userAgent: string }

/** Assets que los bots también piden y que no dicen qué leyeron. */
export const NO_ES_PAGINA = /\.(png|jpe?g|gif|webp|avif|svg|ico|css|m?js|map|woff2?|ttf|otf|eot|mp4|webm|mp3|wav)$/i

/** Largo máximo de lo que viaja en el reporte. */
export const MAX_PATH_LECTURA = 500
export const MAX_UA_LECTURA = 300
