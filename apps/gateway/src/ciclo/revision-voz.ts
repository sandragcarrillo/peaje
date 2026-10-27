import type { VoiceProfile } from '@peaje/db'

/**
 * La revisión de voz de un borrador antes de entregarlo (como el "voice lint"
 * de Boring Marketing). Revisa cuatro cosas:
 *   - rayas largas (regla de Peaje: ninguna): se cambian solas por comas o puntos
 *   - mayúscula sostenida ("PREGUNTAS FRECUENTES"): se pasa sola a minúscula
 *   - palabras que el perfil de voz del negocio evita: solo se cuentan
 *   - frases muy largas: solo se cuentan
 * Lo mecánico se arregla; lo que pide reescribir se avisa en una línea. Nunca
 * frena la entrega. No toca código, URLs, los [TODO: ...] ni el H1 (es la
 * pregunta literal y el título de la tarea).
 */

export type RevisionVoz = {
  /** Rayas largas cambiadas por comas o puntos. */
  rayas: number
  /** Tramos en mayúscula sostenida pasados a minúscula. */
  mayusculas: number
  /** Palabras que el perfil de voz evita y aparecen en el texto (no se cambian: piden reescribir). */
  palabras: string[]
  /** Frases de más de `largoMaximo` palabras (no se cortan solas). */
  largas: number
}

export const revisionVacia = (): RevisionVoz => ({ rayas: 0, mayusculas: 0, palabras: [], largas: 0 })

/** Suma las revisiones de varias páginas (una serie). */
export function sumarRevisiones(rs: (RevisionVoz | null | undefined)[]): RevisionVoz {
  const total = revisionVacia()
  for (const r of rs) {
    if (!r) continue
    total.rayas += r.rayas
    total.mayusculas += r.mayusculas
    total.largas += r.largas
    for (const p of r.palabras) if (!total.palabras.includes(p)) total.palabras.push(p)
  }
  return total
}

/** Lo que no se toca: bloques y tramos de código, placeholders, URLs (de links y sueltas) y los H1. */
const PROTEGIDO = /(```[\s\S]*?```|`[^`\n]*`|\[TODO:[^\]]*\]|\]\([^)\s]*\)|<https?:\/\/[^>\s]+>|https?:\/\/[^\s)>\]]+|^#[ \t][^\n]*)/gm

/** Siglas que se quedan en mayúscula aunque estén dentro de un tramo en mayúscula sostenida. */
const SIGLAS = new Set(
  'SEO API IA AI USD COP MXN CLP PEN ARS EUR UYU BRL IVA PDF URL FAQ CRM ERP SMS GPS NIT RUT RFC CUIT DIAN SAS SA LLC PYME PYMES ONG EPS IPS TV PC CEO CTO CFO HR RRHH UX UI QR'.split(' '),
)

const LETRA = /[\p{L}\p{N}]/u

function partirProtegido(texto: string): { libre: boolean; t: string }[] {
  const partes = texto.split(PROTEGIDO)
  return partes.map((t, i) => ({ libre: i % 2 === 0, t }))
}

/** Rayas largas (y guiones medianos con espacios, usados como raya) por comas o puntos. */
function sinRayas(t: string, cuenta: { n: number }): string {
  const antes = cuenta.n
  // Una raya al empezar la línea es una viñeta.
  let s = t.replace(/^([ \t]*)[—–][ \t]+/gm, (_m, sangria: string) => (cuenta.n++, `${sangria}- `))
  s = s.replace(/[ \t]*—[ \t]*|[ \t]+–[ \t]+/g, (m: string, at: number, todo: string) => {
    cuenta.n++
    const previo = todo.slice(0, at).slice(-1)
    const siguiente = todo.charAt(at + m.length)
    if (previo === '|') return ' - '
    if (siguiente === '|') return ' '
    // Un rango ("10—20") queda con guion.
    if (/\d/.test(previo) && /\d/.test(siguiente) && !/\s/.test(m)) return '-'
    if (siguiente === '\n') return ''
    if (previo === '' || previo === '\n') return siguiente === '' ? ' ' : previo === '' ? ', ' : ''
    if (/[,.;:!?¿¡(]/.test(previo)) return ' '
    if (siguiente === '') return ', '
    if (/\p{Lu}/u.test(siguiente) && LETRA.test(previo)) return '. '
    return ', '
  })
  // Lo que deja una raya junto a otra puntuación.
  if (cuenta.n > antes) s = s.replace(/,[ \t]*([,.;:!?)])/g, '$1').replace(/[ \t]+,/g, ',')
  return s
}

/** Un tramo en mayúscula sostenida: dos palabras o más, ocho letras o más en total. */
const TRAMO_MAYUSCULA = /(?<![\p{L}\p{N}])\p{Lu}{2,}(?:[ \t]+\p{Lu}+)+(?![\p{L}\p{N}])/gu

function sinMayusculaSostenida(t: string, guardar: Set<string>, cuenta: { n: number }): string {
  return t.replace(TRAMO_MAYUSCULA, (m: string, at: number, todo: string) => {
    const palabras = m.split(/([ \t]+)/)
    const letras = palabras.filter((_, i) => i % 2 === 0).join('').length
    if (letras < 8) return m
    // Todas siglas o nombres que se escriben así: no es mayúscula sostenida.
    if (palabras.every((p, i) => i % 2 === 1 || SIGLAS.has(p) || guardar.has(p))) return m
    cuenta.n++
    const previo = todo.slice(0, at).replace(/[ \t]+$/, '').slice(-1)
    const alEmpezar = previo === '' || /[\n#*_>\-|.!?¿¡"«“(]/.test(previo)
    const bajada = palabras.map((p, i) => (i % 2 === 1 || SIGLAS.has(p) || guardar.has(p) ? p : p.toLocaleLowerCase('es'))).join('')
    return alEmpezar ? bajada.charAt(0).toLocaleUpperCase('es') + bajada.slice(1) : bajada
  })
}

/**
 * Las palabras que el perfil de voz evita. `avoids` describe ("no exclamation
 * marks", "sin anglicismos"); de ahí salen solo las palabras citadas
 * ('no "barato"') o las entradas que ya son una palabra o dos ("barato").
 */
export function palabrasEvitadas(voz: Pick<VoiceProfile, 'avoids' | 'uses'> | null | undefined): string[] {
  const salida = new Set<string>()
  const usa = new Set((voz?.uses ?? []).map((u) => u.toLocaleLowerCase('es').trim()))
  for (const a of voz?.avoids ?? []) {
    const citadas = [/"([^"\n]{2,40})"/g, /“([^”\n]{2,40})”/g, /«([^»\n]{2,40})»/g, /‘([^’\n]{2,40})’/g, /(?<!\p{L})'([^'\n]{2,40})'(?!\p{L})/gu].flatMap((re) => [...a.matchAll(re)].map((m) => m[1]!.trim()))
    if (citadas.length) citadas.forEach((c) => salida.add(c.toLocaleLowerCase('es')))
    else {
      const t = a.trim().replace(/[.;:]+$/, '')
      if (!t || /^(no|sin|nada|nunca|never|avoid|avoids|evita|evitar|not|without|don't|doesn't)\b/i.test(t)) continue
      if (t.split(/\s+/).length <= 2 && t.length <= 30) salida.add(t.toLocaleLowerCase('es'))
    }
  }
  return [...salida].filter((p) => p.length >= 2 && !usa.has(p))
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Frases para contar palabras: sin código, tablas ni títulos; los links quedan con su texto. */
function frasesDe(markdown: string): string[] {
  const texto = markdown
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/`[^`\n]*`/g, ' x ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split('\n')
    .filter((l) => !/^\s*(#|\|)/.test(l))
    .join('\n')
  return texto.split(/(?<=[.!?…])\s+|\n+/).map((f) => f.trim()).filter(Boolean)
}

const palabrasEn = (f: string) => (f.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length

/** El largo desde el que una frase cuenta como muy larga: 25 palabras si el negocio escribe corto, si no 35. */
export const largoMaximo = (voz: Pick<VoiceProfile, 'sentenceLength'> | null | undefined) => (/short|cort|breve/i.test(voz?.sentenceLength ?? '') ? 25 : 35)

/**
 * Revisa y limpia un borrador. `protegidas`: nombres que se escriben en
 * mayúscula y no hay que tocar (el del negocio, por ejemplo).
 */
export function revisarVoz(markdown: string, opts: { voz?: VoiceProfile | null; protegidas?: string[] } = {}): { markdown: string; revision: RevisionVoz } {
  const partes = partirProtegido(markdown)
  const libre = partes.filter((p) => p.libre).map((p) => p.t).join('\n')
  // Una palabra en mayúscula que el texto usa sola (fuera de un tramo largo) es una sigla o un nombre: se respeta.
  const sueltas = libre.replace(TRAMO_MAYUSCULA, ' ').match(/(?<![\p{L}\p{N}])\p{Lu}{2,}(?![\p{L}\p{N}])/gu) ?? []
  const guardar = new Set<string>([...sueltas, ...(opts.protegidas ?? []).flatMap((n) => n.split(/\s+/)), ...(opts.voz?.uses ?? []).flatMap((u) => u.split(/\s+/))])
  const rayas = { n: 0 }
  const mayusculas = { n: 0 }
  const limpio = partes.map((p) => (p.libre ? sinMayusculaSostenida(sinRayas(p.t, rayas), guardar, mayusculas) : p.t)).join('')

  const textoLibre = partirProtegido(limpio)
    .filter((p) => p.libre)
    .map((p) => p.t)
    .join('\n')
  const palabras = palabrasEvitadas(opts.voz).filter((p) => new RegExp(`(?<![\\p{L}\\p{N}])${escapar(p)}(?![\\p{L}\\p{N}])`, 'iu').test(textoLibre))
  const tope = largoMaximo(opts.voz)
  const largas = frasesDe(limpio).filter((f) => palabrasEn(f) > tope).length
  return { markdown: limpio, revision: { rayas: rayas.n, mayusculas: mayusculas.n, palabras, largas } }
}

/**
 * La línea del resumen con lo que limpió la revisión y lo que conviene mirar.
 * Null si no hubo nada. `varias`: es una serie (las páginas).
 */
export function lineaDeRevision(r: RevisionVoz | null | undefined, idioma: 'es' | 'en', varias = false): string | null {
  if (!r) return null
  const partes: string[] = []
  const citar = (xs: string[]) => {
    const q = xs.slice(0, 4).map((x) => (idioma === 'es' ? `«${x}»` : `"${x}"`))
    return q.length > 1 ? `${q.slice(0, -1).join(', ')} ${idioma === 'es' ? 'y' : 'and'} ${q.at(-1)}` : q[0]!
  }
  if (idioma === 'es') {
    if (r.rayas) partes.push(`cambié ${r.rayas} raya${r.rayas === 1 ? '' : 's'} larga${r.rayas === 1 ? '' : 's'} por comas o puntos`)
    if (r.mayusculas) partes.push(`pasé ${r.mayusculas} frase${r.mayusculas === 1 ? '' : 's'} de mayúsculas a minúsculas`)
    if (r.palabras.length) partes.push(`${varias ? 'las páginas usan' : 'la página usa'} ${citar(r.palabras)}, que tu perfil de voz evita`)
    if (r.largas) partes.push(r.largas === 1 ? '1 frase quedó muy larga' : `${r.largas} frases quedaron muy largas`)
    return partes.length ? `Revisé la voz: ${partes.join('; ')}.` : null
  }
  if (r.rayas) partes.push(`I swapped ${r.rayas} em dash${r.rayas === 1 ? '' : 'es'} for commas or periods`)
  if (r.mayusculas) partes.push(`I changed ${r.mayusculas} all-caps phrase${r.mayusculas === 1 ? '' : 's'} to normal case`)
  if (r.palabras.length) partes.push(`${varias ? 'the pages use' : 'the page uses'} ${citar(r.palabras)}, which your voice profile avoids`)
  if (r.largas) partes.push(r.largas === 1 ? '1 sentence is very long' : `${r.largas} sentences are very long`)
  return partes.length ? `Voice check: ${partes.join('; ')}.` : null
}
