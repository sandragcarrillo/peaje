import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'

/**
 * Cliente mínimo de la Web API de Slack, verificación de firmas, cifrado del
 * bot token y formato mrkdwn. Sin las cuatro variables (SLACK_CLIENT_ID,
 * SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, SLACK_TOKEN_KEY) corre en modo
 * prueba: no llama a Slack y guarda lo que habría mandado en `bandeja`.
 *
 * Referencias (verificadas el 2026-10-24):
 *   firmas      https://docs.slack.dev/authentication/verifying-requests-from-slack
 *   OAuth v2    https://docs.slack.dev/authentication/installing-with-oauth
 *   mensajes    https://docs.slack.dev/reference/methods/chat.postMessage
 *   mrkdwn      https://docs.slack.dev/messaging/formatting-message-text
 *   archivos    https://docs.slack.dev/reference/methods/files.getUploadURLExternal
 *               https://docs.slack.dev/reference/methods/files.completeUploadExternal (2026-10-26)
 */

/** files:write: los borradores llegan como .md en el hilo. Una instalación previa sin ese permiso recibe el link a la tarea. */
export const SCOPES = ['app_mentions:read', 'chat:write', 'im:history', 'files:write'] as const

const v = (n: string) => process.env[n] ?? ''
export const clientId = () => v('SLACK_CLIENT_ID')
export const clientSecret = () => v('SLACK_CLIENT_SECRET')
export const signingSecret = () => v('SLACK_SIGNING_SECRET')
export const configurado = () => !!(clientId() && clientSecret() && signingSecret() && v('SLACK_TOKEN_KEY'))
export const modoPrueba = () => !configurado()

const base = () => (process.env.GATEWAY_PUBLIC_URL ?? env.publicUrl).replace(/\/$/, '')
export const redirectUri = () => v('SLACK_REDIRECT_URL') || `${base()}/slack/oauth/callback`
export const urlInstalar = (codigo: string) => `${base()}/slack/install?code=${encodeURIComponent(codigo)}`

// ---- firma de Slack (v0, HMAC-SHA256, ventana de 5 minutos) ----

export function firmar(secreto: string, timestamp: string, cuerpo: string): string {
  return `v0=${createHmac('sha256', secreto).update(`v0:${timestamp}:${cuerpo}`, 'utf8').digest('hex')}`
}

/** Cuerpo crudo, tal como llegó: la firma se calcula antes de parsear JSON o form. */
export function verificarFirma(secreto: string, timestamp: string | undefined, cuerpo: string, firma: string | undefined, ahora = Date.now()): boolean {
  if (!secreto || !timestamp || !firma) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(ahora / 1000 - ts) > 300) return false
  const esperada = Buffer.from(firmar(secreto, timestamp, cuerpo), 'utf8')
  const recibida = Buffer.from(firma, 'utf8')
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
}

// ---- bot token cifrado (AES-256-GCM) ----

function clave(): Buffer {
  // En modo prueba no hay tokens reales; una clave fija deja correr el flujo.
  return createHash('sha256').update(v('SLACK_TOKEN_KEY') || 'peaje-slack-modo-prueba', 'utf8').digest()
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', clave(), iv)
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.')
}

export function descifrar(guardado: string): string {
  const [ver, iv, tag, ct] = guardado.split('.')
  if (ver !== 'v1' || !iv || !tag || !ct) throw new Error('slack token: formato desconocido')
  const d = createDecipheriv('aes-256-gcm', clave(), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
}

// ---- Web API ----

export type RespuestaSlack = { ok: boolean; error?: string; ts?: string; channel?: string; [k: string]: unknown }

export const bandeja: { metodo: string; cuerpo: Record<string, unknown> }[] = []
let tsFalso = 0

export async function slack(metodo: string, cuerpo: Record<string, unknown>, token: string): Promise<RespuestaSlack | null> {
  if (modoPrueba()) {
    bandeja.push({ metodo, cuerpo })
    if (bandeja.length > 200) bandeja.shift()
    // Un ts falso deja probar el flujo de "mensaje provisorio y después chat.update".
    return { ok: true, ts: `1700000000.${String(++tsFalso).padStart(6, '0')}`, channel: String(cuerpo.channel ?? '') }
  }
  try {
    const res = await fetch(`https://slack.com/api/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    })
    const j = (await res.json()) as RespuestaSlack
    if (!j.ok) console.warn('[slack]', metodo, j.error)
    return j
  } catch (error) {
    console.warn('[slack]', metodo, error instanceof Error ? error.message : error)
    return null
  }
}

/** Igual que `slack`, pero form-urlencoded: lo aceptan todos los métodos (los de archivos, seguro). */
async function slackForm(metodo: string, campos: Record<string, string>, token: string): Promise<RespuestaSlack | null> {
  try {
    const res = await fetch(`https://slack.com/api/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${token}` },
      body: new URLSearchParams(campos).toString(),
      signal: AbortSignal.timeout(15_000),
    })
    const j = (await res.json()) as RespuestaSlack
    if (!j.ok) console.warn('[slack]', metodo, j.error)
    return j
  } catch (error) {
    console.warn('[slack]', metodo, error instanceof Error ? error.message : error)
    return null
  }
}

export type ArchivoSlack = { nombre: string; contenido: string; titulo?: string }

/**
 * Sube archivos a un canal o a un hilo con el flujo de Slack de hoy (files
 * upload v2; files.upload se retiró): por cada archivo,
 * files.getUploadURLExternal (nombre y largo) y los bytes por POST a la
 * upload_url; al final un solo files.completeUploadExternal que los comparte
 * juntos, en el hilo si hay `threadTs` (el ts del mensaje padre). Necesita
 * files:write. Modo prueba: a la bandeja.
 */
export async function subirArchivos(token: string, destino: { channel: string; threadTs?: string }, archivos: ArchivoSlack[]): Promise<{ ok: boolean; error?: string }> {
  if (!archivos.length) return { ok: true }
  const compartir = { channel_id: destino.channel, ...(destino.threadTs ? { thread_ts: destino.threadTs } : {}) }
  if (modoPrueba()) {
    for (const a of archivos) bandeja.push({ metodo: 'files.getUploadURLExternal', cuerpo: { filename: a.nombre, length: Buffer.byteLength(a.contenido, 'utf8') } })
    bandeja.push({ metodo: 'files.completeUploadExternal', cuerpo: { ...compartir, files: archivos.map((a) => ({ title: a.titulo ?? a.nombre, filename: a.nombre, contenido: a.contenido })) } })
    return { ok: true }
  }
  try {
    const subidos: { id: string; title: string }[] = []
    for (const a of archivos) {
      const bytes = Buffer.from(a.contenido, 'utf8')
      const u = await slackForm('files.getUploadURLExternal', { filename: a.nombre, length: String(bytes.length) }, token)
      if (!u?.ok || typeof u.upload_url !== 'string' || typeof u.file_id !== 'string') return { ok: false, error: u?.error ?? 'no_upload_url' }
      const destinoBytes = new URL(u.upload_url)
      // El token solo viaja a Slack.
      if (destinoBytes.protocol !== 'https:' || !/(^|\.)slack\.com$/.test(destinoBytes.hostname)) return { ok: false, error: 'unexpected_upload_url' }
      const res = await fetch(destinoBytes, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', authorization: `Bearer ${token}` },
        body: bytes,
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status !== 200) return { ok: false, error: `upload_${res.status}` }
      subidos.push({ id: u.file_id, title: a.titulo ?? a.nombre })
    }
    const c = await slackForm('files.completeUploadExternal', { files: JSON.stringify(subidos), ...compartir }, token)
    return c?.ok ? { ok: true } : { ok: false, error: c?.error ?? 'complete_failed' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type AccesoOAuth = {
  ok: boolean
  error?: string
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: { id: string; name?: string } | null
  enterprise?: { id: string; name?: string } | null
  authed_user?: { id: string }
  is_enterprise_install?: boolean
}

/** Cambia el código del OAuth por el bot token. Credenciales por HTTP Basic, como recomienda Slack. */
export async function canjearCodigo(codigo: string): Promise<AccesoOAuth> {
  if (modoPrueba()) {
    return { ok: true, access_token: `xoxb-prueba-${codigo}`, token_type: 'bot', bot_user_id: 'UBOTPRUEBA', app_id: 'APRUEBA', team: { id: 'TPRUEBA', name: 'Equipo de prueba' }, authed_user: { id: 'UINSTALA' } }
  }
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`,
    },
    body: new URLSearchParams({ code: codigo, redirect_uri: redirectUri() }).toString(),
    signal: AbortSignal.timeout(15_000),
  })
  return (await res.json()) as AccesoOAuth
}

export function urlAutorizar(state: string): string {
  const q = new URLSearchParams({ client_id: clientId() || 'modo-prueba', scope: SCOPES.join(','), redirect_uri: redirectUri(), state })
  return `https://slack.com/oauth/v2/authorize?${q.toString()}`
}

// ---- formato ----

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Formato de un tramo sin código: links, negritas, itálicas, títulos, viñetas. */
function formatoTramo(t: string): string {
  return escapar(t)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, txt: string, url: string) => `<${url}|${txt.replace(/\|/g, '/')}>`)
    .replace(/^#{1,6}\s+(.+)$/gm, '**$1**')
    .replace(/^\s*-{3,}\s*$/gm, '─────')
    .replace(/^(\s*)[-*]\s+/gm, '$1• ')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '_$1_')
    .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
    .replace(/__([^_\n]+)__/g, '*$1*')
    .replace(/~~([^~\n]+)~~/g, '~$1~')
}

/**
 * Markdown del agente → mrkdwn de Slack. Solo se escapan &, < y > (lo que
 * pide Slack); dentro de `código` no se toca el formato.
 */
export function aMrkdwn(texto: string): string {
  return texto
    .split(/(```[\s\S]*?```|`[^`\n]+`)/g)
    .map((tramo, i) => (i % 2 === 1 ? escapar(tramo) : formatoTramo(tramo)))
    .join('')
}

/** Partes de a lo sumo `max` caracteres (un bloque section admite 3000): por párrafos, después por líneas, después a la fuerza. */
export function partir(texto: string, max = 2900): string[] {
  const piezas: string[] = []
  for (const p of texto.split(/\n{2,}/)) {
    if (p.length <= max) piezas.push(p)
    else {
      let actual = ''
      for (const linea of p.split('\n')) {
        if (linea.length > max) {
          if (actual) piezas.push(actual)
          actual = ''
          for (let i = 0; i < linea.length; i += max) piezas.push(linea.slice(i, i + max))
        } else if ((actual ? actual.length + 1 : 0) + linea.length > max) {
          piezas.push(actual)
          actual = linea
        } else actual = actual ? `${actual}\n${linea}` : linea
      }
      if (actual) piezas.push(actual)
    }
  }
  const partes: string[] = []
  let actual = ''
  for (const p of piezas) {
    if (actual && actual.length + 2 + p.length > max) {
      partes.push(actual)
      actual = p
    } else actual = actual ? `${actual}\n\n${p}` : p
  }
  if (actual) partes.push(actual)
  return partes.length ? partes : ['']
}

/** Texto plano para el `text` de respaldo (notificaciones y lectores de pantalla). */
export const respaldo = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').slice(0, 3_000)
