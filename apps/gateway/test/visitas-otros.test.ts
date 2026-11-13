// "Otros" en el panel: las visitas sin tipo propio se atribuyen por user-agent
// (agentes con nombre aparte, el resto desplegable). User-agents reales del
// registro de visitas de usepeaje.com. Store en memoria: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { grupoDe, quienEs } from '@peaje/db'
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
  assert.deepEqual(quienEs('Mozilla/5.0 (compatible)'), { tipo: 'sin-ua', nombre: null })
  assert.deepEqual(quienEs('Algo/2.0'), { tipo: 'desconocido', nombre: 'Algo' })
  // Se presenta con "compatible; Nombre/x": ya no es "sin identificarse".
  assert.deepEqual(quienEs('Mozilla/5.0 (compatible; fresh-domain-watch/1.0; +mailto:crawler-optout-5e43b4@fldubai.com)'), { tipo: 'agente', nombre: 'fresh-domain-watch' })
  // Un directorio de agentes sin "bot" en el nombre: con nombre, no "desconocido".
  assert.deepEqual(quienEs('llms.txt-directory/1.0 (+https://directory.llmstxt.cloud)'), { tipo: 'agente', nombre: 'llms.txt-directory' })
  // El navegador de una app en iOS (Messenger) no trae "Safari/": es una persona.
  assert.deepEqual(
    quienEs('Mozilla/5.0 (iPhone; CPU iPhone OS 12_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LightSpeed [FBAN/MessengerLiteForiOS;FBAV/263.1.0.76.121]'),
    { tipo: 'navegador', nombre: null },
  )
})

test('"quién vino" de los reportes: por marca o por clase, con user-agents reales del registro', () => {
  const casos: [string | null, ReturnType<typeof grupoDe>][] = [
    ['BrickBlueBot/0.1 (+https://brick.blue/bot; agentic-web registry)', { clase: 'directorios' }],
    ['WellknownBot/0.1 (+https://wellknown.network/bot)', { clase: 'directorios' }],
    ['agentprobe/0.1.0 (+https://agentprobe.org/methodology; read-only liveness probe)', { clase: 'directorios' }],
    ['agent-tools.cloud-a2a/0.1 (+https://agent-tools.cloud)', { clase: 'directorios' }],
    ['MCPHereBot/1.0 (+https://github.com/MoizAhmedd/mcp-here)', { clase: 'directorios' }],
    ['mcp-remote/0.1.29', { clase: 'mcp' }],
    ['x402-fetch/1.2.0', { clase: 'sdk' }],
    ['curl/8.7.1', { clase: 'scripts' }],
    ['Python-urllib/3.14', { clase: 'scripts' }],
    ['Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; GoogleOther)', { marca: 'Google' }],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot', { marca: 'ChatGPT' }],
    ['claude-code/2.1.286 (claude-desktop, agent-sdk/0.3.308)', { marca: 'Claude' }],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36', { marca: 'Amazon' }],
    ['Mozilla/5.0 (compatible; ExaUser/1.0; +https://exauser.crawler.exa.ai)', { marca: 'Exa' }],
    ['Mozilla/5.0 (compatible; ElevenlabsCrawler/1.0; +https://elevenlabs.io/docs/bots)', { marca: 'ElevenLabs' }],
    ['LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)', { clase: 'previas' }],
    ['Mozilla/5.0 (compatible; Barkrowler/0.9; +https://babbar.tech/crawler)', { clase: 'seo' }],
    ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', { clase: 'seo' }],
    // Escáneres y bots sin marca ni clase: juntos.
    ['Mozilla/5.0 (compatible; QlyzeBot/1.0; +https://app.qlyze.io/bot)', { clase: 'otros' }],
    ['AverPerimeterInspector/1.0 (+https://aver.dev/aver; literal public-path audit)', { clase: 'otros' }],
    ['Mozilla/5.0', { clase: 'otros' }],
    [null, { clase: 'otros' }],
  ]
  for (const [ua, grupo] of casos) assert.deepEqual(grupoDe('other', ua), grupo, String(ua))
  // Los tipos propios: el bot de búsqueda con su marca, sin mirar el user-agent.
  assert.deepEqual(grupoDe('claudebot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0)'), { marca: 'Claude' })
  assert.deepEqual(grupoDe('openai-searchbot', null), { marca: 'ChatGPT' })
  assert.deepEqual(grupoDe('gptbot', null), { clase: 'openai-entrenamiento' })
  assert.deepEqual(grupoDe('x402-client', 'node'), { clase: 'pago' })
})

test('el panel recibe "otros" agrupado por quién, de mayor a menor', async () => {
  const t = await store.createTenant({ slug: 'otros-1', name: 'Otros 1', originUrl: 'https://otros-1.example', embedSecret: 'x' })
  const visita = (ua: string | null, path = '/developers') =>
    registrarVisita({ tenantId: t.id, method: 'GET', path, headers: new Headers(ua ? { 'user-agent': ua } : {}), response: new Response('ok') })
  for (let i = 0; i < 3; i++) visita('Mozilla/5.0 (compatible; QlyzeBot/1.0)')
  visita('curl/8.7.1', '/llms.txt')
  visita('curl/8.14.1', '/mcp')
  visita(null)
  // Un navegador sin nombre de bot no es una visita de agente: va aparte.
  visita('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')
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
  assert.equal(s.navegadores, 1)
  assert.equal(s.totals.visits, 7, 'el navegador no suma al total')
  // Los grupos del reporte: todas las visitas, la marca junta al bot con tipo propio.
  assert.deepEqual(s.grupos, [
    { clase: 'otros', visits: 4, nombres: [{ nombre: 'QlyzeBot', visits: 3 }] },
    { clase: 'scripts', visits: 2, nombres: [{ nombre: 'curl', visits: 2 }] },
    { marca: 'Perplexity', visits: 1, nombres: [] },
  ])
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
