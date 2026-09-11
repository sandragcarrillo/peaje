import type { Context, Next } from 'hono'

/**
 * Límite por IP con ventana deslizante, y las cabeceras del draft RFC de
 * RateLimit en TODAS las respuestas.
 *
 * El punto no es frenar abuso (120/min no frena a nadie): es que un agente
 * pueda auto-regularse leyendo cuánto le queda, en vez de descubrirlo cuando
 * ya lo cortaron. Anunciar las cabeceras sin aplicar el límite sería mentir,
 * así que el límite existe de verdad.
 */
// 600/min ≈ 10/s. Suficientemente alto para que ningún auditor ni ningún
// agente honesto lo toque, suficientemente bajo para frenar un bucle roto.
// Un límite apretado acá no protege nada y sí arruina una auditoría: el
// escáner dispara más de cien chequeos seguidos desde una sola IP.
const CUOTA = 600
const VENTANA_S = 60

const ventanas = new Map<string, { hits: number; abre: number }>()

function limpiar(ahora: number) {
  if (ventanas.size < 5000) return
  for (const [k, v] of ventanas) if (ahora - v.abre > VENTANA_S * 1000) ventanas.delete(k)
}

export async function rateLimit(c: Context, next: Next) {
  if (c.req.path === '/health') return next()

  const ahora = Date.now()
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'desconocida'
  const clave = `${ip}|${c.req.path.split('/')[1] ?? ''}`

  limpiar(ahora)
  const actual = ventanas.get(clave)
  const v =
    actual && ahora - actual.abre < VENTANA_S * 1000 ? actual : { hits: 0, abre: ahora }
  v.hits += 1
  ventanas.set(clave, v)

  const restan = Math.max(CUOTA - v.hits, 0)
  const resetEn = Math.ceil((v.abre + VENTANA_S * 1000 - ahora) / 1000)

  c.header('RateLimit', `"default";r=${restan};t=${resetEn}`)
  c.header('RateLimit-Policy', `"default";q=${CUOTA};w=${VENTANA_S}`)
  // Forma vieja: la que todavía leen la mayoría de los clientes.
  c.header('X-RateLimit-Limit', String(CUOTA))
  c.header('X-RateLimit-Remaining', String(restan))
  c.header('X-RateLimit-Reset', String(Math.ceil((v.abre + VENTANA_S * 1000) / 1000)))

  if (v.hits > CUOTA) {
    c.header('Retry-After', String(resetEn))
    return c.body(
      JSON.stringify(
        {
          type: 'https://peaje.dev/problems/rate-limited',
          title: 'Too many requests',
          status: 429,
          detail: `This merchant accepts ${CUOTA} requests per ${VENTANA_S}s per client.`,
          instance: c.req.path,
          hint: `Wait ${resetEn}s and retry. Read the RateLimit header to pace yourself.`,
        },
        null,
        2,
      ),
      429,
      { 'content-type': 'application/problem+json' },
    )
  }

  return next()
}
