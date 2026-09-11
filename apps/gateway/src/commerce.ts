import { createHash, generateKeyPairSync, createSign, randomUUID } from 'node:crypto'
import type { Resource, Tenant } from '@peaje/db'
import { NETWORKS, NETWORK_IDS } from '@peaje/shared'
import { env } from './env.js'

/**
 * Los tres protocolos de comercio agéntico que el mercado terminó adoptando,
 * sobre el mismo riel que ya tiene Peaje (402 + stablecoin):
 *
 * - UCP (Google/Shopify): el perfil en `/.well-known/ucp` que dice qué sabe
 *   hacer el negocio y por dónde.
 * - ACP (OpenAI): `/checkout_sessions` para armar un carrito, y
 *   `/agentic_commerce/delegate_payment` para que un PSP reciba una tarjeta.
 * - AP2 (Google): mandatos firmados, declarados como extensión de UCP.
 *
 * Una decisión que importa: Peaje NO es un procesador de tarjetas y no acepta
 * PANs. El endpoint de delegate payment existe y responde con la forma que
 * manda ACP, pero rechaza tarjetas y explica cuál es el riel real. Es la
 * respuesta honesta, y para un agente es más útil que un 404.
 */

const UCP_VERSION = '2026-04-08'
const AP2_VERSION = '2026-01-23'
const ACP_API_VERSION = '2025-09-12'

/**
 * Clave de firma de mandatos AP2. Se genera al arrancar y su pública se
 * publica en el mismo perfil, así que es consistente mientras el proceso viva.
 * Para producción debería venir de env y sobrevivir a los reinicios.
 */
const firmante = (() => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>
  const kid = createHash('sha256').update(JSON.stringify(jwk)).digest('base64url').slice(0, 16)
  return { privateKey, jwk: { ...jwk, kid, use: 'sig', alg: 'ES256' } }
})()

/** JWS con contenido separado: el payload viaja en el cuerpo, no en el token. */
function jwsSeparado(payload: unknown): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: firmante.jwk.kid })).toString('base64url')
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const firma = createSign('SHA256')
    .update(`${header}.${cuerpo}`)
    .sign({ key: firmante.privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url')
  return `${header}..${firma}`
}

/** Perfil UCP del negocio (ucp-support, ap2-support). */
export function ucpProfile(tenant: Tenant, base: string): Record<string, unknown> {
  const instrumentos = NETWORK_IDS.map((id) => ({
    type: 'stablecoin',
    network: `eip155:${NETWORKS[id].testnet.chainId}`,
    asset: NETWORKS[id].token,
    symbol: NETWORKS[id].tokenSymbol,
  }))

  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        rest: { endpoint: `${base}/checkout_sessions`, spec: `${base}/openapi.json` },
        mcp: { endpoint: `${base}/mcp`, transport: 'streamable-http' },
      },
      capabilities: {
        'dev.ucp.shopping.checkout': [
          {
            version: UCP_VERSION,
            spec: 'https://ucp.dev/2026-04-08/specification/checkout',
            schema: 'https://ucp.dev/2026-04-08/schemas/shopping/checkout.json',
          },
        ],
        'dev.ucp.shopping.ap2_mandate': [
          {
            version: AP2_VERSION,
            spec: 'https://ucp.dev/2026-01-23/specification/ap2-mandates',
            schema: 'https://ucp.dev/2026-01-23/schemas/shopping/ap2_mandate.json',
            extends: 'dev.ucp.shopping.checkout',
            config: { vp_formats_supported: { 'dc+sd-jwt': {} } },
          },
        ],
      },
      payment_handlers: {
        'dev.ucp.ap2_mandate_compatible_handlers': [
          {
            id: `mpp_${tenant.slug}`,
            version: AP2_VERSION,
            spec: 'https://mpp.dev',
            schema: `${base}/discovery/resources`,
            available_instruments: [{ type: 'ap2_mandate' }, ...instrumentos],
          },
        ],
      },
    },
    signing_keys: [firmante.jwk],
  }
}

export type CheckoutSession = {
  id: string
  status: string
  currency: string
  line_items: unknown[]
  totals: unknown[]
  messages: unknown[]
  links: unknown[]
  fulfillment_options: unknown[]
  merchant_authorization: string
  expires_at: string
}

/** Sesiones vivas. En memoria a propósito: caducan en 15 minutos. */
const sesiones = new Map<string, { sesion: CheckoutSession; vence: number }>()

function limpiar() {
  const ahora = Date.now()
  for (const [id, v] of sesiones) if (v.vence < ahora) sesiones.delete(id)
}

export function getCheckoutSession(id: string): CheckoutSession | null {
  limpiar()
  return sesiones.get(id)?.sesion ?? null
}

/** Error con la forma que manda ACP. */
export function acpError(type: string, code: string, message: string, param?: string) {
  return { type, code, message, ...(param ? { param } : {}) }
}

/**
 * POST /checkout_sessions (acp-support). Los items son los slugs de links con
 * precio del negocio. El pago no ocurre acá: la sesión queda
 * `ready_for_payment` y cada línea trae la URL que devuelve el 402.
 */
export function crearCheckout(
  tenant: Tenant,
  base: string,
  resources: Resource[],
  items: { id: string; quantity: number }[],
): { ok: true; sesion: CheckoutSession } | { ok: false; error: ReturnType<typeof acpError> } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: acpError('invalid_request', 'missing', 'items is required', '$.items') }
  }

  const lineas = []
  for (const [i, item] of items.entries()) {
    const recurso = resources.find((r) => r.slug === item.id)
    if (!recurso) {
      return {
        ok: false,
        error: acpError(
          'invalid_request',
          'invalid',
          `Unknown item "${item.id}". The catalog lives at ${base}/discovery/resources.`,
          `$.items[${i}].id`,
        ),
      }
    }
    const cantidad = Number(item.quantity)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return {
        ok: false,
        error: acpError('invalid_request', 'invalid', 'quantity must be an integer > 0', `$.items[${i}].quantity`),
      }
    }
    // ACP cuenta en la unidad mínima de la moneda: centavos de USD.
    const unitario = Math.round(Number(recurso.priceUsd) * 100)
    const total = unitario * cantidad
    lineas.push({
      id: `li_${recurso.slug}`,
      item: { id: recurso.slug, quantity: cantidad },
      base_amount: total,
      discount: 0,
      subtotal: total,
      tax: 0,
      total,
      // Fuera de la spec pero es lo único que el agente necesita para pagar.
      payment_url: `${base}/r/${recurso.slug}`,
    })
  }

  const total = lineas.reduce((n, l) => n + l.total, 0)
  const id = `cs_${randomUUID().replace(/-/g, '')}`
  const vence = Date.now() + 15 * 60 * 1000

  const cuerpo = {
    id,
    status: 'ready_for_payment',
    currency: 'usd',
    line_items: lineas,
    totals: [
      { type: 'items_base_amount', display_text: 'Items', amount: total },
      { type: 'subtotal', display_text: 'Subtotal', amount: total },
      { type: 'total', display_text: 'Total', amount: total },
    ],
    fulfillment_options: [
      { type: 'digital', id: 'instant', title: 'Instant delivery', subtitle: 'Served on payment', subtotal: 0, tax: 0, total: 0 },
    ],
    messages: [
      {
        type: 'info',
        content_type: 'markdown',
        content: `Pay each line item by calling its \`payment_url\`: you get HTTP 402 with the terms, you settle in stablecoin, you get the resource. No card, no account. Terms: ${base}/auth.md`,
      },
    ],
    links: [{ type: 'seller_shop_policies', url: `${base}/auth.md` }],
    expires_at: new Date(vence).toISOString(),
  }

  // AP2: el negocio firma el carrito. El payload es este cuerpo, la firma
  // viaja separada, y la pública para verificarla está en /.well-known/ucp.
  const sesion: CheckoutSession = { ...cuerpo, merchant_authorization: jwsSeparado(cuerpo) }

  limpiar()
  sesiones.set(id, { sesion, vence })
  return { ok: true, sesion }
}

export const ACP_VERSION_HEADER = ACP_API_VERSION
