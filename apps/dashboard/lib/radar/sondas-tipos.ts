/**
 * Lo que manda la ruta de sondas del radar (app/api/radar/sondas) mientras
 * Ora mide: una línea JSON por evento. Sin imports a propósito: lo leen el
 * server (lib/radar/sondas.ts) y el componente cliente de la medición.
 */

/** Las tres preguntas del dueño, en el orden en que se revisan. */
export type PasoSonda = 'encuentran' | 'usan' | 'compran'

export const PASOS_SONDA: PasoSonda[] = ['encuentran', 'usan', 'compran']

/** bien: ✓. falta: ✗. nota: no se pudo revisar o es contexto, ni a favor ni en contra. */
export type Tono = 'bien' | 'falta' | 'nota'

/** Lo que encontró una sonda. El texto lo pone el diccionario (lib/i18n/sections/radar.ts). */
export type Hallazgo =
  | { id: 'sitio'; estado: 'inalcanzable' }
  | { id: 'sitio'; estado: 'bloqueado'; status: number }
  | { id: 'robots'; estado: 'abierto' | 'sin-archivo' | 'nose' }
  // todos: los bloquea a todos por la regla de *. todosIa: bloquea a cada bot de IA que revisamos, uno por uno.
  | { id: 'robots'; estado: 'bloquea'; bots: string[]; todos: boolean; todosIa: boolean }
  | { id: 'sitemap'; estado: 'ok'; paginas: number | null }
  | { id: 'sitemap'; estado: 'falta' | 'nose' }
  | { id: 'llms' | 'mcp' | 'openapi'; estado: 'ok' | 'falta' | 'nose' }
  | { id: 'jsonld'; estado: 'ok'; tipos: string[] }
  | { id: 'jsonld'; estado: 'falta' | 'invalido' | 'nose' }
  | { id: 'precios'; estado: 'pricing-md' | 'datos' | 'pagina' | 'falta' | 'nose' }
  | { id: 'pagos'; estado: 'ok'; metodos: string[] }
  | { id: 'pagos'; estado: 'falta' | 'nose' }

export type IdHallazgo = Hallazgo['id']

export type EventoSonda =
  | { tipo: 'paso'; paso: PasoSonda; estado: 'revisando' | 'listo' | 'sin-datos' }
  | { tipo: 'hallazgo'; paso: PasoSonda; tono: Tono; hallazgo: Hallazgo }
  | { tipo: 'fin' }
