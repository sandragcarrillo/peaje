// Publica (o actualiza) Peaje en el registro oficial de MCP
// (registry.modelcontextprotocol.io) como com.usepeaje/peaje, con lo que dice
// server.json en la raíz del repo. Para una versión nueva: subir "version" en
// server.json y volver a correr esto.
//
// El dominio se prueba por HTTP: usepeaje.com/.well-known/mcp-registry-auth
// tiene la llave pública (apps/dashboard/app/.well-known/mcp-registry-auth) y
// acá se firma la hora con la privada, que vive fuera del repo.
//
//   node scripts/publicar-registro-mcp.mjs
//   MCP_REGISTRY_KEY=/otra/ruta.pem node scripts/publicar-registro-mcp.mjs
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REGISTRO = 'https://registry.modelcontextprotocol.io'
const DOMINIO = 'usepeaje.com'
const llave = createPrivateKey(readFileSync(process.env.MCP_REGISTRY_KEY ?? join(homedir(), '.config/peaje/mcp-registry-ed25519.pem')))
const servidor = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'))

const timestamp = new Date().toISOString()
const firma = sign(null, Buffer.from(timestamp), llave).toString('hex')
const auth = await fetch(`${REGISTRO}/v0.1/auth/http`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ domain: DOMINIO, timestamp, signed_timestamp: firma }),
})
if (!auth.ok) {
  console.error('No se pudo probar el dominio:', auth.status, await auth.text())
  process.exit(1)
}
const { registry_token: token } = await auth.json()

const r = await fetch(`${REGISTRO}/v0.1/publish`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(servidor),
})
const cuerpo = await r.text()
if (!r.ok) {
  console.error('El registro no lo aceptó:', r.status, cuerpo)
  process.exit(1)
}
console.log(`Publicado ${servidor.name} ${servidor.version}`)
console.log(cuerpo)
