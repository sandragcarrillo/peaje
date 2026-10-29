// Inicio de sesión del MCP del dueño (OAuth 2.1, src/oauth.ts): metadatos,
// registro de clientes, canje del código con PKCE, refresco que rota y corta
// la conexión si reusan el token viejo. La pantalla de permiso vive en el
// dashboard: acá el código se crea directo en el store, como lo hace ella.
// Store en memoria: `pnpm --filter @peaje/gateway test`.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const llave = generatePrivateKey()
Object.assign(process.env, {
  GATEWAY_PUBLIC_URL: 'https://api.peaje.test',
  DASHBOARD_PUBLIC_URL: 'https://panel.peaje.test',
  MPP_SECRET_KEY: 'prueba-oauth-mcp-0123456789abcdef0123456789abcd',
  TREASURY_PRIVATE_KEY: llave,
  TREASURY_ADDRESS: privateKeyToAccount(llave).address,
  INTERNAL_API_SECRET: 'interno',
  AGENTS_SCHEDULER: 'off',
})

const { store } = await import('../src/store.js')
const { oauthRouter } = await import('../src/oauth.js')
const { tareasRouter } = await import('../src/tareas/router.js')
const { hashApiKey } = await import('@peaje/shared')

const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'
const tenant = await store.createTenant({ slug: 'oauth-prueba', name: 'OAuth Prueba', originUrl: 'https://oauth.example', embedSecret: 'x', privyUserId: 'did:privy:duena' })

const verifier = () => randomBytes(32).toString('base64url')
const challenge = (v: string) => createHash('sha256').update(v).digest('base64url')

async function registrar(cuerpo: Record<string, unknown>) {
  return oauthRouter.request('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) })
}

/** Lo que hace la pantalla de permiso del dashboard al tocar Permitir. */
async function codigoPara(clientId: string, v: string, privyUserId = 'did:privy:duena') {
  const code = `peaje_oac_${randomBytes(16).toString('hex')}`
  await store.createOauthCode({
    codeHash: await hashApiKey(code),
    clientId,
    tenantId: tenant.id,
    privyUserId,
    redirectUri: CALLBACK,
    codeChallenge: challenge(v),
    resource: 'https://api.peaje.test/_owner/mcp',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  })
  return code
}

async function canjear(campos: Record<string, string>, headers: Record<string, string> = {}) {
  const r = await oauthRouter.request('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(campos).toString(),
  })
  return { status: r.status, body: (await r.json()) as Record<string, string> }
}

const tareas = (token?: string) => tareasRouter.request('/_owner/tasks', { headers: token ? { authorization: `Bearer ${token}` } : {} })

test('los metadatos apuntan al gateway y a la pantalla de permiso del dashboard', async () => {
  const as = (await (await oauthRouter.request('/.well-known/oauth-authorization-server')).json()) as Record<string, unknown>
  assert.equal(as.issuer, 'https://api.peaje.test')
  assert.equal(as.authorization_endpoint, 'https://panel.peaje.test/oauth/autorizar')
  assert.equal(as.token_endpoint, 'https://api.peaje.test/oauth/token')
  assert.deepEqual(as.code_challenge_methods_supported, ['S256'])
  const pr = (await (await oauthRouter.request('/.well-known/oauth-protected-resource/_owner/mcp')).json()) as Record<string, unknown>
  assert.equal(pr.resource, 'https://api.peaje.test/_owner/mcp')
  assert.deepEqual(pr.authorization_servers, ['https://api.peaje.test'])
})

test('sin credenciales, el 401 dice dónde iniciar sesión', async () => {
  const r = await tareas()
  assert.equal(r.status, 401)
  assert.match(r.headers.get('www-authenticate') ?? '', /resource_metadata="https:\/\/api\.peaje\.test\/\.well-known\/oauth-protected-resource\/_owner\/mcp"/)
  const malo = await tareas('peaje_oat_inventado')
  assert.match(malo.headers.get('www-authenticate') ?? '', /error="invalid_token"/)
})

test('el registro rechaza redirects peligrosos y acepta los de apps y loopback', async () => {
  for (const uri of ['http://evil.example/cb', 'javascript:alert(1)', 'https://claude.ai/cb#x', 'file:///etc/passwd']) {
    assert.equal((await registrar({ redirect_uris: [uri] })).status, 400, uri)
  }
  const ok = await registrar({ client_name: 'Claude', redirect_uris: [CALLBACK, 'http://127.0.0.1:33418/callback', 'cursor://anysphere.cursor-retrieval/oauth/callback'] })
  assert.equal(ok.status, 201)
  const cliente = (await ok.json()) as Record<string, unknown>
  assert.match(String(cliente.client_id), /^peaje_cli_[0-9a-f]{32}$/)
  assert.equal(cliente.token_endpoint_auth_method, 'none')
  assert.equal(cliente.client_secret, undefined)
})

test('código con PKCE: tokens, acceso al MCP, refresco que rota y reuso que corta', async () => {
  const cliente = (await (await registrar({ client_name: 'Claude', redirect_uris: [CALLBACK] })).json()) as { client_id: string }

  // Verifier equivocado: no hay tokens (y el código queda gastado).
  const v1 = verifier()
  const malo = await canjear({ grant_type: 'authorization_code', code: await codigoPara(cliente.client_id, v1), code_verifier: verifier(), client_id: cliente.client_id, redirect_uri: CALLBACK })
  assert.equal(malo.body.error, 'invalid_grant')

  const v = verifier()
  const code = await codigoPara(cliente.client_id, v)
  const r = await canjear({ grant_type: 'authorization_code', code, code_verifier: v, client_id: cliente.client_id, redirect_uri: CALLBACK })
  assert.equal(r.status, 200)
  assert.match(r.body.access_token!, /^peaje_oat_/)
  assert.match(r.body.refresh_token!, /^peaje_ort_/)
  assert.equal(r.body.token_type, 'Bearer')

  // El código sirve una sola vez.
  const otra = await canjear({ grant_type: 'authorization_code', code, code_verifier: v, client_id: cliente.client_id })
  assert.equal(otra.body.error, 'invalid_grant')

  // Con el token entra al MCP del dueño como su negocio.
  const ok = await tareas(r.body.access_token)
  assert.equal(ok.status, 200)
  assert.equal(((await ok.json()) as { business: string }).business, 'oauth-prueba')

  // Integraciones la lista como conexión activa, con el nombre de la herramienta.
  const [conexion] = await store.listOauthGrants(tenant.id, new Date().toISOString())
  assert.equal(conexion?.clientName, 'Claude')

  // Refrescar rota los dos: el acceso viejo deja de servir.
  const nuevo = await canjear({ grant_type: 'refresh_token', refresh_token: r.body.refresh_token!, client_id: cliente.client_id })
  assert.equal(nuevo.status, 200)
  assert.notEqual(nuevo.body.refresh_token, r.body.refresh_token)
  assert.equal((await tareas(r.body.access_token)).status, 401)
  assert.equal((await tareas(nuevo.body.access_token)).status, 200)

  // Alguien reusa el refresh viejo: se corta la conexión entera.
  const reuso = await canjear({ grant_type: 'refresh_token', refresh_token: r.body.refresh_token!, client_id: cliente.client_id })
  assert.equal(reuso.body.error, 'invalid_grant')
  assert.equal((await tareas(nuevo.body.access_token)).status, 401)
  assert.equal((await store.listOauthGrants(tenant.id, new Date().toISOString())).length, 0)
})

test('un código de otra cuenta o de otro cliente no da tokens', async () => {
  const a = (await (await registrar({ client_name: 'A', redirect_uris: [CALLBACK] })).json()) as { client_id: string }
  const b = (await (await registrar({ client_name: 'B', redirect_uris: [CALLBACK] })).json()) as { client_id: string }
  const v = verifier()
  const deOtro = await canjear({ grant_type: 'authorization_code', code: await codigoPara(a.client_id, v), code_verifier: v, client_id: b.client_id })
  assert.equal(deOtro.body.error, 'invalid_grant')
  // El negocio ya no es de quien dio el permiso.
  const ajena = await canjear({ grant_type: 'authorization_code', code: await codigoPara(a.client_id, v, 'did:privy:otra'), code_verifier: v, client_id: a.client_id })
  assert.equal(ajena.body.error, 'invalid_grant')
})

test('un cliente con secreto no canjea sin su secreto', async () => {
  const conf = (await (await registrar({ client_name: 'ChatGPT', redirect_uris: [CALLBACK], token_endpoint_auth_method: 'client_secret_basic' })).json()) as {
    client_id: string
    client_secret: string
  }
  assert.match(conf.client_secret, /^peaje_cls_/)
  const v = verifier()
  const sin = await canjear({ grant_type: 'authorization_code', code: await codigoPara(conf.client_id, v), code_verifier: v, client_id: conf.client_id })
  assert.equal(sin.status, 401)
  const basic = Buffer.from(`${conf.client_id}:${conf.client_secret}`).toString('base64')
  const con = await canjear({ grant_type: 'authorization_code', code: await codigoPara(conf.client_id, v), code_verifier: v }, { authorization: `Basic ${basic}` })
  assert.equal(con.status, 200)
})
