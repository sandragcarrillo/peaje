// Foto de citación del radar público (POST /_internal/radar/citas): preguntas
// sin la marca, caché de 7 días, tope diario, un motor caído no cuenta como
// "no citado", el sitio propio no aparece entre los citados en su lugar, y dos
// pedidos del mismo dominio corren una sola medición. Store en memoria y
// motores falsos, sin red: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
// Sin llaves de motores ni de Anthropic: el router con sus dependencias reales no mide nada.
for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']) delete process.env[k]
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-radar-citas-0123456789abcdef0123456789abcd',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { radarRouter } = await import('../src/radar.js')
const { radarCitas, normalizarDominio, raizRegistrable, preguntasSinMarca, terminosDeMarca, tipoPorReglas } = await import('../src/citacion/radar.js')
type Deps = import('../src/citacion/radar.js').DepsRadarCitas
type Motor = import('../src/citacion/motores.js').Motor
type Respuesta = import('../src/citacion/motores.js').Respuesta

const SITIO = '[https://acme.com/]\nAcme Pay cobra con tarjeta y transferencia para tiendas online en Colombia. '.repeat(4)

function respuesta(texto: string, dominios: string[]): Respuesta {
  return { texto, dominios, paginas: dominios.map((d) => ({ url: `https://${d}/x`, title: `Página de ${d}`, domain: d })) }
}

/** Un motor falso que cuenta las llamadas. */
function motor(id: string, contestar: (q: string) => Respuesta | Promise<Respuesta>): Motor & { llamadas: number } {
  const m = {
    id,
    nombre: id,
    disponible: () => true,
    llamadas: 0,
    async preguntar(q: string) {
      m.llamadas++
      return contestar(q)
    },
  }
  return m
}

let reloj = new Date('2026-10-26T15:00:00.000Z')
function deps(o: Partial<Omit<Deps, 'motores'>> & { motores: Motor[] }): Deps {
  return {
    puedeGenerar: () => true,
    leerSitio: async () => SITIO,
    generar: async () => ({
      preguntas: ['¿Qué pasarela de pagos sirve para una tienda online en Colombia?', '¿Cómo cobrar con PSE en mi ecommerce?', '¿Cuál es la mejor forma de recibir pagos con tarjeta en Bogotá?'],
      marcas: ['Acme Pay'],
      oferta: 'Payment gateway for online stores in Colombia.',
    }),
    clasificar: async () => new Map(),
    resolverPublico: async () => true,
    ahora: () => reloj,
    maxDiario: () => 50,
    timeoutMs: 2_000,
    ...o,
    motores: () => o.motores,
  }
}

const interno = (body: unknown) => ({ method: 'POST', headers: { authorization: 'Bearer interno', 'content-type': 'application/json' }, body: JSON.stringify(body) })

// ---------------------------------------------------------------- dominios y marca

test('normaliza el dominio y rechaza lo que no es un dominio público', () => {
  assert.equal(normalizarDominio('https://www.Acme.com/precios?x=1'), 'acme.com')
  assert.equal(normalizarDominio('shop.acme.com.co'), 'shop.acme.com.co')
  for (const malo of ['', 'localhost', '127.0.0.1', 'http://10.0.0.1', 'acme', 'acme.local', 'a b.com']) assert.equal(normalizarDominio(malo), null, malo)
  assert.equal(raizRegistrable('es.wikipedia.org'), 'wikipedia.org')
  assert.equal(raizRegistrable('blog.acme.com.co'), 'acme.com.co')
  assert.equal(raizRegistrable('acme.github.io'), 'acme.github.io')
  assert.equal(tipoPorReglas('reddit.com'), 'publisher')
  assert.equal(tipoPorReglas('technews.com'), 'publisher')
  assert.equal(tipoPorReglas('newsapi.org'), null)
  assert.equal(tipoPorReglas('wompi.co'), null)
})

test('las preguntas que nombran la marca o el dominio se descartan', async () => {
  const terminos = terminosDeMarca('acme-pay.com', ['Acmé Pay', 'PayLink'])
  const q = preguntasSinMarca(
    [
      '1. ¿Acme Pay sirve para tiendas en Colombia?',
      '¿Es confiable acme-pay.com para cobrar?',
      '¿Qué tal ACMEPAY para ecommerce?',
      'paylink vs wompi para tiendas online',
      '¿Qué pasarela de pagos conviene a una tienda online en Colombia?',
      '¿Qué pasarela de pagos conviene a una tienda online en Colombia?',
      '“¿Cómo cobro con PSE en mi tienda — sin programar?”',
      '¿Cuál es la pasarela más barata para pymes en Bogotá?',
    ],
    terminos,
  )
  assert.deepEqual(q, [
    '¿Qué pasarela de pagos conviene a una tienda online en Colombia?',
    '¿Cómo cobro con PSE en mi tienda, sin programar?',
    '¿Cuál es la pasarela más barata para pymes en Bogotá?',
  ])
})

test('la foto usa solo las preguntas sin marca y marca "mencionado" por el nombre', async () => {
  const chatgpt = motor('chatgpt', (q) => respuesta(q.includes('PSE') ? 'Acme Pay y Wompi aceptan PSE.' : 'Wompi o ePayco.', ['wompi.co']))
  const r = await radarCitas(
    { domain: 'marca.acme.com', locale: 'es' },
    deps({
      motores: [chatgpt],
      generar: async () => ({
        preguntas: ['¿Acme Pay funciona en Colombia?', '¿Cómo cobrar con PSE en mi ecommerce?', 'acme.com opiniones', '¿Qué pasarela usar para una tienda en Medellín?', '¿Cuál cobra menos comisión en Colombia?'],
        marcas: ['Acme Pay'],
        oferta: 'Payment gateway.',
      }),
    }),
  )
  assert.equal(r.status, 200)
  if (r.status !== 200) return
  assert.deepEqual(r.body.questions.map((q) => q.text), ['¿Cómo cobrar con PSE en mi ecommerce?', '¿Qué pasarela usar para una tienda en Medellín?', '¿Cuál cobra menos comisión en Colombia?'])
  for (const q of r.body.questions) assert.ok(!/acme/i.test(q.text), q.text)
  assert.deepEqual(r.body.questions[0]!.engines.chatgpt, { cited: false, mentioned: true, sources: ['wompi.co'] })
  assert.equal(r.body.questions[1]!.engines.chatgpt!.mentioned, false)
  assert.equal(chatgpt.llamadas, 3)
})

// ---------------------------------------------------------------- caché y tope

test('la segunda vez sale del caché sin volver a preguntar', async () => {
  const chatgpt = motor('chatgpt', () => respuesta('Prueba con Wompi.', ['wompi.co', 'epayco.com']))
  const d = deps({ motores: [chatgpt] })
  const primera = await radarCitas({ domain: 'cache.co', locale: 'es' }, d)
  assert.equal(primera.status, 200)
  assert.equal(primera.status === 200 && primera.body.cached, false)
  assert.equal(chatgpt.llamadas, 3)

  reloj = new Date(reloj.getTime() + 6 * 86_400_000)
  const segunda = await radarCitas({ domain: 'https://www.cache.co/', locale: 'es' }, d)
  assert.equal(segunda.status, 200)
  if (segunda.status !== 200 || primera.status !== 200) return
  assert.equal(segunda.body.cached, true)
  assert.equal(chatgpt.llamadas, 3, 'no se volvió a medir')
  assert.deepEqual({ ...segunda.body, cached: false }, primera.body)
  assert.deepEqual(Object.keys(segunda.body), ['domain', 'measuredAt', 'cached', 'questions', 'coverage', 'citedInstead', 'engines'])

  // Otro idioma es otra foto; pasados los 7 días se mide de nuevo.
  await radarCitas({ domain: 'cache.co', locale: 'en' }, d)
  assert.equal(chatgpt.llamadas, 6)
  reloj = new Date(reloj.getTime() + 2 * 86_400_000)
  const vencida = await radarCitas({ domain: 'cache.co', locale: 'es' }, d)
  assert.equal(vencida.status === 200 && vencida.body.cached, false)
  assert.equal(chatgpt.llamadas, 9)
})

test('sin cupo del día: 429 hasta las 00:00 UTC, sin preguntar a nadie', async () => {
  reloj = new Date('2026-11-04T18:00:00.000Z')
  const chatgpt = motor('chatgpt', () => respuesta('x', ['wompi.co']))
  const r = await radarCitas({ domain: 'sin-cupo.com', locale: 'en' }, deps({ motores: [chatgpt], maxDiario: () => 0 }))
  assert.equal(r.status, 429)
  assert.deepEqual(r.body, { error: 'budget', retryAfterSeconds: 6 * 3600 })
  assert.equal(chatgpt.llamadas, 0)

  // El tope cuenta las mediciones nuevas del día, entre todos los dominios.
  const hechasHoy = await Promise.all(['uno-cupo.com', 'dos-cupo.com'].map((domain) => radarCitas({ domain, locale: 'en' }, deps({ motores: [chatgpt], maxDiario: () => 1 }))))
  assert.deepEqual(hechasHoy.map((x) => x.status).sort(), [200, 429])
})

test('sin cupo pero con una foto guardada: se sirve la guardada', async () => {
  reloj = new Date('2026-11-05T10:00:00.000Z')
  const chatgpt = motor('chatgpt', () => respuesta('Wompi.', ['wompi.co']))
  const caido = motor('perplexity', () => Promise.reject(new Error('Perplexity 500')))
  // Parcial (Perplexity no contestó): vale un día, no siete.
  const primera = await radarCitas({ domain: 'parcial.com', locale: 'en' }, deps({ motores: [chatgpt, caido] }))
  assert.equal(primera.status, 200)
  reloj = new Date(reloj.getTime() + 2 * 86_400_000)
  const r = await radarCitas({ domain: 'parcial.com', locale: 'en' }, deps({ motores: [chatgpt, caido], maxDiario: () => 0 }))
  assert.equal(r.status, 200)
  assert.equal(r.status === 200 && r.body.cached, true)
  assert.equal(chatgpt.llamadas, 3, 'sin cupo no se volvió a medir')
})

// ---------------------------------------------------------------- motores

test('un motor que falla no cuenta como "no citado": sale de engines y coverage', async () => {
  reloj = new Date('2026-11-08T10:00:00.000Z')
  let n = 0
  const chatgpt = motor('chatgpt', () => respuesta('Usa falla.com o Wompi.', ['falla.com', 'wompi.co']))
  const caido = motor('perplexity', () => Promise.reject(new Error('Perplexity 401: bad key')))
  // Claude falla en una de las tres: cuenta 2, no 3.
  const aMedias = motor('claude', () => (++n === 2 ? Promise.reject(new Error('overloaded')) : respuesta('Wompi.', ['wompi.co'])))
  // Gemini no llega antes del reloj total.
  const lento = motor('gemini', () => new Promise<Respuesta>(() => {}))
  const r = await radarCitas({ domain: 'falla.com', locale: 'en' }, deps({ motores: [lento, caido, aMedias, chatgpt], timeoutMs: 200 }))
  assert.equal(r.status, 200)
  if (r.status !== 200) return
  assert.deepEqual(r.body.engines, ['chatgpt', 'claude'])
  assert.deepEqual(r.body.coverage, { chatgpt: { cited: 3, total: 3 }, claude: { cited: 0, total: 2 } })
  assert.deepEqual(Object.keys(r.body.questions[1]!.engines), ['chatgpt'], 'la pregunta donde Claude falló no lo trae')
  for (const q of r.body.questions) {
    assert.ok(!('perplexity' in q.engines) && !('gemini' in q.engines))
    assert.deepEqual(q.engines.chatgpt, { cited: true, mentioned: true, sources: ['falla.com', 'wompi.co'] })
  }
})

test('si ningún motor contesta: 503, no queda foto y el dominio espera 5 minutos', async () => {
  const caido = motor('chatgpt', () => Promise.reject(new Error('OpenAI 500')))
  const r = await radarCitas({ domain: 'nadie.com', locale: 'en' }, deps({ motores: [caido] }))
  assert.equal(r.status, 503)
  assert.deepEqual(r.body, { error: 'unavailable', retryAfterSeconds: 300 })
  assert.equal(await store.getRadarCitas('nadie.com', 'en', '2000-01-01T00:00:00.000Z'), null)
  // Reintentar enseguida no vuelve a gastar consultas: espera 5 minutos.
  const otra = await radarCitas({ domain: 'nadie.com', locale: 'en' }, deps({ motores: [caido] }))
  assert.equal(otra.status, 503)
  assert.equal(caido.llamadas, 3)
  reloj = new Date(reloj.getTime() + 5 * 60_000 + 1)
  await radarCitas({ domain: 'nadie.com', locale: 'en' }, deps({ motores: [caido] }))
  assert.equal(caido.llamadas, 6)
})

// ---------------------------------------------------------------- citados en su lugar

test('el dominio propio (con subdominios y www) no aparece entre los citados en su lugar', async () => {
  reloj = new Date('2026-11-10T10:00:00.000Z')
  let i = 0
  const respuestas = [
    respuesta('Mira propio.co.', ['www.propio.co', 'docs.propio.co', 'g2.com', 'rival.com']),
    respuesta('Rival o Wompi.', ['blog.propio.co', 'es.wikipedia.org', 'rival.com', 'wompi.co']),
    respuesta('Wikipedia lista a Rival.', ['es.wikipedia.org', 'rival.com', 'en.wikipedia.org', 'vertexaisearch.cloud.google.com', 'wompi.co']),
  ]
  const contestar = () => respuestas[i++]!
  const chatgpt = motor('chatgpt', contestar)
  const clasificados: string[][] = []
  const r = await radarCitas(
    { domain: 'propio.co', locale: 'en' },
    deps({
      motores: [chatgpt],
      clasificar: async ({ dominios }) => {
        clasificados.push(dominios.map((d) => d.domain))
        return new Map([['rival.com', 'competitor' as const]])
      },
    }),
  )
  assert.equal(r.status, 200)
  if (r.status !== 200) return
  const q = r.body.questions.map((x) => x.engines.chatgpt!)
  assert.deepEqual(q[0], { cited: true, mentioned: true, sources: ['propio.co', 'g2.com', 'rival.com'] })
  assert.deepEqual(q[1], { cited: true, mentioned: false, sources: ['propio.co', 'wikipedia.org', 'rival.com', 'wompi.co'] })
  // Solo cuentan las respuestas donde el sitio no salió (la tercera, porque la segunda lo cita por blog.propio.co).
  assert.deepEqual(r.body.coverage, { chatgpt: { cited: 2, total: 3 } })
  assert.deepEqual(r.body.citedInstead, [
    { domain: 'wikipedia.org', count: 1, kind: 'publisher' },
    { domain: 'rival.com', count: 1, kind: 'competitor' },
    { domain: 'wompi.co', count: 1, kind: null },
  ])
  assert.ok(r.body.citedInstead.every((c) => !c.domain.includes('propio') && !c.domain.includes('google')))
  // Al modelo solo van los que las reglas no resolvieron.
  assert.deepEqual(clasificados, [['rival.com', 'wompi.co']])
})

// ---------------------------------------------------------------- concurrencia y router

test('dos pedidos del mismo dominio a la vez corren una sola medición', async () => {
  reloj = new Date('2026-11-12T10:00:00.000Z')
  const chatgpt = motor('chatgpt', async () => {
    await new Promise((r) => setTimeout(r, 30))
    return respuesta('Wompi.', ['wompi.co'])
  })
  const d = deps({ motores: [chatgpt] })
  const [a, b] = await Promise.all([radarCitas({ domain: 'doble.com', locale: 'es' }, d), radarCitas({ domain: 'www.doble.com', locale: 'es' }, d)])
  assert.equal(a.status, 200)
  assert.deepEqual(a.body, b.body)
  assert.equal(chatgpt.llamadas, 3)
})

test('router: pide el secreto, valida el dominio y sin motores contesta 503', async () => {
  const sinAuth = await radarRouter.request('/radar/citas', { method: 'POST', body: JSON.stringify({ domain: 'acme.com', locale: 'es' }) })
  assert.equal(sinAuth.status, 401)
  const malo = await radarRouter.request('/radar/citas', interno({ domain: 'localhost', locale: 'es' }))
  assert.equal(malo.status, 400)
  assert.deepEqual(await malo.json(), { error: 'invalid-domain' })
  const sinMotores = await radarRouter.request('/radar/citas', interno({ domain: 'sin-motores.com', locale: 'es' }))
  assert.equal(sinMotores.status, 503)
  assert.deepEqual(await sinMotores.json(), { error: 'unavailable' })
})

test('router: una foto guardada sale aunque el gateway no tenga motores', async () => {
  const chatgpt = motor('chatgpt', () => respuesta('Wompi.', ['wompi.co']))
  reloj = new Date()
  await radarCitas({ domain: 'guardada.com', locale: 'en' }, deps({ motores: [chatgpt] }))
  const res = await radarRouter.request('/radar/citas', interno({ domain: 'guardada.com', locale: 'en' }))
  assert.equal(res.status, 200)
  const body = (await res.json()) as { cached: boolean; engines: string[]; questions: unknown[] }
  assert.equal(body.cached, true)
  assert.deepEqual(body.engines, ['chatgpt'])
  assert.equal(body.questions.length, 3)
})
