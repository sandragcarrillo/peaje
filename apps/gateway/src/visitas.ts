import type { AgentKind, NewVisit } from '@peaje/db'
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
 */

const BOTS: [RegExp, AgentKind][] = [
  [/OAI-SearchBot/i, 'openai-searchbot'],
  [/PerplexityBot/i, 'perplexitybot'],
  [/Googlebot/i, 'googlebot'],
  [/ClaudeBot|anthropic-ai/i, 'claudebot'],
  [/GPTBot/i, 'gptbot'],
]

/** Nuestro propio verificador no cuenta como visita. */
const IGNORAR_UA = /peaje-verificador/i

/** La request trae una credencial de pago: el agente entendió el 402 y volvió a intentar. */
export function traeCredencial(headers: Headers): boolean {
  return headers.has('payment-signature') || headers.has('x-payment') || (headers.get('authorization') ?? '').startsWith('Payment ')
}

export function clasificarAgente(headers: Headers): AgentKind {
  // Credencial primero: un cliente de pago se reconoce por cómo paga, no
  // por su user-agent (que suele ser el de fetch de Node).
  if (headers.has('payment-signature') || headers.has('x-payment')) return 'x402-client'
  if ((headers.get('authorization') ?? '').startsWith('Payment ')) return 'mpp-client'
  const ua = headers.get('user-agent') ?? ''
  for (const [re, kind] of BOTS) if (re.test(ua)) return kind
  return 'other'
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

/** Para tests y apagado ordenado. */
export async function descargarVisitas(): Promise<void> {
  await descargar()
}
