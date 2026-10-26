// Correo de bienvenida de Peaje Pro: se manda una vez con el primer cobro de
// Paddle, en el idioma del dueño, y nunca con duplicados, reintentos ni
// renovaciones. Store en memoria y un fetch falso para Resend:
// `pnpm --filter @peaje/gateway test`.
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
process.env.RESEND_API_KEY = 're_test_bienvenida'
process.env.AGENTS_FROM_EMAIL = 'Peaje <agents@usepeaje.com>'
process.env.RADAR_REPLY_TO = 'hello@usepeaje.com'
process.env.DASHBOARD_PUBLIC_URL = 'https://usepeaje.com'
process.env.PADDLE_WEBHOOK_SECRET = 'pdl_ntfset_test_bienvenida'

import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { Hono } from 'hono'
import { store } from '../src/store.js'
import { correoBienvenida, esperarBienvenidas } from '../src/billing/bienvenida.js'
import { firmarPaddle, manejarEventoPaddle, webhookPaddle, type EventoPaddle } from '../src/billing/paddle.js'

const PRECIOS = { founder: 'pri_01m5rck0vjxwwgy1m9t4xe463j', pro: 'pri_01m5rck0zrxc39khzcmtsw59ca' }

// ---------------------------------------------------------------- Resend falso

type Envio = { from: string; to: string; subject: string; html: string; text?: string; reply_to?: string }
let envios: Envio[] = []
let intentos = 0
let resendFalla = false
const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url === 'https://api.resend.com/emails') {
    intentos++
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer re_test_bienvenida')
    if (resendFalla) return new Response('{"message":"boom"}', { status: 500 })
    envios.push(JSON.parse(String(init?.body)))
    return new Response('{"id":"email_1"}', { status: 200 })
  }
  return fetchReal(input, init)
}) as typeof fetch

beforeEach(() => {
  envios = []
  intentos = 0
  resendFalla = false
})

// ---------------------------------------------------------------- eventos

let n = 0
const id = (p: string) => `${p}_${String(++n).padStart(26, '0')}`
const dias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()

async function negocio(slug: string, nombre = slug) {
  return store.createTenant({ slug, name: nombre, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
}

function cobro(o: { tenantId: string; slug: string; plan: 'founder' | 'pro'; sub: string; txn?: string; origin?: string; locale?: string; desde?: string }): EventoPaddle {
  const centavos = o.plan === 'founder' ? '3000' : '6900'
  return {
    event_id: id('evt'),
    event_type: 'transaction.completed',
    occurred_at: new Date().toISOString(),
    data: {
      id: o.txn ?? id('txn'),
      status: 'completed',
      customer_id: 'ctm_01m4abe9dhdrm230v98easpgj2',
      custom_data: { tenantId: o.tenantId, slug: o.slug, plan: o.plan, ...(o.locale ? { locale: o.locale } : {}) },
      currency_code: 'USD',
      origin: o.origin ?? 'web',
      subscription_id: o.sub,
      billing_period: { starts_at: o.desde ?? new Date().toISOString(), ends_at: dias(30) },
      items: [{ price: { id: PRECIOS[o.plan] }, quantity: 1 }],
      details: { totals: { subtotal: centavos, discount: '0', tax: '0', total: centavos, currency_code: 'USD' } },
    },
  }
}

// Paddle copia el customData del checkout (con locale) a la suscripción.
function sub(o: { tenantId: string; slug: string; plan: 'founder' | 'pro'; sub: string; tipo: string; status?: string; locale?: string }): EventoPaddle {
  return {
    event_id: id('evt'),
    event_type: o.tipo,
    occurred_at: new Date().toISOString(),
    data: {
      id: o.sub,
      status: o.status ?? 'active',
      customer_id: 'ctm_01m4abe9dhdrm230v98easpgj2',
      scheduled_change: null,
      items: [{ price: { id: PRECIOS[o.plan] }, quantity: 1, status: 'active' }],
      custom_data: { tenantId: o.tenantId, slug: o.slug, plan: o.plan, ...(o.locale ? { locale: o.locale } : {}) },
    },
  }
}

async function procesar(ev: EventoPaddle) {
  const r = await manejarEventoPaddle(ev, PRECIOS)
  await esperarBienvenidas()
  return r
}

// ---------------------------------------------------------------- flujo

test('primer cobro founder en español: una bienvenida con asunto, link del agente y logo', async () => {
  const t = await negocio('panaderia-luz', 'Panadería Luz')
  const s = id('sub')
  const ev = cobro({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, locale: 'es' })
  assert.deepEqual(await procesar(ev), { handled: 'payment' })

  assert.equal(envios.length, 1)
  const [e] = envios
  assert.equal(e!.to, 'panaderia-luz@example.com')
  assert.equal(e!.from, 'Peaje <agents@usepeaje.com>')
  assert.equal(e!.reply_to, 'hello@usepeaje.com')
  assert.equal(e!.subject, 'Tu agente de Peaje ya está activo')
  assert.match(e!.html, /<html lang="es">/)
  assert.ok(e!.html.includes('href="https://usepeaje.com/t/panaderia-luz/agente"'), 'botón al agente')
  assert.ok(e!.html.includes('https://usepeaje.com/t/panaderia-luz/agente#telegram'), 'paso de Telegram')
  assert.ok(e!.html.includes('https://usepeaje.com/t/panaderia-luz/agente#plan'), 'gestionar suscripción')
  assert.ok(e!.html.includes('src="https://usepeaje.com/email/peaje-logo.png"'), 'logo PNG absoluto')
  assert.ok(e!.html.includes('Ir a mi agente'))
  assert.ok(e!.html.includes('Peaje Pro founder, US$30 al mes'))
  assert.ok(e!.html.includes('Mantienes este precio mientras tu suscripción siga activa.'))
  assert.ok(e!.html.includes('Panadería Luz'))
  assert.ok(e!.html.includes('https://usepeaje.com/terms') && e!.html.includes('https://usepeaje.com/privacy'))
  assert.ok(!/slack/i.test(e!.html), 'Slack no es público todavía')
  assert.ok(!e!.html.includes('—') && !e!.text!.includes('—'), 'sin em dashes')
  assert.ok(e!.text!.startsWith('Tu agente ya está activo'))
  assert.ok(e!.text!.includes('Ir a mi agente: https://usepeaje.com/t/panaderia-luz/agente'))

  // Reintento de Paddle (mismo event_id), replay con otro event_id y subscription.activated después: nada más.
  assert.deepEqual(await procesar(ev), { duplicate: true })
  assert.deepEqual(await procesar({ ...ev, event_id: id('evt') }), { duplicate: true })
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, tipo: 'subscription.activated' }))
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, tipo: 'subscription.updated' }))
  assert.equal(envios.length, 1)
  assert.equal(intentos, 1)
})

test('pro en inglés: sin línea de founder, US$69', async () => {
  const t = await negocio('north-dental', 'North Dental')
  await procesar(cobro({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: id('sub'), locale: 'en' }))
  assert.equal(envios.length, 1)
  const [e] = envios
  assert.equal(e!.subject, 'Your Peaje agent is live')
  assert.match(e!.html, /<html lang="en">/)
  assert.ok(e!.html.includes('Peaje Pro, US$69 a month'))
  assert.ok(!e!.html.includes('founder'))
  assert.ok(e!.html.includes('Go to my agent'))
  assert.ok(e!.html.includes('href="https://usepeaje.com/t/north-dental/agente"'))
})

test('idioma: sin locale en el checkout usa el de su Telegram, y si no, el de su sitio', async () => {
  const conTelegram = await negocio('cafe-tg')
  await store.linkTelegram({ chatId: 991, tenantId: conTelegram.id, username: 'duena', language: 'es' })
  await procesar(cobro({ tenantId: conTelegram.id, slug: conTelegram.slug, plan: 'pro', sub: id('sub') }))
  assert.equal(envios.at(-1)!.subject, 'Tu agente de Peaje ya está activo')

  const conVoz = await negocio('cafe-voz')
  await store.setTenantVoiceProfile(conVoz.id, { language: 'es', formality: 'casual', person: 'tú', sentenceLength: 'short', uses: [], avoids: [], samples: [] })
  await procesar(cobro({ tenantId: conVoz.id, slug: conVoz.slug, plan: 'pro', sub: id('sub') }))
  assert.equal(envios.at(-1)!.subject, 'Tu agente de Peaje ya está activo')

  const sinNada = await negocio('cafe-nada')
  await procesar(cobro({ tenantId: sinNada.id, slug: sinNada.slug, plan: 'pro', sub: id('sub') }))
  assert.equal(envios.at(-1)!.subject, 'Your Peaje agent is live')
  assert.equal(envios.length, 3)
})

test('renovaciones y suscriptores de antes: no hay bienvenida', async () => {
  const t = await negocio('cafe-viejo')
  const s = id('sub')
  // Ya pagaba antes de que existiera la bienvenida (cobro en el ledger, sin welcome_sent_at).
  await store.recordBillingPayment({ tenantId: t.id, plan: 'pro', amountUsd: '69.00', method: 'paddle', reference: id('txn'), periodStart: dias(-30), periodEnd: dias(0), subscriptionRef: s })
  await procesar(cobro({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, origin: 'subscription_recurring', desde: dias(0) }))
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, tipo: 'subscription.updated' }))
  // Un cobro recurrente aunque el ledger no tenga el anterior.
  const otro = await negocio('cafe-sin-ledger')
  await procesar(cobro({ tenantId: otro.id, slug: otro.slug, plan: 'pro', sub: id('sub'), origin: 'subscription_recurring' }))
  assert.equal(intentos, 0)
})

test('Resend falla: el webhook responde igual, la reserva se suelta y el próximo evento reintenta una vez', async () => {
  const t = await negocio('cafe-falla')
  const s = id('sub')
  resendFalla = true
  assert.deepEqual(await procesar(cobro({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, locale: 'es' })), { handled: 'payment' })
  assert.equal(intentos, 1)
  assert.equal(envios.length, 0)

  // Paddle manda subscription.activated / updated: reintenta.
  resendFalla = false
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, tipo: 'subscription.activated', locale: 'es' }))
  assert.equal(envios.length, 1)
  assert.equal(envios[0]!.subject, 'Tu agente de Peaje ya está activo')
  assert.ok(envios[0]!.html.includes('US$30'), 'el plan sale del cobro')
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'founder', sub: s, tipo: 'subscription.updated' }))
  assert.equal(envios.length, 1)
  assert.equal(intentos, 2)
})

test('Resend falla por HTTP: el webhook firmado devuelve 200', async () => {
  const t = await negocio('cafe-http')
  resendFalla = true
  const app = new Hono().post('/paddle/webhook', webhookPaddle)
  const ev = cobro({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: id('sub') })
  // Sin precios en el entorno: el plan sale de customData.
  const cuerpo = JSON.stringify(ev)
  const ts = Math.floor(Date.now() / 1000)
  const res = await app.request('/paddle/webhook', {
    method: 'POST',
    headers: { 'paddle-signature': `ts=${ts};h1=${firmarPaddle(ts, cuerpo, process.env.PADDLE_WEBHOOK_SECRET!)}`, 'content-type': 'application/json' },
    body: cuerpo,
  })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { received: true, handled: 'payment' })
  await esperarBienvenidas()
  assert.equal(intentos, 1)
})

test('el reintento solo vale los primeros 3 días del primer cobro', async () => {
  const t = await negocio('cafe-tarde')
  const s = id('sub')
  await store.recordBillingPayment({ tenantId: t.id, plan: 'pro', amountUsd: '69.00', method: 'paddle', reference: id('txn'), periodStart: dias(-5), periodEnd: dias(25), subscriptionRef: s })
  // El ledger en memoria pone createdAt = ahora: se corre a hace 5 días.
  const [pago] = await store.listBillingPayments(t.id)
  ;(pago as { createdAt: string }).createdAt = dias(-5)
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, tipo: 'subscription.updated' }))
  assert.equal(intentos, 0)
})

test('dos eventos a la vez (cobro y activación): una sola bienvenida', async () => {
  const t = await negocio('cafe-carrera')
  const s = id('sub')
  await manejarEventoPaddle(cobro({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s }), PRECIOS)
  await Promise.all([
    manejarEventoPaddle(sub({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, tipo: 'subscription.activated' }), PRECIOS),
    manejarEventoPaddle(sub({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, tipo: 'subscription.updated' }), PRECIOS),
  ])
  await esperarBienvenidas()
  assert.equal(envios.length, 1)
})

test('sin Resend configurado no reserva: cuando se configura, el próximo evento la manda', async () => {
  const t = await negocio('cafe-sin-resend')
  const s = id('sub')
  delete process.env.RESEND_API_KEY
  try {
    await procesar(cobro({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s }))
    assert.equal(intentos, 0)
  } finally {
    process.env.RESEND_API_KEY = 're_test_bienvenida'
  }
  await procesar(sub({ tenantId: t.id, slug: t.slug, plan: 'pro', sub: s, tipo: 'subscription.updated' }))
  assert.equal(envios.length, 1)
})

test('plantilla: escapa el nombre del negocio y usa DASHBOARD_PUBLIC_URL', () => {
  const c = correoBienvenida({ idioma: 'en', plan: 'pro', slug: 'x', negocio: '<b>Tom & Co</b>', base: 'https://staging.usepeaje.com/' })
  assert.ok(c.html.includes('&lt;b&gt;Tom &amp; Co&lt;/b&gt;'))
  assert.ok(!c.html.includes('<b>Tom'))
  assert.ok(c.html.includes('https://staging.usepeaje.com/email/peaje-logo.png'))
  assert.ok(c.html.includes(c.preheader.replace('<b>Tom & Co</b>', '&lt;b&gt;Tom &amp; Co&lt;/b&gt;')))
})
