import type { Agent, AgentRun } from '@peaje/db'
import { store } from '../store.js'

/**
 * Entrega del resultado a la persona. Un agente que compra cada 15 días y no
 * avisa no sirve: nadie va a estar mirando el panel ese día.
 *
 *   dashboard  queda en la bitácora (default, sin dependencias)
 *   webhook    POST del resultado a una URL del usuario
 *   email      correo (requiere RESEND_API_KEY y AGENTS_FROM_EMAIL)
 *
 * Falla suave y deja registro: si la entrega falla, la compra ya se hizo y el
 * resultado sigue estando en la bitácora.
 */

export type Entregable = {
  agente: string
  mision: string
  servicio: string | null
  url: string | null
  monto: string | null
  red: string | null
  receipt: string | null
  justificacion: string | null
  resultado: string
  fecha: string
}

export function armarEntregable(agent: Agent, run: AgentRun, resultado: string): Entregable {
  const d = (run.decision ?? {}) as {
    elegido?: { nombre?: string } | null
    justificacion?: string | null
  }
  return {
    agente: agent.name,
    mision: agent.mission,
    servicio: d.elegido?.nombre ?? null,
    url: run.targetUrl,
    monto: run.amount,
    red: run.network,
    receipt: run.receiptRef,
    justificacion: d.justificacion ?? null,
    resultado,
    fecha: run.createdAt,
  }
}

async function porWebhook(destino: string, cuerpo: Entregable): Promise<void> {
  const res = await fetch(destino, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'peaje-agent/1.0' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`El webhook respondió ${res.status}`)
}

async function porEmail(destino: string, cuerpo: Entregable): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.AGENTS_FROM_EMAIL
  if (!key || !from) {
    throw new Error('Falta RESEND_API_KEY o AGENTS_FROM_EMAIL en el gateway')
  }

  const html = [
    `<p>Tu agente <strong>${escapar(cuerpo.agente)}</strong> compró algo para ti.</p>`,
    cuerpo.servicio ? `<p><strong>Servicio:</strong> ${escapar(cuerpo.servicio)}</p>` : '',
    cuerpo.monto ? `<p><strong>Costo:</strong> $${escapar(cuerpo.monto)} en ${escapar(cuerpo.red ?? '')}</p>` : '',
    cuerpo.justificacion ? `<p><strong>Por qué lo eligió:</strong><br>${escapar(cuerpo.justificacion)}</p>` : '',
    `<hr><pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px">${escapar(
      cuerpo.resultado.slice(0, 20_000),
    )}</pre>`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: destino,
      subject: `${cuerpo.agente}: ${cuerpo.servicio ?? 'nuevo resultado'}`,
      html,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`)
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Entrega el resultado y deja constancia en la corrida. Nunca lanza. */
export async function entregar(agent: Agent, run: AgentRun, resultado: string): Promise<void> {
  if (agent.deliveryKind === 'dashboard' || !agent.deliveryTarget) {
    await store.markRunDelivered(run.id).catch(() => {})
    return
  }

  const cuerpo = armarEntregable(agent, run, resultado)
  try {
    if (agent.deliveryKind === 'webhook') await porWebhook(agent.deliveryTarget, cuerpo)
    else if (agent.deliveryKind === 'email') await porEmail(agent.deliveryTarget, cuerpo)
    await store.markRunDelivered(run.id)
    console.log(`[agents] resultado entregado por ${agent.deliveryKind} a ${agent.deliveryTarget}`)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message.slice(0, 300) : 'Error al entregar'
    console.warn('[agents] no se pudo entregar el resultado:', mensaje)
    await store.markRunDelivered(run.id, mensaje).catch(() => {})
  }
}
