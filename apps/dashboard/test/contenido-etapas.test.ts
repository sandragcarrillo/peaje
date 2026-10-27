/**
 * Pipeline de contenido (app/t/[slug]/agente/contenido/etapas.ts): etapas,
 * filtro, insignia, evidencia y prioridad de cada tarea, sacadas solo de la
 * tarea, sus seguimientos y las rondas de citación.
 *   cd apps/dashboard && NODE_OPTIONS="--conditions=react-server" npx tsx --test test/contenido-etapas.test.ts
 */
import type { AgentTask, CitationRun, TaskFollowup } from '@peaje/db'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armarPipeline, contarFiltros, etapa, etapasDe, evidenciaDe, faltanDe, filtroDe, insigniaDe, normalPregunta, piezaDe, resultadoDe } from '../app/t/[slug]/agente/contenido/etapas'

const PREGUNTA = '¿Cuánto cuesta una API de clima para Colombia?'
const RAIZ = 'clima.test'

const instrucciones = (formato = true) =>
  [
    `# New page: ${PREGUNTA}`,
    '',
    'AI assistants get asked this and Clima has no page that answers it.',
    '',
    '## What to do',
    '',
    '1. Create the page at `https://clima.test/cuanto-cuesta`.',
    ...(formato ? ['', '## Format', '', '- Format: comparison. A head-to-head comparison.'] : []),
  ].join('\n')

const conBorrador = (pagina: string) => `${instrucciones()}\n\n## Draft\n\n${pagina}\n`

function tarea(x: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'tsk_1',
    tenantId: 'ten_1',
    key: 'content:cuanto-cuesta',
    kind: 'content',
    title: PREGUNTA,
    summary: 'Nadie publica precios en pesos.',
    body: instrucciones(),
    acceptance: [{ type: 'url', url: 'https://clima.test/cuanto-cuesta' }],
    status: 'open',
    source: 'agent',
    note: null,
    doneUrl: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    doneAt: null,
    verifiedAt: null,
    ...x,
  }
}

function run(x: Partial<CitationRun> & Pick<CitationRun, 'engine'>): CitationRun {
  return {
    id: `crn_${x.engine}_${x.roundId ?? 'r2'}`,
    tenantId: 'ten_1',
    roundId: 'r2',
    promptId: null,
    promptText: PREGUNTA,
    runAt: '2026-10-20T12:00:00.000Z',
    cited: false,
    mentioned: false,
    domains: [],
    pages: [],
    answerExcerpt: null,
    error: null,
    ...x,
  }
}

const estados = (t: AgentTask) => Object.fromEntries(etapasDe(t).map((e) => [e.id, `${e.estado}:${e.motivo}`]))

test('abierta sin borrador: identificada y con instrucciones, el borrador es lo que sigue', () => {
  const t = tarea()
  assert.deepEqual(estados(t), {
    identificada: 'hecha:creada',
    brief: 'hecha:con-instrucciones',
    borrador: 'actual:sin-borrador-aun',
    revision: 'pendiente:esperando-borrador',
    publicada: 'pendiente:por-publicar',
  })
  assert.equal(filtroDe(etapasDe(t), t.status), 'pendiente')
  assert.equal(insigniaDe(t), 'sin-borrador')
})

test('borrador con datos faltantes: en revisión, cada [TODO] repetido cuenta una vez', () => {
  const t = tarea({ body: conBorrador(`# ${PREGUNTA}\n\nCuesta [TODO: confirm price] al mes. Desde [TODO: confirm price]. Somos [TODO: team size].`) })
  assert.deepEqual(faltanDe(t.body.split('\n## Draft\n')[1]!), ['confirm price', 'team size'])
  assert.equal(etapa(etapasDe(t), 'borrador').estado, 'hecha')
  assert.equal(estados(t).revision, 'actual:faltan')
  assert.equal(filtroDe(etapasDe(t), t.status), 'listo')
  assert.equal(insigniaDe(t), 'faltan')
  assert.equal(piezaDe(t, [], [], RAIZ).pendientes.length, 2)
})

test('borrador completo: lista para publicar; tomada por la herramienta: en curso', () => {
  const lista = tarea({ body: conBorrador(`# ${PREGUNTA}\n\nCuesta 20 USD al mes.`) })
  assert.equal(estados(lista).revision, 'actual:lista')
  assert.equal(insigniaDe(lista), 'lista')
  const enCurso = { ...lista, status: 'in_progress' as const }
  assert.equal(estados(enCurso).revision, 'actual:en-curso')
  assert.equal(insigniaDe(enCurso), 'en-curso')
  assert.equal(filtroDe(etapasDe(enCurso), enCurso.status), 'listo')
})

test('marcada hecha: con URL cuenta como publicada; sin URL todavía no', () => {
  const body = conBorrador(`# ${PREGUNTA}\n\nCuesta [TODO: confirm price].`)
  const conUrl = tarea({ body, status: 'done', doneUrl: 'https://clima.test/precios', doneAt: '2026-10-10T00:00:00.000Z', note: 'Not live yet: answers 404.' })
  assert.equal(estados(conUrl).publicada, 'hecha:publicada')
  assert.equal(estados(conUrl).revision, 'hecha:revisada-con-faltan')
  assert.equal(filtroDe(etapasDe(conUrl), conUrl.status), 'publicada')
  assert.equal(insigniaDe(conUrl), 'revisando')
  const p = piezaDe(conUrl, [], [], RAIZ)
  assert.equal(p.url, 'https://clima.test/precios')
  assert.equal(p.resultado?.enVivo, 'no-vista')

  const sinUrl = { ...conUrl, doneUrl: null }
  assert.equal(estados(sinUrl).publicada, 'actual:sin-direccion')
  assert.equal(filtroDe(etapasDe(sinUrl), sinUrl.status), 'pendiente')
  assert.equal(piezaDe(sinUrl, [], [], RAIZ).url, null)
})

test('verificada sin borrador: publicada con la URL que Peaje revisó; borrador y revisión sin datos', () => {
  const t = tarea({ status: 'verified', doneAt: '2026-10-10T00:00:00.000Z', verifiedAt: '2026-10-10T00:05:00.000Z' })
  assert.deepEqual(estados(t), {
    identificada: 'hecha:creada',
    brief: 'hecha:con-instrucciones',
    borrador: 'sin-dato:sin-borrador',
    revision: 'sin-dato:no-aplica',
    publicada: 'hecha:publicada',
  })
  const p = piezaDe(t, [], [], RAIZ)
  assert.equal(p.url, 'https://clima.test/cuanto-cuesta')
  assert.equal(p.insignia, 'verificada')
  assert.equal(p.resultado?.enVivo, 'vista')
})

test('frescura: no lleva borrador ni pregunta, aunque una medición tenga el mismo texto', () => {
  const t = tarea({ key: 'content:refresh:/precios', title: 'Refresh /precios: last dated 2025-01-02', body: '# Refresh https://clima.test/precios\n\n## What to do\n\n1. Review the facts.' })
  assert.deepEqual(estados(t), {
    identificada: 'hecha:creada',
    brief: 'hecha:con-instrucciones',
    borrador: 'sin-dato:no-lleva',
    revision: 'sin-dato:no-aplica',
    publicada: 'actual:por-publicar',
  })
  const p = piezaDe(t, [], [run({ engine: 'chatgpt', promptText: t.title })], RAIZ)
  assert.equal(p.pregunta, null)
  assert.equal(p.tipo, 'actualizar')
  assert.equal(p.evidencia, null)
  assert.equal(p.prioridad, null)
  assert.equal(p.insignia, 'por-actualizar')
})

test('descartada: nada después se da por hecho y solo sale en Todas', () => {
  const t = tarea({ status: 'dismissed', note: 'No vendemos en Colombia' })
  const e = etapasDe(t)
  assert.equal(etapa(e, 'publicada').estado, 'sin-dato')
  assert.equal(etapa(e, 'revision').estado, 'sin-dato')
  assert.equal(filtroDe(e, t.status), 'descartada')
  assert.equal(insigniaDe(t), 'descartada')
})

test('una etapa sin instrucciones no sale hecha', () => {
  const t = tarea({ body: '' })
  assert.equal(etapa(etapasDe(t), 'brief').estado, 'sin-dato')
})

test('evidencia y prioridad: la última ronda de la pregunta, sin el sitio propio, sin los que no respondieron', () => {
  const runs: CitationRun[] = [
    // Ronda vieja: no cuenta.
    run({ engine: 'chatgpt', roundId: 'r1', runAt: '2026-10-13T12:00:00.000Z', cited: true }),
    // Ronda nueva, con el texto escrito distinto (sin tildes ni signos).
    run({
      engine: 'chatgpt',
      promptText: 'cuanto cuesta una API de clima para colombia',
      pages: [
        { url: 'https://rival.test/precios', title: 'Precios', domain: 'rival.test', format: 'comparison' },
        { url: 'https://blog.otro.test/top', title: 'Top 5', domain: 'blog.otro.test', format: 'roundup' },
      ],
      domains: ['rival.test', 'blog.otro.test'],
    }),
    run({
      engine: 'perplexity',
      mentioned: true,
      pages: [
        { url: 'https://rival.test/precios', title: 'Precios', domain: 'rival.test', format: 'comparison' },
        { url: null, title: null, domain: 'foro.test', format: null },
      ],
    }),
    run({
      engine: 'claude',
      cited: true,
      pages: [
        { url: 'https://www.clima.test/precios', title: 'Nosotros', domain: 'www.clima.test', format: 'product' },
        { url: 'https://tercero.test/a', title: 'A', domain: 'tercero.test', format: 'comparison' },
      ],
    }),
    run({ engine: 'gemini', error: 'timeout' }),
    // Otra pregunta: no cuenta.
    run({ engine: 'chatgpt', promptText: 'Mejor API de clima', pages: [{ url: 'https://x.test', title: null, domain: 'x.test', format: 'guide' }] }),
  ]
  const r = evidenciaDe(PREGUNTA, runs, RAIZ)
  assert.ok(r)
  assert.equal(r.evidencia.roundId, 'r2')
  assert.deepEqual(
    r.evidencia.motores.map((m) => [m.engine, m.estado]),
    [
      ['chatgpt', 'no'],
      ['perplexity', 'nombra'],
      ['claude', 'cita'],
      ['gemini', 'error'],
    ],
  )
  // Claude cita al sitio: lo propio (www.clima.test) no aparece entre los que citó.
  assert.deepEqual(
    r.evidencia.motores.find((m) => m.engine === 'claude')!.enTuLugar.map((p) => p.domain),
    ['tercero.test'],
  )
  // 3 respondieron, 2 no citan (nombrar sin link no es citar); en esas dos, 3 sitios distintos.
  assert.deepEqual(r.prioridad, { noCitan: 2, respondieron: 3, otros: 3 })
  // Formatos de lo citado en lugar del sitio, solo los conocidos: 3 comparaciones y 1 ranking.
  assert.deepEqual(r.evidencia.formatos, [
    { format: 'comparison', paginas: 3 },
    { format: 'roundup', paginas: 1 },
  ])
  assert.equal(r.evidencia.paginasConFormato, 4)
})

test('sin medición exacta no hay evidencia ni número; parecida no alcanza', () => {
  assert.equal(evidenciaDe(PREGUNTA, [run({ engine: 'chatgpt', promptText: `${PREGUNTA} en 2026` })], RAIZ), null)
  assert.equal(normalPregunta('¿Cuánto  cuesta?'), normalPregunta('cuanto cuesta'))
  // Una ronda donde todos fallaron: evidencia sí (se ve que no respondieron), prioridad no.
  const r = evidenciaDe(PREGUNTA, [run({ engine: 'chatgpt', error: 'x' })], RAIZ)
  assert.equal(r?.prioridad, null)
})

test('resultado: lo que midió cada seguimiento y la foto al verificarla', () => {
  const t = tarea({ status: 'verified', verifiedAt: '2026-09-01T00:00:00.000Z' })
  const antes = { at: '2026-09-01T00:00:00.000Z', question: PREGUNTA, citation: { chatgpt: { cited: false, mentioned: false }, claude: { cited: false, mentioned: true } } }
  const seguimientos: TaskFollowup[] = [
    {
      id: 'f6',
      tenantId: 'ten_1',
      taskId: 'tsk_1',
      kind: '6w',
      dueAt: '2026-10-13T00:00:00.000Z',
      doneAt: null,
      before: antes,
      after: null,
      verdict: null,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'f2',
      tenantId: 'ten_1',
      taskId: 'tsk_1',
      kind: '2w',
      dueAt: '2026-09-15T00:00:00.000Z',
      doneAt: '2026-09-15T03:00:00.000Z',
      before: antes,
      after: { at: '2026-09-15T03:00:00.000Z', citation: { claude: { cited: true, mentioned: true }, chatgpt: { cited: false, mentioned: false } }, verdictEs: 'Claude cita tu sitio.' },
      verdict: 'Claude cites your site.',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
    { id: 'otra', tenantId: 'ten_1', taskId: 'tsk_2', kind: '2w', dueAt: '2026-09-15T00:00:00.000Z', doneAt: null, before: antes, after: null, verdict: null, createdAt: '2026-09-01T00:00:00.000Z' },
  ]
  const r = resultadoDe(t, seguimientos)
  assert.ok(r)
  assert.equal(r.enVivo, 'vista')
  assert.deepEqual(r.antes, { citan: [], preguntados: 2 })
  assert.deepEqual(
    r.mediciones.map((m) => [m.kind, m.citan, m.preguntados, m.veredictoEs]),
    [
      ['2w', ['claude'], 2, 'Claude cita tu sitio.'],
      ['6w', null, 0, null],
    ],
  )
  assert.equal(resultadoDe(tarea(), seguimientos.filter((f) => f.taskId === 'tsk_9')), null)
})

test('orden: por prioridad las que faltan, después publicadas y al final descartadas', () => {
  const medida = (q: string, noCitan: number, otros: number): CitationRun[] =>
    Array.from({ length: 4 }, (_, i) =>
      run({
        engine: ['chatgpt', 'perplexity', 'claude', 'gemini'][i]!,
        promptText: q,
        cited: i >= noCitan,
        pages: i < noCitan ? Array.from({ length: otros }, (_, j) => ({ url: `https://o${j}.test`, title: null, domain: `o${j}.test`, format: null })) : [],
      }),
    )
  const tareas: AgentTask[] = [
    tarea({ id: 'baja', key: 'content:baja', title: 'Pregunta baja', updatedAt: '2026-10-05T00:00:00.000Z' }),
    tarea({ id: 'alta', key: 'content:alta', title: 'Pregunta alta' }),
    tarea({ id: 'empate', key: 'content:empate', title: 'Pregunta empate' }),
    tarea({ id: 'sin-medir', key: 'content:sin', title: 'Sin medir', updatedAt: '2026-10-25T00:00:00.000Z' }),
    tarea({ id: 'publicada', key: 'content:pub', title: 'Publicada', status: 'verified', verifiedAt: '2026-10-11T00:00:00.000Z' }),
    tarea({ id: 'descartada', key: 'content:desc', title: 'Descartada', status: 'dismissed' }),
    tarea({ id: 'arreglo', key: 'fix:robots', kind: 'fix', title: 'Fix robots' }),
  ]
  const runs = [...medida('Pregunta alta', 4, 2), ...medida('Pregunta empate', 4, 1), ...medida('Pregunta baja', 1, 5)]
  const piezas = armarPipeline(tareas, [], runs, RAIZ)
  assert.deepEqual(
    piezas.map((p) => p.id),
    ['alta', 'empate', 'baja', 'sin-medir', 'publicada', 'descartada'],
  )
  assert.deepEqual(contarFiltros(piezas), { todas: 6, listo: 0, pendiente: 4, publicada: 1 })
})
