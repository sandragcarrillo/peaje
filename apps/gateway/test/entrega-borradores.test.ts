// Entrega de borradores en el chat, como Boring Marketing en Slack: el
// "estoy en eso" pasa a "✅ Listo en …" con el tiempo real, un resumen corto
// con las preguntas que faltan y lo que sigue, y la página como .md con
// frontmatter (Telegram: sendDocument / sendMediaGroup; Slack: files upload
// v2 en el hilo). Antes, la revisión de voz limpia rayas y mayúsculas. Si el
// archivo no sale, va el link a la tarea. Store en memoria y APIs falsas de
// Anthropic, Telegram y Slack: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.AGENT_MODEL
delete process.env.TOPIC_MODEL
// Solo Claude tiene clave: el resumen no puede nombrar otro asistente.
delete process.env.OPENAI_API_KEY
delete process.env.PERPLEXITY_API_KEY
delete process.env.GEMINI_API_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  ANTHROPIC_API_KEY: 'sk-ant-prueba',
  DASHBOARD_PUBLIC_URL: 'https://usepeaje.com',
  MPP_SECRET_KEY: 'prueba-entrega-0123456789abcdef0123456789abcdef',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
  TOPIC_TIMEOUT_MS: '500',
  AGENT_JOBS_TICK_MS: '20',
  // Telegram y Slack "de verdad" (fuera del modo prueba), contra las APIs falsas de abajo.
  TELEGRAM_BOT_TOKEN: 'tg-prueba',
  SLACK_CLIENT_ID: 'cid',
  SLACK_CLIENT_SECRET: 'csecret',
  SLACK_SIGNING_SECRET: 'ssecret',
  SLACK_TOKEN_KEY: 'clave-de-prueba',
})

// ---------------------------------------------------------------- APIs falsas

type Bloque = Record<string, unknown>
let guion: Bloque[][] = []
let k = 0
const herramienta = (name: string, input: Record<string, unknown> = {}): Bloque => ({ type: 'tool_use', id: `toolu_${++k}`, name, input })
const texto = (t: string): Bloque => ({ type: 'text', text: t })
const respuesta = (content: Bloque[], stop = 'end_turn') =>
  new Response(JSON.stringify({ id: `msg_${++k}`, type: 'message', role: 'assistant', model: 'x', content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/** El borrador que "escribe" Opus: con rayas largas, una palabra que la voz evita y dos [TODO]. */
const borrador = (pregunta: string) => ({
  markdown: [
    `# ${pregunta}`,
    '',
    'El envío en Bogotá cuesta 10.000 pesos — llega en 24 horas y es barato. Lo dice la [página de envíos](https://tienda.example/envios).',
    '',
    'Actualizado: octubre de 2026',
    '',
    '## ¿Hacen envíos el mismo día?',
    '',
    'Sí — si el pedido entra temprano. [TODO: ¿Hasta qué hora reciben pedidos para el mismo día?]',
    '',
    '## ¿Cuánto cuesta fuera de Bogotá?',
    '',
    '[TODO: ¿Cuánto cuesta el envío a Medellín?]',
  ].join('\n'),
  todos: ['¿Hasta qué hora reciben pedidos para el mismo día?', '¿Cuánto cuesta el envío a Medellín?'],
})

const plan = {
  hub: { pregunta: '¿Cómo funcionan los envíos de la tienda?', porQue: 'Es la pregunta general.', formato: 'guide', modelo: '' },
  spokes: [
    { pregunta: '¿Cuánto cuesta el envío a Medellín?', porQue: 'Precio.', formato: 'guide', modelo: '' },
    { pregunta: '¿Hacen envíos el mismo día en Bogotá?', porQue: 'Rapidez.', formato: 'guide', modelo: '' },
    { pregunta: '¿Qué pasa si no estoy en casa?', porQue: 'Entrega.', formato: 'guide', modelo: '' },
  ],
}

type Llamada = { metodo: string; cuerpo: Record<string, unknown> }
let telegram: Llamada[] = []
let slackApi: Llamada[] = []
let subidas: { url: string; contenido: string }[] = []
let fallaArchivoTg = false
let errorSlackArchivos: string | null = null
let idTg = 100
let tsSlack = 0

/** Un FormData de la Bot API como objeto: los archivos quedan como { nombre, contenido }. */
async function leerForm(form: FormData): Promise<Record<string, unknown>> {
  const salida: Record<string, unknown> = {}
  const pares: [string, FormDataEntryValue][] = []
  form.forEach((v, clave) => void pares.push([clave, v]))
  for (const [clave, v] of pares) {
    if (typeof v === 'string') {
      try {
        salida[clave] = /^[[{]/.test(v) ? JSON.parse(v) : v
      } catch {
        salida[clave] = v
      }
    } else salida[clave] = { nombre: (v as File).name, contenido: await v.text() }
  }
  return salida
}

const fetchReal = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://api.anthropic.com/')) {
    const body = JSON.parse(String(init?.body)) as { system?: unknown; messages?: { content: unknown }[] }
    const system = Array.isArray(body.system) ? (body.system as { text: string }[]).map((b) => b.text).join('\n') : String(body.system ?? '')
    if (/You route messages/.test(system)) return respuesta([texto(JSON.stringify({ topic: 'business', reply: '' }))])
    if (/You write one complete web page/.test(system)) {
      const pedido = String(body.messages?.[0]?.content ?? '')
      const pregunta = /Question: (.*)\n/.exec(pedido)?.[1] ?? '¿?'
      return respuesta([texto(JSON.stringify(borrador(pregunta)))])
    }
    if (/You plan a small series/.test(system)) return respuesta([texto(JSON.stringify(plan))])
    const paso = guion.shift() ?? [texto('Listo.')]
    return respuesta(paso, paso.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn')
  }
  if (url.startsWith('https://api.telegram.org/bot')) {
    const metodo = url.split('/').pop()!
    const cuerpo = init?.body instanceof FormData ? await leerForm(init.body) : (JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
    telegram.push({ metodo, cuerpo })
    if (fallaArchivoTg && (metodo === 'sendDocument' || metodo === 'sendMediaGroup')) return Response.json({ ok: false, error_code: 400, description: 'Bad Request: file is too big' })
    if (metodo === 'sendMediaGroup') return Response.json({ ok: true, result: (cuerpo.media as unknown[]).map(() => ({ message_id: ++idTg })) })
    return Response.json({ ok: true, result: { message_id: ++idTg } })
  }
  if (url.startsWith('https://slack.com/api/')) {
    const metodo = url.split('/').pop()!
    const tipo = String((init?.headers as Record<string, string> | undefined)?.['content-type'] ?? '')
    const crudo = String(init?.body ?? '')
    const cuerpo = tipo.includes('x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(crudo)) : (JSON.parse(crudo || '{}') as Record<string, unknown>)
    slackApi.push({ metodo, cuerpo })
    if (metodo === 'files.getUploadURLExternal') {
      if (errorSlackArchivos) return Response.json({ ok: false, error: errorSlackArchivos })
      const id = `F${++tsSlack}`
      return Response.json({ ok: true, upload_url: `https://files.slack.com/upload/v1/${id}`, file_id: id })
    }
    if (metodo === 'files.completeUploadExternal') return Response.json({ ok: true, files: JSON.parse(String(cuerpo.files)) })
    return Response.json({ ok: true, ts: metodo === 'chat.update' ? cuerpo.ts : `1700000200.${String(++tsSlack).padStart(6, '0')}`, channel: cuerpo.channel })
  }
  if (url.startsWith('https://files.slack.com/upload/')) {
    subidas.push({ url, contenido: Buffer.from(init?.body as Uint8Array).toString('utf8') })
    return new Response('OK - 123', { status: 200 })
  }
  // El sitio del negocio: texto de sobra para escribir la página.
  if (/^https:\/\/tienda-\d+\.example\/$/.test(url)) {
    return new Response(`<html><body><h1>Tienda</h1><p>${'Vendemos café de origen en Bogotá y hacemos envíos a todo el país. '.repeat(8)}</p></body></html>`, { status: 200 })
  }
  if (/\.example(\/|$)/.test(url)) return new Response('', { status: 404 })
  return fetchReal(input, init)
}) as typeof fetch

const { store } = await import('../src/store.js')
await import('../src/telegram/router.js')
const { procesarUpdate } = await import('../src/telegram/bot.js')
await import('../src/slack/reportes.js')
const { cifrar } = await import('../src/slack/api.js')
const { procesarEvento } = await import('../src/slack/bot.js')
const { iniciarTrabajos, avisoDeTrabajo } = await import('../src/tareas/trabajos.js')
const { slugDePregunta, borradorDe } = await import('../src/ciclo/borrador.js')
const { duracion, descripcionMeta, lineaSiguiente } = await import('../src/ciclo/entrega.js')
const { revisarVoz, lineaDeRevision } = await import('../src/ciclo/revision-voz.js')
const { COSTOS_CREDITOS, periodoCreditos } = await import('@peaje/db')

beforeEach(() => {
  guion = []
  telegram = []
  slackApi = []
  subidas = []
  fallaArchivoTg = false
  errorSlackArchivos = null
})

let apagar: (() => void) | null = null
after(() => apagar?.())

// ---------------------------------------------------------------- ayudas

let n = 0
async function negocio() {
  const slug = `tienda-${++n}`
  const t = await store.createTenant({ slug, name: `Tienda ${n}`, originUrl: `https://${slug}.example`, embedSecret: 'x' })
  await store.setTenantPlan(t.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
  await store.setTenantVoiceProfile(t.id, {
    language: 'es',
    formality: 'casual',
    person: 'tú, nosotros',
    sentenceLength: 'short',
    uses: ['café de origen'],
    avoids: ['no "barato"', 'sin signos de exclamación'],
    samples: [],
    editedByOwner: true,
  })
  return (await store.getTenantById(t.id))!
}

async function hasta(cond: () => boolean, ms = 8_000): Promise<void> {
  const fin = Date.now() + ms
  while (!cond()) {
    if (Date.now() > fin) throw new Error('timeout esperando la entrega')
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** El worker se prende después de la respuesta del chat, como en la vida real (el borrador tarda minutos). */
async function correrTrabajos(listo: () => boolean) {
  apagar = iniciarTrabajos()
  try {
    await hasta(listo)
    // Lo que queda de la entrega (el link si el archivo falló) sale en la misma vuelta.
    await new Promise((r) => setTimeout(r, 50))
  } finally {
    apagar()
    apagar = null
  }
}

const de = (xs: Llamada[], metodo: string) => xs.filter((x) => x.metodo === metodo)
type Archivo = { nombre: string; contenido: string }

function frontmatter(contenido: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(contenido)
  assert.ok(m, 'el .md empieza con frontmatter')
  return Object.fromEntries(m[1]!.split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]))
}

let chat = 5000
async function chatTelegram(tenantId: string) {
  const chatId = ++chat
  await store.linkTelegram({ chatId, tenantId, username: null, language: 'es' })
  return chatId
}

// ---------------------------------------------------------------- unidades

test('el tiempo se escribe corto en los dos idiomas', () => {
  assert.equal(duracion(488_000, 'es'), '8 min 8 s')
  assert.equal(duracion(488_000, 'en'), '8m 8s')
  assert.equal(duracion(42_400, 'es'), '42 s')
  assert.equal(duracion(42_400, 'en'), '42s')
  assert.equal(duracion(120_000, 'es'), '2 min')
  assert.equal(duracion(3_780_000, 'es'), '1 h 3 min')
  assert.equal(duracion(3_780_000, 'en'), '1h 3m')
  assert.equal(duracion(200, 'en'), '1s')
})

test('revisión de voz: rayas a comas o puntos, mayúscula sostenida a minúscula, sin tocar código, URLs, TODO ni H1', () => {
  const md = [
    '# ¿Cuánto cuesta — el envío?',
    '',
    'Cuesta 10.000 pesos — Gratis desde 50.000. Llega rápido — en 24 horas — a Bogotá.',
    '',
    '## PREGUNTAS FRECUENTES SOBRE EL ENVÍO',
    '',
    '— una viñeta con raya',
    'Pedidos de 10—20 kilos, `a — b`, [precios — tarifas](https://x.example/a—b) y [TODO: ¿Cuánto — cuesta?]. Usamos SEO y el IVA INCLUIDO.',
  ].join('\n')
  const { markdown, revision } = revisarVoz(md, {})
  assert.equal(revision.rayas, 6)
  assert.equal(revision.mayusculas, 2)
  assert.match(markdown, /^# ¿Cuánto cuesta — el envío\?$/m)
  assert.match(markdown, /Cuesta 10\.000 pesos\. Gratis desde 50\.000\. Llega rápido, en 24 horas, a Bogotá\./)
  assert.match(markdown, /^## Preguntas frecuentes sobre el envío$/m)
  assert.match(markdown, /^- una viñeta con raya$/m)
  assert.match(markdown, /10-20 kilos/)
  assert.match(markdown, /`a — b`/)
  assert.match(markdown, /\[precios, tarifas\]\(https:\/\/x\.example\/a—b\)/)
  assert.match(markdown, /\[TODO: ¿Cuánto — cuesta\?\]/)
  assert.match(markdown, /SEO y el IVA incluido/)
  assert.equal(lineaDeRevision(revision, 'es'), 'Revisé la voz: cambié 6 rayas largas por comas o puntos; pasé 2 frases de mayúsculas a minúsculas.')
})

test('revisión de voz: palabras que el perfil evita y frases largas se avisan sin cambiarlas', () => {
  const larga = `Esta frase ${'sigue y '.repeat(16)}termina.`
  const voz = { language: 'es', formality: '', person: '', sentenceLength: 'short', uses: [], avoids: ['no "barato"', 'increíble', 'sin anglicismos'], samples: [] }
  const { markdown, revision } = revisarVoz(`# Q\n\nEs barato y bueno. ${larga}\n`, { voz })
  assert.match(markdown, /Es barato y bueno/)
  assert.deepEqual(revision.palabras, ['barato'])
  assert.equal(revision.largas, 1)
  assert.equal(lineaDeRevision(revision, 'en'), 'Voice check: the page uses "barato", which your voice profile avoids; 1 sentence is very long.')
  assert.equal(lineaDeRevision(revisarVoz('# Q\n\nTodo bien.\n').revision, 'es'), null)
})

test('lo que sigue nombra solo los asistentes que Peaje mide', () => {
  assert.equal(lineaSiguiente('es'), 'Cuando esté publicada, Peaje revisa a las 2 y a las 6 semanas si Claude la cita.')
  process.env.OPENAI_API_KEY = 'sk-prueba'
  try {
    assert.equal(lineaSiguiente('es', true), 'Cuando estén publicadas, Peaje revisa a las 2 y a las 6 semanas si ChatGPT o Claude las citan.')
    assert.equal(lineaSiguiente('en'), "Once it's live, Peaje checks at 2 and 6 weeks whether ChatGPT or Claude cites it.")
  } finally {
    delete process.env.OPENAI_API_KEY
  }
  const anthropic = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  try {
    const sin = lineaSiguiente('en')
    assert.doesNotMatch(sin, /ChatGPT|Claude|Perplexity|Gemini/)
    assert.match(sin, /measures visits from AI assistants at 2 and 6 weeks/)
  } finally {
    process.env.ANTHROPIC_API_KEY = anthropic
  }
})

test('la meta description sale de la respuesta directa, bajo 160 caracteres', () => {
  const md = `# P\n\n*Actualizado: octubre de 2026*\n\n${'Una frase de respuesta directa con datos reales. '.repeat(6)}\n\n## Más\n\nOtra cosa.`
  const d = descripcionMeta(md)
  assert.ok(d.length < 160, d)
  assert.match(d, /^Una frase de respuesta directa/)
  assert.ok(d.endsWith('.'))
})

// ---------------------------------------------------------------- Telegram

test('Telegram, una página: el aviso pasa a "✅ Listo en …", el resumen responde al pedido y el .md sale una vez, sin cobrar de nuevo', async () => {
  const t = await negocio()
  const chatId = await chatTelegram(t.id)
  const pregunta = '¿Cuánto cuesta el envío?'
  guion = [[herramienta('draft_page', { question: pregunta, why: 'Tres clientes lo preguntaron esta semana' })], [texto(avisoDeTrabajo('draft_page', 'es'))]]
  await procesarUpdate({ message: { message_id: 501, chat: { id: chatId }, from: { language_code: 'es' }, text: 'escribe la página del envío' } })
  const aviso = de(telegram, 'sendMessage').at(-1)!
  assert.equal(aviso.cuerpo.text, avisoDeTrabajo('draft_page', 'es'))
  const idAviso = idTg
  await correrTrabajos(() => de(telegram, 'sendDocument').length > 0)

  // 1. El "estoy en eso" editado con el tiempo real.
  const [edicion, ...otras] = de(telegram, 'editMessageText')
  assert.equal(otras.length, 0)
  assert.equal(edicion!.cuerpo.message_id, idAviso)
  assert.match(String(edicion!.cuerpo.text), /^✅ Listo en \d+ s$/)

  // 2. El resumen, como respuesta al pedido: qué página, por qué, qué falta (como preguntas) y qué sigue.
  const resumen = de(telegram, 'sendMessage').at(-1)!
  assert.deepEqual(resumen.cuerpo.reply_parameters, { message_id: 501, allow_sending_without_reply: true })
  const r = String(resumen.cuerpo.text)
  assert.doesNotMatch(r, /✅/)
  assert.match(r, /^Es la página que responde «¿Cuánto cuesta el envío\?»\. Tres clientes lo preguntaron esta semana\./)
  assert.match(r, /Le faltan 2 datos que no están en tu sitio; contéstame aquí y la completo:\n1\. ¿Hasta qué hora reciben pedidos para el mismo día\?\n2\. ¿Cuánto cuesta el envío a Medellín\?/)
  assert.match(r, /Cuando esté publicada, Peaje revisa a las 2 y a las 6 semanas si Claude la cita\./)
  assert.doesNotMatch(r, /ChatGPT|Perplexity|Gemini/)
  assert.match(r, /Revisé la voz: cambié 2 rayas largas por comas o puntos; la página usa «barato», que tu perfil de voz evita\./)
  assert.doesNotMatch(r, /—/)
  // La tarjeta de la tarea sigue como botón.
  const [tarea] = await store.listTasks(t.id)
  const botones = (resumen.cuerpo.reply_markup as { inline_keyboard: { url?: string }[][] }).inline_keyboard.flat()
  assert.ok(botones.some((b) => b.url === `https://usepeaje.com/t/${t.slug}/agente/tareas/${tarea!.id}`))

  // 3. El .md, una sola vez, respondiendo al pedido, con frontmatter y ya limpio.
  const docs = de(telegram, 'sendDocument')
  assert.equal(docs.length, 1)
  assert.deepEqual(docs[0]!.cuerpo.reply_parameters, { message_id: 501, allow_sending_without_reply: true })
  const archivo = docs[0]!.cuerpo.document as Archivo
  const slug = slugDePregunta(pregunta)
  assert.equal(archivo.nombre, `${slug}.md`)
  const fm = frontmatter(archivo.contenido)
  assert.equal(fm.title, JSON.stringify(pregunta))
  assert.equal(fm.slug, JSON.stringify(slug))
  assert.match(fm.date!, /^\d{4}-\d{2}-\d{2}$/)
  const descripcion = JSON.parse(fm.description!) as string
  assert.ok(descripcion.length > 20 && descripcion.length < 160, descripcion)
  assert.match(descripcion, /^El envío en Bogotá cuesta 10\.000 pesos, llega en 24 horas/)
  assert.doesNotMatch(archivo.contenido, /—/)
  assert.match(archivo.contenido, /\n# ¿Cuánto cuesta el envío\?\n/)
  assert.match(archivo.contenido, /\[TODO: ¿Cuánto cuesta el envío a Medellín\?\]/)
  assert.equal(de(telegram, 'sendMessage').filter((m) => /No pude adjuntar/.test(String(m.cuerpo.text))).length, 0)

  // El dashboard sigue igual: la tarea guarda el mismo borrador (limpio) y la conversación el aviso con la línea de estado.
  assert.equal(`${borradorDe(tarea!)}\n`, archivo.contenido.split('---\n\n')[1])
  const ultimo = (await store.listMessages(t.id, 10)).filter((m) => m.role === 'assistant').at(-1)!
  assert.match(ultimo.text, /^✅ Listo en \d+ s\n\nEs la página que responde/)
  // Entregar no cobra: solo la página, al pedirla.
  assert.equal(await store.creditsUsedSince(t.id, periodoCreditos().desde), COSTOS_CREDITOS.pagina)
})

test('Telegram: si el archivo no sale, va el link a la tarea; sin aviso que editar, la línea de estado encabeza el resumen', async () => {
  const t = await negocio()
  const chatId = await chatTelegram(t.id)
  fallaArchivoTg = true
  // El agente no usó la frase del aviso: no hay qué editar.
  guion = [[herramienta('draft_page', { question: '¿Hacen envíos el mismo día?', why: 'Lo preguntan' })], [texto('Voy con la página.')]]
  await procesarUpdate({ message: { message_id: 600, chat: { id: chatId }, from: { language_code: 'es' }, text: 'la página del mismo día' } })
  await correrTrabajos(() => de(telegram, 'sendMessage').some((m) => /No pude adjuntar/.test(String(m.cuerpo.text))))

  const [job] = await store.listJobs(t.id, 1)
  assert.equal(job!.status, 'done')
  assert.equal(de(telegram, 'editMessageText').length, 0)
  assert.equal(de(telegram, 'sendDocument').length, 1)
  const mensajes = de(telegram, 'sendMessage').map((m) => String(m.cuerpo.text))
  const resumen = mensajes.find((m) => m.includes('Es la página que responde'))!
  assert.match(resumen, /^✅ Listo en \d+ s\n\nEs la página que responde «¿Hacen envíos el mismo día\?»/)
  const [tarea] = await store.listTasks(t.id)
  assert.equal(mensajes.at(-1), `No pude adjuntar el archivo aquí. La página completa está en tu dashboard: https://usepeaje.com/t/${t.slug}/agente/tareas/${tarea!.id}`)
})

test('Telegram, una serie: un resumen del conjunto y todas las páginas en un solo álbum de .md', async () => {
  const t = await negocio()
  const chatId = await chatTelegram(t.id)
  guion = [[herramienta('draft_page_series', { topic: 'envíos' })], [texto(avisoDeTrabajo('page_series', 'es'))]]
  await procesarUpdate({ message: { message_id: 700, chat: { id: chatId }, from: { language_code: 'es' }, text: 'arma una serie sobre envíos' } })
  const idAviso = idTg
  await correrTrabajos(() => de(telegram, 'sendMediaGroup').length > 0)

  assert.equal(de(telegram, 'editMessageText')[0]!.cuerpo.message_id, idAviso)
  assert.match(String(de(telegram, 'editMessageText')[0]!.cuerpo.text), /^✅ Listo en \d+ s$/)
  const resumen = String(de(telegram, 'sendMessage').at(-1)!.cuerpo.text)
  assert.match(resumen, /^Es la serie sobre «envíos»: la página principal «¿Cómo funcionan los envíos de la tienda\?» y 3 páginas que la apoyan, enlazadas entre sí\./)
  assert.match(resumen, /Faltan 8 datos en total; contéstame aquí y los completo:\n«¿Cómo funcionan los envíos de la tienda\?»\n1\. ¿Hasta qué hora/)
  assert.match(resumen, /\n8\. ¿Cuánto cuesta el envío a Medellín\?/)
  assert.match(resumen, /Cuando estén publicadas, Peaje revisa a las 2 y a las 6 semanas si Claude las cita\./)
  assert.match(resumen, /Revisé la voz: cambié 8 rayas largas por comas o puntos; las páginas usan «barato», que tu perfil de voz evita\./)

  assert.equal(de(telegram, 'sendDocument').length, 0)
  const [album, ...mas] = de(telegram, 'sendMediaGroup')
  assert.equal(mas.length, 0)
  assert.deepEqual(album!.cuerpo.reply_parameters, { message_id: 700, allow_sending_without_reply: true })
  const media = album!.cuerpo.media as { type: string; media: string }[]
  assert.deepEqual(media, [0, 1, 2, 3].map((i) => ({ type: 'document', media: `attach://pagina${i}` })))
  const nombres = media.map((_, i) => (album!.cuerpo[`pagina${i}`] as Archivo).nombre)
  assert.deepEqual(nombres, [plan.hub, ...plan.spokes].map((p) => `${slugDePregunta(p.pregunta)}.md`))
  for (let i = 0; i < 4; i++) {
    const a = album!.cuerpo[`pagina${i}`] as Archivo
    assert.equal(frontmatter(a.contenido).slug, JSON.stringify(slugDePregunta([plan.hub, ...plan.spokes][i]!.pregunta)))
    assert.doesNotMatch(a.contenido, /—/)
  }
  assert.equal(await store.creditsUsedSince(t.id, periodoCreditos().desde), COSTOS_CREDITOS.serie)
})

// ---------------------------------------------------------------- Slack

async function canalSlack(tenantId: string, equipo: string) {
  await store.saveSlackInstall({ teamId: equipo, teamName: 'Tienda', enterpriseId: null, botTokenEnc: cifrar('xoxb-prueba'), botUserId: 'UBOT', installerUserId: 'U1' })
  await store.linkSlack({ teamId: equipo, channelId: 'C1', tenantId, language: 'es', linkedBy: 'U1' })
}

test('Slack, una serie: el aviso se edita, el resumen y los .md (upload v2, un solo complete) van al hilo de la mención', async () => {
  const t = await negocio()
  await canalSlack(t.id, 'T1')
  guion = [[herramienta('draft_page_series', { topic: 'envíos' })], [texto(avisoDeTrabajo('page_series', 'es'))]]
  const mencion = '1700000100.000100'
  await procesarEvento({ type: 'event_callback', team_id: 'T1', event: { type: 'app_mention', user: 'U2', text: '<@UBOT> arma una serie sobre envíos', ts: mencion, channel: 'C1' } })
  const provisorio = de(slackApi, 'chat.postMessage')[0]!
  assert.equal(provisorio.cuerpo.thread_ts, mencion)
  const tsAviso = `1700000200.${String(tsSlack).padStart(6, '0')}`
  await correrTrabajos(() => de(slackApi, 'files.completeUploadExternal').length > 0)

  const ediciones = de(slackApi, 'chat.update').filter((u) => /✅/.test(String(u.cuerpo.text)))
  assert.equal(ediciones.length, 1)
  assert.equal(ediciones[0]!.cuerpo.ts, tsAviso)
  assert.match(String(ediciones[0]!.cuerpo.text), /^✅ Listo en \d+ s$/)
  const resumen = de(slackApi, 'chat.postMessage').at(-1)!
  assert.equal(resumen.cuerpo.thread_ts, mencion)
  assert.match(String(resumen.cuerpo.text), /^Es la serie sobre «envíos»/)

  const urls = de(slackApi, 'files.getUploadURLExternal')
  assert.equal(urls.length, 4)
  assert.deepEqual(urls.map((u) => u.cuerpo.filename), [plan.hub, ...plan.spokes].map((p) => `${slugDePregunta(p.pregunta)}.md`))
  assert.equal(subidas.length, 4)
  for (let i = 0; i < 4; i++) {
    assert.equal(Number(urls[i]!.cuerpo.length), Buffer.byteLength(subidas[i]!.contenido, 'utf8'))
    assert.match(subidas[i]!.contenido, /^---\ntitle: "/)
  }
  const [completo, ...mas] = de(slackApi, 'files.completeUploadExternal')
  assert.equal(mas.length, 0)
  assert.equal(completo!.cuerpo.channel_id, 'C1')
  assert.equal(completo!.cuerpo.thread_ts, mencion)
  assert.equal((JSON.parse(String(completo!.cuerpo.files)) as unknown[]).length, 4)
  assert.equal(de(slackApi, 'chat.postMessage').filter((m) => /No pude adjuntar/.test(String(m.cuerpo.text))).length, 0)
})

test('Slack sin files:write: la página llega igual y el archivo se cambia por el link a la tarea, en el hilo', async () => {
  const t = await negocio()
  await canalSlack(t.id, 'T2')
  errorSlackArchivos = 'missing_scope'
  guion = [[herramienta('draft_page', { question: '¿Qué pasa si no estoy en casa?', why: 'Lo preguntan' })], [texto(avisoDeTrabajo('draft_page', 'es'))]]
  const mencion = '1700000300.000100'
  await procesarEvento({ type: 'event_callback', team_id: 'T2', event: { type: 'app_mention', user: 'U2', text: '<@UBOT> la página de entregas', ts: mencion, channel: 'C1' } })
  await correrTrabajos(() => de(slackApi, 'chat.postMessage').some((m) => /No pude adjuntar/.test(String(m.cuerpo.text))))
  const [tarea] = await store.listTasks(t.id)
  const respaldo = de(slackApi, 'chat.postMessage').at(-1)!
  assert.equal(respaldo.cuerpo.thread_ts, mencion)
  assert.equal(respaldo.cuerpo.text, `No pude adjuntar el archivo aquí. La página completa está en tu dashboard: https://usepeaje.com/t/${t.slug}/agente/tareas/${tarea!.id}`)
  assert.equal(de(slackApi, 'files.completeUploadExternal').length, 0)
  const [job] = await store.listJobs(t.id, 1)
  assert.equal(job!.status, 'done')
})
