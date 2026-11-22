/**
 * Lo que comparten las páginas que se escriben en .md (el blog en
 * content/blog y las comparativas en content/comparar): el frontmatter de
 * claves simples y la fecha YYYY-MM-DD.
 */

/** El bloque `---` del principio, con claves en minúscula y valores sin comillas. */
export function frontmatter(texto: string): { datos: Record<string, string>; resto: string } {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { datos: {}, resto: texto }
  const datos: Record<string, string> = {}
  for (const linea of m[1]!.split(/\r?\n/)) {
    const i = linea.indexOf(':')
    if (i <= 0) continue
    datos[linea.slice(0, i).trim().toLowerCase()] = linea
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return { datos, resto: texto.slice(m[0].length) }
}

export const fechaValida = (x: string | undefined) => (x && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null)

/** El H1 del cuerpo (si lo hay) y el cuerpo sin él: el título se pinta aparte. */
export function sinH1(resto: string): { h1: string | null; cuerpo: string } {
  const h1 = resto.match(/^\s*#\s+(.+)\s*$/m)
  return { h1: h1?.[1]?.trim() ?? null, cuerpo: resto.replace(/^\s*#\s+.+\r?\n+/, '').trim() }
}

/** "26 oct 2026" / "Oct 26, 2026". */
export function fechaCorta(fecha: string, idioma: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(idioma === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${fecha}T12:00:00Z`),
  )
}
