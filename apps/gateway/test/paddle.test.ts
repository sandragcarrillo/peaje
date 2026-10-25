// Webhook de Paddle: firma, idempotencia, founder/pro, cancelación al fin del
// período y reembolso del primer pago. Corre contra el store en memoria (sin
// SUPABASE_URL): `pnpm --filter @peaje/gateway test`.
//
// Los payloads copian la forma de eventos reales del sandbox de Paddle
// (transaction.completed y subscription.canceled del 7 oct 2026) con los ids
// de precio de Peaje Pro y el customData que manda el dashboard.
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CUPOS_FOUNDER, accesoPro } from '@peaje/db'
import { Hono } from 'hono'
import { store } from '../src/store.js'
import {
  firmarPaddle,
  leerFirmaPaddle,
  manejarEventoPaddle,
  planDePaddle,
  verificarFirmaPaddle,
  webhookPaddle,
  type EventoPaddle,
} from '../src/billing/paddle.js'

const PRECIOS = { founder: 'pri_01m5rck0vjxwwgy1m9t4xe463j', pro: 'pri_01m5rck0zrxc39khzcmtsw59ca' }
const FIRMA_OPENSSL = '51375f103ed03e1bd0b15c02d522b58f3e07666030210eea91038de3d871e7ab'
const SECRETO = 'pdl_ntfset_01gkpjp8bkm3tm53kdgkx6sms7_6h3qd3uFSi9YCD3OLYAShQI90XTI5vEI'

let n = 0
const id = (p: string) => `${p}_${String(++n).padStart(26, '0')}`

async function negocio(slug: string) {
  return store.createTenant({ slug, name: slug, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
}

function transaccion(o: { tenantId: string; slug: string; plan: 'founder' | 'pro'; sub: string; txn?: string; desde: string; hasta: string; precio?: string; origin?: string }): EventoPaddle {
  const precio = o.precio ?? PRECIOS[o.plan]
  return {
    event_id: id('evt'),
    event_type: 'transaction.completed',
    occurred_at: o.desde,
    notification_id: id('ntf'),
    data: {
      id: o.txn ?? id('txn'),
      status: 'completed',
      customer_id: 'ctm_01m4abe9dhdrm230v98easpgj2',
      custom_data: { tenantId: o.tenantId, slug: o.slug, plan: o.plan },
      currency_code: 'USD',
      origin: o.origin ?? 'web',
      subscription_id: o.sub,
      collection_mode: 'automatic',
      billing_period: { starts_at: o.desde, ends_at: o.hasta },
      items: [{ price: { id: precio, product_id: 'pro_01m5rck0qv2rwhgx0rt8zzke65', unit_price: { amount: o.plan === 'founder' ? '3000' : '6900', currency_code: 'USD' } }, quantity: 1 }],
      details: { totals: { subtotal: o.plan === 'founder' ? '3000' : '6900', discount: '0', tax: '0', total: o.plan === 'founder' ? '3000' : '6900', currency_code: 'USD' } },
    },
  }
}

function suscripcion(o: { tenantId: string; slug: string; plan: 'founder' | 'pro'; sub: string; status: string; tipo?: string; cancelaEn?: string | null; canceladaEn?: string | null; ocurrio?: string }): EventoPaddle {
  return {
    event_id: id('evt'),
    event_type: o.tipo ?? `subscription.${o.status === 'active' ? 'updated' : o.status}`,
    occurred_at: o.ocurrio ?? new Date().toISOString(),
    data: {
      id: o.sub,
      status: o.status,
      customer_id: 'ctm_01m4abe9dhdrm230v98easpgj2',
      canceled_at: o.canceladaEn ?? null,
      paused_at: null,
      current_billing_period: null,
      scheduled_change: o.cancelaEn ? { action: 'cancel', effective_at: o.cancelaEn, resume_at: null } : null,
      items: [{ price: { id: PRECIOS[o.plan] }, quantity: 1, status: 'active' }],
      custom_data: { tenantId: o.tenantId, slug: o.slug, plan: o.plan },
    },
  }
}

function reembolso(txn: string, sub: string, o: { status?: string; type?: string; action?: string } = {}): EventoPaddle {
  return {
    event_id: id('evt'),
    event_type: o.status === 'pending_approval' ? 'adjustment.created' : 'adjustment.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: id('adj'),
      action: o.action ?? 'refund',
      type: o.type ?? 'full',
      transaction_id: txn,
      subscription_id: sub,
      customer_id: 'ctm_01m4abe9dhdrm230v98easpgj2',
      reason: 'First payment within 7 days',
      currency_code: 'USD',
      status: o.status ?? 'approved',
      totals: { subtotal: '3000', tax: '0', total: '3000', fee: '0', earnings: '0', currency_code: 'USD' },
      updated_at: new Date().toISOString(),
    },
  }
}

const dias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()

// ---------------------------------------------------------------- firma

test('firma: acepta el HMAC-SHA256 de `ts:cuerpo` y rechaza todo lo demás', () => {
  const cuerpo = JSON.stringify({ event_id: 'evt_01gks14ge726w50ch2tmaw2a1x', event_type: 'transaction.completed', data: {} })
  const ts = 1671552777
  const h1 = firmarPaddle(ts, cuerpo, SECRETO)
  assert.match(h1, /^[0-9a-f]{64}$/)
  const header = `ts=${ts};h1=${h1}`
  const ahora = ts * 1000

  assert.deepEqual(leerFirmaPaddle(header), { ts, h1: [h1] })
  assert.deepEqual(verificarFirmaPaddle(cuerpo, header, SECRETO, { ahora }), { ok: true })
  // Dentro y fuera de los 5 segundos que recomienda Paddle.
  assert.deepEqual(verificarFirmaPaddle(cuerpo, header, SECRETO, { ahora: ahora + 5_000 }), { ok: true })
  assert.deepEqual(verificarFirmaPaddle(cuerpo, header, SECRETO, { ahora: ahora + 6_000 }), { ok: false, motivo: 'vencida' })
  // Cuerpo tocado (un espacio), otro secreto, header roto.
  assert.deepEqual(verificarFirmaPaddle(cuerpo + ' ', header, SECRETO, { ahora }), { ok: false, motivo: 'firma' })
  assert.deepEqual(verificarFirmaPaddle(cuerpo, header, SECRETO + 'x', { ahora }), { ok: false, motivo: 'firma' })
  assert.deepEqual(verificarFirmaPaddle(cuerpo, `h1=${h1}`, SECRETO, { ahora }), { ok: false, motivo: 'formato' })
  assert.deepEqual(verificarFirmaPaddle(cuerpo, `ts=${ts};h1=zz`, SECRETO, { ahora }), { ok: false, motivo: 'firma' })
  // Rotación de secreto: dos h1, vale si uno coincide.
  assert.deepEqual(verificarFirmaPaddle(cuerpo, `ts=${ts};h1=${'0'.repeat(64)};h1=${h1}`, SECRETO, { ahora }), { ok: true })
})

test('firma: valor fijo calculado aparte (openssl dgst -sha256 -hmac)', () => {
  // printf '1671552777:{"a":1}' | openssl dgst -sha256 -hmac 'secreto'
  assert.equal(firmarPaddle(1671552777, '{"a":1}', 'secreto'), FIRMA_OPENSSL)
})

// ---------------------------------------------------------------- plan

test('plan: sale del precio cobrado; con precios configurados, otro precio no es de Peaje', () => {
  const items = (p: string) => [{ price: { id: p } }]
  assert.equal(planDePaddle(items(PRECIOS.founder), { plan: 'pro' }, PRECIOS), 'founder')
  assert.equal(planDePaddle(items(PRECIOS.pro), { plan: 'founder' }, PRECIOS), 'pro')
  // Precio de Puente en la misma cuenta de Paddle.
  assert.equal(planDePaddle(items('pri_01m3z0agfaab253yga67k4ngb9'), null, PRECIOS), null)
  // Sin precios configurados: lo que dijo el checkout.
  assert.equal(planDePaddle(items('pri_x'), { plan: 'founder' }, { founder: null, pro: null }), 'founder')
  assert.equal(planDePaddle(items('pri_x'), { plan: 'otro' }, { founder: null, pro: null }), null)
})

// ---------------------------------------------------------------- flujo

test('primer cobro founder: activa hasta billing_period.ends_at y guarda cliente y suscripción', async () => {
  const t = await negocio('cafe-founder')
  const sub = id('sub')
  const hasta = dias(30)
  const ev = transaccion({ tenantId: t.id, slug: t.slug, plan: 'founder', sub, desde: new Date().toISOString(), hasta })
  assert.deepEqual(await manejarEventoPaddle(ev, PRECIOS), { handled: 'payment' })

  const despues = (await store.getTenantById(t.id))!
  assert.equal(despues.plan, 'founder')
  assert.equal(despues.planUntil, hasta)
  assert.equal(despues.paddleSubscriptionId, sub)
  assert.equal(despues.paddleCustomerId, 'ctm_01m4abe9dhdrm230v98easpgj2')
  assert.equal(accesoPro(despues).activo, true)

  const [pago] = await store.listBillingPayments(t.id)
  assert.equal(pago?.method, 'paddle')
  assert.equal(pago?.reference, ev.data.id)
  assert.equal(pago?.amountUsd, '30.00')
  assert.equal(pago?.subscriptionRef, sub)
})

test('idempotencia: el mismo event_id y la misma transacción no extienden dos veces', async () => {
  const t = await negocio('cafe-repetido')
  const sub = id('sub')
  const txn = id('txn')
  const ev = transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, txn, desde: new Date().toISOString(), hasta: dias(30) })
  await manejarEventoPaddle(ev, PRECIOS)
  // Reintento de Paddle: mismo evento.
  assert.deepEqual(await manejarEventoPaddle(ev, PRECIOS), { duplicate: true })
  // Otro evento con la misma transacción (p. ej. replay manual desde el panel).
  assert.deepEqual(await manejarEventoPaddle({ ...ev, event_id: id('evt') }, PRECIOS), { duplicate: true })
  assert.equal((await store.listBillingPayments(t.id)).length, 1)
})

test('renovación: el segundo cobro mueve plan_until al fin del nuevo período', async () => {
  const t = await negocio('cafe-renueva')
  const sub = id('sub')
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(-29), hasta: dias(1) }), PRECIOS)
  const hasta = dias(31)
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(1), hasta, origin: 'subscription_recurring' }), PRECIOS)
  assert.equal((await store.getTenantById(t.id))!.planUntil, hasta)
  assert.equal((await store.listBillingPayments(t.id)).length, 2)
})

test('founder sin cupo: si el cliente pagó founder, se honra', async () => {
  // Llena los cupos con negocios que ya pagaron founder.
  for (let i = 0; i < CUPOS_FOUNDER; i++) {
    const otro = await negocio(`lleno-${i}`)
    await store.recordBillingPayment({ tenantId: otro.id, plan: 'founder', amountUsd: '30', method: 'x402', reference: id('ref'), periodStart: dias(0), periodEnd: dias(30) })
  }
  const t = await negocio('cafe-tarde')
  const r = await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: id('sub'), desde: dias(0), hasta: dias(30) }), PRECIOS)
  assert.deepEqual(r, { handled: 'payment' })
  assert.equal((await store.getTenantById(t.id))!.plan, 'founder')
})

test('customData.plan dice founder pero se cobró el precio pro: manda el precio', async () => {
  const t = await negocio('cafe-mezcla')
  const ev = transaccion({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: id('sub'), desde: dias(0), hasta: dias(30), precio: PRECIOS.pro })
  await manejarEventoPaddle(ev, PRECIOS)
  assert.equal((await store.getTenantById(t.id))!.plan, 'pro')
})

test('evento de otro producto de la cuenta (Puente): se ignora y no toca nada', async () => {
  const t = await negocio('cafe-ajeno')
  const ev = transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: id('sub'), desde: dias(0), hasta: dias(30), precio: 'pri_01m3z0agfaab253yga67k4ngb9' })
  assert.deepEqual(await manejarEventoPaddle(ev, PRECIOS), { ignored: 'unknown-price' })
  assert.equal((await store.getTenantById(t.id))!.plan, 'free')
  // Sin customData de Peaje (un cobro de RevenueCat): no hay negocio.
  const sinNegocio = { ...ev, event_id: id('evt'), data: { ...ev.data, custom_data: { source: 'paddle', rc_user_id: 'x' } } }
  assert.deepEqual(await manejarEventoPaddle(sinNegocio, PRECIOS), { ignored: 'no-tenant' })
})

test('cancelar: conserva Pro hasta el fin del período; al terminar pasa a gratis', async () => {
  const t = await negocio('cafe-cancela')
  const sub = id('sub')
  const fin = dias(20)
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(-10), hasta: fin }), PRECIOS)

  // El dueño cancela en el portal: sigue active con scheduled_change.
  await manejarEventoPaddle(suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, status: 'active', cancelaEn: fin }), PRECIOS)
  let ahora = (await store.getTenantById(t.id))!
  assert.equal(ahora.paddleStatus, 'active')
  assert.equal(ahora.paddleCancelAt, fin)
  assert.equal(ahora.planUntil, fin)
  assert.equal(accesoPro(ahora).activo, true)

  // Llega el fin del período: subscription.canceled con canceled_at = fin.
  await manejarEventoPaddle(suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, status: 'canceled', canceladaEn: fin }), PRECIOS)
  ahora = (await store.getTenantById(t.id))!
  assert.equal(ahora.paddleStatus, 'canceled')
  assert.equal(ahora.paddleCancelAt, null)
  assert.equal(ahora.planUntil, fin)
  assert.equal(accesoPro(ahora, new Date(new Date(fin).getTime() + 1000)).activo, false)
})

test('cancelación inmediata desde Paddle: Pro termina en canceled_at, y un reintento tardío no lo revive', async () => {
  const t = await negocio('cafe-inmediata')
  const sub = id('sub')
  const txn = id('txn')
  const primero = transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, txn, desde: dias(-1), hasta: dias(29) })
  await manejarEventoPaddle(primero, PRECIOS)
  const cancelada = new Date().toISOString()
  await manejarEventoPaddle(suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, status: 'canceled', canceladaEn: cancelada }), PRECIOS)
  assert.equal((await store.getTenantById(t.id))!.planUntil, cancelada)

  // Un cobro de esa suscripción que llega después (reintento): queda en el ledger, no extiende.
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(-1), hasta: dias(29) }), PRECIOS)
  assert.equal((await store.getTenantById(t.id))!.planUntil, cancelada)
})

test('reembolso completo del primer pago: el plan termina; pendiente no hace nada', async () => {
  const t = await negocio('cafe-reembolso')
  const sub = id('sub')
  const txn = id('txn')
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'founder', sub, txn, desde: dias(-2), hasta: dias(28) }), PRECIOS)

  // En live el reembolso nace pendiente de aprobación.
  assert.deepEqual(await manejarEventoPaddle(reembolso(txn, sub, { status: 'pending_approval' }), PRECIOS), { ignored: 'adjustment-pending_approval' })
  assert.equal(accesoPro((await store.getTenantById(t.id))!).activo, true)

  const aprobado = reembolso(txn, sub)
  assert.deepEqual(await manejarEventoPaddle(aprobado, PRECIOS), { handled: 'refund-ends-plan' })
  const ahora = (await store.getTenantById(t.id))!
  assert.equal(ahora.plan, 'free')
  assert.equal(ahora.planUntil, null)
  assert.equal(accesoPro(ahora).activo, false)
  assert.ok((await store.findBillingPayment('paddle', txn))?.refundedAt)
  // Otro evento de ajuste sobre el mismo cobro: ya está reembolsado.
  assert.deepEqual(await manejarEventoPaddle({ ...aprobado, event_id: id('evt') }, PRECIOS), { duplicate: true })
})

test('reembolso de una renovación o parcial: el plan sigue', async () => {
  const t = await negocio('cafe-reembolso-renov')
  const sub = id('sub')
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(-35), hasta: dias(-5) }), PRECIOS)
  const txn2 = id('txn')
  const hasta = dias(25)
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, txn: txn2, desde: dias(-5), hasta, origin: 'subscription_recurring' }), PRECIOS)

  assert.deepEqual(await manejarEventoPaddle(reembolso(txn2, sub, { type: 'partial' }), PRECIOS), { ignored: 'partial-refund' })
  assert.deepEqual(await manejarEventoPaddle(reembolso(txn2, sub), PRECIOS), { handled: 'refund-renewal' })
  const ahora = (await store.getTenantById(t.id))!
  assert.equal(ahora.planUntil, hasta)
  assert.equal(accesoPro(ahora).activo, true)
})

test('dos suscripciones del mismo negocio: la que se cancela no pisa a la viva', async () => {
  const t = await negocio('cafe-doble')
  const viva = id('sub')
  const otra = id('sub')
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: viva, desde: dias(0), hasta: dias(30) }), PRECIOS)
  await manejarEventoPaddle(suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: viva, status: 'active', tipo: 'subscription.activated' }), PRECIOS)
  const r = await manejarEventoPaddle(suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: otra, status: 'canceled', canceladaEn: new Date().toISOString() }), PRECIOS)
  assert.deepEqual(r, { ignored: 'other-subscription-active' })
  const ahora = (await store.getTenantById(t.id))!
  assert.equal(ahora.paddleSubscriptionId, viva)
  assert.equal(accesoPro(ahora).activo, true)
})

test('evento sin custom_data: se encuentra el negocio por la suscripción', async () => {
  const t = await negocio('cafe-sin-custom')
  const sub = id('sub')
  await manejarEventoPaddle(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, desde: dias(0), hasta: dias(30) }), PRECIOS)
  const ev = suscripcion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub, status: 'past_due', tipo: 'subscription.past_due' })
  ev.data.custom_data = null
  assert.deepEqual(await manejarEventoPaddle(ev, PRECIOS), { handled: 'subscription-past_due' })
  assert.equal((await store.getTenantById(t.id))!.paddleStatus, 'past_due')
})

// ---------------------------------------------------------------- HTTP

test('POST /paddle/webhook: 401 con firma mala, 200 con firma buena, 200 duplicado', async () => {
  process.env.PADDLE_WEBHOOK_SECRET = SECRETO
  process.env.PADDLE_PRICE_FOUNDER = PRECIOS.founder
  process.env.PADDLE_PRICE_PRO = PRECIOS.pro
  const app = new Hono()
  app.post('/paddle/webhook', webhookPaddle)
  const t = await negocio('cafe-http')
  const cuerpo = JSON.stringify(transaccion({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: id('sub'), desde: dias(0), hasta: dias(30) }))
  const ts = Math.floor(Date.now() / 1000)
  const pedir = (firma: string, body = cuerpo) => app.request('/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': firma, 'content-type': 'application/json' }, body })

  assert.equal((await pedir(`ts=${ts};h1=${'a'.repeat(64)}`)).status, 401)
  assert.equal((await pedir('')).status, 400)
  const bien = `ts=${ts};h1=${firmarPaddle(ts, cuerpo, SECRETO)}`
  const r = await pedir(bien)
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { received: true, handled: 'payment' })
  assert.equal((await store.getTenantById(t.id))!.plan, 'pro')
  const otra = await pedir(bien)
  assert.equal(otra.status, 200)
  assert.deepEqual(await otra.json(), { received: true, duplicate: true })
  // Firmado pero no es un evento: 400 (Paddle reintenta; nunca debería pasar).
  const raro = '{"hola":1}'
  assert.equal((await pedir(`ts=${ts};h1=${firmarPaddle(ts, raro, SECRETO)}`, raro)).status, 400)
})

