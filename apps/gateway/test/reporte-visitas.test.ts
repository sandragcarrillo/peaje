// El reporte programado de visitas (reportes/visitas.ts) y cómo sale por
// Telegram y Slack: "quién vino" por marca o por clase, con lo que sobra
// chico y al final, y las rutas como código para que Telegram no las tome
// por comandos ("/mcp" y "/robots" salían en azul y se podían tocar). Store
// en memoria y Telegram en modo prueba: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.TELEGRAM_BOT_TOKEN
const llave = generatePrivateKey()
Object.assign(process.env, {
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  MPP_SECRET_KEY: 'prueba-reporte-visitas-0123456789abcdef0123456789',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { lineasQuien, reporteVisitas, rutaComoCodigo } = await import('../src/reportes/visitas.js')
const { aHtml } = await import('../src/telegram/api.js')
const { aMrkdwn } = await import('../src/slack/api.js')

const HASTA = new Date('2026-11-09T13:00:00Z')
const DESDE = new Date(HASTA.getTime() - 7 * 86_400_000)

async function negocioConVisitas(slug: string, visitas: [string | null, string, number, ('other' | 'claudebot' | 'gptbot' | 'googlebot')?][]) {
  const t = await store.createTenant({ slug, name: 'Peaje', originUrl: `https://${slug}.example`, embedSecret: 'x' })
  const at = new Date(HASTA.getTime() - 86_400_000).toISOString()
  await store.recordVisits(
    visitas.flatMap(([userAgent, path, n, agentKind = 'other']) =>
      Array.from({ length: n }, () => ({
        tenantId: t.id,
        at,
        path,
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
      })),
    ),
  )
  return t
}

test('"quién vino" separa directorios, scripts y marcas; los escáneres van al final', async () => {
  const t = await negocioConVisitas('reporte-quien', [
    ['BrickBlueBot/0.1 (+https://brick.blue/bot; agentic-web registry)', '/mcp', 6],
    ['WellknownBot/0.1 (+https://wellknown.network/bot)', '/.well-known/agent-card.json', 2],
    ['Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', '/llms.txt', 4, 'claudebot'],
    ['Claude-User/1.0', '/developers', 1],
    ['curl/8.7.1', '/robots.txt', 3],
    ['GPTBot/1.2', '/robots.txt', 2, 'gptbot'],
    ['Mozilla/5.0 (compatible; QlyzeBot/1.0; +https://app.qlyze.io/bot)', '/agents.md', 1],
    // Un navegador no es una visita de agente: no aparece.
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '/', 5],
  ])
  const r = await reporteVisitas(t, { desde: DESDE, hasta: HASTA, frecuencia: 'weekly', zona: 'America/Bogota', idioma: 'es' })
  assert.equal(r.visitas, 19)
  const quien = r.texto.split('Quién vino:\n')[1]!.split('\n\n')[0]!.split('\n')
  assert.deepEqual(quien, [
    '- Directorios de agentes y MCP: 8 (BrickBlueBot, WellknownBot)',
    '- Claude: 5',
    '- Scripts y herramientas: 3 (curl)',
    '- Rastreador de entrenamiento de OpenAI: 2',
    '- Escáneres y otros bots: 1 (QlyzeBot)',
  ])
  assert.doesNotMatch(r.texto, /\bOtros:/)

  const en = await reporteVisitas(t, { desde: DESDE, hasta: HASTA, frecuencia: 'weekly', zona: 'America/Bogota', idioma: 'en' })
  assert.match(en.texto, /- Agent and MCP directories: 8 \(BrickBlueBot, WellknownBot\)/)
  assert.match(en.texto, /- Scanners and other bots: 1 \(QlyzeBot\)/)
})

test('las marcas chicas se juntan cuando no hay lugar, sin tapar a los asistentes principales', () => {
  const grupos = [
    { clase: 'directorios' as const, visits: 198, nombres: [{ nombre: 'BrickBlueBot', visits: 111 }] },
    { marca: 'Claude', visits: 125, nombres: [] },
    { marca: 'Google', visits: 112, nombres: [] },
    { clase: 'scripts' as const, visits: 79, nombres: [{ nombre: 'curl', visits: 71 }, { nombre: 'undici', visits: 8 }] },
    { clase: 'openai-entrenamiento' as const, visits: 68, nombres: [] },
    { clase: 'otros' as const, visits: 25, nombres: [{ nombre: 'fresh-domain-watch', visits: 7 }] },
    { marca: 'ChatGPT', visits: 20, nombres: [] },
    { clase: 'seo' as const, visits: 12, nombres: [{ nombre: 'SEO*Juice', visits: 5 }] },
    { marca: 'ElevenLabs', visits: 9, nombres: [] },
    { marca: 'Apple', visits: 4, nombres: [] },
    { marca: 'Perplexity', visits: 3, nombres: [] },
    { marca: 'Exa', visits: 3, nombres: [] },
  ]
  assert.deepEqual(lineasQuien(grupos, 'es'), [
    '- Directorios de agentes y MCP: 198 (BrickBlueBot)',
    '- Claude: 125',
    '- Google: 112',
    '- Scripts y herramientas: 79 (curl, undici)',
    '- Rastreador de entrenamiento de OpenAI: 68',
    '- ChatGPT: 20',
    // El nombre sale del user-agent: sin los caracteres que el markdown interpreta.
    '- Herramientas de SEO: 12 (SEOJuice)',
    '- Perplexity: 3',
    '- Otros rastreadores de IA y buscadores: 16 (ElevenLabs, Apple, Exa)',
    '- Escáneres y otros bots: 25 (fresh-domain-watch)',
  ])
  // Con lugar, cada marca tiene su línea; una sola que sobra también va con su nombre.
  assert.deepEqual(lineasQuien([{ marca: 'Apple', visits: 4, nombres: [] }, { marca: 'Exa', visits: 3, nombres: [] }], 'en'), ['- Apple: 4', '- Exa: 3'])
})

test('las rutas van como código: Telegram no las toma por comandos y Slack las deja en `código`', async () => {
  const t = await negocioConVisitas('reporte-rutas', [
    ['curl/8.7.1', '/mcp', 3],
    ['curl/8.7.1', '/.well-known/agent-card.json', 2],
    ['curl/8.7.1', '/robots.txt', 1],
  ])
  const r = await reporteVisitas(t, { desde: DESDE, hasta: HASTA, frecuencia: 'weekly', zona: 'America/Bogota', idioma: 'es' })
  assert.match(r.texto, /^- `\/mcp`: 3$/m)
  assert.match(r.texto, /^- `\/robots\.txt`: 1$/m)

  const html = aHtml(r.texto)
  assert.match(html, /^• <code>\/mcp<\/code>: 3$/m)
  assert.match(html, /^• <code>\/\.well-known\/agent-card\.json<\/code>: 2$/m)
  assert.match(html, /^• <code>\/robots\.txt<\/code>: 1$/m)
  assert.match(html, /^<b>Peaje: visitas de agentes<\/b>$/m)
  // Ningún "/" que Telegram tome por comando queda fuera de <code>.
  assert.doesNotMatch(html.replace(/<code>[^<]*<\/code>/g, '').replace(/<\/\w+>/g, ''), /(^|[^\w/<>\\])\/[A-Za-z0-9_]/m)

  const slack = aMrkdwn(r.texto)
  assert.match(slack, /^• `\/mcp`: 3$/m)
  assert.match(slack, /^\*Peaje: visitas de agentes\*$/m)

  // Una ruta rara de escáner no rompe el código.
  assert.equal(rutaComoCodigo('/a`b'), '`/ab`')
  assert.equal(rutaComoCodigo(`/${'x'.repeat(100)}`).length, 82)
})

test('aHtml: una ruta suelta sale como código; los comandos del bot, los links y el resto quedan igual', () => {
  assert.equal(aHtml('Lee /llms.txt y /mcp, después /developers.'), 'Lee <code>/llms.txt</code> y <code>/mcp</code>, después <code>/developers</code>.')
  assert.equal(aHtml('(/robots.txt)'), '(<code>/robots.txt</code>)')
  assert.equal(aHtml('**/mcp** está bien'), '<b><code>/mcp</code></b> está bien')
  // Los comandos de verdad siguen tocables.
  assert.equal(aHtml('Cambia con /negocios o /stop.'), 'Cambia con /negocios o /stop.')
  // Lo que Telegram no toma por comando no se toca.
  for (const t of ['https://usepeaje.com/mcp', 'usepeaje.com/llms.txt', '/.well-known/agent-card.json', '/r/ejemplo', '24/7 y y/o']) assert.equal(aHtml(t), t)
  // El código va aparte: una negrita no se mete adentro y el HTML se escapa.
  assert.equal(aHtml('`a**b` y **c**'), '<code>a**b</code> y <b>c</b>')
  assert.equal(aHtml('`<x>` & <y>'), '<code>&lt;x&gt;</code> &amp; &lt;y&gt;')
  assert.equal(aHtml('```bash\nnpx peaje init\n```'), '<pre>npx peaje init</pre>')
  // Viñetas sin comerse la línea en blanco de antes.
  assert.equal(aHtml('Quién vino:\n\n- Claude: 5\n* Google: 3'), 'Quién vino:\n\n• Claude: 5\n• Google: 3')
})
