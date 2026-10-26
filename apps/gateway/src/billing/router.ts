import {
  CUPOS_FOUNDER,
  LIMITES,
  PRECIOS_USD,
  accesoPro,
  esPlanPago,
  extenderPlan,
  type BillingMethod,
  type PlanPago,
  type Tenant,
} from '@peaje/db'
import { Hono } from 'hono'
import { Receipt } from 'mppx'
import { contextoCobro, nuevoContexto } from '../contexto.js'
import { env } from '../env.js'
import { mppx } from '../mpp.js'
import { store } from '../store.js'
import { urlCheckout, urlPlan } from './acceso.js'
import { cryptoActivo, founderDisponible } from './founder.js'
import { crearSesionPortal, webhookPaddle } from './paddle.js'
import { saldoCreditos, usoPublico } from '../tareas/creditos.js'

/**
 * Cobro del agente Pro (M9):
 *   POST /paddle/webhook                           eventos de Paddle Billing (tarjeta; ver paddle.ts)
 *   GET  /_internal/:slug/billing                  plan vigente, créditos del mes, precios, cupos founder, historial
 *   POST /_internal/:slug/billing/portal           link al portal de clientes de Paddle
 *
 * Detrás de BILLING_CRYPTO_ENABLED (apagado por defecto desde el 24 oct 2026):
 *   GET  /_billing/:slug/:plan                     402 en USDC por el mes (founder|pro); pagado, extiende 30 días
 *
 * El pago de la suscripción es de Peaje, no del negocio: es un cobro propio
 * (solo Tempo, entero a la treasury; los rieles de contrato no aceptan al fee
 * recipient como merchant) y no pasa por creditReceipt (no entra al ledger
 * del negocio). Pagar con saldo ya no existe: Peaje no guarda saldos.
 * Queda en billing_payments con la referencia del receipt.
 */
export const billingRouter = new Hono()

billingRouter.onError((err, c) => {
  console.error('[billing] error no manejado', err)
  return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
})

/**
 * Precio a cobrar. BILLING_TEST_PRICE_USD solo vale fuera de producción: con
 * él se prueba el pago real en testnet sin gastar US$29.
 */
export function precioCobro(plan: PlanPago): string {
  const prueba = process.env.BILLING_TEST_PRICE_USD
  if (prueba && process.env.NODE_ENV !== 'production' && Number(prueba) > 0) return String(Number(prueba))
  return String(PRECIOS_USD[plan])
}

const sinCupoFounder = (tenant: Tenant) => ({
  error: 'founder-full',
  message: `The ${CUPOS_FOUNDER} founder spots are taken. Subscribe to Pro instead.`,
  checkout: urlCheckout(tenant.slug, 'pro'),
})

/** Con el cobro en USDC apagado, el 402 de la suscripción no existe. */
const cryptoApagado = (slug: string) => ({
  error: 'card-only',
  message: 'Peaje Pro is paid by card. Subscribe from your dashboard.',
  upgradeUrl: urlPlan(slug),
})

/** Registra el pago y extiende el plan 30 días desde max(hoy, vencimiento actual). */
async function activar(tenant: Tenant, plan: PlanPago, monto: string, method: BillingMethod, reference: string) {
  const previo = await store.findBillingPayment(method, reference)
  if (previo) {
    const actual = await store.getTenantById(tenant.id)
    return { pago: previo, tenant: actual ?? tenant, repetido: true }
  }
  // Pasar de founder a pro (o al revés) empieza de hoy: no se mezclan precios.
  const { desde, hasta } = extenderPlan(tenant.plan === plan ? tenant.planUntil : null)
  const pago = await store.recordBillingPayment({ tenantId: tenant.id, plan, amountUsd: monto, method, reference, periodStart: desde, periodEnd: hasta })
  await store.setTenantPlan(tenant.id, plan, hasta)
  console.log('[billing] plan activado', { tenant: tenant.slug, plan, monto, method, reference, hasta })
  return { pago, tenant: { ...tenant, plan, planUntil: hasta }, repetido: false }
}

function confirmacion(r: Awaited<ReturnType<typeof activar>>) {
  const acceso = accesoPro(r.tenant)
  return {
    ok: true,
    business: r.tenant.slug,
    plan: r.pago.plan,
    amountUsd: r.pago.amountUsd,
    method: r.pago.method,
    reference: r.pago.reference,
    periodStart: r.pago.periodStart,
    planUntil: r.tenant.planUntil,
    alreadyRecorded: r.repetido,
    access: acceso,
  }
}

/** Detrás del proxy de Railway el esquema llega como http: el challenge tiene que nombrar la URL que pidió el cliente. */
function conUrlExterna(req: Request): Request {
  const proto = req.headers.get('x-forwarded-proto')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? req.headers.get('host')
  if (!proto && !host) return req
  const url = new URL(req.url)
  const externa = `${proto ?? url.protocol.replace(':', '')}://${host ?? url.host}${url.pathname}${url.search}`
  return externa === req.url ? req : new Request(externa, req)
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

/** Lo que ve una persona que abre el link de pago en el navegador. */
function paginaDePago(tenant: Tenant, plan: PlanPago, precio: string, url: string): string {
  const nombre = plan === 'founder' ? 'Founder' : 'Pro'
  const panel = `${process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'}/t/${tenant.slug}/agente#plan`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Peaje ${nombre}</title>
<style>body{font-family:system-ui,sans-serif;background:#171613;color:#f3efe6;max-width:34rem;margin:12vh auto;padding:0 1.25rem;line-height:1.5}code{display:block;background:#23211d;padding:.75rem;overflow-x:auto;font-size:.85rem}a{color:#a9d8e0}p{color:#c9c4b8}h1{font-size:1.4rem}</style></head><body>
<h1>Peaje ${nombre} for ${esc(tenant.name)}: US$${Number(precio).toFixed(2)} for 30 days</h1>
<p>This link is paid by a wallet or an AI agent, not by a browser. Today it is paid in pathUSD on Tempo.</p>
<p><strong>Easiest:</strong> pay by card from your dashboard.<br><a href="${esc(panel)}">Open my plan in Peaje</a></p>
<p><strong>From a terminal</strong>, with a wallet that speaks x402 or MPP:</p>
<code>npx mppx ${esc(url)}</code>
<p>Card payments are coming soon.</p>
</body></html>`
}

// Paddle firma cada evento; no lleva el secreto interno.
billingRouter.post('/paddle/webhook', webhookPaddle)

billingRouter.get('/_billing/:slug/:plan', async (c) => {
  if (!cryptoActivo()) return c.json(cryptoApagado(c.req.param('slug')), 404)
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Business not found' }, 404)
  const plan = c.req.param('plan')
  if (!esPlanPago(plan)) return c.json({ error: 'Plan must be founder or pro' }, 400)
  if (plan === 'founder' && !(await founderDisponible(tenant)).ok) return c.json(sinCupoFounder(tenant), 409)

  const precio = precioCobro(plan)
  // Una persona que abre el link en el navegador veía un 402 crudo: se le
  // explica cómo se paga. Wallets y agentes no piden text/html ni llegan sin credencial.
  const esNavegador =
    (c.req.header('accept') ?? '').includes('text/html') && !c.req.header('authorization') && !c.req.header('payment-signature')
  if (esNavegador) return c.html(paginaDePago(tenant, plan, precio, c.req.url))
  // Cobro propio de Peaje: sin merchant, solo la oferta de Tempo a la treasury.
  const cobro = nuevoContexto(null, precio, { propio: true })
  cobro.x402Header = c.req.header('payment-signature') ?? null
  const result = await contextoCobro.run(cobro, () =>
    mppx.charge({
      amount: precio,
      description: `Peaje ${plan === 'founder' ? 'Founder' : 'Pro'} agent for ${tenant.name}, 30 days`,
    })(conUrlExterna(c.req.raw)),
  )
  if (result.status === 402) return result.challenge

  // withReceipt solo pone headers: primero se lee la referencia, después se sella la respuesta real.
  const header = result.withReceipt(new Response(null)).headers.get('Payment-Receipt')
  if (!header) return c.json({ error: 'Payment settled without a receipt. Keep your transaction and contact support.' }, 502)
  const receipt = Receipt.deserialize(header)
  const r = await activar(tenant, plan, precio, 'x402', receipt.reference)
  return result.withReceipt(c.json(confirmacion(r)))
})

// ---- interno (dashboard) ----

billingRouter.use('/_internal/:slug/billing', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})
billingRouter.use('/_internal/:slug/billing/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

billingRouter.get('/_internal/:slug/billing', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const crypto = cryptoActivo()
  const [founder, pagos, saldo] = await Promise.all([founderDisponible(tenant), store.listBillingPayments(tenant.id, 20), saldoCreditos(tenant)])
  return c.json({
    access: accesoPro(tenant),
    // Créditos del agente este mes: { credits, used, remaining, renewsAt, costs }.
    usage: usoPublico(saldo),
    prices: {
      founder: { usd: PRECIOS_USD.founder, charged: precioCobro('founder'), limits: LIMITES.founder },
      pro: { usd: PRECIOS_USD.pro, charged: precioCobro('pro'), limits: LIMITES.pro },
    },
    founder: { slotsLeft: founder.cupos, total: CUPOS_FOUNDER, available: founder.ok, alreadyFounder: founder.yaFounder },
    payments: pagos,
    // Links del 402 en USDC: solo con BILLING_CRYPTO_ENABLED.
    crypto,
    checkout: crypto
      ? { founder: founder.ok ? urlCheckout(tenant.slug, 'founder') : null, pro: urlCheckout(tenant.slug, 'pro') }
      : { founder: null, pro: null },
    upgradeUrl: urlPlan(tenant.slug),
  })
})

/**
 * El botón "Gestionar suscripción": una sesión nueva del portal de Paddle en
 * cada clic. El cliente sale del negocio (lo dejó el webhook), nunca de lo
 * que mande el navegador.
 */
billingRouter.post('/_internal/:slug/billing/portal', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  if (!tenant.paddleCustomerId) return c.json({ error: 'no-paddle-customer', message: 'This business has no card subscription yet.' }, 404)
  const subs = tenant.paddleSubscriptionId && tenant.paddleStatus !== 'canceled' ? [tenant.paddleSubscriptionId] : []
  try {
    return c.json({ url: await crearSesionPortal(tenant.paddleCustomerId, subs) })
  } catch (error) {
    console.error('[billing] no se pudo abrir el portal de Paddle', error)
    return c.json({ error: 'We could not open the Paddle portal. Try again in a minute.' }, 502)
  }
})
