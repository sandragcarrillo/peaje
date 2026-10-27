import 'server-only'
import { normalizarCitas, type RespuestaCitas } from './citas-tipos'

/**
 * Pide al gateway la foto de citación de un dominio para el radar público:
 * POST /_internal/radar/citas { domain, locale }. Mismo patrón que
 * lib/gateway.ts (GATEWAY_INTERNAL_URL + Bearer INTERNAL_API_SECRET), aparte
 * para no tocar ese archivo. Tarda hasta ~70 s cuando no está en el caché del
 * gateway (que guarda la foto 7 días y lleva el tope diario).
 *
 * Acá, además, un caché corto por instancia: el pedido en curso se comparte
 * (la medición lo arranca y el resultado lo vuelve a pedir) y lo que llegó se
 * guarda un rato, para no gastar el tope por IP ni pegarle al gateway de más.
 *
 * Solo en desarrollo: RADAR_CITAS_STUB=ok|budget|unavailable devuelve una
 * respuesta de prueba sin llamar al gateway (para ver la sección sin el
 * endpoint), marcada `ejemplo: true`: la sección muestra "Ejemplo con datos
 * inventados (solo en desarrollo)". Con NODE_ENV distinto de development se ignora.
 */

const base = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8787'
const secret = process.env.INTERNAL_API_SECRET ?? ''
const TIMEOUT_MS = 85_000

const STUB = process.env.NODE_ENV === 'development' ? process.env.RADAR_CITAS_STUB : undefined

type Entrada = { promesa: Promise<RespuestaCitas>; vence: number }

// En globalThis: la ruta y cualquier otro bundle del mismo proceso ven el mismo caché.
const g = globalThis as typeof globalThis & { __peajeRadarCitas?: Map<string, Entrada> }
const cache: Map<string, Entrada> = (g.__peajeRadarCitas ??= new Map())

/** Cuánto vale lo que llegó antes de volver a preguntar. */
function vigenciaMs(r: RespuestaCitas): number {
  if (!('error' in r)) return 30 * 60_000
  if (r.error === 'budget') return Math.min(Math.max((r.retryAfterSeconds ?? 600) * 1000, 60_000), 15 * 60_000)
  if (r.error === 'invalid-domain') return 60 * 60_000
  // Con retryAfter es "ocupado" (otra medición del dominio en curso): el reintento tiene que pasar.
  if (r.error === 'unavailable') return r.retryAfterSeconds ? 0 : 30_000
  return 0
}

let avisoSinSecreto = false

async function llamar(dominio: string, locale: 'es' | 'en'): Promise<RespuestaCitas> {
  // Marcado como ejemplo: la sección lo dice en grande para que nadie lo tome por un resultado real.
  if (STUB) return { ...(await stub(STUB, dominio, locale)), ejemplo: true }
  if (!secret) {
    if (!avisoSinSecreto) console.warn('[radar] sin INTERNAL_API_SECRET: la sección de citas sale como no disponible')
    avisoSinSecreto = true
    return { error: 'unavailable' }
  }
  try {
    const res = await fetch(`${base}/_internal/radar/citas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ domain: dominio, locale }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const data: unknown = await res.json().catch(() => null)
    const r = normalizarCitas(data, res.ok)
    if ('error' in r && r.error === 'unavailable' && !res.ok) console.warn(`[radar] citas de ${dominio}: el gateway respondió ${res.status}`)
    return r
  } catch (err) {
    console.error(`[radar] citas de ${dominio} fallaron`, err instanceof Error ? err.message : err)
    return { error: 'unavailable' }
  }
}

/**
 * La foto de citación del dominio. `puedeLlamar` se consulta solo cuando hay
 * que ir al gateway (el tope por IP de la ruta); si dice que no, 'limit'.
 * Nunca lanza.
 */
export function citasDe(dominio: string, locale: 'es' | 'en', o: { puedeLlamar: () => boolean }): Promise<RespuestaCitas> {
  const clave = `${dominio}|${locale}`
  const ahora = Date.now()
  const hit = cache.get(clave)
  if (hit && hit.vence > ahora) return hit.promesa
  if (!o.puedeLlamar()) return Promise.resolve({ error: 'limit' })
  for (const [k, e] of cache) if (e.vence <= ahora) cache.delete(k)
  if (cache.size > 2_000) cache.clear()
  // Mientras está en curso vale hasta el timeout; cuando llega, lo que diga vigenciaMs.
  const entrada: Entrada = { promesa: llamar(dominio, locale), vence: ahora + TIMEOUT_MS + 5_000 }
  cache.set(clave, entrada)
  void entrada.promesa.then((r) => {
    entrada.vence = Date.now() + vigenciaMs(r)
  })
  return entrada.promesa
}

/** Respuesta de prueba, solo en desarrollo (ver arriba). Los dominios son de ejemplo a propósito. */
async function stub(modo: string, dominio: string, locale: 'es' | 'en'): Promise<RespuestaCitas> {
  await new Promise((r) => setTimeout(r, 8_000))
  if (modo === 'budget') return { error: 'budget', retryAfterSeconds: 3_600 }
  if (modo !== 'ok') return { error: 'unavailable' }
  const preguntas =
    locale === 'es'
      ? ['¿Dónde compro café de especialidad en línea?', '¿Qué tostador de café me recomiendas para regalar?', '¿Cuál es el mejor café en grano para espresso?']
      : ['Where can I buy specialty coffee online?', 'Which coffee roaster would you recommend for a gift?', 'What is the best whole bean coffee for espresso?']
  const celda = (cited: boolean, mentioned: boolean, sources: string[]) => ({ cited, mentioned, sources })
  return normalizarCitas(
    {
      domain: dominio,
      measuredAt: new Date().toISOString(),
      cached: false,
      engines: ['chatgpt', 'perplexity', 'claude', 'gemini'],
      questions: preguntas.map((text, i) => ({
        text,
        engines: {
          chatgpt: celda(false, false, ['guia-ejemplo.com', 'competidor-ejemplo.com']),
          perplexity: celda(i === 0, i === 0, i === 0 ? [dominio, 'guia-ejemplo.com'] : ['resenas-ejemplo.com']),
          claude: celda(false, i === 1, ['competidor-ejemplo.com']),
          ...(i < 2 ? { gemini: celda(false, false, ['otra-tienda-ejemplo.com']) } : {}),
        },
      })),
      coverage: { chatgpt: { cited: 0, total: 3 }, perplexity: { cited: 1, total: 3 }, claude: { cited: 0, total: 3 }, gemini: { cited: 0, total: 2 } },
      citedInstead: [
        { domain: 'guia-ejemplo.com', count: 4, kind: 'publisher' },
        { domain: 'competidor-ejemplo.com', count: 4, kind: 'competitor' },
        { domain: 'resenas-ejemplo.com', count: 2, kind: 'publisher' },
        { domain: 'otra-tienda-ejemplo.com', count: 2, kind: null },
      ],
    },
    true,
  )
}
