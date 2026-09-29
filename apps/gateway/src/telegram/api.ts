/**
 * Cliente mínimo de la Bot API de Telegram. Sin TELEGRAM_BOT_TOKEN corre en
 * modo prueba: no manda nada y guarda lo que habría mandado en `bandeja`
 * (lo lee el test por la ruta interna).
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

let usuarioBot: string | null = null
/** El @usuario del bot, para armar el enlace t.me. */
export async function nombreBot(): Promise<string> {
  if (usuarioBot) return usuarioBot
  if (modoPrueba()) return (usuarioBot = process.env.TELEGRAM_BOT_USERNAME ?? 'peaje_agent_bot')
  const me = await tg<{ username: string }>('getMe', {})
  usuarioBot = me?.username ?? process.env.TELEGRAM_BOT_USERNAME ?? 'peaje_agent_bot'
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
