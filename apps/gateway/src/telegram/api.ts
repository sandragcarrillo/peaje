/**
 * Cliente mínimo de la Bot API de Telegram. Sin TELEGRAM_BOT_TOKEN corre en
 * modo prueba: no manda nada y guarda lo que habría mandado en `bandeja`
 * (lo lee el test por la ruta interna).
 *
 * Referencia (verificada el 2026-10-26): https://core.telegram.org/bots/api
 * (sendDocument, sendMediaGroup 2 a 10 documentos, ReplyParameters, 50 MB por archivo).
 */
export const token = () => process.env.TELEGRAM_BOT_TOKEN ?? ''
export const modoPrueba = () => !token()

export const bandeja: { metodo: string; cuerpo: Record<string, unknown> }[] = []

export async function tg<T = unknown>(metodo: string, cuerpo: Record<string, unknown>): Promise<T | null> {
  if (modoPrueba()) {
    bandeja.push({ metodo, cuerpo })
    if (bandeja.length > 200) bandeja.shift()
    return null
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    })
    const j = (await res.json()) as { ok: boolean; result?: T; description?: string }
    if (!j.ok) console.warn('[telegram]', metodo, j.description)
    return j.result ?? null
  } catch (error) {
    console.warn('[telegram]', metodo, error instanceof Error ? error.message : error)
    return null
  }
}

/** Un archivo nuevo para subir (sendDocument, sendMediaGroup). `nombre` es el nombre que ve el dueño. */
export type ArchivoTg = { nombre: string; contenido: string; tipo?: string }
const esArchivo = (v: unknown): v is ArchivoTg => !!v && typeof v === 'object' && 'nombre' in v && 'contenido' in v

/**
 * La Bot API con multipart/form-data, la única forma de subir un archivo
 * nuevo. Cada ArchivoTg va como archivo con su nombre; el resto, como texto
 * (los objetos en JSON: reply_parameters, media). En sendMediaGroup, cada
 * archivo va en su propio campo y `media` lo nombra con "attach://<campo>".
 * Modo prueba: a la bandeja, y cuenta como enviado.
 */
export async function tgArchivos(metodo: string, campos: Record<string, unknown>): Promise<{ ok: boolean; description?: string }> {
  if (modoPrueba()) {
    bandeja.push({ metodo, cuerpo: campos })
    if (bandeja.length > 200) bandeja.shift()
    return { ok: true }
  }
  try {
    const form = new FormData()
    for (const [k, v] of Object.entries(campos)) {
      if (v === undefined || v === null) continue
      if (esArchivo(v)) form.append(k, new Blob([v.contenido], { type: v.tipo ?? 'text/markdown; charset=utf-8' }), v.nombre)
      else form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
    }
    const res = await fetch(`https://api.telegram.org/bot${token()}/${metodo}`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) })
    const j = (await res.json()) as { ok: boolean; description?: string }
    if (!j.ok) console.warn('[telegram]', metodo, j.description)
    return { ok: !!j.ok, description: j.description }
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error)
    console.warn('[telegram]', metodo, description)
    return { ok: false, description }
  }
}

let usuarioBot: string | null = null
/** El @usuario del bot, para armar el enlace t.me. */
export async function nombreBot(): Promise<string> {
  if (usuarioBot) return usuarioBot
  if (modoPrueba()) return (usuarioBot = process.env.TELEGRAM_BOT_USERNAME ?? 'PeajeAgentBot')
  const me = await tg<{ username: string }>('getMe', {})
  usuarioBot = me?.username ?? process.env.TELEGRAM_BOT_USERNAME ?? 'PeajeAgentBot'
  return usuarioBot
}

/** Markdown del agente → HTML de Telegram (lo único que soporta sin escapar todo). */
export function aHtml(texto: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc(texto)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*]\s+/gm, '• ')
}

/** Telegram corta a 4096 caracteres: se parte por párrafos. */
export function partir(texto: string, max = 3800): string[] {
  const partes: string[] = []
  let actual = ''
  for (const p of texto.split(/\n{2,}/)) {
    if ((actual + '\n\n' + p).length > max && actual) {
      partes.push(actual)
      actual = p
    } else actual = actual ? `${actual}\n\n${p}` : p
  }
  if (actual) partes.push(actual)
  return partes.length ? partes : ['']
}
