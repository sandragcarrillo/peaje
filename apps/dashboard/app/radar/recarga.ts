/**
 * Desfase de deploy: si la página se cargó antes de un deploy nuevo, el id de
 * la server action ya no existe en el server y la llamada lanza (no devuelve
 * { ok: false }). Eso no se arregla reintentando: hay que recargar. Se guarda
 * lo que la persona escribió, se recarga una sola vez por formulario y por
 * sesión (sin bucles) y la página recargada lo vuelve a poner con un aviso.
 */

const PREFIJO = 'peaje-radar-recarga'

export type FormularioRadar = 'hero' | 'informe' | 'medir'
export type Guardado = { email?: string; dominio?: string; consiente?: boolean }

/**
 * Recarga la página una vez para este formulario. true si recargó (no hay
 * que mostrar error); false si ya se recargó antes en esta sesión o no hay
 * sessionStorage (mostrar el error de siempre).
 */
export function recargarUnaVez(formulario: FormularioRadar, guardado: Guardado = {}): boolean {
  try {
    const usado = `${PREFIJO}:usado:${formulario}`
    if (sessionStorage.getItem(usado)) return false
    sessionStorage.setItem(usado, '1')
    sessionStorage.setItem(`${PREFIJO}:${formulario}`, JSON.stringify(guardado))
    window.location.reload()
    return true
  } catch {
    return false
  }
}

/** Lo que dejó una recarga para este formulario, una sola vez. null si no hubo recarga. */
export function leerRecarga(formulario: FormularioRadar): Guardado | null {
  try {
    const clave = `${PREFIJO}:${formulario}`
    const crudo = sessionStorage.getItem(clave)
    if (crudo === null) return null
    sessionStorage.removeItem(clave)
    const x = JSON.parse(crudo) as unknown
    if (typeof x !== 'object' || x === null) return {}
    const g = x as Record<string, unknown>
    return {
      email: typeof g.email === 'string' ? g.email.slice(0, 254) : undefined,
      dominio: typeof g.dominio === 'string' ? g.dominio.slice(0, 200) : undefined,
      consiente: g.consiente === true,
    }
  } catch {
    return null
  }
}
