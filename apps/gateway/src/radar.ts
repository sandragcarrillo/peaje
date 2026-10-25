import { Hono } from 'hono'
import { z } from 'zod'
import { env } from './env.js'
import { enviarCorreo } from './monitor/email.js'
import { store } from './store.js'

/**
 * Radar público, para el dashboard (secreto interno):
 *   POST /_internal/radar/leads    guarda (o actualiza) el email que pidió medir un dominio
 *   POST /_internal/radar/report   manda el reporte del dominio a ese email
 *
 * El dashboard calcula el reporte con los datos de Ora (lib/ora.ts) y lo
 * manda armado; acá se guarda, se evita el doble envío y se escribe el correo.
 */
export const radarRouter = new Hono()

radarRouter.onError((err, c) => {
  console.error('[radar] error no manejado', err)
  return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
})

radarRouter.use('/radar/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)
const dominio = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/)
const locale = z.enum(['es', 'en'])

const leadBody = z.object({
  email,
  domain: dominio,
  locale,
  marketingConsent: z.boolean(),
  source: z.string().max(40).optional(),
})

radarRouter.post('/radar/leads', async (c) => {
  const parsed = leadBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid-lead' }, 400)
  const lead = await store.upsertRadarLead({ ...parsed.data, source: parsed.data.source ?? 'radar' })
  return c.json({ lead })
})

const reportBody = z.object({
  email,
  domain: dominio,
  locale,
  score: z.number().min(0).max(100),
  grade: z.string().max(4),
  projected: z.number().min(0).max(100),
  projectedGrade: z.string().max(4),
  fixes: z
    .array(z.object({ name: z.string().max(200), recommendation: z.string().max(600).nullable(), points: z.number().nullable() }))
    .max(3),
})
export type ReporteRadar = z.infer<typeof reportBody>

/** Mismo reporte, al mismo email, como mucho una vez cada 10 minutos. */
const INTERVALO_MS = 10 * 60_000

radarRouter.post('/radar/report', async (c) => {
  const parsed = reportBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid-report' }, 400)
  const r = parsed.data

  // Quien ya dejó su email puede medir otros dominios: el lead de ese dominio
  // nace acá, sin consentimiento de tips (no lo dio para este).
  if (!(await store.getRadarLead(r.email, r.domain))) {
    await store.upsertRadarLead({ email: r.email, domain: r.domain, locale: r.locale, marketingConsent: false, source: 'radar' })
  }

  if (!process.env.RESEND_API_KEY || !process.env.AGENTS_FROM_EMAIL) {
    console.warn(`[radar] correo sin configurar (RESEND_API_KEY / AGENTS_FROM_EMAIL): no se manda el reporte de ${r.domain}`)
    return c.json({ sent: false, reason: 'email-not-configured' })
  }

  const tomado = await store.claimRadarReport(r.email, r.domain, new Date(Date.now() - INTERVALO_MS).toISOString())
  if (!tomado) return c.json({ sent: false, reason: 'recently-sent' })

  const { subject, html } = htmlReporteRadar(r)
  try {
    // TODO(San): definir a qué dirección llegan las respuestas para que las lea
    // Sandra. Sin RADAR_REPLY_TO, la respuesta va al remitente (AGENTS_FROM_EMAIL).
    await enviarCorreo(r.email, subject, html, { replyTo: process.env.RADAR_REPLY_TO || undefined })
  } catch (err) {
    console.error(`[radar] no se pudo mandar el reporte de ${r.domain}`, err)
    return c.json({ sent: false, reason: 'send-failed' })
  }
  return c.json({ sent: true })
})

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const estilo = 'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111'

const TEXTO = {
  es: {
    subject: (d: string, n: number) => `${d} en el radar de Peaje: ${n} de 100`,
    intro: (d: string) => `Mediste <strong>${d}</strong> en el radar de Peaje. Esto es lo que vio un agente de IA al llegar.`,
    hoy: 'Puntaje hoy',
    conPeaje: 'Con Peaje, hasta',
    falta: 'Lo primero que falta',
    puntos: (n: number) => `hasta ${n} puntos`,
    yaAlto: 'Tu sitio ya pasa todo lo que Peaje cubre. No hay nada urgente que arreglar.',
    verCompleto: 'Ver el resultado completo',
    instalar: 'Instalar Peaje en tu sitio',
    instalarTexto: 'Te registras con tu email y un comando en tu proyecto instala lo que falta.',
    nota: 'El puntaje lo calcula Ora (ora.ai), un medidor independiente. El número con Peaje estima lo que el kit arregla.',
    responde: 'Si respondes este correo, te lee Sandra.',
    firma: 'Sandra, de Peaje',
  },
  en: {
    subject: (d: string, n: number) => `${d} on the Peaje radar: ${n} out of 100`,
    intro: (d: string) => `You measured <strong>${d}</strong> on the Peaje radar. This is what an AI agent saw when it arrived.`,
    hoy: 'Score today',
    conPeaje: 'With Peaje, up to',
    falta: 'What is missing first',
    puntos: (n: number) => `up to ${n} points`,
    yaAlto: 'Your site already passes everything Peaje covers. Nothing urgent to fix.',
    verCompleto: 'See the full result',
    instalar: 'Install Peaje on your site',
    instalarTexto: 'Sign up with your email and one command in your project installs what is missing.',
    nota: 'The score comes from Ora (ora.ai), an independent scanner. The number with Peaje estimates what the kit fixes.',
    responde: 'If you reply to this email, Sandra reads it.',
    firma: 'Sandra, from Peaje',
  },
}

export function htmlReporteRadar(r: ReporteRadar): { subject: string; html: string } {
  const t = TEXTO[r.locale]
  const d = encodeURIComponent(r.domain)
  const radarUrl = `https://usepeaje.com/radar?d=${d}`
  const nuevoUrl = `https://usepeaje.com/nuevo?url=${d}`
  const sube = r.projected > r.score
  const fixes = r.fixes
    .map(
      (f) =>
        `<li style="margin-bottom:8px"><strong>${esc(f.name)}</strong>${f.points ? ` <span style="color:#666">(${esc(t.puntos(Math.round(f.points)))})</span>` : ''}${f.recommendation ? `<br><span style="color:#444">${esc(f.recommendation)}</span>` : ''}</li>`,
    )
    .join('')

  const html = `<div style="${estilo}">
<p>${t.intro(esc(r.domain))}</p>
<p style="font-size:17px"><strong>${t.hoy}: ${r.score} (${esc(r.grade)})</strong>${sube ? `<br><span style="color:#1f7280"><strong>${t.conPeaje} ~${r.projected} (${esc(r.projectedGrade)})</strong></span>` : ''}</p>
${sube && fixes ? `<p><strong>${t.falta}</strong></p><ol style="padding-left:20px">${fixes}</ol>` : `<p>${t.yaAlto}</p>`}
<p><a href="${radarUrl}">${t.verCompleto}</a></p>
<p><a href="${nuevoUrl}">${t.instalar}</a><br><span style="color:#666">${t.instalarTexto}</span></p>
<p style="color:#666;font-size:13px">${t.nota}</p>
<p>${t.responde}<br>${t.firma}</p>
</div>`
  return { subject: t.subject(r.domain, r.score), html }
}
