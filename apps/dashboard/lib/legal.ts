/**
 * Datos fijos de las páginas legales (/terms, /privacy, /reembolsos, /precios)
 * y del pie del sitio. Una sola fuente para que no se desincronicen.
 *
 * Titular, ciudad, jurisdicción y correo copiados de las páginas legales de
 * Puente (tupuente.app), que Paddle ya aprobó.
 */

/**
 * Titular del servicio, igual que en Puente. Confirmado por San el 24 oct 2026:
 * Sandra Carrillo, persona natural.
 */
export const TITULAR = 'Sandra Carrillo'
export const CIUDAD_ES = 'Bogotá, Colombia'
export const CIUDAD_EN = 'Bogotá, Colombia'

/**
 * Correo de contacto. Es el mismo de Puente porque el repo de Peaje no tiene
 * ningún buzón propio.
 * TODO(San): si creas un buzón en usepeaje.com (por ejemplo hola@usepeaje.com),
 * cámbialo acá y queda en las cuatro páginas y en el pie.
 */
export const CONTACTO = 'hello@usepeaje.com'

/** Fecha de la versión vigente. Cambiarla cada vez que cambie una de las páginas. */
export const ACTUALIZADA_ES = '27 de octubre de 2026'
export const ACTUALIZADA_EN = 'October 27, 2026'

/** Términos de compra de Paddle, que aplican a cada pedido. */
export const PADDLE_TERMINOS = 'https://www.paddle.com/legal/checkout-buyer-terms'
/** Portal de compradores de Paddle: recibos, cancelación y reembolsos. */
export const PADDLE_PORTAL = 'https://paddle.net'
