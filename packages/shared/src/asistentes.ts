/**
 * Los asistentes de IA en los que Peaje mide si un sitio sale citado: la
 * fuente única para el texto que ve la gente (dashboard, correos, Telegram) y
 * para los prompts del agente. Hoy son ChatGPT y Claude (claves de OpenAI y de
 * Anthropic en producción).
 *
 * Los motores que el gateway sabe consultar viven en
 * apps/gateway/src/citacion/motores.ts y pueden ser más (Perplexity, Gemini):
 * se usan si tienen clave. Si uno pasa a medirse en producción, se agrega acá.
 * Los rastreadores que visitan el sitio (PerplexityBot, Googlebot…) son otra
 * cosa y no dependen de esta lista.
 *
 * La copy que usa esta lista está escrita para dos o más (verbos en plural).
 * Sin imports: lo usan server y cliente.
 */
export const ASISTENTES_MEDIDOS = ['ChatGPT', 'Claude'] as const

/** Los ids de motor (los de MOTORES en el gateway) de ASISTENTES_MEDIDOS, en el mismo orden. */
export const MOTORES_MEDIDOS = ['chatgpt', 'claude'] as const

type Idioma = 'es' | 'en'

/** "A, B y C" / "A, B o C" / "A, B and C" / "A, B or C", sin coma antes de la conjunción. */
export function unirNombres(nombres: readonly string[], idioma: Idioma, conjuncion: 'y' | 'o' = 'y'): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  const palabra = idioma === 'en' ? (conjuncion === 'y' ? 'and' : 'or') : conjuncion
  return `${nombres.slice(0, -1).join(', ')} ${palabra} ${nombres.at(-1)}`
}

/** Los asistentes medidos en una frase: "ChatGPT y Claude", "ChatGPT o Claude", "ChatGPT and Claude", "ChatGPT or Claude". */
export const asistentesMedidos = (idioma: Idioma, conjuncion: 'y' | 'o' = 'y'): string => unirNombres(ASISTENTES_MEDIDOS, idioma, conjuncion)
