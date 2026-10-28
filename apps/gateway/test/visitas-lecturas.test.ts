// Lecturas de páginas que reporta el proxy del kit (POST /:slug/kit/visita):
// las páginas que el sitio sirve solo nunca pasan por el gateway, y sin el
// reporte el registro de visitas solo contaba los archivos de discovery.
// Store en memoria, sin red: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-visitas-lecturas-0123456789abcdef01234567',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { kitRouter } = await import('../src/kit.js')
const { descargarVisitas, esLecturaDelKit, registrarVisita } = await import('../src/visitas.js')

const GPTBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'
const CLAUDEBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'

let n = 0
async function negocio() {
  n += 1
  const slug = `lecturas-${n}`
  return store.createTenant({ slug, name: `Lecturas ${n}`, originUrl: `https://${slug}.example`, embedSecret: 'x' })
}

const reportar = (slug: string, body: unknown) =>
  kitRouter.request(`/${slug}/kit/visita`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function visitas(tenantId: string) {
  await descargarVisitas()
  return store.visitStats(tenantId, { days: 7 })
}

test('la lectura de un bot queda como visita de ese bot, en su ruta, sin status de respuesta', async () => {
  const t = await negocio()
  assert.equal((await reportar(t.slug, { path: '/blog/hola', method: 'GET', userAgent: GPTBOT })).status, 204)
  assert.equal((await reportar(t.slug, { path: '/', method: 'HEAD', userAgent: CLAUDEBOT })).status, 204)
  const s = await visitas(t.id)
  assert.equal(s.totals.visits, 2)
  assert.deepEqual(s.byKind.map((k) => k.kind).sort(), ['claudebot', 'gptbot'])
  assert.deepEqual(s.topPaths.map((p) => p.path).sort(), ['/', '/blog/hola'])
  assert.equal(s.notFound.length, 0, 'sin status no cuenta como inexistente')
  assert.equal(s.funnel.served402, 0)
})

test('lo que no es la lectura de un bot de la lista se rechaza y no se guarda', async () => {
  const t = await negocio()
  const malos: unknown[] = [
    null,
    { path: '/blog', method: 'GET' },
    { path: '/blog', method: 'GET', userAgent: 'Mozilla/5.0 (Macintosh) Safari/605.1.15' },
    { path: '/blog', method: 'POST', userAgent: GPTBOT },
    { path: 'blog', method: 'GET', userAgent: GPTBOT },
    { path: '/blog?email=a@b.co', method: 'GET', userAgent: GPTBOT },
    { path: '/blog hola', method: 'GET', userAgent: GPTBOT },
    { path: `/${'a'.repeat(600)}`, method: 'GET', userAgent: GPTBOT },
  ]
  for (const body of malos) assert.equal((await reportar(t.slug, body)).status, 400, JSON.stringify(body)?.slice(0, 80))
  assert.equal((await reportar('no-existe', { path: '/', method: 'GET', userAgent: GPTBOT })).status, 404)
  assert.equal((await visitas(t.id)).totals.visits, 0)
})

test('las rutas que sirve el gateway y los assets se aceptan pero no se cuentan dos veces', async () => {
  const t = await negocio()
  for (const path of ['/llms.txt', '/LLMS.TXT', '/.well-known/agent-card.json', '/r/menu', '/logo.png']) {
    assert.equal((await reportar(t.slug, { path, method: 'GET', userAgent: GPTBOT })).status, 204, path)
  }
  assert.equal((await visitas(t.id)).totals.visits, 0)
})

test('el reporte mismo no cuenta como request, y las sondas del verificador tampoco', async () => {
  assert.ok(esLecturaDelKit('/kit/visita', 'node'))
  const t = await negocio()
  const respuesta = new Response('ok')
  registrarVisita({ tenantId: t.id, method: 'GET', path: '/developers', headers: new Headers({ 'user-agent': GPTBOT, 'x-peaje-verificador': '1' }), response: respuesta })
  registrarVisita({ tenantId: t.id, method: 'GET', path: '/developers', headers: new Headers({ 'user-agent': GPTBOT }), response: respuesta })
  const s = await visitas(t.id)
  assert.equal(s.totals.visits, 1, 'solo la del bot de verdad')
})
