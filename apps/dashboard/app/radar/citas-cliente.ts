import type { RespuestaCitas } from './citas-tipos'

/**
 * Pedido de citas del lado del navegador, compartido mientras dura la
 * pestaña: la medición lo arranca junto con Ora y la sección del resultado
 * (otra pantalla, misma navegación) lo retoma en vez de empezar de cero.
 * `desde` sirve para que el contador de espera no vuelva a 0 al cambiar de pantalla.
 */

type Pedido = { promesa: Promise<RespuestaCitas>; desde: number }

const pedidos = new Map<string, Pedido>()

export function pedirCitas(dominio: string, locale: string, o: { nuevo?: boolean } = {}): Pedido {
  const clave = `${dominio}|${locale}`
  const hay = pedidos.get(clave)
  if (hay && !o.nuevo) return hay
  const promesa = fetch('/api/radar/citas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dominio, locale }),
  })
    .then(async (r) => (await r.json()) as RespuestaCitas)
    .catch((err: unknown): RespuestaCitas => {
      console.error('[radar] no se pudieron pedir las citas', err)
      return { error: 'unavailable' }
    })
  const pedido = { promesa, desde: hay?.desde ?? Date.now() }
  pedidos.set(clave, pedido)
  // Un error no se guarda: si la persona vuelve a esta pantalla, se pregunta de nuevo.
  void promesa.then((r) => {
    if ('error' in r && pedidos.get(clave) === pedido) pedidos.delete(clave)
  })
  return pedido
}
