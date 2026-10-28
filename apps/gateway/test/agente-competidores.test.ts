// El agente contesta "¿a quién cita la IA en vez de mí?" con nombres y
// páginas (get_competitors), y solo lee afuera las páginas que aparecieron en
// las mediciones del negocio (read_competitor_page). Store en memoria, sin red.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-agente-competidores-0123456789abcdef0123',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { probarHerramienta } = await import('../src/tareas/agente.js')

const tenant = await store.createTenant({ slug: 'clima-prueba', name: 'Clima Prueba', originUrl: 'https://climaprueba.co', embedSecret: 'x' })
const corrida = (promptText: string, engine: string, cited: boolean, paginas: { domain: string; url: string; title: string; format: 'guide' | 'comparison' | 'roundup' }[]) => ({
  tenantId: tenant.id,
  roundId: 'ronda-1',
  promptId: null,
  promptText,
  engine,
  cited,
  mentioned: cited,
  domains: [...new Set(paginas.map((p) => p.domain))],
  pages: paginas,
  answerExcerpt: null,
  error: null,
})
const guia = { domain: 'open-meteo.com', url: 'https://open-meteo.com/en/docs', title: 'Weather Forecast API', format: 'guide' as const }
const lista = { domain: 'apilist.fun', url: 'https://apilist.fun/best-weather-apis', title: 'Best weather APIs 2026', format: 'roundup' as const }
await store.recordCitationRuns([
  corrida('mejor api de clima gratis', 'openai', false, [guia, lista]),
  corrida('mejor api de clima gratis', 'anthropic', false, [guia]),
  corrida('api clima bogotá por hora', 'openai', false, [guia]),
  corrida('api clima colombia', 'openai', true, [{ domain: 'climaprueba.co', url: 'https://climaprueba.co/', title: 'Clima Prueba', format: 'guide' }, lista]),
])

test('los competidores salen uno por uno, con cuántas respuestas ganan y con qué páginas', async () => {
  const r = (await probarHerramienta('get_competitors', {}, { tenant, idioma: 'es' })) as Awaited<ReturnType<typeof import('../src/citacion/competidores.js').competidoresCitados>>
  assert.equal(r.answersMeasured, 4)
  assert.equal(r.answersWithoutYou, 3)
  assert.deepEqual(r.competitors.map((c) => [c.domain, c.answersWon]), [['open-meteo.com', 3], ['apilist.fun', 1]])
  const primero = r.competitors[0]
  assert.deepEqual(primero?.engines.sort(), ['anthropic', 'openai'])
  assert.deepEqual(primero?.pages, [{ title: 'Weather Forecast API', url: 'https://open-meteo.com/en/docs', format: 'guide', citations: 3 }])
  // Donde el negocio sí aparece no cuenta como respuesta ganada por otro.
  assert.ok(!r.competitors.some((c) => c.domain === 'climaprueba.co'))
  assert.deepEqual(r.formatNotes.map((f) => f.format).sort(), ['guide', 'roundup'])
})

test('solo se leen páginas que aparecieron en sus mediciones', async () => {
  const r = (await probarHerramienta('read_competitor_page', { url: 'https://example.com/otra' }, { tenant, idioma: 'es' })) as { error?: string }
  assert.match(r.error ?? '', /only pages cited/)
})
