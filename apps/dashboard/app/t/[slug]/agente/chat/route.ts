import { getLocale } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'

/**
 * Pasa al navegador el stream del agente (SSE): estados en vivo mientras usa
 * herramientas y el mensaje final. El secreto interno del gateway queda acá.
 */
export const maxDuration = 300

const base = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:8787'
const secret = process.env.INTERNAL_API_SECRET ?? ''

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireTenant(slug)
  const { text } = (await req.json().catch(() => ({}))) as { text?: string }
  let res: Response
  try {
    res = await fetch(`${base}/_internal/${slug}/tasks/chat/stream`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text, language: await getLocale(), channel: 'dashboard' }),
      cache: 'no-store',
    })
  } catch {
    return new Response('event: error\ndata: gateway-unreachable\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  if (!res.ok || !res.body) {
    const detalle = await res.text().catch(() => '')
    return new Response(`event: error\ndata: ${detalle.replace(/\n/g, ' ').slice(0, 300) || res.status}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
  }
  return new Response(res.body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform' } })
}
