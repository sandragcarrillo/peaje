import { createHmac, timingSafeEqual } from 'node:crypto'
import { PRECIOS_USD, esPlanPago, extenderPlan, type PlanPago, type Tenant } from '@peaje/db'
import type { Context } from 'hono'
import { store } from '../store.js'
import { programarBienvenida } from './bienvenida.js'
import { founderDisponible } from './founder.js'

/**
 * Suscripción Pro con tarjeta por Paddle Billing (Paddle es el Merchant of Record).
 *
 *   POST /paddle/webhook   eventos de Paddle, firmados con PADDLE_WEBHOOK_SECRET
 *
 * El checkout lo abre el dashboard (Paddle.js) con customData
 * { tenantId, slug, plan }. Paddle copia ese customData a la suscripción y a
 * cada renovación, así que todo evento trae el negocio.
 *
 * - transaction.completed: un cobro pagado. Va al ledger (billing_payments,
 *   method 'paddle', referencia txn_...) y plan_until pasa a ser el fin del
 *   período que Paddle cobró (billing_period.ends_at).
 * - subscription.*: guarda cliente, suscripción, estado y la cancelación
 *   programada. Cancelar conserva Pro hasta el fin del período pagado: el
 *   evento subscription.canceled llega cuando ese período termina.
 * - adjustment.*: reembolso completo aprobado del primer pago de la
 *   suscripción (o contracargo) termina el plan. Las renovaciones no se
 *   reembolsan por política; si San reembolsa una, queda marcada y nada más.
 *
 * Idempotente por event_id (tabla paddle_events) y, además, por la
 * transacción en billing_payments.
 *
 * Bienvenida: con el primer cobro de una suscripción Peaje manda su propio
 * correo (bienvenida.ts), una sola vez por negocio (tenants.welcome_sent_at).
 * Si Resend falla, los eventos subscription.* de los 3 días siguientes lo
 * reintentan. Nunca cambia la respuesta del webhook.
 */

// ---------------------------------------------------------------- firma

/** Paddle firma con ts=<unix>;h1=<hmac>. Puede traer varios h1 mientras se rota el secreto. */
export function leerFirmaPaddle(header: string): { ts: number | null; h1: string[] } {
  let ts: number | null = null
  const h1: string[] = []
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    const clave = parte.slice(0, i).trim()
    const valor = parte.slice(i + 1).trim()
    if (clave === 'ts' && /^\d+$/.test(valor)) ts = Number(valor)
    else if (clave === 'h1' && valor) h1.push(valor)
  }
  return { ts, h1 }
}

/** Lo que Paddle firma: `${ts}:${cuerpo crudo}`, HMAC-SHA256 con el secreto del destino, en hex. */
export function firmarPaddle(ts: number, cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(`${ts}:${cuerpo}`).digest('hex')
}

/** Paddle recomienda 5 segundos entre ts y ahora. PADDLE_WEBHOOK_TOLERANCE_S lo cambia si el reloj de Railway se corre. */
export const TOLERANCIA_FIRMA_S = 5

export function verificarFirmaPaddle(
  cuerpo: string,
  header: string,
  secreto: string,
  opts: { toleranciaS?: number; ahora?: number } = {},
): { ok: true } | { ok: false; motivo: 'formato' | 'vencida' | 'firma' } {
  const { ts, h1 } = leerFirmaPaddle(header)
  if (ts === null || !h1.length) return { ok: false, motivo: 'formato' }
  const ahora = Math.floor((opts.ahora ?? Date.now()) / 1000)
  if (Math.abs(ahora - ts) > (opts.toleranciaS ?? TOLERANCIA_FIRMA_S)) return { ok: false, motivo: 'vencida' }
  const esperada = Buffer.from(firmarPaddle(ts, cuerpo, secreto), 'hex')
  const coincide = h1.some((h) => {
    if (!/^[0-9a-f]+$/i.test(h)) return false
    const dada = Buffer.from(h, 'hex')
    return dada.length === esperada.length && timingSafeEqual(dada, esperada)
  })
  return coincide ? { ok: true } : { ok: false, motivo: 'firma' }
}

// ---------------------------------------------------------------- eventos

export type EventoPaddle = {
  event_id: string
  event_type: string
  occurred_at?: string
  notification_id?: string
  data: Record<string, any>
}

export type PreciosPaddle = { founder: string | null; pro: string | null }

/** Los precios de Paddle de cada plan. Sin ellos se confía en customData.plan. */
export const preciosPaddle = (): PreciosPaddle => ({
  founder: process.env.PADDLE_PRICE_FOUNDER || null,
  pro: process.env.PADDLE_PRICE_PRO || null,
})

type CustomData = { tenantId?: unknown; slug?: unknown; plan?: unknown } | null | undefined

/** Estados de Paddle en los que la suscripción sigue viva (cobra o reintenta). */
export const SUSCRIPCION_VIVA = new Set(['active', 'trialing', 'past_due'])

/**
 * El plan sale del precio que se cobró, no de lo que dijo el navegador. Si los
 * precios están configurados y el cobro es de otro precio (otro producto de la
 * misma cuenta de Paddle), no es de Peaje Pro: null.
 */
export function planDePaddle(items: unknown, custom: CustomData, precios: PreciosPaddle): PlanPago | null {
  const ids = (Array.isArray(items) ? items : []).map((i) => i?.price?.id ?? i?.price_id).filter((x): x is string => typeof x === 'string')
  if (precios.founder && ids.includes(precios.founder)) return 'founder'
  if (precios.pro && ids.includes(precios.pro)) return 'pro'
  if (precios.founder || precios.pro) return null
  return esPlanPago(custom?.plan) ? custom.plan : null
}

async function tenantDe(custom: CustomData, subscriptionId: string | null | undefined): Promise<Tenant | null> {
  if (typeof custom?.tenantId === 'string' && custom.tenantId) {
    // Un id que no es uuid hace fallar la consulta en Postgres: se trata como "no está".
    const t = await store.getTenantById(custom.tenantId).catch(() => null)
    if (t) {
      if (typeof custom.slug === 'string' && custom.slug !== t.slug) console.warn('[paddle] customData con slug distinto al del negocio', { tenantId: t.id, slug: t.slug, customSlug: custom.slug })
      return t
    }
  }
  if (subscriptionId) return store.getTenantByPaddleSubscription(subscriptionId)
  return null
}

/** Lo cobrado en dólares, sin impuestos (Paddle los cobra y los declara). Si no es USD, el precio de lista. */
function montoUsd(d: Record<string, any>, plan: PlanPago): string {
  const t = d.details?.totals
  if ((t?.currency_code ?? d.currency_code) === 'USD' && t?.subtotal != null) {
    const centavos = Number(t.subtotal) - Number(t.discount ?? 0)
    if (Number.isFinite(centavos) && centavos >= 0) return (centavos / 100).toFixed(2)
  }
  return String(PRECIOS_USD[plan])
}

const iso = (x: unknown): string | null => (typeof x === 'string' && !Number.isNaN(new Date(x).getTime()) ? new Date(x).toISOString() : null)

export type ResultadoPaddle = { handled: string } | { ignored: string } | { duplicate: true }

async function transaccionCompletada(ev: EventoPaddle, precios: PreciosPaddle): Promise<ResultadoPaddle> {
  const d = ev.data
  if (!d.subscription_id) return { ignored: 'not-a-subscription' }
  const custom = d.custom_data as CustomData
  const tenant = await tenantDe(custom, d.subscription_id)
  if (!tenant) {
    console.warn('[paddle] cobro sin negocio', { txn: d.id, sub: d.subscription_id, custom })
    return { ignored: 'no-tenant' }
  }
  const plan = planDePaddle(d.items, custom, precios)
  if (!plan) return { ignored: 'unknown-price' }
  if (await store.findBillingPayment('paddle', d.id)) return { duplicate: true }
  if (esPlanPago(custom?.plan) && custom.plan !== plan) console.warn('[paddle] customData.plan no coincide con el precio cobrado; manda el precio', { tenant: tenant.slug, custom: custom.plan, plan })

  if (plan === 'founder') {
    const f = await founderDisponible(tenant)
    // El cliente ya pagó el precio founder: se honra y queda en el log para que San lo vea.
    if (!f.ok) console.warn('[paddle] cobro founder sin cupo disponible; se honra igual', { tenant: tenant.slug, txn: d.id, cupos: f.cupos })
  }

  const respaldo = extenderPlan(tenant.plan === plan ? tenant.planUntil : null)
  const desde = iso(d.billing_period?.starts_at) ?? respaldo.desde
  const fin = iso(d.billing_period?.ends_at) ?? respaldo.hasta
  await store.recordBillingPayment({
    tenantId: tenant.id,
    plan,
    amountUsd: montoUsd(d, plan),
    method: 'paddle',
    reference: d.id,
    periodStart: desde,
    periodEnd: fin,
    subscriptionRef: d.subscription_id,
  })

  // Un reintento tardío del primer cobro no revive una suscripción que ya terminó.
  const terminada = tenant.paddleSubscriptionId === d.subscription_id && tenant.paddleStatus === 'canceled'
  if (!terminada) {
    // Mismo plan: nunca acorta lo que ya tenía. Otro plan: empieza con este período.
    const actual = tenant.plan === plan && tenant.planUntil ? new Date(tenant.planUntil).getTime() : 0
    const hasta = new Date(Math.max(new Date(fin).getTime(), actual)).toISOString()
    await store.setTenantPlan(tenant.id, plan, hasta)
    console.log('[paddle] plan activado', { tenant: tenant.slug, plan, txn: d.id, hasta })
    // Bienvenida con el primer cobro de la suscripción, nunca con una renovación.
    if (d.origin !== 'subscription_recurring' && (await cobrosDeSuscripcion(tenant.id, d.subscription_id)).length === 1) {
      programarBienvenida({ tenant, plan, custom: custom as Record<string, unknown> | null })
    }
  }
  await store.setTenantPaddle(tenant.id, {
    paddleSubscriptionId: d.subscription_id,
    ...(d.customer_id ? { paddleCustomerId: d.customer_id } : {}),
  })
  return { handled: 'payment' }
}

const cobrosDeSuscripcion = async (tenantId: string, sub: string) =>
  (await store.listBillingPayments(tenantId, 100)).filter((p) => p.method === 'paddle' && p.subscriptionRef === sub)

/** Si el envío de la bienvenida falló, los eventos de la suscripción de estos días la reintentan. */
export const DIAS_REINTENTO_BIENVENIDA = 3

/**
 * Reintento de la bienvenida: la suscripción está viva, tiene un solo cobro
 * (sigue en su primer período), sin reembolso, de hace menos de 3 días. La
 * reserva de welcome_sent_at decide si de verdad falta.
 */
async function reintentarBienvenida(tenant: Tenant, sub: string, status: unknown, plan: PlanPago, custom: CustomData): Promise<void> {
  if (status !== 'active' && status !== 'trialing') return
  const cobros = await cobrosDeSuscripcion(tenant.id, sub)
  const primero = cobros.length === 1 ? cobros[0] : null
  if (!primero || primero.refundedAt) return
  if (Date.now() - new Date(primero.createdAt).getTime() > DIAS_REINTENTO_BIENVENIDA * 86_400_000) return
  // El plan del cobro manda (es el precio que se pagó); el del evento solo si no coincide nada.
  programarBienvenida({ tenant, plan: esPlanPago(primero.plan) ? primero.plan : plan, custom: custom as Record<string, unknown> | null })
}

async function suscripcion(ev: EventoPaddle, precios: PreciosPaddle): Promise<ResultadoPaddle> {
  const d = ev.data
  const custom = d.custom_data as CustomData
  const tenant = await tenantDe(custom, d.id)
  if (!tenant) {
    console.warn('[paddle] suscripción sin negocio', { sub: d.id, custom })
    return { ignored: 'no-tenant' }
  }
  const plan = planDePaddle(d.items, custom, precios)
  if (!plan) return { ignored: 'unknown-price' }

  const otra = tenant.paddleSubscriptionId && tenant.paddleSubscriptionId !== d.id
  if (otra && SUSCRIPCION_VIVA.has(tenant.paddleStatus ?? '')) {
    // Dos checkouts del mismo negocio: la que muere no pisa a la que sigue cobrando.
    if (!SUSCRIPCION_VIVA.has(d.status)) return { ignored: 'other-subscription-active' }
    console.warn('[paddle] el negocio ya tenía otra suscripción viva; se guarda la nueva', { tenant: tenant.slug, antes: tenant.paddleSubscriptionId, ahora: d.id })
  }

  const cancelacion = d.scheduled_change?.action === 'cancel' ? iso(d.scheduled_change.effective_at) : null
  await store.setTenantPaddle(tenant.id, {
    paddleSubscriptionId: d.id,
    paddleStatus: typeof d.status === 'string' ? d.status : null,
    paddleCancelAt: d.status === 'canceled' ? null : cancelacion,
    ...(d.customer_id ? { paddleCustomerId: d.customer_id } : {}),
  })

  if (d.status === 'canceled' || d.status === 'paused') {
    // Terminó (fin del período cancelado, o cancelación inmediata desde Paddle): Pro hasta ese momento.
    const fin = iso(d.canceled_at) ?? iso(d.paused_at) ?? iso(ev.occurred_at) ?? new Date().toISOString()
    if (tenant.planUntil && new Date(tenant.planUntil).getTime() > new Date(fin).getTime()) {
      await store.setTenantPlan(tenant.id, esPlanPago(tenant.plan) ? tenant.plan : 'free', fin)
    }
    console.log('[paddle] suscripción terminada', { tenant: tenant.slug, sub: d.id, status: d.status, fin })
  } else {
    await reintentarBienvenida(tenant, d.id, d.status, plan, custom)
  }
  return { handled: `subscription-${d.status}` }
}

async function ajuste(ev: EventoPaddle): Promise<ResultadoPaddle> {
  const d = ev.data
  const contracargo = d.action === 'chargeback'
  if (d.action !== 'refund' && !contracargo) return { ignored: `adjustment-${d.action}` }
  if (d.status !== 'approved') return { ignored: `adjustment-${d.status}` }
  if (!contracargo && d.type && d.type !== 'full') {
    console.log('[paddle] reembolso parcial: el plan sigue', { txn: d.transaction_id, adjustment: d.id })
    return { ignored: 'partial-refund' }
  }
  const pago = d.transaction_id ? await store.findBillingPayment('paddle', d.transaction_id) : null
  if (!pago) {
    console.warn('[paddle] reembolso de un cobro que no está en el ledger', { txn: d.transaction_id, adjustment: d.id })
    return { ignored: 'unknown-transaction' }
  }
  if (pago.refundedAt) return { duplicate: true }
  const tenant = await store.getTenantById(pago.tenantId)
  if (!tenant) return { ignored: 'no-tenant' }

  const cobros = (await store.listBillingPayments(tenant.id, 100)).filter((p) => p.method === 'paddle' && p.subscriptionRef === pago.subscriptionRef)
  const primero = !cobros.some((p) => p.id !== pago.id && new Date(p.periodStart).getTime() < new Date(pago.periodStart).getTime())
  await store.markBillingPaymentRefunded(pago.id, iso(d.updated_at) ?? new Date().toISOString())

  if (primero || contracargo) {
    await store.setTenantPlan(tenant.id, 'free', null)
    console.log('[paddle] reembolso del primer pago: el plan termina', { tenant: tenant.slug, txn: pago.reference, contracargo })
    return { handled: 'refund-ends-plan' }
  }
  console.log('[paddle] reembolso de una renovación: el plan sigue', { tenant: tenant.slug, txn: pago.reference })
  return { handled: 'refund-renewal' }
}

export class EventoPaddleInvalido extends Error {}

/** Procesa un evento ya verificado. Idempotente por event_id. */
export async function manejarEventoPaddle(ev: EventoPaddle, precios: PreciosPaddle = preciosPaddle()): Promise<ResultadoPaddle> {
  if (!ev || typeof ev.event_id !== 'string' || typeof ev.event_type !== 'string' || !ev.data || typeof ev.data !== 'object') {
    throw new EventoPaddleInvalido('Not a Paddle event')
  }
  if (await store.paddleEventSeen(ev.event_id)) return { duplicate: true }

  let r: ResultadoPaddle
  switch (ev.event_type) {
    case 'transaction.completed':
      r = await transaccionCompletada(ev, precios)
      break
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.updated':
    case 'subscription.trialing':
    case 'subscription.past_due':
    case 'subscription.paused':
    case 'subscription.resumed':
    case 'subscription.canceled':
      r = await suscripcion(ev, precios)
      break
    case 'adjustment.created':
    case 'adjustment.updated':
      r = await ajuste(ev)
      break
    default:
      r = { ignored: ev.event_type }
  }
  await store.recordPaddleEvent({ eventId: ev.event_id, eventType: ev.event_type, occurredAt: iso(ev.occurred_at) })
  console.log('[paddle] evento', { id: ev.event_id, type: ev.event_type, ...r })
  return r
}

/**
 * POST /paddle/webhook. Solo un 2xx corta los reintentos de Paddle: cualquier
 * falla (firma o proceso) devuelve no-2xx y Paddle vuelve a intentar con el
 * mismo event_id.
 */
export async function webhookPaddle(c: Context) {
  const secreto = process.env.PADDLE_WEBHOOK_SECRET
  if (!secreto) {
    console.error('[paddle] falta PADDLE_WEBHOOK_SECRET: el webhook no se puede verificar')
    return c.json({ error: 'Paddle webhook not configured' }, 503)
  }
  const firma = c.req.header('paddle-signature') ?? ''
  // El cuerpo crudo: re-serializar el JSON cambiaría los bytes firmados.
  const cuerpo = await c.req.text()
  if (!firma || !cuerpo) return c.json({ error: 'Missing signature or body' }, 400)
  const tolerancia = Number(process.env.PADDLE_WEBHOOK_TOLERANCE_S ?? TOLERANCIA_FIRMA_S)
  const v = verificarFirmaPaddle(cuerpo, firma, secreto, { toleranciaS: Number.isFinite(tolerancia) && tolerancia > 0 ? tolerancia : TOLERANCIA_FIRMA_S })
  if (!v.ok) {
    console.warn('[paddle] firma rechazada', { motivo: v.motivo })
    return c.json({ error: 'Invalid signature' }, 401)
  }
  try {
    const r = await manejarEventoPaddle(JSON.parse(cuerpo) as EventoPaddle)
    return c.json({ received: true, ...r })
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof EventoPaddleInvalido) return c.json({ error: 'Invalid event body' }, 400)
    console.error('[paddle] no se pudo procesar el evento', error)
    return c.json({ error: 'Internal error' }, 500)
  }
}

// ---------------------------------------------------------------- portal

function baseApi(clave: string): string {
  const ambiente = process.env.PADDLE_ENV ?? (clave.startsWith('pdl_live_') ? 'production' : 'sandbox')
  return ambiente === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
}

/**
 * Sesión del portal de clientes de Paddle: link ya autenticado para cancelar,
 * cambiar la tarjeta o bajar facturas. Es de un solo uso y vence: se crea en
 * cada clic, nunca se guarda. La API key necesita customer_portal_session.write.
 */
export async function crearSesionPortal(customerId: string, subscriptionIds: string[]): Promise<string> {
  const clave = process.env.PADDLE_API_KEY
  if (!clave) throw new Error('PADDLE_API_KEY is not set')
  const res = await fetch(`${baseApi(clave)}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', 'paddle-version': '1' },
    body: JSON.stringify({ subscription_ids: subscriptionIds }),
  })
  if (!res.ok) throw new Error(`Paddle portal session failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } }
  const url = json.data?.urls?.general?.overview
  if (!url) throw new Error('Paddle portal session came back without a URL')
  return url
}
