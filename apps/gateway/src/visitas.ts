import type { AgentKind, NewVisit } from '@peaje/db'
import {
  MAX_PATH_LECTURA,
  MAX_UA_LECTURA,
  NO_ES_PAGINA,
  PEAJE_VERIFICADOR_HEADER,
  pathCanonico,
  RUTAS_DINAMICAS,
  RUTAS_PROXY,
  tipoDeBot,
  type LecturaDeBot,
} from '@peaje/shared'
import { Receipt } from 'mppx'
import { store } from './store.js'

/**
 * Visitas de agentes: cada request que entra a un tenant, pague o no. El
 * ledger (`payments`) solo ve a quien pagó; un negocio quiere saber también
 * quién lo lee (bots de respuesta, clientes MPP que miran el 402 y se van)
 * y por qué rutas. Ver la migración `agent_visits`.
 *
 * Se acumula en memoria y se descarga cada 2 s o 50 filas: nunca en el
 * camino del request, y nunca lanza. Si el pago existe, la fila se liga al
 * ledger por la referencia del Receipt.
 *
 * Las páginas que el sitio sirve solo (la home, el blog) no pasan por acá: de
 * esas, el proxy del kit reporta las que lee un bot (`registrarLectura`).
 * La lista de bots es la de @peaje/shared, la misma que usa el kit.
 */

/** Nuestro propio verificador no cuenta como visita. */
const IGNORAR_UA = /peaje-verificador/i

/**
 * Lo que lee el propio kit instalado en el sitio del negocio tampoco cuenta.
 * El proxy pide el manifest cada minuto por instancia y PeajeHead pide el
 * catálogo y el agent card cada hora por página, siempre que alguien (humano
 * o bot) entra al sitio. Salen con el user-agent de Node o de Vercel. Antes
 * se contaban como visitas de agentes y eran cerca del 75% del total.
 */
const LECTURAS_DEL_KIT = new Set(['/discovery/resources', '/.well-known/agent-card.json'])
const UA_DEL_KIT = /^(node|undici|Vercel Edge Functions|Next\.js Middleware|peaje-kit(\/.*)?)$/i

export function esLecturaDelKit(path: string, ua: string | null): boolean {
  // El manifest solo lo lee el kit: ningún agente lo necesita. El reporte de
  // lecturas lo manda el kit y se registra como la lectura que trae, no como request.
  if (path === '/kit/manifest.json' || path === '/kit/visita') return true
  return LECTURAS_DEL_KIT.has(path) && UA_DEL_KIT.test(ua ?? '')
}

/** La request trae una credencial de pago: el agente entendió el 402 y volvió a intentar. */
export function traeCredencial(headers: Headers): boolean {
  return headers.has('payment-signature') || headers.has('x-payment') || (headers.get('authorization') ?? '').startsWith('Payment ')
}

export function clasificarAgente(headers: Headers): AgentKind {
  // Credencial primero: un cliente de pago se reconoce por cómo paga, no
  // por su user-agent (que suele ser el de fetch de Node).
  if (headers.has('payment-signature') || headers.has('x-payment')) return 'x402-client'
  if ((headers.get('authorization') ?? '').startsWith('Payment ')) return 'mpp-client'
  return tipoDeBot(headers.get('user-agent')) ?? 'other'
}

/**
 * Qué ruta y qué precio vio esta request. Lo anota el handler que cobra y lo
 * lee el middleware de visitas después de `next()`: los dos tienen el mismo
 * `Request` crudo, así que no hace falta pasar nada por el contexto de Hono.
 */
const cobros = new WeakMap<Request, { routeId: string | null; priceUsd: string }>()

export function marcarCobro(req: Request, cobro: { routeId: string | null; priceUsd: string }): void {
  cobros.set(req, cobro)
}

type Pendiente = Omit<NewVisit, 'paid' | 'network' | 'amount' | 'paymentId'> & { receiptRef: string | null }

const LOTE = 50
const CADA_MS = 2_000
const cola: Pendiente[] = []
let timer: NodeJS.Timeout | null = null

function encolar(p: Pendiente): void {
  cola.push(p)
  if (cola.length >= LOTE) {
    void descargar()
    return
  }
  if (!timer) {
    timer = setTimeout(() => void descargar(), CADA_MS)
    timer.unref()
  }
}

async function descargar(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const lote = cola.splice(0)
  if (lote.length === 0) return
  try {
    const filas: NewVisit[] = await Promise.all(
      lote.map(async ({ receiptRef, ...v }) => {
        const pago = receiptRef ? await store.findPaymentByReceiptRef(receiptRef).catch(() => null) : null
        return {
          ...v,
          paid: pago !== null,
          network: pago?.network ?? null,
          amount: pago?.amount ?? null,
          paymentId: pago?.id ?? null,
        }
      }),
    )
    await store.recordVisits(filas)
  } catch (error) {
    console.warn('[visitas] no se pudo guardar el lote', error instanceof Error ? error.message : error)
  }
}

/**
 * Registra la request ya respondida. Se llama desde el middleware de tenant
 * después de `next()`: ahí se sabe el status y si salió un Receipt.
 */
export function registrarVisita(input: {
  tenantId: string
  method: string
  path: string
  headers: Headers
  response: Response
  /** El `Request` crudo, para leer la marca que dejó el handler que cobra. */
  request?: Request
}): void {
  const ua = input.headers.get('user-agent')
  if (ua && IGNORAR_UA.test(ua)) return
  // Las sondas del verificador salen con el UA real de un bot: no son visitas.
  if (input.headers.has(PEAJE_VERIFICADOR_HEADER)) return
  if (esLecturaDelKit(input.path, ua)) return
  let receiptRef: string | null = null
  const receipt = input.response.headers.get('Payment-Receipt')
  if (receipt) {
    try {
      receiptRef = Receipt.deserialize(receipt).reference
    } catch {
      receiptRef = null
    }
  }
  const cobro = input.request ? cobros.get(input.request) : undefined
  encolar({
    tenantId: input.tenantId,
    at: new Date().toISOString(),
    path: input.path,
    method: input.method,
    userAgent: ua ? ua.slice(0, 300) : null,
    agentKind: clasificarAgente(input.headers),
    status: input.response.status,
    routeId: cobro?.routeId ?? null,
    priceUsd: cobro?.priceUsd ?? null,
    attempted: traeCredencial(input.headers),
    receiptRef,
  })
}

/**
 * Status de una lectura reportada por el kit: el proxy corre antes que la
 * página y no sabe con qué status salió. No es 404 ni 402, así que no entra
 * en "inexistentes" ni en el embudo de cobro.
 */
export const STATUS_LECTURA = 0

/**
 * El cuerpo de `POST /:slug/kit/visita`: `invalida` si no tiene la forma de
 * una lectura de un bot de la lista, `ignorar` si es válida pero no se cuenta
 * (un asset, o una ruta que sirve el gateway y que ya se registró al pasar por
 * él: así no se cuenta dos veces aunque un kit viejo o nuevo decida distinto).
 */
export function lecturaDelKit(body: unknown): LecturaDeBot | 'invalida' | 'ignorar' {
  if (!body || typeof body !== 'object') return 'invalida'
  const { path, method, userAgent } = body as Record<string, unknown>
  if (typeof path !== 'string' || typeof method !== 'string' || typeof userAgent !== 'string') return 'invalida'
  const m = method.toUpperCase()
  if (m !== 'GET' && m !== 'HEAD') return 'invalida'
  // Una ruta sin query, sin espacios ni caracteres de control, y con largo acotado.
  if (!path.startsWith('/') || path.length > MAX_PATH_LECTURA || path.includes('?') || /[\s\u0000-\u001f\u007f]/.test(path)) return 'invalida'
  if (userAgent.length > MAX_UA_LECTURA || !tipoDeBot(userAgent)) return 'invalida'
  const canon = pathCanonico(path).toLowerCase()
  const delGateway =
    RUTAS_PROXY.some((r) => r.path.toLowerCase() === canon) || RUTAS_DINAMICAS.some((r) => canon.startsWith(r.prefijo.toLowerCase()))
  if (delGateway || NO_ES_PAGINA.test(path)) return 'ignorar'
  return { path, method: m, userAgent }
}

/** Una página del sitio que leyó un bot, según el proxy del kit, ya validada con `lecturaDelKit`. */
export function registrarLectura(tenantId: string, lectura: LecturaDeBot): void {
  encolar({
    tenantId,
    at: new Date().toISOString(),
    path: lectura.path,
    method: lectura.method,
    userAgent: lectura.userAgent,
    agentKind: tipoDeBot(lectura.userAgent) ?? 'other',
    status: STATUS_LECTURA,
    routeId: null,
    priceUsd: null,
    attempted: false,
    receiptRef: null,
  })
}

/** Para tests y apagado ordenado. */
export async function descargarVisitas(): Promise<void> {
  await descargar()
}
