// Créditos fuera del chat: buscar tareas, armar el plan, medir la citación y
// el comprador misterioso cuestan lo mismo desde el dashboard o el MCP del
// dueño que en el chat. Se reserva antes de correr y se devuelve si falla o
// no entrega (una espera de "too-soon"); sin saldo, 429 con el texto del chat.
// La búsqueda de arreglos sin Pro sigue gratis. Store en memoria:
// `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
// Sin llave de Anthropic: armar el plan falla y sirve para probar la devolución.
delete process.env.ANTHROPIC_API_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  MPP_SECRET_KEY: 'prueba-creditos-dash-0123456789abcdef0123456789ab',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (/\.example(\/|$)|^https?:\/\/localhost/.test(url)) return new Response('', { status: 404 })
  return fetchReal(input, init)
}) as typeof fetch

const { store } = await import('../src/store.js')
const { cobrarAccion, sinCreditos, saldoCreditos } = await import('../src/tareas/creditos.js')
const { tareasRouter } = await import('../src/tareas/router.js')
const { compradorRouter } = await import('../src/comprador/router.js')
const { construir } = await import('../src/tareas/mcp.js')
const { COSTOS_CREDITOS, CREDITOS_MENSUALES, periodoCreditos } = await import('@peaje/db')

let n = 0
/** Pro por 20 días. Sin dominio público (localhost): la búsqueda corre sin llamar a nadie. */
async function negocio(o: { pro?: boolean } = {}) {
  const slug = `dash-${++n}`
  const t = await store.createTenant({ slug, name: `Negocio ${n}`, originUrl: 'http://localhost:9', embedSecret: 'x' })
  if (o.pro !== false) await store.setTenantPlan(t.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
  return (await store.getTenantById(t.id))!
}
const usados = (tenantId: string) => store.creditsUsedSince(tenantId, periodoCreditos().desde)
/** Deja `quedan` créditos este mes. */
const dejar = (tenantId: string, quedan: number) => store.addCreditCharge({ tenantId, credits: CREDITOS_MENSUALES - quedan, reason: 'prueba' })
const mes = (idioma: 'es' | 'en') => new Intl.DateTimeFormat(idioma === 'es' ? 'es-CO' : 'en-US', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(periodoCreditos().renueva))

const interno = (body: unknown = {}) => ({
  method: 'POST',
  headers: { authorization: 'Bearer interno', 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// ---------------------------------------------------------------- cobrarAccion

test('cobrarAccion: cobra el precio del chat si entrega; devuelve si no entrega o si falla', async () => {
  const t = await negocio()
  const ok = await cobrarAccion(t, 'informe', { idioma: 'es', motivo: 'prueba:ok', entrego: () => true }, async () => ({ listo: true }))
  assert.deepEqual(ok, { valor: { listo: true } })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)

  const espera = await cobrarAccion(t, 'comprador', { idioma: 'es', motivo: 'prueba:espera', entrego: (x: { error?: string }) => !x.error }, async () => ({ error: 'too-soon' }))
  assert.deepEqual(espera, { valor: { error: 'too-soon' } })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)

  await assert.rejects(
    cobrarAccion(t, 'comprador', { idioma: 'es', motivo: 'prueba:falla', entrego: () => true }, async () => {
      // Mientras corre, lo reservado ya cuenta: un segundo clic no gasta el mismo saldo.
      assert.equal(await usados(t.id), COSTOS_CREDITOS.informe + COSTOS_CREDITOS.comprador)
      throw new Error('boom')
    }),
    /boom/,
  )
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)
})

test('cobrarAccion sin saldo: no corre y devuelve el mismo texto del chat, con la renovación', async () => {
  const t = await negocio()
  await dejar(t.id, COSTOS_CREDITOS.informe - 1)
  let corrio = false
  const r = await cobrarAccion(t, 'informe', { idioma: 'es', motivo: 'prueba', entrego: () => true }, async () => {
    corrio = true
  })
  assert.equal(corrio, false)
  assert.ok('sinCreditos' in r)
  assert.equal(r.sinCreditos.error, 'not-enough-credits')
  assert.equal(
    r.sinCreditos.message,
    `Eso cuesta ${COSTOS_CREDITOS.informe} créditos y te quedan ${COSTOS_CREDITOS.informe - 1} este mes. Tus créditos se renuevan el ${mes('es')}; mientras tanto podemos seguir conversando.`,
  )
  assert.equal(r.sinCreditos.cost, COSTOS_CREDITOS.informe)
  assert.equal(r.sinCreditos.remaining, COSTOS_CREDITOS.informe - 1)
  assert.equal(r.sinCreditos.renewsAt, periodoCreditos().renueva)
  assert.equal(await usados(t.id), CREDITOS_MENSUALES - (COSTOS_CREDITOS.informe - 1))

  const ahora = new Date()
  const en = sinCreditos(await saldoCreditos(t, ahora), COSTOS_CREDITOS.comprador, 'en', ahora)
  assert.equal(en.message, `That costs ${COSTOS_CREDITOS.comprador} credits and you have ${COSTOS_CREDITOS.informe - 1} left this month. Your credits renew on ${mes('en')}; until then we can keep talking.`)
  assert.equal(en.retryInSeconds, Math.ceil((new Date(periodoCreditos(ahora).renueva).getTime() - ahora.getTime()) / 1000))
})

// ---------------------------------------------------------------- dashboard

test('POST tasks/generate con Pro: cobra informe; la espera de 10 minutos no cobra', async () => {
  const t = await negocio()
  const res = await tareasRouter.request(`/_internal/${t.slug}/tasks/generate`, interno({ language: 'es' }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { creadas: 0, actualizadas: 0, cerradas: 0 })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)

  const otra = await tareasRouter.request(`/_internal/${t.slug}/tasks/generate`, interno({ language: 'es' }))
  assert.equal(otra.status, 429)
  assert.equal(((await otra.json()) as { error: string }).error, 'too-soon')
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)
})

test('POST tasks/generate sin Pro: la búsqueda de arreglos sigue gratis', async () => {
  const t = await negocio({ pro: false })
  const res = await tareasRouter.request(`/_internal/${t.slug}/tasks/generate`, interno())
  assert.equal(res.status, 200)
  assert.equal(await usados(t.id), 0)
})

test('sin saldo: generate, plan, citación y comprador responden 429 con el texto del chat y no corren', async () => {
  const t = await negocio()
  await dejar(t.id, 3)
  const casos = [
    { router: tareasRouter, path: `/_internal/${t.slug}/tasks/generate`, body: { language: 'es' }, costo: COSTOS_CREDITOS.informe },
    { router: tareasRouter, path: `/_internal/${t.slug}/tasks/plan`, body: { language: 'es', goal: 'both', cadence: 'weekly', capacity: ['content'] }, costo: COSTOS_CREDITOS.informe },
    { router: tareasRouter, path: `/_internal/${t.slug}/tasks/citations/run`, body: { language: 'en' }, costo: COSTOS_CREDITOS.informe },
    { router: compradorRouter, path: `/${t.slug}/mystery/run`, body: { language: 'en' }, costo: COSTOS_CREDITOS.comprador },
  ]
  for (const c of casos) {
    const res = await c.router.request(c.path, interno(c.body))
    assert.equal(res.status, 429, c.path)
    const j = (await res.json()) as { error: string; message: string; remaining: number; retryInSeconds: number }
    assert.equal(j.error, 'not-enough-credits', c.path)
    assert.equal(j.remaining, 3)
    assert.ok(j.retryInSeconds > 0)
    assert.equal(
      j.message,
      c.body.language === 'es'
        ? `Eso cuesta ${c.costo} créditos y te quedan 3 este mes. Tus créditos se renuevan el ${mes('es')}; mientras tanto podemos seguir conversando.`
        : `That costs ${c.costo} credits and you have 3 left this month. Your credits renew on ${mes('en')}; until then we can keep talking.`,
      c.path,
    )
  }
  assert.equal(await usados(t.id), CREDITOS_MENSUALES - 3)
  // No corrió nada: la búsqueda no gastó su espera de 10 minutos.
  await store.addCreditCharge({ tenantId: t.id, credits: -(CREDITOS_MENSUALES - 3), reason: 'prueba' })
  assert.equal((await tareasRouter.request(`/_internal/${t.slug}/tasks/generate`, interno())).status, 200)
})

test('POST tasks/plan que falla devuelve los créditos', async () => {
  const t = await negocio()
  const res = await tareasRouter.request(`/_internal/${t.slug}/tasks/plan`, interno({ language: 'es', goal: 'both', cadence: 'weekly', capacity: ['content'] }))
  assert.equal(res.status, 500)
  assert.match(((await res.json()) as { error: string }).error, /ANTHROPIC_API_KEY/)
  assert.equal(await usados(t.id), 0)
})

test('sin Pro, plan, citación y comprador siguen en 403 antes de mirar créditos', async () => {
  const t = await negocio({ pro: false })
  for (const [router, path] of [
    [tareasRouter, `/_internal/${t.slug}/tasks/citations/run`],
    [compradorRouter, `/${t.slug}/mystery/run`],
  ] as const) {
    const res = await router.request(path, interno({ language: 'es' }))
    assert.equal(res.status, 403)
    assert.equal(((await res.json()) as { error: string }).error, 'pro-required')
  }
})

// ---------------------------------------------------------------- MCP del dueño

async function mcpDelDueno(tenant: Awaited<ReturnType<typeof negocio>>) {
  const [delServidor, delCliente] = InMemoryTransport.createLinkedPair()
  await construir(tenant).connect(delServidor)
  const client = new Client({ name: 'coding-agent', version: '1.0.0' })
  await client.connect(delCliente)
  return client
}
const textoDe = (r: Awaited<ReturnType<Client['callTool']>>) => ((r.content as { text: string }[])[0]?.text ?? '')

test('MCP del dueño: peaje_refresh_tasks cobra informe con Pro y avisa sin saldo', async () => {
  const t = await negocio()
  const client = await mcpDelDueno(t)
  const { tools } = await client.listTools()
  assert.match(tools.find((x) => x.name === 'peaje_refresh_tasks')!.description ?? '', new RegExp(`uses ${COSTOS_CREDITOS.informe} of the owner's monthly credits`))
  const r = await client.callTool({ name: 'peaje_refresh_tasks', arguments: {} })
  assert.equal(r.isError, undefined)
  assert.deepEqual(JSON.parse(textoDe(r)), { creadas: 0, actualizadas: 0, cerradas: 0 })
  assert.equal(await usados(t.id), COSTOS_CREDITOS.informe)
  await client.close()

  const pobre = await negocio()
  await dejar(pobre.id, 0)
  const otro = await mcpDelDueno(pobre)
  const sin = await otro.callTool({ name: 'peaje_refresh_tasks', arguments: {} })
  assert.equal(sin.isError, true)
  const j = JSON.parse(textoDe(sin)) as { error: string; message: string }
  assert.equal(j.error, 'not-enough-credits')
  assert.equal(j.message, `That costs ${COSTOS_CREDITOS.informe} credits and you have 0 left this month. Your credits renew on ${mes('en')}; until then we can keep talking.`)
  assert.equal(await usados(pobre.id), CREDITOS_MENSUALES)
  await otro.close()

  const gratis = await negocio({ pro: false })
  const libre = await mcpDelDueno(gratis)
  assert.equal((await libre.callTool({ name: 'peaje_refresh_tasks', arguments: {} })).isError, undefined)
  assert.equal(await usados(gratis.id), 0)
  await libre.close()
})
