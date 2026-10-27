/**
 * Sondas en vivo del radar (lib/radar/sondas.ts): la guarda SSRF (solo
 * http(s) al dominio pedido o su www, nunca IPs privadas ni nombres
 * internos), la lectura de robots.txt y JSON-LD, y la limpieza de lo que
 * manda el gateway para la sección de citas (app/radar/citas-tipos.ts).
 *   cd apps/dashboard && NODE_OPTIONS="--conditions=react-server" npx tsx --test test/radar-sondas.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizarCitas } from '../app/radar/citas-tipos'
import {
  bloqueadosPorRobots,
  dominioSondeable,
  enlazaPrecios,
  ipPrivada,
  leerJsonLd,
  lookupSeguro,
  pedir,
  urlPermitida,
} from '../lib/radar/sondas'

test('ipPrivada: loopback, redes privadas, link-local, CGNAT, mapeadas y reservadas no pasan', () => {
  for (const ip of [
    '127.0.0.1',
    '127.8.8.8',
    '10.0.0.5',
    '172.16.3.4',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '[::1]',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    'no-es-una-ip',
  ]) {
    assert.equal(ipPrivada(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '151.101.1.69', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e']) {
    assert.equal(ipPrivada(ip), false, ip)
  }
})

test('dominioSondeable: nada de localhost, IPs ni nombres internos', () => {
  for (const d of ['localhost', 'app.localhost', 'printer.local', 'metadata.google.internal', '127.0.0.1', 'x.test', 'sin-punto', 'a.b.home.arpa']) {
    assert.equal(dominioSondeable(d), false, d)
  }
  for (const d of ['example.co', 'tostadores.com.co', 'usepeaje.com']) assert.equal(dominioSondeable(d), true, d)
})

test('urlPermitida: solo http(s), puertos por defecto, sin credenciales, y el dominio o su www', () => {
  const d = 'tostadores.com'
  for (const u of [
    'file:///etc/passwd',
    'ftp://tostadores.com/robots.txt',
    'javascript:alert(1)',
    'data:text/plain,hola',
    'gopher://tostadores.com/',
    'http://localhost/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'https://otro-sitio.com/robots.txt',
    'https://tostadores.com.evil.com/',
    'https://api.tostadores.com/',
    'https://user:clave@tostadores.com/',
    'https://tostadores.com:8443/',
    'no es una url',
  ]) {
    assert.equal(urlPermitida(u, d), null, u)
  }
  assert.equal(urlPermitida('https://tostadores.com/robots.txt', d)?.href, 'https://tostadores.com/robots.txt')
  assert.equal(urlPermitida('http://www.tostadores.com/llms.txt#x', d)?.href, 'http://www.tostadores.com/llms.txt')
  assert.equal(urlPermitida('https://tostadores.com:443/', d)?.href, 'https://tostadores.com/')
  // Un dominio interno no se sondea aunque la URL coincida.
  assert.equal(urlPermitida('http://localhost/', 'localhost'), null)
  assert.equal(urlPermitida('http://intranet.local/', 'intranet.local'), null)
})

test('lookupSeguro: un nombre que resuelve a loopback no conecta', async () => {
  const err = await new Promise<NodeJS.ErrnoException | null>((ok) => lookupSeguro('localhost', {}, (e) => ok(e)))
  assert.equal(err?.code, 'EADDRNOTPUBLIC')
})

test('pedir: nunca sale de la guarda (devuelve null, no lanza)', async () => {
  assert.equal(await pedir('localhost', 'http://localhost/'), null)
  assert.equal(await pedir('tostadores.com', 'http://127.0.0.1/'), null)
  assert.equal(await pedir('tostadores.com', 'file:///etc/passwd'), null)
})

test('robots.txt: el grupo propio del bot manda; si no tiene, el de *; Allow: / gana el empate', () => {
  assert.deepEqual(bloqueadosPorRobots('User-agent: *\nDisallow:\n'), { bloqueados: [], todos: false })
  assert.deepEqual(bloqueadosPorRobots('User-agent: *\nDisallow: /admin\n'), { bloqueados: [], todos: false })
  const todos = bloqueadosPorRobots('User-agent: *\nDisallow: /\n', ['GPTBot', 'ClaudeBot'])
  assert.deepEqual(todos, { bloqueados: ['GPTBot', 'ClaudeBot'], todos: true })
  const algunos = bloqueadosPorRobots(
    '# IA fuera\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n',
    ['GPTBot', 'ClaudeBot', 'PerplexityBot'],
  )
  assert.deepEqual(algunos, { bloqueados: ['GPTBot', 'ClaudeBot'], todos: false })
  // El bot tiene su grupo que lo deja entrar aunque * esté cerrado.
  assert.deepEqual(bloqueadosPorRobots('User-agent: *\nDisallow: /\n\nuser-agent: gptbot\nallow: /\n', ['GPTBot']), { bloqueados: [], todos: false })
})

test('JSON-LD: tipos, precios y bloques rotos', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Tostadores"}</script>
    <script type='application/ld+json'>{"@graph":[{"@type":["Product"],"offers":{"@type":"Offer","price":"12.5"}}]}</script>
    <script type="application/ld+json">{ roto </script>
  </head></html>`
  const ld = leerJsonLd(html)
  assert.equal(ld.bloques, 3)
  assert.equal(ld.validos, 2)
  assert.deepEqual(ld.tipos, ['Organization', 'Product', 'Offer'])
  assert.equal(ld.precios, true)
  assert.deepEqual(leerJsonLd('<html><body>hola</body></html>'), { bloques: 0, validos: 0, tipos: [], precios: false })
})

test('página de precios enlazada desde la principal, del mismo sitio', () => {
  assert.equal(enlazaPrecios('<a href="/precios">Precios</a>', 'tostadores.com'), true)
  assert.equal(enlazaPrecios('<a href="https://www.tostadores.com/es/pricing/">x</a>', 'tostadores.com'), true)
  assert.equal(enlazaPrecios('<a href="https://otro.com/pricing">x</a>', 'tostadores.com'), false)
  assert.equal(enlazaPrecios('<a href="/preciosos-cafes">x</a>', 'tostadores.com'), false)
})

test('citas: errores del gateway, forma rota y cobertura que falta', () => {
  assert.deepEqual(normalizarCitas({ error: 'budget', retryAfterSeconds: 3600 }, false), { error: 'budget', retryAfterSeconds: 3600 })
  assert.deepEqual(normalizarCitas({ error: 'algo-nuevo' }, false), { error: 'unavailable' })
  assert.deepEqual(normalizarCitas(null, false), { error: 'unavailable' })
  assert.deepEqual(normalizarCitas({ engines: [], questions: [] }, true), { error: 'unavailable' })

  const r = normalizarCitas(
    {
      domain: 'tostadores.com',
      measuredAt: '2026-10-26T15:00:00.000Z',
      cached: true,
      engines: ['chatgpt', 'perplexity', 'NO VALE'],
      questions: [
        { text: ' ¿Dónde compro café? ', engines: { chatgpt: { cited: false, mentioned: true, sources: ['a.com'] }, perplexity: { cited: true, mentioned: true, sources: [] } } },
        { text: '¿Qué tostador regalo?', engines: { chatgpt: { cited: false, mentioned: false, sources: [] } } },
      ],
      coverage: { chatgpt: { cited: 0, total: 2 }, perplexity: { cited: 5, total: 1 } },
      citedInstead: [
        { domain: 'guia.com', count: 3, kind: 'publisher' },
        { domain: 'no es dominio', count: 2, kind: null },
        { domain: 'rival.com', count: 0, kind: 'competitor' },
        { domain: 'rival2.com', count: 2, kind: 'otra-cosa' },
      ],
    },
    true,
  )
  assert.ok(!('error' in r))
  assert.deepEqual(r.engines, ['chatgpt', 'perplexity'])
  assert.equal(r.questions[0]!.text, '¿Dónde compro café?')
  assert.deepEqual(r.coverage.chatgpt, { cited: 0, total: 2 })
  // La del gateway no cierra (5 de 1): se cuenta desde las preguntas, 1 de 1 respondida.
  assert.deepEqual(r.coverage.perplexity, { cited: 1, total: 1 })
  assert.deepEqual(r.citedInstead, [
    { domain: 'guia.com', count: 3, kind: 'publisher' },
    { domain: 'rival2.com', count: 2, kind: null },
  ])
  assert.equal(r.cached, true)
})
