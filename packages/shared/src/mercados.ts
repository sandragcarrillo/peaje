/**
 * Mercados para medir citas: el país desde el que se pregunta. Un negocio
 * puede estar muy bien citado en Colombia y no salir en una pregunta hecha en
 * inglés y sin ubicación, así que la medición se puede pedir por país: las
 * preguntas se escriben para ese mercado y a los motores que lo aceptan
 * (ChatGPT y Claude) se les dice desde dónde se busca.
 * '' es "sin país": la medición de siempre.
 */
export const MERCADOS = [
  { codigo: 'CO', es: 'Colombia', en: 'Colombia', idioma: 'es' },
  { codigo: 'MX', es: 'México', en: 'Mexico', idioma: 'es' },
  { codigo: 'AR', es: 'Argentina', en: 'Argentina', idioma: 'es' },
  { codigo: 'CL', es: 'Chile', en: 'Chile', idioma: 'es' },
  { codigo: 'PE', es: 'Perú', en: 'Peru', idioma: 'es' },
  { codigo: 'EC', es: 'Ecuador', en: 'Ecuador', idioma: 'es' },
  { codigo: 'ES', es: 'España', en: 'Spain', idioma: 'es' },
  { codigo: 'BR', es: 'Brasil', en: 'Brazil', idioma: 'pt' },
  { codigo: 'US', es: 'Estados Unidos', en: 'United States', idioma: 'en' },
] as const

export type Mercado = (typeof MERCADOS)[number]

/** El mercado de un código de país (cualquier caja). Null si no es uno de la lista: no se mide un país inventado. */
export function mercadoDe(codigo: unknown): Mercado | null {
  if (typeof codigo !== 'string') return null
  const c = codigo.trim().toUpperCase()
  return MERCADOS.find((m) => m.codigo === c) ?? null
}
