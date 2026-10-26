/**
 * El radar como API (origen de la tool get_api_radar_by_dominio del MCP del
 * sitio "peaje"): score, nota y los arreglos que más suben el score, con un
 * Ora falso.
 *   cd apps/dashboard && npx tsx --conditions=react-server --test test/radar-api.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

type Check = { id: string; name: string; status: string; score: number; maxScore: number; estScoreGain?: number; recommendation?: string }
const check = (id: string, status: string, o: Partial<Check> = {}): Check => ({ id, name: `Check ${id}`, status, score: status === 'pass' ? 2 : 0, maxScore: 2, ...o })

const ORA = {
  domain: 'tostadores.example',
  score: 41,
  maxScore: 100,
  grade: 'D',
  analysisStatus: 'complete',
  scannedAt: '2026-10-20T10:00:00.000Z',
  layers: [
    {
      id: 'discovery',
      name: 'Discovery',
      checks: [
        check('llms-txt-exists', 'fail', { estScoreGain: 3.5, recommendation: 'Publish /llms.txt.' }),
        check('wikipedia-presence', 'fail', { estScoreGain: 0.6, recommendation: 'Get a Wikipedia article.' }),
        check('robots-ai-policy-quality', 'pass'),
      ],
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      checks: [
        check('sitemap', 'fail', { estScoreGain: 1.1 }),
        check('json-ld', 'warning', { score: 1, maxScore: 4, estScoreGain: 1.7 }),
        check('agent-mode-view', 'fail'),
        check('openapi-spec', 'na', { maxScore: 7 }),
        check('webmcp', 'fail', { maxScore: 5, estScoreGain: 2.9 }),
        check('trust-anchors', 'fail', { estScoreGain: 1.1 }),
      ],
    },
    // Ora repite los chequeos del MCP de docs: cuenta una vez.
    { id: 'usability', name: 'Usability', checks: [check('llms-txt-exists', 'fail', { estScoreGain: 3.5 }), check('mcp-server-card', 'warning', { score: 1 })] },
  ],
}

let escaneos = 0
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url === 'https://ora.ai/api/score/tostadores.example') return Response.json(ORA)
  if (url.startsWith('https://ora.ai/api/score/')) return new Response('{"code":"DOMAIN_NOT_SCANNED"}', { status: 404 })
  if (url === 'https://ora.ai/api/scan') {
    escaneos++
    return Response.json({ error: 'Site not reachable' }, { status: 400 })
  }
  throw new Error(`fetch inesperado: ${url}`)
}) as typeof fetch

// Sin await de nivel superior: el dashboard compila a CommonJS.
const ruta = import('../app/api/radar/[dominio]/route')
const pedir = async (dominio: string) => (await ruta).GET(new Request(`https://usepeaje.com/api/radar/${dominio}`), { params: Promise.resolve({ dominio }) })

test('score, nota y los 5 arreglos que más suben el score, de Peaje o del sitio', async () => {
  const res = await pedir('tostadores.example')
  assert.equal(res.status, 200)
  const j = (await res.json()) as Record<string, unknown> & { topFixes: Record<string, unknown>[]; missing: { id: string; points: number }[] }
  assert.equal(j.domain, 'tostadores.example')
  assert.equal(j.score, 41)
  assert.equal(j.grade, 'D')
  assert.deepEqual(j.topFixes, [
    { id: 'llms-txt-exists', name: 'Check llms-txt-exists', points: 3.5, fixedBy: 'llms.txt', how: 'Publish /llms.txt.' },
    { id: 'webmcp', name: 'Check webmcp', points: 2.9, fixedBy: null },
    { id: 'json-ld', name: 'Check json-ld', points: 1.7, fixedBy: 'JSON-LD' },
    { id: 'sitemap', name: 'Check sitemap', points: 1.1, fixedBy: null },
    { id: 'trust-anchors', name: 'Check trust-anchors', points: 1.1, fixedBy: null },
  ])
  // Lo que arregla Peaje sigue en `missing`, ordenado; lo que no aplica no cuenta.
  // (mcp-server-card no trae estimación de Ora: en `missing` vale su maxScore, como en la previsión; en topFixes va al final.)
  assert.deepEqual(j.missing.map((m) => [m.id, m.points]), [['llms-txt-exists', 3.5], ['mcp-server-card', 2], ['json-ld', 1.7]])
  assert.equal(j.page, 'https://usepeaje.com/radar?d=tostadores.example')
  assert.equal(escaneos, 0)
})

test('dominio inválido: 400; sitio que no abre: 404 con pista', async () => {
  assert.equal((await pedir('no es un dominio')).status, 400)
  const res = await pedir('no-abre.example')
  assert.equal(res.status, 404)
  assert.equal(((await res.json()) as { error: string }).error, 'unreachable')
  assert.equal(escaneos, 1)
})

test('el escaneo fresco tiene tiempo: 120 s', async () => {
  assert.equal((await ruta).maxDuration, 120)
})
