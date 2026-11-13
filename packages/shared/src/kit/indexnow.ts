/**
 * IndexNow: el aviso a Bing (y por él a los otros buscadores que lo usan:
 * Naver, Seznam, Yandex, Yep) de que una URL cambió. Google no lo escucha.
 * Sin aviso, el portal con precios nuevos puede tardar en recrawlearse.
 *
 * Vive en shared porque las mutaciones de rutas y links están en el dashboard
 * (server actions que escriben el store directo, sin pasar por el gateway), y
 * la clave la sirve el gateway en `INDEXNOW_KEY_PATH`. Ambos necesitan
 * derivar la misma clave del mismo secreto.
 */

/**
 * En la raíz a propósito: según indexnow.org/documentation, una clave en una
 * carpeta solo cubre las URLs de esa carpeta, y la de `/.well-known/` dejaba
 * afuera a `/developers` y `/pricing.md`. El nombre puede ser cualquiera si
 * el aviso lleva `keyLocation` (opción 2 del protocolo).
 */
export const INDEXNOW_KEY_PATH = '/peaje-indexnow.txt'

/** Donde vivía antes. El gateway la sigue sirviendo para los proxies ya instalados. */
export const INDEXNOW_KEY_PATH_ANTERIOR = '/.well-known/peaje-indexnow.txt'

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
 * El host donde la clave responde de verdad. `originHost` viene sin `www.`
 * (dominioVerificable), pero muchos sitios viven en `www` y redirigen el
 * apex: se sigue la redirección y se usa el host final, porque IndexNow pide
 * que `host`, `keyLocation` y cada URL sean del mismo host. Null si la clave
 * no está en la raíz (proxy sin instalar o con la lista de rutas vieja).
 */
export async function hostConClave(originHost: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${originHost}${INDEXNOW_KEY_PATH}`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    if ((await res.text()).trim() !== key) return null
    const final = new URL(res.url || `https://${originHost}${INDEXNOW_KEY_PATH}`)
    return final.pathname === INDEXNOW_KEY_PATH ? final.hostname : null
  } catch {
    return null
  }
}

/**
 * POST a IndexNow con la lista de URLs. Nunca lanza: un aviso que falla no
 * puede tirar la acción que creó la ruta. Antes de avisar confirma que la
 * clave responde en la raíz del dominio y avisa en el host donde responde;
 * si no responde, no avisa (Bing lo rechazaría) y lo loguea. Devuelve true
 * si Bing aceptó (200 o 202).
 */
export async function pingIndexNow(originHost: string, urls: string[], key: string): Promise<boolean> {
  if (urls.length === 0) return false
  const host = await hostConClave(originHost, key)
  if (!host) {
    console.warn('[indexnow] la clave no responde en la raíz, no se avisa', { host: originHost, path: INDEXNOW_KEY_PATH })
    return false
  }
  const urlList = urls.map((u) => {
    const url = new URL(u)
    if (url.hostname === originHost) url.hostname = host
    return url.toString()
  })
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}${INDEXNOW_KEY_PATH}`,
        urlList,
      }),
      signal: AbortSignal.timeout(5_000),
    })
    if (res.status === 200 || res.status === 202) return true
    console.warn('[indexnow] rechazado', { host, status: res.status })
    return false
  } catch (err) {
    console.warn('[indexnow] no se pudo avisar', { host, err: err instanceof Error ? err.message : err })
    return false
  }
}

/** Las URLs que cambian cuando cambian precios: el portal y la tabla de precios. */
export function urlsIndexNow(originHost: string): string[] {
  return [`https://${originHost}/developers`, `https://${originHost}/pricing.md`]
}
