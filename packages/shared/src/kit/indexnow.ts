/**
 * IndexNow: el aviso a Bing (y por él a Copilot, DuckDuckGo, Yandex) de que
 * una URL cambió. Google no lo escucha, pero Bing es la mitad del índice que
 * usan ChatGPT y Copilot, y sin aviso el portal con precios nuevos puede
 * tardar semanas en recrawlearse.
 *
 * Vive en shared porque las mutaciones de rutas y links están en el dashboard
 * (server actions que escriben el store directo, sin pasar por el gateway), y
 * la clave la sirve el gateway en `/.well-known/peaje-indexnow.txt`. Ambos
 * necesitan derivar la misma clave del mismo secreto.
 */

export const INDEXNOW_KEY_PATH = '/.well-known/peaje-indexnow.txt'

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Clave IndexNow del tenant: los primeros 32 hex de sha256(embedSecret +
 * 'indexnow'). Derivada y no guardada: no hay columna nueva, no hay rotación
 * que coordinar, y quien no tiene el embedSecret no puede pingear en tu
 * nombre. Web Crypto a propósito: shared también corre en el bundle del
 * dashboard.
 */
export async function claveIndexNow(embedSecret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${embedSecret}indexnow`))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

/**
 * POST a IndexNow con la lista de URLs. Nunca lanza: un aviso que falla no
 * puede tirar la acción que creó la ruta. Devuelve true si Bing aceptó
 * (200 o 202); 4xx suele ser clave que todavía no responde en el dominio
 * (el proxy no está puesto), y eso se loguea y sigue.
 */
export async function pingIndexNow(originHost: string, urls: string[], key: string): Promise<boolean> {
  if (urls.length === 0) return false
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: originHost,
        key,
        keyLocation: `https://${originHost}${INDEXNOW_KEY_PATH}`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(5_000),
    })
    if (res.status === 200 || res.status === 202) return true
    console.warn('[indexnow] rechazado', { host: originHost, status: res.status })
    return false
  } catch (err) {
    console.warn('[indexnow] no se pudo avisar', { host: originHost, err: err instanceof Error ? err.message : err })
    return false
  }
}

/** Las URLs que cambian cuando cambian precios: el portal y la tabla de precios. */
export function urlsIndexNow(originHost: string): string[] {
  return [`https://${originHost}/developers`, `https://${originHost}/pricing.md`]
}
