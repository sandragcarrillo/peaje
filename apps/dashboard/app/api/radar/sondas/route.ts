import { cookies } from 'next/headers'
import { dominioDeRadar } from '@/app/radar/dominio'
import { sondear } from '@/lib/radar/sondas'
import type { EventoSonda } from '@/lib/radar/sondas-tipos'

/**
 * Sondas en vivo del radar: mientras Ora mide, revisa robots.txt, sitemap,
 * llms.txt, MCP, OpenAPI, JSON-LD, precios y formas de pago publicadas, y lo
 * cuenta en NDJSON (una línea por evento, ver lib/radar/sondas-tipos.ts).
 *
 * POST y no GET: el sitio "peaje" puede ponerle precio a GET /api/radar/:dominio
 * (docs/sql/peaje-radar-route.sql) y ese patrón también tomaría
 * /api/radar/sondas. Pide la misma cookie que medir: solo corre para quien
 * ya dejó su correo.
 */

export const maxDuration = 45

/** Rondas por IP por hora (medir permite 6). */
const TOPE = 12
const ventana = new Map<string, number[]>()

function dentroDelLimite(ip: string): boolean {
  const ahora = Date.now()
  const lista = (ventana.get(ip) ?? []).filter((t) => ahora - t < 3_600_000)
  if (lista.length >= TOPE) return false
  lista.push(ahora)
  ventana.set(ip, lista)
  if (ventana.size > 5_000) ventana.clear()
  return true
}

export async function POST(req: Request) {
  if (!(await cookies()).get('peaje_radar_email')?.value) {
    return Response.json({ error: 'sin-correo' }, { status: 401 })
  }
  const body = (await req.json().catch(() => null)) as { dominio?: unknown } | null
  const dominio = dominioDeRadar(typeof body?.dominio === 'string' ? body.dominio : undefined)
  if (!dominio) return Response.json({ error: 'invalid-domain' }, { status: 400 })
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
  if (!dentroDelLimite(ip)) return Response.json({ error: 'limit' }, { status: 429 })

  const corte = new AbortController()
  req.signal.addEventListener('abort', () => corte.abort())
  const codificador = new TextEncoder()
  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      let abierto = true
      const emitir = (e: EventoSonda) => {
        if (!abierto) return
        try {
          controller.enqueue(codificador.encode(`${JSON.stringify(e)}\n`))
        } catch {
          abierto = false
        }
      }
      try {
        await sondear(dominio, emitir, { signal: corte.signal })
      } catch (err) {
        console.error(`[radar] sondas de ${dominio} fallaron`, err)
      }
      emitir({ tipo: 'fin' })
      if (abierto) {
        try {
          controller.close()
        } catch {
          // el cliente ya se fue
        }
      }
    },
    cancel() {
      corte.abort()
    },
  })

  return new Response(flujo, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  })
}
