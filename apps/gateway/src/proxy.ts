import type { Tenant } from '@peaje/db'
import { PEAJE_ORIGIN_HEADER, secretoOrigen } from '@peaje/shared'

/** Headers que no se reenvían al origin del tenant. */
const STRIP = new Set([
  'host',
  'connection',
  'content-length',
  // El credential MPP es entre el agente y el gateway: el origin no lo ve.
  'authorization',
  // Igual el pago x402: una autorización sin usar en manos del origin se
  // puede someter por fuera y el agente pierde la plata.
  'payment-signature',
  'x-payment',
])

/**
 * Reenvía el request al origin del tenant, preservando método, query y body.
 * Agrega contexto de Peaje para que el origin pueda auditar el pago.
 */
export async function proxyToOrigin(
  request: Request,
  tenant: Tenant,
  path: string,
  context: { paymentRef?: string } = {},
): Promise<Response> {
  const incoming = new URL(request.url)
  // El path se pega al origin como texto: con new URL(path, base), un path
  // "//otro-host/x" cambiaba de host y el gateway le mandaba a ese host la
  // prueba de origen del negocio (y servía para leer la red interna).
  const origin = new URL(tenant.originUrl).origin
  const target = new URL(`${origin}${path.startsWith('/') ? '' : '/'}${path}`)
  if (target.origin !== origin) return new Response('Bad path', { status: 400 })
  target.search = incoming.search

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (!STRIP.has(k) && !k.startsWith('payment-') && !k.startsWith('x-payment')) headers.set(key, value)
  })
  headers.set('x-peaje-tenant', tenant.slug)
  // Prueba ante el sitio de que esta request ya pagó (ver proxy-runtime.ts):
  // el middleware del negocio la deja pasar al handler en vez de reenviarla.
  headers.set(PEAJE_ORIGIN_HEADER, await secretoOrigen(tenant.embedSecret))
  headers.set('x-forwarded-host', incoming.host)
  if (context.paymentRef) headers.set('x-peaje-payment-ref', context.paymentRef)

  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase())

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  })

  // fetch ya descomprimió el body, así que los headers de compresión y longitud
  // del origin quedan mintiendo: hay que sacarlos o el cliente falla al leer.
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')

  // Response nuevo: el original queda inmutable y no podríamos sellarle el receipt.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

