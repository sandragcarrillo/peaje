import Anthropic from '@anthropic-ai/sdk'

/**
 * Los motores de respuesta a los que Peaje les hace las preguntas del negocio.
 * Cada uno devuelve el texto de la respuesta y los dominios que citó. Solo se
 * usan los que tienen clave en el entorno. Son proxies de lo que ve un usuario
 * en la app de consumo (otro modelo, sin personalización, sin ubicación).
 *
 * Formas verificadas contra la documentación oficial el 28 sep 2026:
 *   Perplexity: /v1/agent (Sonar Chat Completions se retiró el 27 sep 2026)
 *   OpenAI: Responses API con la herramienta web_search, citas url_citation
 *   Gemini: generateContent con google_search; web.title trae el dominio
 *   Claude: Messages con web_search_20250305, citas web_search_result_location
 */

export type Respuesta = { texto: string; dominios: string[] }
export type Motor = { id: string; nombre: string; disponible: () => boolean; preguntar: (q: string) => Promise<Respuesta> }

const TIMEOUT = 90_000

export function dominioDe(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))]

async function json(res: Response, motor: string) {
  const cuerpo = await res.text()
  if (!res.ok) throw new Error(`${motor} ${res.status}: ${cuerpo.slice(0, 200)}`)
  return JSON.parse(cuerpo)
}

let anthropic: Anthropic | null = null

export const MOTORES: Motor[] = [
  {
    id: 'chatgpt',
    nombre: 'ChatGPT',
    disponible: () => !!process.env.OPENAI_API_KEY,
    async preguntar(q) {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.CITATION_OPENAI_MODEL ?? 'gpt-5.5', input: q, tools: [{ type: 'web_search' }] }),
        signal: AbortSignal.timeout(TIMEOUT),
      })
      const j = await json(res, 'OpenAI')
      const partes = (j.output ?? []).filter((o: { type: string }) => o.type === 'message').flatMap((o: { content?: unknown[] }) => o.content ?? []) as {
        text?: string
        annotations?: { type: string; url?: string }[]
      }[]
      return {
        texto: partes.map((p) => p.text ?? '').join('\n'),
        dominios: unicos(partes.flatMap((p) => (p.annotations ?? []).filter((a) => a.type === 'url_citation').map((a) => dominioDe(a.url ?? '')))),
      }
    },
  },
  {
    id: 'perplexity',
    nombre: 'Perplexity',
    disponible: () => !!process.env.PERPLEXITY_API_KEY,
    async preguntar(q) {
      const res = await fetch('https://api.perplexity.ai/v1/agent', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.CITATION_PERPLEXITY_MODEL ?? 'perplexity/sonar', input: q, tools: [{ type: 'web_search' }] }),
        signal: AbortSignal.timeout(TIMEOUT),
      })
      const j = await json(res, 'Perplexity')
      const salida = (j.output ?? []) as { type: string; content?: { text?: string }[]; results?: { url?: string }[] }[]
      return {
        texto: salida.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).map((c) => c.text ?? '').join('\n'),
        dominios: unicos(salida.filter((o) => o.type === 'search_results').flatMap((o) => (o.results ?? []).map((r) => dominioDe(r.url ?? '')))),
      }
    },
  },
  {
    id: 'gemini',
    nombre: 'Gemini',
    disponible: () => !!process.env.GEMINI_API_KEY,
    async preguntar(q) {
      const modelo = process.env.CITATION_GEMINI_MODEL ?? 'gemini-3.1-flash-lite'
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: q }] }], tools: [{ google_search: {} }] }),
        signal: AbortSignal.timeout(TIMEOUT),
      })
      const j = await json(res, 'Gemini')
      const c = j.candidates?.[0] ?? {}
      const chunks = (c.groundingMetadata?.groundingChunks ?? []) as { web?: { uri?: string; title?: string } }[]
      return {
        texto: (c.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''),
        // web.uri es un redirect de vertexaisearch; web.title trae el dominio.
        dominios: unicos(chunks.map((ch) => (ch.web?.title && /\./.test(ch.web.title) ? ch.web.title.replace(/^www\./, '').toLowerCase() : dominioDe(ch.web?.uri ?? '')))),
      }
    },
  },
  {
    id: 'claude',
    nombre: 'Claude',
    disponible: () => !!process.env.ANTHROPIC_API_KEY,
    async preguntar(q) {
      anthropic ??= new Anthropic()
      const res = await anthropic.messages.create(
        {
          model: process.env.CITATION_CLAUDE_MODEL ?? 'claude-haiku-4-5',
          max_tokens: 2_000,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
          messages: [{ role: 'user', content: q }],
        },
        { timeout: TIMEOUT },
      )
      const textos = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      return {
        texto: textos.map((b) => b.text).join(''),
        dominios: unicos(
          textos.flatMap((b) => (b.citations ?? []).map((ct) => (ct.type === 'web_search_result_location' ? dominioDe(ct.url) : null))),
        ),
      }
    },
  },
]

export const motoresDisponibles = () => MOTORES.filter((m) => m.disponible())
