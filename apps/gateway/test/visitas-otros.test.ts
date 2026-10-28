// "Otros" en el panel: las visitas sin tipo propio se atribuyen por user-agent
// (agentes con nombre aparte, el resto desplegable). User-agents reales del
// registro de visitas de usepeaje.com. Store en memoria: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quienEs } from '@peaje/db'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-visitas-otros-0123456789abcdef0123456789',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { descargarVisitas, registrarVisita } = await import('../src/visitas.js')

test('cada user-agent cae donde corresponde', () => {
  assert.deepEqual(quienEs('claude-code/2.1.286 (claude-desktop, agent-sdk/0.3.308)'), { tipo: 'agente', nombre: 'Claude Code' })
  assert.deepEqual(quienEs('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'), {
    tipo: 'agente',
    nombre: 'ChatGPT (ChatGPT-User)',
  })
  assert.deepEqual(quienEs('LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'), { tipo: 'agente', nombre: 'LinkedIn' })
  // Sin nombre conocido pero se presenta como lector: aparte, con su nombre.
  assert.deepEqual(quienEs('CreoraPublicReader/1.0'), { tipo: 'agente', nombre: 'CreoraPublicReader' })
  assert.deepEqual(quienEs('curl/8.14.1'), { tipo: 'script', nombre: 'curl' })
  assert.deepEqual(quienEs('node'), { tipo: 'script', nombre: 'node' })
  assert.deepEqual(quienEs('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'), {
    tipo: 'navegador',
    nombre: null,
  })
  assert.deepEqual(quienEs(''), { tipo: 'sin-ua', nombre: null })
  assert.deepEqual(quienEs(null), { tipo: 'sin-ua', nombre: null })
  assert.deepEqual(quienEs('Algo/2.0'), { tipo: 'desconocido', nombre: 'Algo' })
})

test('el panel recibe "otros" agrupado por quién, de mayor a menor', async () => {
  const t = await store.createTenant({ slug: 'otros-1', name: 'Otros 1', originUrl: 'https://otros-1.example', embedSecret: 'x' })
  const visita = (ua: string | null, path = '/developers') =>
    registrarVisita({ tenantId: t.id, method: 'GET', path, headers: new Headers(ua ? { 'user-agent': ua } : {}), response: new Response('ok') })
  for (let i = 0; i < 3; i++) visita('Mozilla/5.0 (compatible; QlyzeBot/1.0)')
  visita('curl/8.7.1', '/llms.txt')
  visita('curl/8.14.1', '/mcp')
  visita(null)
  // Nuestras herramientas y Ora no se registran.
  visita('PeajeRadar/1.0 (+https://usepeaje.com/radar)')
  visita('peaje-monitor/1.0')
  visita('OraBot/1.0 (+https://ora.ai/bot)')
  // Un bot con tipo propio no entra en "otros".
  visita('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)')
  await descargarVisitas()
  const s = await store.visitStats(t.id, { days: 7 })
  assert.deepEqual(s.otros, [
    { tipo: 'agente', nombre: 'QlyzeBot', visits: 3 },
    { tipo: 'script', nombre: 'curl', visits: 2 },
    { tipo: 'sin-ua', nombre: null, visits: 1 },
  ])
  assert.equal(s.byKind.find((k) => k.kind === 'other')?.visits, 6)
})

test('lo guardado antes del filtro (kit, Ora, nuestras herramientas) tampoco se cuenta al leer', async () => {
  const t = await store.createTenant({ slug: 'otros-2', name: 'Otros 2', originUrl: 'https://otros-2.example', embedSecret: 'x' })
  const fila = (path: string, userAgent: string | null) => ({
    tenantId: t.id,
    at: new Date().toISOString(),
    path,
    method: 'GET',
    userAgent,
    agentKind: 'other' as const,
    paid: false,
    network: null,
    amount: null,
    paymentId: null,
    status: 200,
    routeId: null,
    priceUsd: null,
    attempted: false,
  })
  await store.recordVisits([
    fila('/kit/manifest.json', 'node'),
    fila('/discovery/resources', 'node'),
    fila('/developers', 'OraBot/1.0 (+https://ora.ai/bot)'),
    fila('/', 'PeajeRadar/1.0 (+https://usepeaje.com/radar)'),
    fila('/llms.txt', 'peaje-monitor/1.0'),
    fila('/llms.txt', 'curl/8.7.1'),
  ])
  const s = await store.visitStats(t.id, { days: 7 })
  assert.equal(s.totals.visits, 1)
  assert.deepEqual(s.otros, [{ tipo: 'script', nombre: 'curl', visits: 1 }])
  assert.deepEqual(s.topPaths.map((p) => p.path), ['/llms.txt'])
})
