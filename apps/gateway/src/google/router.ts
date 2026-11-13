import { dominioVerificable } from '@peaje/shared'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { sinPro } from '../billing/acceso.js'
import { env } from '../env.js'
import { store } from '../store.js'
import { canjearCodigo, cifrar, configurado, elegirPropiedad, firmarEstado, leerEstado, listarPropiedades, revocar, SCOPE_CONSOLA, urlAutorizar, urlInstalar } from './api.js'

/**
 *   GET    /google/install?state=…          pone la cookie y redirige al consentimiento de Google
 *   GET    /google/oauth/callback           canjea el código, elige la propiedad del sitio, guarda la conexión y vuelve a Integraciones (?google=)
 *   POST   /_internal/:slug/google/link     enlace para conectar (state firmado, 30 min)
 *   GET    /_internal/:slug/google          estado de la conexión
 *   PUT    /_internal/:slug/google/property cambia la propiedad entre las que ve la cuenta
 *   DELETE /_internal/:slug/google          revoca en Google y borra la conexión
 */
export const googleRouter = new Hono()

const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')
const COOKIE = 'peaje_google_state'
const seguro = () => env.publicUrl.startsWith('https://')

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Solo para un enlace vencido o sin configurar, cuando no se sabe de qué negocio es. Colores de Peaje, claro y oscuro.
const pagina = (titulo: string, cuerpo: string, idioma: 'es' | 'en') => `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${esc(titulo)}</title>
<style>:root{--bg:#fdf9f0;--panel:#f7f3ea;--borde:#cbc6bd;--texto:#1c1c16;--suave:#494740;--acento:#1f7280;--sobre:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161512;--panel:#201f1c;--borde:#38362f;--texto:#f4f0e7;--suave:#a49e92;--acento:#a2dae2;--sobre:#1c1b19}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--texto);font:16px/1.55 ui-sans-serif,system-ui,sans-serif}
main{width:100%;max-width:440px;background:var(--panel);border:1px solid var(--borde);border-radius:12px;padding:28px}
.marca{font:600 13px/1 ui-monospace,monospace;color:var(--suave);margin:0 0 20px}h1{font-size:22px;line-height:1.25;margin:0 0 8px}p{margin:0;color:var(--suave)}
a{display:inline-block;margin-top:20px;padding:10px 16px;border-radius:8px;background:var(--acento);color:var(--sobre);text-decoration:none;font-weight:500}</style></head>
<body><main><p class="marca">Peaje</p><h1>${esc(titulo)}</h1>${cuerpo}<a href="${esc(DASHBOARD)}">${idioma === 'es' ? 'Volver a Peaje' : 'Back to Peaje'}</a></main></body></html>`

googleRouter.get('/google/install', (c) => {
  const state = c.req.query('state') ?? ''
  const estado = state ? leerEstado(state) : null
  if (!configurado() || !estado) {
    return c.html(pagina('Este enlace venció', '<p>Vuelve a Integraciones en Peaje y toca "Conectar Google" otra vez.</p><p lang="en" style="margin-top:8px">This link expired. Go back to Integrations in Peaje and tap "Connect Google" again.</p>', 'es'), 410)
  }
  // La cookie ata el consentimiento a este navegador: un state copiado a otro no sirve.
  setCookie(c, COOKIE, state, { httpOnly: true, secure: seguro(), sameSite: 'Lax', path: '/google', maxAge: 30 * 60 })
  return c.redirect(urlAutorizar(state), 302)
})

/** Cómo terminó la conexión. El dashboard lee ?google= y muestra el mensaje en Integraciones. */
export type ResultadoGoogle = 'connected' | 'permission' | 'cancelled' | 'failed' | 'expired' | 'pro'

googleRouter.get('/google/oauth/callback', async (c) => {
  const state = c.req.query('state') ?? ''
  const estado = state ? leerEstado(state) : null
  const tenant = estado ? await store.getTenantById(estado.tenantId) : null
  // Sin un state válido no se sabe de qué negocio es.
  if (!estado || !tenant) return c.redirect(DASHBOARD, 302)
  const volver = (r: ResultadoGoogle) => c.redirect(`${DASHBOARD}/t/${tenant.slug}/integraciones?google=${r}#google`, 302)

  if (getCookie(c, COOKIE) !== state) return volver('expired')
  setCookie(c, COOKIE, '', { path: '/google', maxAge: 0 })
  if (c.req.query('error')) return volver('cancelled')
  if (sinPro(tenant, estado.idioma)) return volver('pro')

  let canje
  try {
    canje = await canjearCodigo(c.req.query('code') ?? '')
  } catch (e) {
    console.warn('[google] token', e instanceof Error ? e.message : e)
    return volver('failed')
  }
  // Google muestra una casilla por permiso y deja seguir sin marcar la de Search Console.
  if (!canje.scope.split(' ').includes(SCOPE_CONSOLA)) return volver('permission')
  // Sin refresh token no hay lectura después de una hora. Con prompt=consent Google siempre lo manda; si no vino, mejor no guardar.
  if (!canje.refreshToken) return volver('failed')

  const propiedades = await listarPropiedades(canje.accessToken).catch(() => [])
  const propiedad = elegirPropiedad(propiedades, dominioVerificable(tenant.originUrl))
  // Con otra cuenta, la anterior se revoca. Con la misma no: revocar corta el permiso entero, también el token nuevo.
  const anterior = await store.getGoogleConnection(tenant.id)
  if (anterior?.email && canje.email && anterior.email !== canje.email) void revocar(anterior.refreshTokenEnc).catch(() => undefined)
  await store.saveGoogleConnection({
    tenantId: tenant.id,
    email: canje.email,
    property: propiedad,
    properties: propiedades,
    refreshTokenEnc: cifrar(canje.refreshToken),
    scope: canje.scope,
  })
  // Si la cuenta no tiene el sitio, el dashboard lo dice y deja elegir uno de la lista.
  return volver('connected')
})

googleRouter.use('/_internal/:slug/google/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})
googleRouter.use('/_internal/:slug/google', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

googleRouter.post('/_internal/:slug/google/link', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  if (!configurado()) return c.json({ error: 'not-configured', message: 'Google no está configurado en el gateway' }, 503)
  const bloqueo = sinPro(tenant) // Pro, como Telegram y Slack
  if (bloqueo) return c.json(bloqueo, 403)
  const body = (await c.req.json().catch(() => ({}))) as { language?: string }
  return c.json({ url: urlInstalar(firmarEstado(tenant.id, body.language === 'es' ? 'es' : 'en')) })
})

googleRouter.get('/_internal/:slug/google', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const con = configurado() ? await store.getGoogleConnection(tenant.id) : null
  return c.json({
    configured: configurado(),
    connection: con
      ? { email: con.email, property: con.property, properties: con.properties, connectedAt: con.connectedAt, lastUsedAt: con.lastUsedAt, lastError: con.lastError }
      : null,
  })
})

googleRouter.put('/_internal/:slug/google/property', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const con = await store.getGoogleConnection(tenant.id)
  if (!con) return c.json({ error: 'not-connected' }, 404)
  const { property } = (await c.req.json().catch(() => ({}))) as { property?: string }
  // Solo una de las que la cuenta ve: nada de propiedades escritas a mano.
  if (!property || !con.properties.some((p) => p.siteUrl === property)) return c.json({ error: 'unknown-property' }, 400)
  await store.updateGoogleConnection(tenant.id, { property, lastError: null })
  return c.json({ ok: true, property })
})

googleRouter.delete('/_internal/:slug/google', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const con = await store.getGoogleConnection(tenant.id)
  if (con) {
    await revocar(con.refreshTokenEnc).catch(() => undefined)
    await store.deleteGoogleConnection(tenant.id)
  }
  return c.json({ ok: true })
})
