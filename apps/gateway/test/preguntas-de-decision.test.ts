// Preguntas de decisión en cada ronda de citación ("alternativas a X", "X vs
// Y"), con los competidores que la IA ya citó en lugar del negocio: quién
// cuenta como competidor, en qué idioma salen, y cómo entran en el cupo sin
// pasar el tope ni sacar las del dueño. Funciones puras, sin red ni modelo.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.ANTHROPIC_API_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-preguntas-de-decision-0123456789abcdef01',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { competidoresConocidos, cupoDecision, elegirPreguntas, idiomaDePreguntas, nombreDeMarca, preguntasDeDecision } = await import('../src/citacion/decision.js')
const { terminosDeMarca } = await import('../src/citacion/radar.js')
type CitationRun = import('@peaje/db').CitationRun
type CitationPrompt = import('@peaje/db').CitationPrompt
type PageFormat = import('@peaje/db').PageFormat

let n = 0
function corrida(pregunta: string, paginas: [string, PageFormat, string?][], o: Partial<CitationRun> = {}): CitationRun {
  return {
    id: `r${++n}`,
    tenantId: 't',
    roundId: 'ronda',
    promptId: 'p',
    promptText: pregunta,
    engine: 'chatgpt',
    runAt: '2026-11-20T10:00:00.000Z',
    cited: false,
    mentioned: false,
    domains: [...new Set(paginas.map(([d]) => d))],
    pages: paginas.map(([domain, format, title]) => ({ domain, format, title: title ?? null, url: `https://${domain}/x` })),
    answerExcerpt: null,
    error: null,
    ...o,
  }
}

const pregunta = (text: string, source: CitationPrompt['source'] = 'agent', i = n++): CitationPrompt => ({ id: `p${i}`, tenantId: 't', text, source, active: true, createdAt: '' })

test('competidores: sitios que venden algo, citados donde el negocio no; ni medios, ni gigantes, ni el propio', () => {
  const runs = [
    corrida('Mejores herramientas GEO para pymes', [
      ['www.semrush.com', 'product', 'Semrush: plataforma de marketing'],
      ['help.openai.com', 'docs'],
      ['blog.hubspot.es', 'roundup'],
      ['tryprofound.com', 'comparison'],
    ]),
    corrida('¿Cómo sé si ChatGPT recomienda mi negocio?', [
      ['semrush.com', 'guide'],
      ['seranking.com', 'product', 'SE Ranking | All-in-one SEO platform'],
      ['es.wikipedia.org', 'guide'],
      ['llmstxt.org', 'product'],
      ['docs.usepeaje.com', 'docs'],
    ]),
    // Donde el negocio sale citado no cuenta; una respuesta que falló tampoco.
    corrida('¿Qué es GEO?', [['otro.ai', 'product']], { cited: true }),
    corrida('¿Qué es AEO?', [['caido.ai', 'product']], { error: 'timeout' }),
    // Un sitio que solo sale con guías y listas es un medio o un blog: no es competidor.
    corrida('Guía de GEO', [['blogdeseo.com', 'guide'], ['listas.com', 'roundup']]),
  ]
  const c = competidoresConocidos({ runs, raiz: 'usepeaje.com', marcas: terminosDeMarca('usepeaje.com', ['Peaje']) }, 5)
  assert.deepEqual(c, [
    { domain: 'semrush.com', nombre: 'Semrush' },
    { domain: 'seranking.com', nombre: 'SE Ranking' },
    { domain: 'tryprofound.com', nombre: 'Profound' },
  ])
})

test('competidores: lo que el radar clasificó como competidor suma, y el nombre de la marca nunca entra', () => {
  const runs = [corrida('Mejor CRM para comunidades', [['rival.com', 'docs'], ['puente.app', 'product']])]
  const c = competidoresConocidos({
    runs,
    raiz: 'usepuente.com',
    marcas: terminosDeMarca('usepuente.com', ['Puente']),
    radar: [
      { domain: 'delradar.co', kind: 'competitor' },
      { domain: 'g2.com', kind: 'publisher' },
      { domain: 'nada.com', kind: null },
    ],
  })
  // delradar.co: radar (2); rival.com: una pregunta (1). puente.app lleva la marca.
  assert.deepEqual(c.map((x) => x.domain), ['delradar.co', 'rival.com'])
  assert.deepEqual(competidoresConocidos({ runs: [], raiz: 'a.com', marcas: [] }), [])
})

test('el nombre sale del título citado cuando coincide con el dominio; si no, la etiqueta con mayúscula', () => {
  assert.equal(nombreDeMarca('seranking.com', ['SE Ranking | All-in-one SEO platform']), 'SE Ranking')
  assert.equal(nombreDeMarca('llmpulse.ai', ['Track AI visibility - LLM Pulse']), 'LLM Pulse')
  assert.equal(nombreDeMarca('peec.ai', ['AI search analytics for marketing teams']), 'Peec')
  assert.equal(nombreDeMarca('getgeofix.com'), 'Geofix')
  assert.equal(nombreDeMarca('go.com'), 'Go')
})

test('el idioma es el de las demás preguntas del negocio', () => {
  assert.equal(idiomaDePreguntas(['¿Qué herramientas GEO arreglan tu sitio?', 'Mejores herramientas para que ChatGPT recomiende tu negocio', 'x402 vs MPP']), 'es')
  assert.equal(idiomaDePreguntas(['Best weather API for Latin America', 'How do I get hourly forecasts in JSON?']), 'en')
  assert.equal(idiomaDePreguntas(['Qual a melhor ferramenta para você vender online?', 'Como não perder clientes']), 'pt')
  assert.equal(idiomaDePreguntas([], 'es'), 'es')
  assert.equal(idiomaDePreguntas(['x402 vs MPP'], 'en'), 'en')
})

test('las preguntas de decisión: alternativas al primero, el primero contra el segundo, y así hasta el cupo', () => {
  assert.equal(cupoDecision(20), 4)
  assert.equal(cupoDecision(10), 2)
  assert.equal(cupoDecision(4), 0)
  assert.deepEqual(preguntasDeDecision(['Semrush', 'Otterly', 'Peec'], 'es', 4), [
    '¿Cuáles son las mejores alternativas a Semrush?',
    'Semrush vs Otterly: ¿cuál me conviene?',
    '¿Cuáles son las mejores alternativas a Otterly?',
    'Semrush vs Peec: ¿cuál me conviene?',
  ])
  assert.deepEqual(preguntasDeDecision(['Wompi'], 'en', 4), ['What are the best alternatives to Wompi?', 'Is Wompi worth it or is there something better?'])
  assert.deepEqual(preguntasDeDecision([], 'es', 4), [], 'sin competidores conocidos no se inventa ninguno')
  for (const q of preguntasDeDecision(['A', 'B', 'C'], 'pt', 6)) assert.ok(q.split(/\s+/).length < 15, q)
})

test('el cupo no pasa el tope: con lugar libre se suman; lleno, salen las últimas del agente, nunca las del dueño ni las de seguimiento', () => {
  const decision = ['¿Cuáles son las mejores alternativas a Semrush?', 'Semrush vs Otterly: ¿cuál me conviene?', '¿Cuáles son las mejores alternativas a Otterly?', 'Semrush vs Peec: ¿cuál me conviene?']

  // 10 guardadas con tope 20: las cuatro entran en el lugar libre.
  const pocas = Array.from({ length: 10 }, (_, i) => pregunta(`Pregunta ${i}`))
  const conLugar = elegirPreguntas(pocas, decision, 20)
  assert.equal(conLugar.length, 14)
  assert.deepEqual(conLugar.slice(10).map((p) => p.id), [null, null, null, null], 'las de decisión no son preguntas guardadas')

  // 20 guardadas con tope 20: siguen siendo 20; salen las últimas del agente, no la del dueño ni la de seguimiento.
  const llenas = Array.from({ length: 20 }, (_, i) => pregunta(`Pregunta ${i}`, i === 19 ? 'owner' : 'agent'))
  const r = elegirPreguntas(llenas, decision, 20, new Set(['pregunta 18']))
  assert.equal(r.length, 20)
  assert.deepEqual(r.slice(0, 16).map((p) => p.text), [...llenas.slice(0, 14), llenas[18]!, llenas[19]!].map((p) => p.text))
  assert.deepEqual(r.slice(16).map((p) => p.text), decision)

  // Founder (tope 10): cupo de 2. Una que ya está guardada no se repite.
  const founder = elegirPreguntas([...pocas.slice(0, 9), pregunta('¿cuáles son las MEJORES alternativas a semrush?')], decision, 10)
  assert.equal(founder.length, 10)
  assert.deepEqual(founder.filter((p) => p.id === null).map((p) => p.text), [decision[1], decision[2]])

  // Todas del dueño: el dueño manda, no entra ninguna de decisión.
  const delDueno = Array.from({ length: 20 }, (_, i) => pregunta(`Del dueño ${i}`, 'owner'))
  assert.equal(elegirPreguntas(delDueno, decision, 20).filter((p) => p.id === null).length, 0)

  // Bajó de plan: se miden las del nuevo tope, igual que antes.
  assert.equal(elegirPreguntas(llenas, [], 10).length, 10)
})
