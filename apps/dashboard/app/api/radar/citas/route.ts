import { getLocale } from '@/lib/i18n'
import { citasDe } from '@/app/radar/citas'
import { dominioDeRadar } from '@/app/radar/dominio'

/**
 * La sección "la IA recomienda a otros" del radar la pide desde el navegador
 * (la medición la arranca en paralelo con Ora y el resultado la retoma). Así
 * los bots que abren un enlace compartido no disparan preguntas a los motores.
 *
 * POST por lo mismo que las sondas: GET /api/radar/:dominio puede tener precio.
 * Pública como el resultado del radar; el gasto lo frenan el tope por IP de
 * acá y el caché y el tope diario del gateway.
 */

export const maxDuration = 90

/** Pedidos al gateway por IP por hora (lo que sale del caché no cuenta). */
const TOPE = 10
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
  const body = (await req.json().catch(() => null)) as { dominio?: unknown; locale?: unknown } | null
  const dominio = dominioDeRadar(typeof body?.dominio === 'string' ? body.dominio : undefined)
  if (!dominio) return Response.json({ error: 'invalid-domain' }, { status: 400 })
  const locale = body?.locale === 'es' || body?.locale === 'en' ? body.locale : await getLocale()
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
  const r = await citasDe(dominio, locale, { puedeLlamar: () => dentroDelLimite(ip) })
  return Response.json(r, { headers: { 'cache-control': 'no-store' } })
}
