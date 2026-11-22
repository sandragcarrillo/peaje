/**
 * Mercados para medir citas: el país desde el que se pregunta. Un negocio
 * puede estar muy bien citado en Colombia y no salir en una pregunta hecha en
 * inglés y sin ubicación, así que la medición se puede pedir por país: las
 * preguntas se escriben para ese mercado y a los motores que lo aceptan
 * (ChatGPT y Claude) se les dice desde dónde se busca.
 * '' es "sin país": la medición de siempre.
 */
export type Mercado = {
  codigo: string
  es: string
  en: string
  /** 'local': un país fuera de la lista; las preguntas van en el idioma de ese país. */
  idioma: 'es' | 'pt' | 'en' | 'local'
}

/** Los de la lista del formulario. Cualquier otro país se puede escribir (ver mercadoDe y paisPorNombre). */
export const MERCADOS: readonly Mercado[] = [
  { codigo: 'CO', es: 'Colombia', en: 'Colombia', idioma: 'es' },
  { codigo: 'VE', es: 'Venezuela', en: 'Venezuela', idioma: 'es' },
  { codigo: 'MX', es: 'México', en: 'Mexico', idioma: 'es' },
  { codigo: 'AR', es: 'Argentina', en: 'Argentina', idioma: 'es' },
  { codigo: 'CL', es: 'Chile', en: 'Chile', idioma: 'es' },
  { codigo: 'PE', es: 'Perú', en: 'Peru', idioma: 'es' },
  { codigo: 'EC', es: 'Ecuador', en: 'Ecuador', idioma: 'es' },
  { codigo: 'ES', es: 'España', en: 'Spain', idioma: 'es' },
  { codigo: 'BR', es: 'Brasil', en: 'Brazil', idioma: 'pt' },
  { codigo: 'US', es: 'Estados Unidos', en: 'United States', idioma: 'en' },
]

/** El nombre de un código ISO de país en ese idioma; null si el código no es de un país. */
function nombreDePais(idioma: string, codigo: string): string | null {
  try {
    // Un código viejo (DD, la Alemania del Este) se resuelve al país actual: no cuenta, vale el código vigente.
    if (new Intl.Locale(`und-${codigo}`).region !== codigo) return null
    const n = new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo)
    return n && n !== codigo && !/unknown|desconocid/i.test(n) ? n : null
  } catch {
    return null
  }
}

/**
 * El mercado de un código de país (cualquier caja): uno de la lista o cualquier
 * otro país real (código ISO de dos letras). Null si no es un país: no se mide un país inventado.
 */
export function mercadoDe(codigo: unknown): Mercado | null {
  if (typeof codigo !== 'string') return null
  const c = codigo.trim().toUpperCase()
  const deLista = MERCADOS.find((m) => m.codigo === c)
  if (deLista) return deLista
  if (!/^[A-Z]{2}$/.test(c)) return null
  const en = nombreDePais('en', c)
  return en ? { codigo: c, es: nombreDePais('es', c) ?? en, en, idioma: 'local' } : null
}

const plano = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
let porNombre: Map<string, string> | null = null

/** El código del país que alguien escribió ("Uruguay", "costa rica", "Germany"). Null si no lo reconocemos. */
export function paisPorNombre(texto: string): string | null {
  const buscado = plano(texto)
  if (buscado.length < 3) return null
  if (!porNombre) {
    porNombre = new Map()
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const a of letras) {
      for (const b of letras) {
        for (const idioma of ['es', 'en', 'pt']) {
          const n = nombreDePais(idioma, a + b)
          if (n && !porNombre.has(plano(n))) porNombre.set(plano(n), a + b)
        }
      }
    }
  }
  return porNombre.get(buscado) ?? null
}

/** Una ciudad escrita a mano, limpia: solo letras, espacios y . ' -, hasta 60 caracteres. Null si no sirve. */
export function ciudadLimpia(x: unknown): string | null {
  if (typeof x !== 'string') return null
  const c = x.replace(/\s+/g, ' ').trim().slice(0, 60)
  return c.length >= 2 && /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(c) ? c : null
}
