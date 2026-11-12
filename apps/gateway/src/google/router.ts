import { dominioVerificable } from '@peaje/shared'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { sinPro } from '../billing/acceso.js'
import { env } from '../env.js'
import { store } from '../store.js'
import { canjearCodigo, cifrar, configurado, elegirPropiedad, firmarEstado, leerEstado, listarPropiedades, revocar, SCOPE_CONSOLA, urlAutorizar, urlInstalar } from './api.js'

/**
 *   GET    /google/install?state=…          pone la cookie y redirige al consentimiento de Google
 *   GET    /google/oauth/callback           canjea el código, elige la propiedad del sitio, guarda la conexión
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

const pagina = (titulo: string, cuerpo: string, idioma: 'es' | 'en') => `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:0 16px;line-height:1.5;color:#111;background:#fff}
a.b{display:inline-block;margin-top:12px;margin-right:12px;padding:10px 16px;border-radius:8px;background:#111;color:#fff;text-decoration:none}
code{background:#f2f2f2;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>${esc(titulo)}</h1>${cuerpo}</body></html>`

const volver = (idioma: 'es' | 'en', slug?: string) =>
  `<a class="b" href="${esc(slug ? `${DASHBOARD}/t/${slug}/integraciones#google` : DASHBOARD)}">${idioma === 'es' ? 'Volver a Peaje' : 'Back to Peaje'}</a>`

googleRouter.get('/google/install', (c) => {
  const state = c.req.query('state') ?? ''
  const estado = state ? leerEstado(state) : null
  if (!configurado() || !estado) {
    return c.html(pagina('Link expired', '<p>This link expired. Tap "Connect Google" again in Peaje.</p><p>Este enlace venció. Vuelve a tocar "Conectar Google" en Peaje.</p>', 'en'), 410)
  }
  // La cookie ata el consentimiento a este navegador: un state copiado a otro no sirve.
  setCookie(c, COOKIE, state, { httpOnly: true, secure: seguro(), sameSite: 'Lax', path: '/google', maxAge: 30 * 60 })
  return c.redirect(urlAutorizar(state), 302)
})

googleRouter.get('/google/oauth/callback', async (c) => {
  const state = c.req.query('state') ?? ''
  const estado = state ? leerEstado(state) : null
  const idioma = estado?.idioma ?? 'en'
  const es = idioma === 'es'
  if (!estado || getCookie(c, COOKIE) !== state) {
    return c.html(pagina(es ? 'No se pudo conectar' : 'Could not connect', `<p>${es ? 'El enlace venció o se abrió en otro navegador. Vuelve a tocar "Conectar Google" en Integraciones.' : 'The link expired or was opened in another browser. Tap "Connect Google" again in Integrations.'}</p>${volver(idioma)}`, idioma), 400)
  }
  setCookie(c, COOKIE, '', { path: '/google', maxAge: 0 })
  const tenant = await store.getTenantById(estado.tenantId)
  if (!tenant) return c.html(pagina('Not found', '<p>Business not found.</p>', idioma), 404)
  if (c.req.query('error')) {
    return c.html(pagina(es ? 'Conexión cancelada' : 'Connection cancelled', `<p>${es ? 'No se conectó nada. Puedes intentarlo de nuevo cuando quieras.' : 'Nothing was connected. You can try again anytime.'}</p>${volver(idioma, tenant.slug)}`, idioma))
  }
  const bloqueo = sinPro(tenant, idioma)
  if (bloqueo) return c.html(pagina('Peaje Pro', `<p>${esc(bloqueo.message)}</p>${volver(idioma, tenant.slug)}`, idioma), 403)

  let canje
  try {
    canje = await canjearCodigo(c.req.query('code') ?? '')
  } catch (e) {
    console.warn('[google] token', e instanceof Error ? e.message : e)
    return c.html(pagina(es ? 'No se pudo conectar' : 'Could not connect', `<p>${es ? 'Google no confirmó la conexión. Inténtalo de nuevo.' : 'Google did not confirm the connection. Try again.'}</p>${volver(idioma, tenant.slug)}`, idioma), 502)
  }
  // Google deja desmarcar cada permiso en la pantalla de consentimiento.
  if (!canje.scope.split(' ').includes(SCOPE_CONSOLA)) {
    return c.html(
      pagina(
        es ? 'Falta un permiso' : 'One permission missing',
        `<p>${es ? 'Para leer tu Search Console, Peaje necesita el permiso "Ver los datos de Search Console de tus sitios verificados". Vuelve a conectar y déjalo marcado.' : 'To read your Search Console, Peaje needs the permission "View Search Console data for your verified sites". Connect again and keep it checked.'}</p>${volver(idioma, tenant.slug)}`,
        idioma,
      ),
      400,
    )
  }
  // Sin refresh token no hay lectura después de una hora. Con prompt=consent Google siempre lo manda; si no vino, mejor no guardar.
  if (!canje.refreshToken) {
    return c.html(pagina(es ? 'No se pudo conectar' : 'Could not connect', `<p>${es ? 'Google no entregó el acceso permanente. Vuelve a conectar.' : 'Google did not hand over lasting access. Connect again.'}</p>${volver(idioma, tenant.slug)}`, idioma), 502)
  }

  const propiedades = await listarPropiedades(canje.accessToken).catch(() => [])
  const dominio = dominioVerificable(tenant.originUrl)
  const propiedad = elegirPropiedad(propiedades, dominio)
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

  const cuenta = canje.email ? ` (<b>${esc(canje.email)}</b>)` : ''
  if (propiedad) {
    const cuerpo = es
      ? `<p>Peaje ya lee el Search Console de <b>${esc(propiedad)}</b> con tu cuenta de Google${cuenta}. Solo lectura: Peaje no cambia nada en tu Search Console.</p><p>Pregúntale al agente, por ejemplo: <code>¿en qué búsquedas aparezco y nadie hace clic?</code></p>${volver(idioma, tenant.slug)}`
      : `<p>Peaje now reads Search Console for <b>${esc(propiedad)}</b> with your Google account${cuenta}. Read only: Peaje changes nothing in your Search Console.</p><p>Ask the agent, for example: <code>which searches show my site but get no clicks?</code></p>${volver(idioma, tenant.slug)}`
    return c.html(pagina(es ? 'Search Console conectado' : 'Search Console connected', cuerpo, idioma))
  }
  const lista = propiedades.length ? `<ul>${propiedades.map((p) => `<li><code>${esc(p.siteUrl)}</code></li>`).join('')}</ul>` : ''
  const cuerpo = es
    ? `<p>Tu cuenta de Google quedó conectada${cuenta}, pero no tiene <b>${esc(dominio ?? tenant.originUrl)}</b> en Search Console.${propiedades.length ? ' Estas son las que tiene:' : ''}</p>${lista}<p>Agrega tu sitio en <a href="https://search.google.com/search-console">Search Console</a> o elige una de la lista en Integraciones. Si el sitio está en otra cuenta, desconecta y conecta esa.</p>${volver(idioma, tenant.slug)}`
    : `<p>Your Google account is connected${cuenta}, but it does not have <b>${esc(dominio ?? tenant.originUrl)}</b> in Search Console.${propiedades.length ? ' These are the ones it has:' : ''}</p>${lista}<p>Add your site in <a href="https://search.google.com/search-console">Search Console</a> or pick one from the list in Integrations. If the site is in another account, disconnect and connect that one.</p>${volver(idioma, tenant.slug)}`
  return c.html(pagina(es ? 'Falta tu sitio' : 'Your site is missing', cuerpo, idioma))
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
