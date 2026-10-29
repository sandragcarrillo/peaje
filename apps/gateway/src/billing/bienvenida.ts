import { PRECIOS_USD, type PlanPago, type Tenant } from '@peaje/db'
import { asistentesMedidos } from '@peaje/shared'
import { enviarCorreo, type Adjunto } from '../monitor/email.js'
import { LOGO_CID, LOGO_PNG_BASE64 } from './logo-correo.js'
import { store } from '../store.js'

/**
 * Correo de bienvenida de Peaje Pro. Lo manda Peaje, aparte del recibo de
 * Paddle, una sola vez por negocio: con el primer cobro de la suscripción
 * (transaction.completed) o, si ese envío falló, con el siguiente evento de la
 * misma suscripción en los días siguientes (ver paddle.ts).
 *
 * Idempotencia: antes de enviar se reserva tenants.welcome_sent_at con un
 * update condicional (solo si está en null). Reintentos de Paddle, eventos
 * duplicados y dos eventos que llegan a la vez: solo uno gana la reserva.
 * Si Resend falla, la reserva se suelta (vuelve a null) y el próximo evento
 * reintenta. Nunca hace fallar el webhook.
 *
 * El envío corre en segundo plano: Paddle espera la respuesta del webhook en
 * menos de 5 segundos y Resend puede tardar más.
 */

export type IdiomaBienvenida = 'es' | 'en'

const DASHBOARD = () => (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------- idioma

const idiomaDe = (x: unknown): IdiomaBienvenida | null => {
  if (typeof x !== 'string') return null
  const v = x.trim().toLowerCase()
  if (v.startsWith('es')) return 'es'
  if (v.startsWith('en')) return 'en'
  return null
}

/**
 * El idioma del dueño: el del checkout (customData.locale, si el dashboard lo
 * manda), el de su Telegram, el de su sitio (perfil de voz), y si no hay
 * nada, inglés como el dashboard.
 */
export async function idiomaDelDueno(tenant: Tenant, custom?: Record<string, unknown> | null): Promise<IdiomaBienvenida> {
  const delCheckout = idiomaDe(custom?.locale) ?? idiomaDe(custom?.language)
  if (delCheckout) return delCheckout
  const links = await store.listTelegramLinks(tenant.id).catch(() => [])
  const tg = links.find((l) => l.active) ?? links[0]
  const deTelegram = idiomaDe(tg?.language)
  if (deTelegram) return deTelegram
  return idiomaDe(tenant.voiceProfile?.language) ?? 'en'
}

// ---------------------------------------------------------------- texto

type Copia = {
  subject: string
  preheader: string
  titulo: string
  gracias: string
  founder: string | null
  intro: string
  puede: string[]
  pasosTitulo: string
  pasos: { texto: string; link?: { href: string; label: string } }[]
  boton: string
  cancelar: { antes: string; link: string; despues: string }
  recibo: string
  responder: string
  terminos: string
  privacidad: string
}

function copia(idioma: IdiomaBienvenida, plan: PlanPago, negocio: string, urls: { agente: string; telegram: string; plan: string }): Copia {
  const precio = PRECIOS_USD[plan]
  if (idioma === 'es') {
    const nombre = plan === 'founder' ? 'Peaje Pro founder' : 'Peaje Pro'
    return {
      subject: 'Tu agente de Peaje ya está activo',
      preheader: `Qué hace por ${negocio} y tres pasos para empezar.`,
      titulo: 'Tu agente ya está activo',
      gracias: `Gracias por suscribirte a ${nombre}, US$${precio} al mes.`,
      founder: plan === 'founder' ? 'Mantienes este precio mientras tu suscripción siga activa.' : null,
      intro: `Desde hoy tu agente trabaja para ${negocio}. Esto es lo que hace:`,
      puede: [
        `Te dice qué falta para que ${asistentesMedidos('es')} te encuentren y te recomienden, y mide cada semana si te citan.`,
        'Te muestra qué tipo de páginas cita la IA para tus preguntas y escribe las tuyas en la voz de tu marca, una página o una serie completa.',
        'Deja cada arreglo listo como tarea para Claude Code o Cursor, y lo revisa en tu sitio cuando lo publicas.',
        'Te cuenta cuántos agentes de IA visitaron tu sitio, cada día, cada semana o cada mes, como prefieras.',
        'Puedes hablarle en tu panel o en Telegram.',
      ],
      pasosTitulo: 'Para empezar',
      pasos: [
        { texto: 'Conecta Telegram para hablarle desde el celular.', link: { href: urls.telegram, label: 'Conectar Telegram' } },
        { texto: 'Pídele a tu agente que arme tu plan. Escríbele “arma mi plan”. Si le falta algo, te pregunta.' },
        { texto: 'Elige cada cuánto quieres tu informe de visitas. Díselo al agente y te llega por Telegram.' },
      ],
      boton: 'Ir a mi agente',
      cancelar: { antes: 'Cancelas cuando quieras desde tu panel, en ', link: 'Gestionar suscripción', despues: '.' },
      recibo: 'El recibo de tu pago te lo manda Paddle.',
      responder: 'Si respondes este correo, te contesta el equipo de Peaje.',
      terminos: 'Términos',
      privacidad: 'Privacidad',
    }
  }
  const nombre = plan === 'founder' ? 'Peaje Pro founder' : 'Peaje Pro'
  return {
    subject: 'Your Peaje agent is live',
    preheader: `What it does for ${negocio} and three steps to get started.`,
    titulo: 'Your agent is live',
    gracias: `Thanks for subscribing to ${nombre}, US$${precio} a month.`,
    founder: plan === 'founder' ? 'You keep this price while your subscription stays active.' : null,
    intro: `From today your agent works for ${negocio}. Here is what it does:`,
    puede: [
      `Tells you what is missing for ${asistentesMedidos('en')} to find and recommend you, and checks every week whether they cite you.`,
      'Shows you which kinds of pages AI cites for your questions and writes yours in your brand’s voice, one page or a whole series.',
      'Turns each fix into a task for Claude Code or Cursor, and checks it on your site once you publish it.',
      'Tells you how many AI agents visited your site, every day, week or month, whichever you prefer.',
      'You can talk to it in your dashboard or on Telegram.',
    ],
    pasosTitulo: 'To get started',
    pasos: [
      { texto: 'Connect Telegram so you can talk to it from your phone.', link: { href: urls.telegram, label: 'Connect Telegram' } },
      { texto: 'Ask your agent to build your plan. Write “build my plan”. If it needs something, it asks.' },
      { texto: 'Choose how often you want your visits report. Tell the agent and it arrives on Telegram.' },
    ],
    boton: 'Go to my agent',
    cancelar: { antes: 'Cancel anytime from your dashboard, under ', link: 'Manage subscription', despues: '.' },
    recibo: 'Paddle sends you the receipt for your payment.',
    responder: 'If you reply to this email, the Peaje team answers.',
    terminos: 'Terms',
    privacidad: 'Privacy',
  }
}

// ---------------------------------------------------------------- html

const TINTA = '#1c1b19'
const SUAVE = '#6b675f'
const ACENTO = '#1f7280'
const CREMA = '#fdf9f0'
const BORDE = '#ece5d6'
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export type CorreoBienvenida = { subject: string; preheader: string; html: string; text: string; adjuntos: Adjunto[] }

export function correoBienvenida(o: { idioma: IdiomaBienvenida; plan: PlanPago; slug: string; negocio: string; base?: string }): CorreoBienvenida {
  const base = (o.base ?? DASHBOARD()).replace(/\/$/, '')
  const agente = `${base}/t/${encodeURIComponent(o.slug)}/agente`
  // Telegram vive en Integraciones (antes, en Mi agente).
  const urls = { agente, telegram: `${base}/t/${encodeURIComponent(o.slug)}/integraciones#telegram`, plan: `${agente}#plan` }
  // Embebido: se ve aunque el programa de correo bloquee imágenes externas.
  const logo = `cid:${LOGO_CID}`
  const c = copia(o.idioma, o.plan, o.negocio, urls)

  const p = (html: string, extra = '') => `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;line-height:1.55;color:${TINTA};${extra}">${html}</p>`
  const link = (href: string, texto: string) => `<a href="${esc(href)}" class="acento" style="color:${ACENTO};text-decoration:underline">${esc(texto)}</a>`

  // Viñetas y pasos en tabla: Outlook rompe las sangrías de <ul> y <ol>.
  const filaLista = (marca: string, html: string, ultima: boolean) => `<tr>
<td valign="top" width="28" class="acento" style="width:28px;padding:0 0 ${ultima ? 0 : 12}px;font-family:${FUENTE};font-size:16px;line-height:1.55;color:${ACENTO};font-weight:600">${marca}</td>
<td valign="top" class="tinta" style="padding:0 0 ${ultima ? 0 : 12}px;font-family:${FUENTE};font-size:16px;line-height:1.55;color:${TINTA}">${html}</td>
</tr>`
  const lista = (filas: string[]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px">${filas.join('')}</table>`

  const puede = lista(c.puede.map((t, i) => filaLista('&#8226;', esc(t), i === c.puede.length - 1)))
  const pasos = lista(c.pasos.map((s, i) => filaLista(`${i + 1}.`, `${esc(s.texto)}${s.link ? `<br>${link(s.link.href, s.link.label)}` : ''}`, i === c.pasos.length - 1)))

  const boton = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px">
<tr><td align="center" bgcolor="${ACENTO}" style="background:${ACENTO};border-radius:8px">
<a href="${esc(agente)}" style="display:inline-block;padding:14px 26px;font-family:${FUENTE};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px">${esc(c.boton)}</a>
</td></tr></table>`

  const pie = (html: string) => `<p class="suave" style="margin:0 0 8px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${SUAVE}">${html}</p>`

  const html = `<!doctype html>
<html lang="${o.idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(c.subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .fondo { background:#141311 !important; }
    .tarjeta { background:#1f1e1b !important; border-color:#34312b !important; }
    .tinta, .tinta p { color:#f1ece2 !important; }
    .suave { color:#b3ada2 !important; }
    .linea { border-color:#34312b !important; }
    .acento { color:#7cc4cf !important; }
  }
  @media (max-width:600px) {
    .tarjeta-pad { padding:28px 22px !important; }
  }
</style>
</head>
<body class="fondo" style="margin:0;padding:0;background:${CREMA}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${CREMA}">${esc(c.preheader)}${'&#8199;&#65279;&#847;'.repeat(40)}</div>
<table role="presentation" class="fondo" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREMA}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
<tr><td style="padding:0 4px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding:0 10px 0 0"><img src="${esc(logo)}" width="40" height="40" alt="Peaje" style="display:block;width:40px;height:40px;border:0;border-radius:9px"></td>
<td valign="middle" class="tinta" style="font-family:${FUENTE};font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${TINTA}">Peaje</td>
</tr></table>
</td></tr>
<tr><td class="tarjeta tarjeta-pad tinta" style="background:#ffffff;border:1px solid ${BORDE};border-radius:12px;padding:36px 36px 28px">
<h1 class="tinta" style="margin:0 0 20px;font-family:${FUENTE};font-size:24px;line-height:1.25;font-weight:700;color:${TINTA}">${esc(c.titulo)}</h1>
${p(`${esc(c.gracias)}${c.founder ? ` ${esc(c.founder)}` : ''}`)}
${p(esc(c.intro), 'margin-bottom:14px')}
${puede}
<h2 class="tinta" style="margin:0 0 14px;font-family:${FUENTE};font-size:18px;line-height:1.3;font-weight:700;color:${TINTA}">${esc(c.pasosTitulo)}</h2>
${pasos}
${boton}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="linea" style="border-top:1px solid ${BORDE};padding-top:20px">
${pie(`${esc(c.cancelar.antes)}${link(urls.plan, c.cancelar.link)}${esc(c.cancelar.despues)} ${esc(c.recibo)}`)}
${pie(esc(c.responder))}
${pie(`${link(`${base}/terms`, c.terminos)} &nbsp;&middot;&nbsp; ${link(`${base}/privacy`, c.privacidad)}`)}
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    c.titulo,
    '',
    `${c.gracias}${c.founder ? ` ${c.founder}` : ''}`,
    '',
    c.intro,
    ...c.puede.map((t) => `- ${t}`),
    '',
    `${c.pasosTitulo}:`,
    ...c.pasos.map((s, i) => `${i + 1}. ${s.texto}${s.link ? ` ${s.link.href}` : ''}`),
    '',
    `${c.boton}: ${agente}`,
    '',
    '--',
    `${c.cancelar.antes}${c.cancelar.link}${c.cancelar.despues} ${urls.plan}`,
    c.recibo,
    c.responder,
    `${c.terminos}: ${base}/terms`,
    `${c.privacidad}: ${base}/privacy`,
  ].join('\n')

  const adjuntos: Adjunto[] = [{ filename: 'peaje-logo.png', content: LOGO_PNG_BASE64, content_id: LOGO_CID }]
  return { subject: c.subject, preheader: c.preheader, html, text, adjuntos }
}

// ---------------------------------------------------------------- envío

export type ResultadoBienvenida = 'sent' | 'already-sent' | 'no-email' | 'not-configured' | 'failed'

/** Reserva, manda y, si Resend falla, suelta la reserva. Nunca tira. */
export async function mandarBienvenida(o: { tenant: Tenant; plan: PlanPago; custom?: Record<string, unknown> | null }): Promise<ResultadoBienvenida> {
  const { tenant, plan } = o
  if (!tenant.email) {
    console.warn('[bienvenida] el negocio no tiene correo', { tenant: tenant.slug })
    return 'no-email'
  }
  if (!process.env.RESEND_API_KEY || !process.env.AGENTS_FROM_EMAIL) {
    // Sin reservar: cuando se configure, el próximo evento de la suscripción la manda.
    console.warn('[bienvenida] falta RESEND_API_KEY o AGENTS_FROM_EMAIL', { tenant: tenant.slug })
    return 'not-configured'
  }
  const at = new Date().toISOString()
  try {
    if (!(await store.claimWelcomeEmail(tenant.id, at))) return 'already-sent'
  } catch (error) {
    // Sin la columna (migración 20261026000000 sin correr) no se manda: sin reserva no hay idempotencia.
    console.error('[bienvenida] no se pudo reservar el envío', { tenant: tenant.slug }, error)
    return 'failed'
  }
  try {
    const idioma = await idiomaDelDueno(tenant, o.custom)
    const correo = correoBienvenida({ idioma, plan, slug: tenant.slug, negocio: tenant.name })
    await enviarCorreo(tenant.email, correo.subject, correo.html, { text: correo.text, replyTo: process.env.RADAR_REPLY_TO || undefined, attachments: correo.adjuntos })
    console.log('[bienvenida] enviada', { tenant: tenant.slug, plan, idioma })
    return 'sent'
  } catch (error) {
    console.error('[bienvenida] Resend falló; se suelta la reserva para reintentar con el próximo evento', { tenant: tenant.slug }, error)
    await store.releaseWelcomeEmail(tenant.id, at).catch((e) => console.error('[bienvenida] no se pudo soltar la reserva', { tenant: tenant.slug }, e))
    return 'failed'
  }
}

const pendientes = new Set<Promise<ResultadoBienvenida>>()

/** Manda en segundo plano: el webhook responde sin esperar a Resend. */
export function programarBienvenida(o: Parameters<typeof mandarBienvenida>[0]): void {
  const p: Promise<ResultadoBienvenida> = mandarBienvenida(o).finally(() => pendientes.delete(p))
  pendientes.add(p)
}

/** Para tests (y un apagado ordenado): espera los envíos en curso. */
export async function esperarBienvenidas(): Promise<ResultadoBienvenida[]> {
  const hechos: ResultadoBienvenida[] = []
  while (pendientes.size) hechos.push(...(await Promise.all([...pendientes])))
  return hechos
}
