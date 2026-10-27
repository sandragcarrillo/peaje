// Origen de primer contacto en los leads del radar y en los negocios
// (acquisition_source, migración 20261026300000): POST /_internal/radar/leads
// y /radar/report lo guardan, el primero se queda, uno mal formado se descarta
// sin perder el lead, y los listados por fecha del panel /admin/origenes.
// Store en memoria, sin red: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
// Sin correo configurado: /radar/report guarda el lead y contesta sin mandar nada.
delete process.env.RESEND_API_KEY
delete process.env.AGENTS_FROM_EMAIL
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-origen-leads-0123456789abcdef0123456789abcd',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { radarRouter } = await import('../src/radar.js')
const { MemoryStore } = await import('@peaje/db')

const interno = (body: unknown) => ({
  method: 'POST',
  headers: { authorization: 'Bearer interno', 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
const lead = (email: string, domain: string, extra: Record<string, unknown> = {}) =>
  radarRouter.request('/radar/leads', interno({ email, domain, locale: 'es', marketingConsent: false, ...extra }))

test('el lead guarda el origen y el primero se queda', async () => {
  const r1 = await lead('ana@ejemplo.com', 'ana.com', { acquisitionSource: 'comunidad' })
  assert.equal(r1.status, 200)
  assert.equal(((await r1.json()) as { lead: { acquisitionSource: string | null } }).lead.acquisitionSource, 'comunidad')

  // Vuelve con otro enlace (otro navegador): consentimiento nuevo, origen el de antes.
  const r2 = await lead('ana@ejemplo.com', 'ana.com', { acquisitionSource: 'linkedin/social/lanzamiento', marketingConsent: true })
  assert.equal(r2.status, 200)
  const guardado = await store.getRadarLead('ana@ejemplo.com', 'ana.com')
  assert.equal(guardado?.acquisitionSource, 'comunidad')
  assert.equal(guardado?.marketingConsent, true)
  assert.equal(guardado?.source, 'radar')
})

test('un lead sin origen lo toma la primera vez que llega uno', async () => {
  await lead('beto@ejemplo.com', 'beto.com')
  assert.equal((await store.getRadarLead('beto@ejemplo.com', 'beto.com'))?.acquisitionSource, null)
  await lead('beto@ejemplo.com', 'beto.com', { acquisitionSource: 't.co' })
  assert.equal((await store.getRadarLead('beto@ejemplo.com', 'beto.com'))?.acquisitionSource, 't.co')
})

test('un origen mal formado se descarta y el lead se guarda igual', async () => {
  for (const [i, malo] of ['Con Espacios', 'a/b/c/d', 'x'.repeat(61), 42, '<script>'].entries()) {
    const r = await lead(`malo${i}@ejemplo.com`, 'malo.com', { acquisitionSource: malo })
    assert.equal(r.status, 200, `origen ${String(malo)}`)
    assert.equal((await store.getRadarLead(`malo${i}@ejemplo.com`, 'malo.com'))?.acquisitionSource, null)
  }
  // El resto del cuerpo sigue validándose.
  assert.equal((await lead('no-es-correo', 'malo.com', { acquisitionSource: 'ok' })).status, 400)
})

test('el lead que nace en /radar/report (otro dominio del mismo correo) lleva el origen', async () => {
  const r = await radarRouter.request(
    '/radar/report',
    interno({
      email: 'ana@ejemplo.com',
      domain: 'otro-de-ana.com',
      locale: 'es',
      score: 40,
      grade: 'D',
      projected: 70,
      projectedGrade: 'B',
      fixes: [],
      acquisitionSource: 'comunidad',
    }),
  )
  assert.equal(r.status, 200)
  assert.equal((await store.getRadarLead('ana@ejemplo.com', 'otro-de-ana.com'))?.acquisitionSource, 'comunidad')
})

test('MemoryStore: el negocio guarda su origen y los listados por fecha filtran y ordenan', async () => {
  const s = new MemoryStore()
  const viejo = await s.createTenant({ slug: 'viejo', name: 'viejo', originUrl: 'https://viejo.test', embedSecret: 'x' })
  await new Promise((r) => setTimeout(r, 5))
  const corte = new Date().toISOString()
  await new Promise((r) => setTimeout(r, 5))
  const a = await s.createTenant({ slug: 'a', name: 'a', originUrl: 'https://a.test', embedSecret: 'x', acquisitionSource: 'comunidad' })
  await new Promise((r) => setTimeout(r, 5))
  const b = await s.createTenant({ slug: 'b', name: 'b', originUrl: 'https://b.test', embedSecret: 'x' })

  assert.equal(viejo.acquisitionSource, null)
  assert.equal(a.acquisitionSource, 'comunidad')
  assert.equal((await s.getTenantBySlug('a'))?.acquisitionSource, 'comunidad')
  assert.deepEqual((await s.listTenantsSince(corte)).map((t) => t.slug), ['b', 'a'])
  assert.equal(b.acquisitionSource, null)

  await s.upsertRadarLead({ email: 'x@x.com', domain: 'x.com', locale: 'es', marketingConsent: false, acquisitionSource: 'ref-1' })
  await new Promise((r) => setTimeout(r, 5))
  const corteLeads = new Date().toISOString()
  await new Promise((r) => setTimeout(r, 5))
  await s.upsertRadarLead({ email: 'y@y.com', domain: 'y.com', locale: 'en', marketingConsent: false })
  await new Promise((r) => setTimeout(r, 5))
  await s.upsertRadarLead({ email: 'z@z.com', domain: 'z.com', locale: 'en', marketingConsent: false, acquisitionSource: 'google.com' })
  // Actualizar un lead viejo no lo trae a la ventana: cuenta por created_at.
  await s.upsertRadarLead({ email: 'x@x.com', domain: 'x.com', locale: 'es', marketingConsent: true, acquisitionSource: 'otro' })

  const recientes = await s.listRadarLeadsSince(corteLeads)
  assert.deepEqual(recientes.map((l) => l.email), ['z@z.com', 'y@y.com'])
  assert.deepEqual(recientes.map((l) => l.acquisitionSource), ['google.com', null])
  assert.equal((await s.getRadarLead('x@x.com', 'x.com'))?.acquisitionSource, 'ref-1')
})
