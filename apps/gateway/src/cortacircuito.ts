import type { Tenant } from '@peaje/db'

/**
 * Corte por origen caído. Si el origen de un negocio falla (5xx o sin
 * respuesta) N veces en M minutos, el gateway deja de ofrecer el 402 para ese
 * negocio durante un enfriamiento: ningún agente paga por algo que no se le
 * va a servir. Vale para todos los rieles. Al cortarse se avisa al dueño una
 * vez por enfriamiento, por Telegram (si lo conectó) y por correo.
 *
 * Estado en memoria del proceso: el gateway corre en un solo proceso.
 *   ORIGIN_BREAKER_FAILURES (3), ORIGIN_BREAKER_WINDOW_MINUTES (10),
 *   ORIGIN_BREAKER_COOLDOWN_MINUTES (15)
 */

const numero = (nombre: string, porDefecto: number) => {
  const n = Number(process.env[nombre])
  return Number.isFinite(n) && n > 0 ? n : porDefecto
}
const config = () => ({
  fallos: numero('ORIGIN_BREAKER_FAILURES', 3),
  ventanaMs: numero('ORIGIN_BREAKER_WINDOW_MINUTES', 10) * 60_000,
  enfriamientoMs: numero('ORIGIN_BREAKER_COOLDOWN_MINUTES', 15) * 60_000,
})

type Estado = { fallos: number[]; hasta: number | null }
const estados = new Map<string, Estado>()

let reloj = () => Date.now()
/** Solo para tests. */
export function fijarReloj(fn: () => number): void {
  reloj = fn
}

export type Avisador = (tenant: Tenant, hasta: Date) => Promise<void>
let avisador: Avisador = avisarAlDueno
/** Solo para tests. */
export function fijarAvisador(fn: Avisador): void {
  avisador = fn
}

/** Si el negocio está cortado, hasta cuándo. null = se cobra normal. */
export function cortado(tenantId: string): Date | null {
  const e = estados.get(tenantId)
  if (!e?.hasta) return null
  if (e.hasta > reloj()) return new Date(e.hasta)
  // Terminó el enfriamiento: se vuelve a cobrar con la cuenta en cero.
  estados.delete(tenantId)
  return null
}

/** Anota un fallo del origen. Devuelve true si este fallo cortó al negocio. */
export function registrarFalloOrigen(tenant: Tenant): boolean {
  const { fallos, ventanaMs, enfriamientoMs } = config()
  const ahora = reloj()
  const e = estados.get(tenant.id) ?? { fallos: [], hasta: null }
  if (e.hasta && e.hasta > ahora) return false
  e.fallos = [...e.fallos.filter((t) => ahora - t < ventanaMs), ahora]
  e.hasta = null
  estados.set(tenant.id, e)
  if (e.fallos.length < fallos) return false

  e.hasta = ahora + enfriamientoMs
  e.fallos = []
  const hasta = new Date(e.hasta)
  console.warn('[corte] origen caído: sin ofertas 402 hasta', hasta.toISOString(), { tenant: tenant.slug })
  void avisador(tenant, hasta).catch((error) => console.warn('[corte] no se pudo avisar al dueño', error instanceof Error ? error.message : error))
  return true
}

/** Cuerpo para el agente mientras el negocio está cortado. */
export function respuestaCortado(tenant: Pick<Tenant, 'name'>, hasta: Date): Response {
  const segundos = Math.max(1, Math.ceil((hasta.getTime() - reloj()) / 1000))
  return Response.json(
    {
      error: `Payments to ${tenant.name} are paused: its server failed several times in a row.`,
      hint: `You were not charged. Retry after ${segundos} seconds.`,
      code: 'origin-paused',
    },
    { status: 503, headers: { 'retry-after': String(segundos) } },
  )
}

/** Aviso al dueño por los canales que ya tiene (Telegram conectado, correo del negocio). */
async function avisarAlDueno(tenant: Tenant, hasta: Date): Promise<void> {
  const [{ store }, { tg }] = await Promise.all([import('./store.js'), import('./telegram/api.js')])
  const panel = `${process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'}/t/${tenant.slug}`
  const hora = hasta.toISOString().slice(11, 16)
  const texto = {
    es: `Tu sitio ${tenant.name} falló varias veces seguidas al responder pedidos pagos. Para que nadie pague sin recibir nada, Peaje dejó de cobrar hasta las ${hora} UTC. Revisa tu servidor: ${panel}`,
    en: `Your site ${tenant.name} failed several paid requests in a row. So nobody pays for nothing, Peaje stopped charging until ${hora} UTC. Check your server: ${panel}`,
  }
  const links = await store.listTelegramLinks(tenant.id).catch(() => [])
  for (const l of links) await tg('sendMessage', { chat_id: l.chatId, text: l.language === 'es' ? texto.es : texto.en })
  if (tenant.email && process.env.RESEND_API_KEY && process.env.AGENTS_FROM_EMAIL) {
    const { enviarCorreo } = await import('./monitor/email.js')
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    await enviarCorreo(tenant.email, `Peaje paused payments for ${tenant.name}`, `<p>${esc(texto.en)}</p><p>${esc(texto.es)}</p>`, {
      text: `${texto.en}\n\n${texto.es}`,
    })
  }
}
