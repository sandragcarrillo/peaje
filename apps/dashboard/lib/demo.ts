/**
 * Agendador de la página /demo. La URL la pone San en NEXT_PUBLIC_DEMO_URL
 * (Vercel) y de ella sale cómo se agenda:
 *
 * - Cal.com (cal.com/usuario/evento o app.cal.com/...): calendario en línea
 *   con el embed.js de Cal, prellenado con lo que la persona escribió.
 * - Cualquier otra URL https (Google Calendar, Calendly…): un botón que la abre
 *   en otra pestaña. Las páginas de reserva de Google no se pueden prellenar.
 * - Sin variable o con una URL que no sirve: un mailto a CONTACTO.
 *
 * Es NEXT_PUBLIC_: Next la fija en el build, así que cambiarla pide redeploy.
 * Sin imports: la usan la página y la CSP (lib/csp.ts, en el proxy).
 */

/** Hosts de Cal.com que se incrustan. Cal sirve el iframe siempre desde app.cal.com. */
const HOSTS_CAL = new Set(['cal.com', 'app.cal.com'])
export const CAL_EMBED_JS = 'https://app.cal.com/embed/embed.js'
/** El iframe del calendario (embed.js cambia cal.com por app.cal.com). */
export const CAL_IFRAME = 'https://app.cal.com'
/** La fuente de títulos que embed.js pide desde cal.com. */
export const CAL_FUENTE = 'https://cal.com'

export type Agendador =
  | { tipo: 'cal'; calLink: string; calOrigin: string }
  | { tipo: 'enlace'; url: string }
  | { tipo: 'correo' }

export function agendadorDesde(valor: string | undefined): Agendador {
  const texto = valor?.trim()
  if (!texto) return { tipo: 'correo' }
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return { tipo: 'correo' }
  }
  if (url.protocol !== 'https:') return { tipo: 'correo' }
  if (HOSTS_CAL.has(url.hostname)) {
    // "usuario/evento" (o "team/equipo/evento"), con su query si trae.
    const ruta = url.pathname.replace(/^\/+|\/+$/g, '')
    if (ruta) return { tipo: 'cal', calLink: `${ruta}${url.search}`, calOrigin: url.origin }
  }
  return { tipo: 'enlace', url: url.toString() }
}

export const agendador = (): Agendador => agendadorDesde(process.env.NEXT_PUBLIC_DEMO_URL)
