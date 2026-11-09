// Con los cobros en prueba, el plan no muestra pasos de cobro ni su resumen,
// cuenta solo los bots con que los asistentes buscan para responder (ClaudeBot
// es entrenamiento) y cada paso dice en palabras qué mide, de dónde arrancó,
// dónde está y la meta. Store en memoria, sin red.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgentKind } from '@peaje/db'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.NEXT_PUBLIC_COBROS
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-plan-sin-cobros-0123456789abcdef01234567',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { planConAvance } = await import('../src/tareas/plan.js')
const { probarHerramienta } = await import('../src/tareas/agente.js')

const tenant = await store.createTenant({ slug: 'plan-prueba', name: 'Plan Prueba', originUrl: 'https://planprueba.co', embedSecret: 'x' })
await store.savePlan({
  tenantId: tenant.id,
  goal: 'both',
  goalDetail: 'que la IA me recomiende y que los agentes paguen',
  capacity: ['content'],
  cadence: 'weekly',
  language: 'es',
  summary: 'Hoy tienes 0 pagos y una ruta sin precio.',
  steps: [
    { title: 'Publica 4 páginas', why: 'pocas visitas', deliverable: '4 páginas con la pregunta como título', metric: 'answer_bot_visits_7d', target: 2 },
    { title: 'Cobra la ruta del radar', why: 'sin precio', deliverable: 'precio y descripción en la ruta', metric: 'paid_requests_7d', target: 5 },
    { title: 'Revisa cada 402', why: 'sin intentos', deliverable: 'cada 402 revisado', metric: 'payment_attempt_rate', target: 0.6 },
  ],
  baseline: { answer_bot_visits_7d: 1, paid_requests_7d: 0, payment_attempt_rate: null },
})

const visita = (agentKind: AgentKind, userAgent: string) => ({
  tenantId: tenant.id,
  at: new Date().toISOString(),
  path: '/',
  method: 'GET',
  userAgent,
  agentKind,
  paid: false,
  network: null,
  amount: null,
  paymentId: null,
  status: 200,
  routeId: null,
  priceUsd: null,
  attempted: false,
})
const claudeBot = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'
await store.recordVisits([
  visita('claudebot', claudeBot),
  visita('claudebot', claudeBot),
  visita('claudebot', claudeBot),
  visita('googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
  visita('openai-searchbot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot'),
])

test('sin cobros, el plan esconde los pasos de cobro y el resumen que habla de ellos', async () => {
  const p = await planConAvance(tenant)
  assert.ok(p)
  assert.deepEqual(
    p.steps.map((s) => s.metric),
    ['answer_bot_visits_7d'],
  )
  assert.equal(p.goal, 'recommendations')
  assert.equal(p.summary, 'Tu plan para que los asistentes de IA te recomienden: 1 paso, 1 cumplido.')
})

test('ClaudeBot no cuenta como bot de respuesta y el avance dice qué se mide', async () => {
  const [s] = (await planConAvance(tenant))!.steps
  assert.equal(s.current, 2)
  assert.equal(s.done, true)
  assert.match(s.progress, /^Visitas en 7 días de los bots con que ChatGPT, Perplexity y Google buscan para responder \(sin rastreadores de entrenamiento\): /)
  assert.match(s.progress, /: 1 al armar el plan \([^)]+\), 2 hoy, meta 2\. Cumplida\.$/)
})

test('el resumen que lee el agente no trae pagos ni el paso de pago', async () => {
  const o = (await probarHerramienta('get_overview', {}, { tenant, idioma: 'es' })) as {
    metrics: Record<string, unknown>
    last7Days: Record<string, unknown>
    goalPlan: { goal: string; steps: { title: string; asked: string; progress: string; done: boolean }[] }
  }
  for (const m of ['paid_requests_7d', 'revenue_7d', 'payment_attempt_rate']) assert.ok(!(m in o.metrics), m)
  assert.deepEqual(o.last7Days, { visits: 5 })
  assert.equal(o.goalPlan.goal, 'recommendations')
  assert.deepEqual(
    o.goalPlan.steps.map((s) => s.title),
    ['Publica 4 páginas'],
  )
  assert.equal(o.goalPlan.steps[0].asked, '4 páginas con la pregunta como título')
  assert.match(o.goalPlan.steps[0].progress, /2 hoy, meta 2/)
})
