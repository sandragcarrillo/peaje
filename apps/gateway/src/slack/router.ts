import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { env } from '../env.js'
import { store } from '../store.js'
import { bandeja, canjearCodigo, cifrar, configurado, modoPrueba, signingSecret, urlAutorizar, verificarFirma } from './api.js'
import { destinoSlack, enlaceParaInstalar, procesarEvento, procesarInteraccion, type PayloadInteraccion, type SobreEventos } from './bot.js'
// Registra Slack como canal de los reportes programados.
import './reportes.js'
// ---- M9 ----
import { sinPro } from '../billing/acceso.js'

/**
 *   GET  /slack/install?code=…               redirige al OAuth de Slack (state = código del dashboard)
 *   GET  /slack/oauth/callback               canjea el código, guarda la instalación
 *   POST /slack/events                       Events API (app_mention, message.im, app_uninstalled)
 *   POST /slack/interactions                 clics en botones de Block Kit
 *   POST /_internal/:slug/slack/link         enlace de instalación de un solo uso
 *   GET  /_internal/:slug/slack              canales conectados
 *   DELETE /_internal/:slug/slack            desconecta todos (o uno con ?team=&channel=)
 *   GET  /_internal/slack/outbox             lo que el bot habría mandado (solo modo prueba)
 */
export const slackRouter = new Hono()

const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')
const COOKIE = 'peaje_slack_state'

/**
 * Firma v0 de Slack sobre el cuerpo crudo. Con SLACK_SIGNING_SECRET se exige
 * siempre; sin él (modo prueba) solo se acepta desde localhost, como Telegram.
 */
function firmaValida(c: Context, cuerpo: string): boolean {
  const secreto = signingSecret()
  if (secreto) return verificarFirma(secreto, c.req.header('x-slack-request-timestamp'), cuerpo, c.req.header('x-slack-signature'))
  return modoPrueba() && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.req.header('host') ?? '')
}

// Una fila por conversación (`team:canal`): los mensajes del mismo canal se contestan en orden.
const filas = new Map<string, Promise<void>>()
function encolar(clave: string, tarea: () => Promise<void>): void {
  const previa = filas.get(clave) ?? Promise.resolve()
  const siguiente = previa.then(tarea).catch((e) => console.error('[slack]', clave, e))
  filas.set(clave, siguiente)
  void siguiente.finally(() => {
    if (filas.get(clave) === siguiente) filas.delete(clave)
  })
}
/** Para los tests: espera a que se vacíen las filas. */
export async function esperarFilas(): Promise<void> {
  while (filas.size) await Promise.all([...filas.values()])
}

slackRouter.post('/slack/events', async (c) => {
  const cuerpo = await c.req.text()
  if (!firmaValida(c, cuerpo)) return c.json({ ok: false }, 401)
  let sobre: SobreEventos
  try {
    sobre = JSON.parse(cuerpo) as SobreEventos
  } catch {
    return c.json({ ok: false }, 400)
  }
  if (sobre.type === 'url_verification') return c.json({ challenge: sobre.challenge ?? '' })
  if (sobre.type !== 'event_callback' || !sobre.event) return c.body(null, 200)
  // Slack espera un 2xx en 3 s y reintenta hasta 3 veces: event_id se marca una sola vez.
  if (sobre.event_id) {
    const nuevo = await store.claimSlackEvent(sobre.event_id).catch(() => true)
    if (!nuevo) return c.body(null, 200)
  }
  encolar(destinoSlack(sobre.team_id ?? '', sobre.event.channel ?? ''), () => procesarEvento(sobre))
  return c.body(null, 200)
})

slackRouter.post('/slack/interactions', async (c) => {
  const cuerpo = await c.req.text()
  if (!firmaValida(c, cuerpo)) return c.json({ ok: false }, 401)
  let p: PayloadInteraccion
  try {
    p = JSON.parse(new URLSearchParams(cuerpo).get('payload') ?? '') as PayloadInteraccion
  } catch {
    return c.json({ ok: false }, 400)
  }
  const team = p.team?.id ?? p.user?.team_id ?? ''
  const canal = p.channel?.id ?? p.container?.channel_id ?? ''
  encolar(destinoSlack(team, canal), () => procesarInteraccion(p))
  // Acuse vacío en menos de 3 s; la respuesta va después por chat.postMessage.
  return c.body(null, 200)
})

const pagina = (titulo: string, cuerpo: string, idioma: 'es' | 'en' = 'en') => `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:0 16px;line-height:1.5;color:#111;background:#fff}
a.b{display:inline-block;margin-top:12px;margin-right:12px;padding:10px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none}
code{background:#f2f2f2;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>${titulo}</h1>${cuerpo}</body></html>`

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

slackRouter.get('/slack/install', async (c) => {
  const codigo = c.req.query('code') ?? ''
  const pendiente = codigo ? await store.getSlackCode(codigo) : null
  if (!pendiente) {
    return c.html(pagina('Link expired', '<p>This link was already used or expired. Get a new one in "My agent" → "Add to Slack".</p><p>Este enlace ya se usó o venció. Genera uno nuevo en "Mi agente" → "Agregar a Slack".</p>'), 410)
  }
  // El state es el código del dashboard; la cookie ata el OAuth a este navegador.
  setCookie(c, COOKIE, codigo, { httpOnly: true, secure: !modoPrueba(), sameSite: 'Lax', path: '/slack', maxAge: 60 * 60 })
  return c.redirect(urlAutorizar(codigo), 302)
})

slackRouter.get('/slack/oauth/callback', async (c) => {
  const state = c.req.query('state') ?? ''
  const pendiente = state ? await store.getSlackCode(state) : null
  const idioma = pendiente?.language === 'es' ? 'es' : 'en'
  const es = idioma === 'es'
  const volver = (slug?: string) => `<a class="b" href="${esc(slug ? `${DASHBOARD}/t/${slug}/agente` : DASHBOARD)}">${es ? 'Volver a Peaje' : 'Back to Peaje'}</a>`
  if (!pendiente || getCookie(c, COOKIE) !== state) {
    return c.html(pagina(es ? 'No se pudo instalar' : 'Could not install', `<p>${es ? 'El enlace venció o se abrió en otro navegador. Vuelve a tocar "Agregar a Slack" en "Mi agente".' : 'The link expired or was opened in another browser. Tap "Add to Slack" again in "My agent".'}</p>${volver()}`, idioma), 400)
  }
  const tenant = await store.getTenantById(pendiente.tenantId)
  if (!tenant) return c.html(pagina('Not found', '<p>Business not found.</p>'), 404)
  if (c.req.query('error')) {
    return c.html(pagina(es ? 'Instalación cancelada' : 'Install cancelled', `<p>${es ? 'No se instaló nada. Puedes intentarlo de nuevo cuando quieras.' : 'Nothing was installed. You can try again anytime.'}</p>${volver(tenant.slug)}`, idioma))
  }
  const bloqueo = sinPro(tenant, idioma)
  if (bloqueo) return c.html(pagina('Peaje Pro', `<p>${esc(bloqueo.message)}</p>${volver(tenant.slug)}`, idioma), 403)
  const r = await canjearCodigo(c.req.query('code') ?? '').catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'fetch_failed' }))
  if (!r.ok || !('access_token' in r) || !r.access_token || !r.bot_user_id || !r.authed_user?.id) {
    console.warn('[slack] oauth.v2.access', r.error)
    return c.html(pagina(es ? 'No se pudo instalar' : 'Could not install', `<p>${es ? 'Slack no confirmó la instalación' : 'Slack did not confirm the install'} (${esc(r.error ?? 'unknown')}).</p>${volver(tenant.slug)}`, idioma), 502)
  }
  // Instalación de toda la organización (Enterprise Grid): no hay team y el modelo es por workspace.
  if (r.is_enterprise_install || !r.team?.id) {
    return c.html(pagina(es ? 'No se pudo instalar' : 'Could not install', `<p>${es ? 'Peaje se instala en un workspace, no en toda la organización. Instálalo desde el workspace donde está tu equipo.' : 'Peaje installs in a workspace, not across the whole organization. Install it from the workspace where your team is.'}</p>${volver(tenant.slug)}`, idioma), 400)
  }
  await store.saveSlackInstall({
    teamId: r.team.id,
    teamName: r.team.name ?? null,
    enterpriseId: r.enterprise?.id ?? null,
    botTokenEnc: cifrar(r.access_token),
    botUserId: r.bot_user_id,
    installerUserId: r.authed_user.id,
  })
  // El código queda atado a este workspace y a quien instaló: su próxima mención conecta el canal.
  await store.bindSlackCode(state, r.team.id, r.authed_user.id, new Date(Date.now() + 24 * 60 * 60_000).toISOString())
  setCookie(c, COOKIE, '', { path: '/slack', maxAge: 0 })
  const abrir = r.app_id ? `<a class="b" href="${esc(`https://slack.com/app_redirect?app=${r.app_id}&team=${r.team.id}`)}">${es ? 'Abrir Slack' : 'Open Slack'}</a>` : ''
  const cuerpo = es
    ? `<p>Peaje quedó instalado en <b>${esc(r.team.name ?? r.team.id)}</b>. Falta un paso para conectar un canal a <b>${esc(tenant.name)}</b>:</p>
<ol><li>En el canal donde quieres usarlo, escribe <code>/invite @Peaje</code>.</li><li>Menciona a <code>@Peaje</code> en ese canal (por ejemplo, <code>@Peaje hola</code>). Ese canal queda conectado.</li></ol>
<p>También puedes escribirle por mensaje directo. Cualquiera del canal puede preguntar; los cambios de precio o de rutas solo los apruebas tú.</p>${abrir}${volver(tenant.slug)}`
    : `<p>Peaje is installed in <b>${esc(r.team.name ?? r.team.id)}</b>. One step left to connect a channel to <b>${esc(tenant.name)}</b>:</p>
<ol><li>In the channel where you want it, type <code>/invite @Peaje</code>.</li><li>Mention <code>@Peaje</code> in that channel (for example, <code>@Peaje hi</code>). That channel gets connected.</li></ol>
<p>You can also message it directly. Anyone in the channel can ask; only you approve price or route changes.</p>${abrir}${volver(tenant.slug)}`
  return c.html(pagina(es ? 'Peaje está en tu Slack' : 'Peaje is in your Slack', cuerpo, idioma))
})

slackRouter.use('/_internal/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

slackRouter.get('/_internal/slack/outbox', (c) => c.json({ testMode: modoPrueba(), outbox: modoPrueba() ? bandeja : [] }))

slackRouter.post('/_internal/:slug/slack/link', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const bloqueo = sinPro(tenant) // M9: Slack es Pro, como Telegram
  if (bloqueo) return c.json(bloqueo, 403)
  const body = (await c.req.json().catch(() => ({}))) as { language?: string }
  return c.json(await enlaceParaInstalar(tenant, body.language === 'es' ? 'es' : 'en'))
})

slackRouter.get('/_internal/:slug/slack', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const links = await store.listSlackLinks(tenant.id)
  const equipos = new Map<string, string | null>()
  for (const l of links) if (!equipos.has(l.teamId)) equipos.set(l.teamId, (await store.getSlackInstall(l.teamId))?.teamName ?? null)
  return c.json({
    configured: configurado(),
    links: links.map((l) => ({
      teamId: l.teamId,
      teamName: equipos.get(l.teamId) ?? null,
      channelId: l.channelId,
      direct: l.channelId.startsWith('D'),
      url: `https://slack.com/app_redirect?team=${l.teamId}&channel=${l.channelId}`,
      language: l.language,
      linkedAt: l.linkedAt,
    })),
  })
})

slackRouter.delete('/_internal/:slug/slack', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const teamId = c.req.query('team') || undefined
  const channelId = c.req.query('channel') || undefined
  await store.unlinkSlack({ tenantId: tenant.id, teamId, channelId })
  // Lo programado para esos canales se va con la conexión.
  await store
    .deleteReportSchedules(tenant.id, teamId && channelId ? { channel: 'slack', target: destinoSlack(teamId, channelId) } : { channel: 'slack' })
    .catch(() => 0)
  return c.json({ ok: true })
})
