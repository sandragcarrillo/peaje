import type { Fila } from './api.js'

/**
 * Qué conviene trabajar según Search Console, sin que nadie lo pregunte. Dos
 * casos, por página:
 *
 *   titulo   Google ya la muestra en la primera página y casi nadie entra:
 *            el título y la descripción no convencen.
 *   mejorar  Google la muestra lejos del primer puesto: la página existe y
 *            todavía no responde mejor que las que tiene adelante.
 *
 * Puro: recibe las filas de 28 días y devuelve la lista ordenada. `parte` es
 * la fracción de las impresiones del sitio que se lleva la página; de ahí sale
 * el impacto, relativo al propio sitio y nunca un pronóstico de clics.
 */

export type Oportunidad = {
  tipo: 'titulo' | 'mejorar'
  url: string
  ruta: string
  impresiones: number
  clics: number
  posicion: number
  parte: number
  puntaje: number
  /** Las búsquedas donde Google muestra la página, de más a menos vistas. */
  consultas: { texto: string; impresiones: number; posicion: number }[]
}

/** Con menos que esto, 28 días no dicen nada de una página. */
export const MIN_IMPRESIONES = 10
/** Para decir "nadie entra" hace falta más muestra: en la primera página se espera al menos un clic cada 20 o 30 vistas. */
export const MIN_IMPRESIONES_TITULO = 20
const PRIMERA_PAGINA = 10

const redondo = (n: number) => Math.round(n * 10) / 10

function rutaDe(url: string): string | null {
  try {
    const u = new URL(url)
    // Un ancla (#seccion) no es una página: Google a veces la reporta aparte.
    return u.hash ? null : u.pathname
  } catch {
    return null
  }
}

/** `paginas`: filas por página. `pares`: filas por búsqueda y página (keys [query, page]). */
export function oportunidades(paginas: Fila[], pares: Fila[]): Oportunidad[] {
  // Las anclas repiten impresiones de su página: no cuentan en el total.
  const total = paginas.filter((f) => f.keys[0] && rutaDe(f.keys[0]) !== null).reduce((s, f) => s + f.impressions, 0)
  if (total === 0) return []
  const porPagina = new Map<string, Oportunidad['consultas']>()
  for (const f of pares) {
    const [texto, url] = f.keys
    if (!texto || !url) continue
    const lista = porPagina.get(url) ?? []
    lista.push({ texto, impresiones: f.impressions, posicion: redondo(f.position) })
    porPagina.set(url, lista)
  }
  const salida: Oportunidad[] = []
  for (const f of paginas) {
    const url = f.keys[0]
    const ruta = url ? rutaDe(url) : null
    if (!url || ruta === null || f.impressions < MIN_IMPRESIONES) continue
    const enPrimera = f.position <= PRIMERA_PAGINA
    const sinClics = f.clicks / f.impressions < 0.01
    const tipo: Oportunidad['tipo'] | null = enPrimera ? (sinClics && f.impressions >= MIN_IMPRESIONES_TITULO ? 'titulo' : null) : 'mejorar'
    if (!tipo) continue
    const parte = f.impressions / total
    salida.push({
      tipo,
      url,
      ruta,
      impresiones: f.impressions,
      clics: f.clicks,
      posicion: redondo(f.position),
      parte,
      // Cambiar un título es más corto que rehacer una página: a igual tráfico, va primero.
      puntaje: Math.round((tipo === 'titulo' ? 55 : 45) + Math.min(30, parte * 60)),
      consultas: (porPagina.get(url) ?? []).sort((a, b) => b.impresiones - a.impresiones).slice(0, 5),
    })
  }
  // A igual puntaje, primero la más corta de hacer (el título).
  const corta = (o: Oportunidad) => (o.tipo === 'titulo' ? 0 : 1)
  return salida.sort((a, b) => b.puntaje - a.puntaje || corta(a) - corta(b) || b.impresiones - a.impresiones)
}
