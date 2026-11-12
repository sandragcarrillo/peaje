// Google Search Console: el state firmado, la propiedad que se elige, el
// callback del OAuth (cookie, permisos, token cifrado) y lo que lee el agente.
// Store en memoria; Google es un fetch falso que responde según la URL.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  MPP_SECRET_KEY: 'prueba-google-search-console-0123456789abcdef0123',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
  GATEWAY_PUBLIC_URL: 'https://api.ejemplo.test',
  GOOGLE_CLIENT_ID: 'cliente.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-de-prueba',
  GOOGLE_TOKEN_KEY: 'llave-de-prueba-para-cifrar-tokens-0123456789',
})

const { store } = await import('../src/store.js')
const api = await import('../src/google/api.js')
const { googleRouter } = await import('../src/google/router.js')
const { resumenConsola, rango } = await import('../src/google/consola.js')
const { probarHerramienta } = await import('../src/tareas/agente.js')

const tenant = await store.createTenant({ slug: 'gsc-prueba', name: 'GSC Prueba', originUrl: 'https://www.ejemplo.co', embedSecret: 'x' })
await store.setTenantPlan(tenant.id, 'pro', new Date(Date.now() + 20 * 86_400_000).toISOString())
const gratis = await store.createTenant({ slug: 'gsc-gratis', name: 'GSC Gratis', originUrl: 'https://gratis.co', embedSecret: 'x' })

const interno = { authorization: 'Bearer interno', 'content-type': 'application/json' }
const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.y`

type Respuesta = { status?: number; json: unknown }
let llamadas: { url: string; body: string | null }[] = []
let responder: (url: string, body: string | null) => Respuesta = () => ({ status: 404, json: {} })
const fetchReal = globalThis.fetch
globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada)
  const body = typeof init?.body === 'string' ? init.body : null
  llamadas.push({ url, body })
  const r = responder(url, body)
  return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
}) as typeof fetch
process.on('exit', () => {
  globalThis.fetch = fetchReal
})

test('state firmado: vale para su negocio, no si lo tocan ni si venció', () => {
  const s = api.firmarEstado(tenant.id, 'es', 1_000)
  assert.deepEqual(api.leerEstado(s, 2_000), { tenantId: tenant.id, idioma: 'es', vence: 1_000 + 30 * 60_000 })
  const [cuerpo, firma] = s.split('.')
  const otro = Buffer.from(JSON.stringify({ t: gratis.id, l: 'es', e: 9e15, n: 'x' })).toString('base64url')
  assert.equal(api.leerEstado(`${otro}.${firma}`, 2_000), null)
  assert.equal(api.leerEstado(`${cuerpo}.x${firma}`, 2_000), null)
  assert.equal(api.leerEstado(s, 1_000 + 31 * 60_000), null)
})

test('la propiedad: dominio primero, después prefijo, subdominio por el padre, nunca otra', () => {
  const p = (...urls: string[]) => urls.map((siteUrl) => ({ siteUrl, permissionLevel: 'siteOwner' }))
  assert.equal(api.elegirPropiedad(p('https://www.ejemplo.co/', 'sc-domain:ejemplo.co'), 'www.ejemplo.co'), 'sc-domain:ejemplo.co')
  assert.equal(api.elegirPropiedad(p('http://ejemplo.co/', 'https://www.ejemplo.co/'), 'www.ejemplo.co'), 'https://www.ejemplo.co/')
  assert.equal(api.elegirPropiedad(p('sc-domain:ejemplo.co'), 'tienda.ejemplo.co'), 'sc-domain:ejemplo.co')
  assert.equal(api.elegirPropiedad(p('sc-domain:otroejemplo.co', 'https://otro.co/'), 'ejemplo.co'), null)
  assert.equal(api.urlEnPropiedad('https://www.ejemplo.co/blog', 'sc-domain:ejemplo.co'), true)
  assert.equal(api.urlEnPropiedad('https://ejemplo.co.evil.com/', 'sc-domain:ejemplo.co'), false)
  assert.equal(api.urlEnPropiedad('https://www.ejemplo.co/x', 'https://www.ejemplo.co/'), true)
})

/** Pide el enlace, pasa por /google/install y vuelve al callback con la cookie, como el navegador. */
async function conectar(slug: string, opciones: { scope?: string; sinRefresh?: boolean; cookie?: string } = {}) {
  const r = await googleRouter.request(`/_internal/${slug}/google/link`, { method: 'POST', headers: interno, body: JSON.stringify({ language: 'es' }) })
  if (r.status !== 200) return { link: r }
  const { url } = (await r.json()) as { url: string }
  const state = new URL(url).searchParams.get('state')!
  const ida = await googleRouter.request(`/google/install?state=${encodeURIComponent(state)}`)
  assert.equal(ida.status, 302)
  const destino = new URL(ida.headers.get('location')!)
  assert.equal(destino.origin + destino.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(destino.searchParams.get('access_type'), 'offline')
  assert.equal(destino.searchParams.get('redirect_uri'), 'https://api.ejemplo.test/google/oauth/callback')
  assert.match(destino.searchParams.get('scope')!, /webmasters\.readonly/)
  const cookie = opciones.cookie ?? ida.headers.get('set-cookie')!.split(';')[0]!
  responder = (u) => {
    if (u === 'https://oauth2.googleapis.com/token') {
      return {
        json: {
          access_token: 'ya29.acceso',
          expires_in: 3600,
          ...(opciones.sinRefresh ? {} : { refresh_token: '1//refresco-secreto' }),
          scope: opciones.scope ?? `openid https://www.googleapis.com/auth/userinfo.email ${api.SCOPE_CONSOLA}`,
          id_token: idToken('duena@ejemplo.co'),
        },
      }
    }
    if (u === 'https://www.googleapis.com/webmasters/v3/sites') {
      return { json: { siteEntry: [{ siteUrl: 'https://www.ejemplo.co/', permissionLevel: 'siteFullUser' }, { siteUrl: 'sc-domain:ejemplo.co', permissionLevel: 'siteOwner' }, { siteUrl: 'sc-domain:ajeno.co', permissionLevel: 'siteUnverifiedUser' }] } }
    }
    return { status: 404, json: {} }
  }
  const vuelta = await googleRouter.request(`/google/oauth/callback?code=codigo&state=${encodeURIComponent(state)}`, { headers: { cookie } })
  return { vuelta, html: await vuelta.text() }
}

test('conectar: solo Pro; el callback exige la cookie y el permiso de Search Console; el token queda cifrado', async () => {
  const { link } = await conectar('gsc-gratis')
  assert.equal(link?.status, 403)

  const otraCookie = await conectar('gsc-prueba', { cookie: 'peaje_google_state=otro' })
  assert.equal(otraCookie.vuelta?.status, 400)
  assert.equal(await store.getGoogleConnection(tenant.id), null)

  const sinPermiso = await conectar('gsc-prueba', { scope: 'openid email' })
  assert.equal(sinPermiso.vuelta?.status, 400)
  assert.match(sinPermiso.html!, /Falta un permiso/)
  assert.equal(await store.getGoogleConnection(tenant.id), null)

  const sinRefresh = await conectar('gsc-prueba', { sinRefresh: true })
  assert.equal(sinRefresh.vuelta?.status, 502)

  const ok = await conectar('gsc-prueba')
  assert.equal(ok.vuelta?.status, 200)
  assert.match(ok.html!, /sc-domain:ejemplo\.co/)
  const con = await store.getGoogleConnection(tenant.id)
  assert.ok(con)
  assert.equal(con.email, 'duena@ejemplo.co')
  assert.equal(con.property, 'sc-domain:ejemplo.co')
  assert.deepEqual(con.properties.map((p) => p.siteUrl), ['https://www.ejemplo.co/', 'sc-domain:ejemplo.co'])
  assert.ok(!con.refreshTokenEnc.includes('refresco-secreto'))
  assert.equal(api.descifrar(con.refreshTokenEnc), '1//refresco-secreto')

  const estado = (await (await googleRouter.request('/_internal/gsc-prueba/google', { headers: interno })).json()) as { configured: boolean; connection: Record<string, unknown> }
  assert.equal(estado.configured, true)
  assert.equal(estado.connection.property, 'sc-domain:ejemplo.co')
  assert.ok(!('refreshTokenEnc' in estado.connection))

  const mala = await googleRouter.request('/_internal/gsc-prueba/google/property', { method: 'PUT', headers: interno, body: JSON.stringify({ property: 'sc-domain:ajeno.co' }) })
  assert.equal(mala.status, 400)
  const buena = await googleRouter.request('/_internal/gsc-prueba/google/property', { method: 'PUT', headers: interno, body: JSON.stringify({ property: 'https://www.ejemplo.co/' }) })
  assert.equal(buena.status, 200)
  await googleRouter.request('/_internal/gsc-prueba/google/property', { method: 'PUT', headers: interno, body: JSON.stringify({ property: 'sc-domain:ejemplo.co' }) })

  const sinClave = await googleRouter.request('/_internal/gsc-prueba/google')
  assert.equal(sinClave.status, 401)
})

test('el agente lee totales, búsquedas, páginas y oportunidades; un token revocado queda anotado', async () => {
  api.olvidarAccesos()
  llamadas = []
  const fila = (key: string, clicks: number, impressions: number, position: number) => ({ keys: [key], clicks, impressions, ctr: impressions ? clicks / impressions : 0, position })
  responder = (u, body) => {
    if (u === 'https://oauth2.googleapis.com/token') return { json: { access_token: 'ya29.nuevo', expires_in: 3600 } }
    if (u.endsWith('/searchAnalytics/query')) {
      const q = JSON.parse(body!) as { dimensions: string[] }
      if (!q.dimensions.length) return { json: { rows: [{ keys: [], clicks: 12, impressions: 900, ctr: 12 / 900, position: 14.26 }] } }
      if (q.dimensions[0] === 'query') return { json: { rows: [fila('peaje x402', 10, 100, 2.1), fila('cobrar a agentes de ia', 0, 300, 11.4), fila('geo latam', 2, 150, 9), fila('raro', 0, 3, 40)] } }
      return { json: { rows: [fila('https://www.ejemplo.co/', 12, 500, 6), fila('https://www.ejemplo.co/blog/geo', 0, 400, 17)] } }
    }
    if (u.endsWith('/sitemaps')) return { json: { sitemap: [{ path: 'https://www.ejemplo.co/sitemap.xml', lastDownloaded: '2026-11-10T00:00:00Z', isPending: false, errors: '0', warnings: '1' }] } }
    return { status: 404, json: {} }
  }
  const r = await probarHerramienta('get_search_console', { days: 28 }, { tenant, idioma: 'es' })
  const d = r as Exclude<Awaited<ReturnType<typeof resumenConsola>>, { connected: false }> & { totals: { clicks: number; ctrPct: number; position: number }; opportunities: Record<string, { key: string }[]> }
  assert.equal(d.connected, true)
  assert.equal(d.property, 'sc-domain:ejemplo.co')
  assert.deepEqual(d.totals, { clicks: 12, impressions: 900, ctrPct: 1.3, position: 14.3 })
  assert.deepEqual(d.opportunities.queriesWithoutClicks.map((f) => f.key), ['cobrar a agentes de ia'])
  assert.deepEqual(d.opportunities.queriesAlmostFirstPage.map((f) => f.key), ['cobrar a agentes de ia', 'geo latam'])
  assert.deepEqual(d.opportunities.pagesWithoutClicks.map((f) => f.key), ['https://www.ejemplo.co/blog/geo'])
  // La propiedad de dominio va codificada en la ruta, y el rango termina ayer en hora del Pacífico.
  const consulta = llamadas.find((l) => l.url.endsWith('/searchAnalytics/query'))!
  assert.ok(consulta.url.includes('/sites/sc-domain%3Aejemplo.co/'))
  assert.equal((JSON.parse(consulta.body!) as { endDate: string }).endDate, rango(28).hasta)
  assert.ok((await store.getGoogleConnection(tenant.id))?.lastUsedAt)

  // La dueña quitó el acceso en su cuenta de Google.
  api.olvidarAccesos()
  responder = (u) => (u === 'https://oauth2.googleapis.com/token' ? { status: 400, json: { error: 'invalid_grant' } } : { status: 404, json: {} })
  const revocado = (await probarHerramienta('get_search_console', {}, { tenant, idioma: 'es' })) as { error?: string; howToConnect?: string }
  assert.equal(revocado.error, 'reconnect')
  assert.match(revocado.howToConnect!, /\/t\/gsc-prueba\/integraciones#google$/)
  assert.match((await store.getGoogleConnection(tenant.id))?.lastError ?? '', /^reconnect/)
})

test('inspect_url: solo URLs del sitio; devuelve si está indexada y la canónica', async () => {
  api.olvidarAccesos()
  responder = (u) => {
    if (u === 'https://oauth2.googleapis.com/token') return { json: { access_token: 'ya29.otro', expires_in: 3600 } }
    if (u === 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect') {
      return { json: { inspectionResult: { inspectionResultLink: 'https://search.google.com/x', indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', pageFetchState: 'SUCCESSFUL', googleCanonical: 'https://www.ejemplo.co/a', userCanonical: 'https://www.ejemplo.co/b' } } } }
    }
    return { status: 404, json: {} }
  }
  const fuera = (await probarHerramienta('inspect_url', { url: 'https://otro.co/x' }, { tenant, idioma: 'es' })) as { error?: string }
  assert.ok(fuera.error)
  const r = (await probarHerramienta('inspect_url', { url: 'https://www.ejemplo.co/b' }, { tenant, idioma: 'es' })) as { indexed: boolean; coverage: string; canonicalMismatch: boolean }
  assert.equal(r.indexed, false)
  assert.equal(r.coverage, 'Crawled - currently not indexed')
  assert.equal(r.canonicalMismatch, true)
})

test('desconectar revoca en Google y borra la fila; sin conexión el agente da el link', async () => {
  llamadas = []
  responder = () => ({ json: {} })
  const r = await googleRouter.request('/_internal/gsc-prueba/google', { method: 'DELETE', headers: interno })
  assert.equal(r.status, 200)
  const revoca = llamadas.find((l) => l.url === 'https://oauth2.googleapis.com/revoke')
  assert.ok(revoca)
  assert.equal(new URLSearchParams(revoca.body!).get('token'), '1//refresco-secreto')
  assert.equal(await store.getGoogleConnection(tenant.id), null)
  const sin = (await probarHerramienta('get_search_console', {}, { tenant, idioma: 'es' })) as { connected: boolean; reason: string }
  assert.deepEqual([sin.connected, sin.reason], [false, 'not-connected'])
})
