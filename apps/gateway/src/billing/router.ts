import {
  CUPOS_FOUNDER,
  LIMITES,
  PRECIOS_USD,
  SaldoInsuficiente,
  accesoPro,
  esPlanPago,
  extenderPlan,
  type BillingMethod,
  type PlanPago,
  type Tenant,
} from '@peaje/db'
import { isSettlementNetwork } from '@peaje/shared'
import { Hono } from 'hono'
import { Receipt } from 'mppx'
import { contextoCobro, nuevoContexto } from '../contexto.js'
import { env } from '../env.js'
import { mppx } from '../mpp.js'
import { saldosPorRed } from '../saldos.js'
import { store } from '../store.js'
import { payoutFromTenant } from '../treasury.js'
import { urlCheckout, urlPlan } from './acceso.js'

/**
 * Cobro del agente Pro con el propio 402 de Peaje (M9):
 *   GET  /_billing/:slug/:plan                     402 por el mes (founder|pro); pagado, extiende 30 días
 *   GET  /_internal/:slug/billing                  plan vigente, precios, cupos founder, historial, URLs
 *   POST /_internal/:slug/billing/pay-with-balance {plan}  paga con el saldo cobrado del negocio
 *
 * El pago de la suscripción es de Peaje, no del negocio: va a la treasury con
 * `merchant` nulo y no pasa por creditReceipt (no entra al ledger del negocio).
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

/** Founder solo si quedan cupos, o si este negocio ya es founder (renueva a su precio). */
async function founderDisponible(tenant: Tenant): Promise<{ ok: boolean; cupos: number; yaFounder: boolean }> {
  const [usados, pagos] = await Promise.all([store.countFounders(), store.listBillingPayments(tenant.id, 100)])
  const yaFounder = pagos.some((p) => p.plan === 'founder')
  const cupos = Math.max(0, CUPOS_FOUNDER - usados)
  return { ok: yaFounder || cupos > 0, cupos, yaFounder }
}

const sinCupoFounder = (tenant: Tenant) => ({
  error: 'founder-full',
  message: `The ${CUPOS_FOUNDER} founder spots are taken. Subscribe to Pro instead.`,
  checkout: urlCheckout(tenant.slug, 'pro'),
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

billingRouter.get('/_billing/:slug/:plan', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Business not found' }, 404)
  const plan = c.req.param('plan')
  if (!esPlanPago(plan)) return c.json({ error: 'Plan must be founder or pro' }, 400)
  if (plan === 'founder' && !(await founderDisponible(tenant)).ok) return c.json(sinCupoFounder(tenant), 409)

  const precio = precioCobro(plan)
  // merchant nulo: en los rieles con contrato el pago queda a nombre de Peaje, no del negocio.
  const cobro = nuevoContexto(null, precio)
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
  const [founder, pagos, saldos] = await Promise.all([
    founderDisponible(tenant),
    store.listBillingPayments(tenant.id, 20),
    saldosPorRed(tenant).catch(() => []),
  ])
  return c.json({
    access: accesoPro(tenant),
    prices: {
      founder: { usd: PRECIOS_USD.founder, charged: precioCobro('founder'), limits: LIMITES.founder },
      pro: { usd: PRECIOS_USD.pro, charged: precioCobro('pro'), limits: LIMITES.pro },
    },
    founder: { slotsLeft: founder.cupos, total: CUPOS_FOUNDER, available: founder.ok, alreadyFounder: founder.yaFounder },
    balanceAvailable: saldos.reduce((s, b) => s + Number(b.available), 0).toFixed(6),
    payments: pagos,
    checkout: { founder: founder.ok ? urlCheckout(tenant.slug, 'founder') : null, pro: urlCheckout(tenant.slug, 'pro') },
    upgradeUrl: urlPlan(tenant.slug),
  })
})

/** Un pago con saldo a la vez por negocio: un doble clic no cobra dos meses. */
const enCurso = new Set<string>()

/**
 * Paga el mes con el saldo cobrado. El débito es un retiro hacia la treasury:
 * baja el disponible igual que un retiro normal. En Tempo y los rieles de
 * Circle el saldo ya está en la treasury, así que es solo el asiento (sin tx).
 * En las redes con PeajeSettlement el saldo vive en el contrato a nombre del
 * negocio: ahí sí sale una tx del contrato a la treasury.
 */
billingRouter.post('/_internal/:slug/billing/pay-with-balance', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const { plan } = (await c.req.json().catch(() => ({}))) as { plan?: string }
  if (!esPlanPago(plan)) return c.json({ error: 'Plan must be founder or pro' }, 400)
  if (plan === 'founder' && !(await founderDisponible(tenant)).ok) return c.json(sinCupoFounder(tenant), 409)
  if (enCurso.has(tenant.id)) return c.json({ error: 'A payment is already in progress' }, 409)
  enCurso.add(tenant.id)
  try {
    const precio = precioCobro(plan)
    const monto = Number(precio)
    const saldos = await saldosPorRed(tenant)
    // Primero donde no hace falta tx (el saldo ya está en la treasury).
    const candidatas = saldos
      .filter((b) => Number(b.available) + 1e-9 >= monto)
      .sort((a, b) => Number(isSettlementNetwork(a.network)) - Number(isSettlementNetwork(b.network)))
    const red = candidatas[0]
    if (!red) {
      const total = saldos.reduce((s, b) => s + Number(b.available), 0)
      return c.json(
        {
          error: 'insufficient-balance',
          message: `Your Peaje balance is US$${total.toFixed(2)} and no single network has US$${monto.toFixed(2)}. Pay with the checkout link instead.`,
          checkout: urlCheckout(tenant.slug, plan),
        },
        400,
      )
    }

    let retiro
    try {
      retiro = await store.createWithdrawal(
        { tenantId: tenant.id, amount: monto.toFixed(6), toWallet: env.treasuryAddress, network: red.network },
        { checkAvailable: !isSettlementNetwork(red.network) },
      )
    } catch (error) {
      if (error instanceof SaldoInsuficiente) return c.json({ error: 'insufficient-balance', message: 'Your balance changed. Try again or use the checkout link.', checkout: urlCheckout(tenant.slug, plan) }, 409)
      throw error
    }
    if (isSettlementNetwork(red.network)) {
      try {
        const hash = await payoutFromTenant(tenant, red.network, env.treasuryAddress, monto.toFixed(6))
        await store.updateWithdrawal(retiro.id, { txRef: hash })
      } catch (error) {
        await store.updateWithdrawal(retiro.id, { status: 'failed' })
        console.error('[billing] no se pudo mover el saldo del contrato', error)
        return c.json({ error: 'We could not move your balance. Try again or use the checkout link.' }, 502)
      }
    } else {
      await store.updateWithdrawal(retiro.id, { status: 'confirmed' })
    }
    const r = await activar(tenant, plan, precio, 'balance', `withdrawal:${retiro.id}`)
    return c.json({ ...confirmacion(r), network: red.network, withdrawalId: retiro.id })
  } finally {
    enCurso.delete(tenant.id)
  }
})
