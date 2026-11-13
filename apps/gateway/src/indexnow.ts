/**
 * IndexNow del lado del gateway: la clave que Bing va a buscar al dominio del
 * negocio y el aviso cuando cambian precios.
 *
 *   GET /:slug/peaje-indexnow.txt               la clave, en texto plano
 *   GET /:slug/.well-known/peaje-indexnow.txt   la misma, donde vivía antes
 *
 * El proxy del kit reenvía la de la raíz desde el dominio del negocio, así
 * que `keyLocation` apunta ahí y Bing la valida contra el mismo host que las
 * URLs avisadas. La de `/.well-known/` queda para los proxies instalados con
 * la lista de rutas vieja: no cubre `/developers`, así que no se avisa con ella. La derivación y el POST viven en @peaje/shared porque las
 * mutaciones de rutas están en el dashboard; acá solo se sirve la clave.
 */
import type { Tenant } from '@peaje/db'
import { claveIndexNow, dominioVerificable, INDEXNOW_KEY_PATH, INDEXNOW_KEY_PATH_ANTERIOR, pingIndexNow, urlsIndexNow } from '@peaje/shared'
import { Hono } from 'hono'
import { store } from './store.js'

export { pingIndexNow }

export const indexNowRouter = new Hono()

for (const path of [INDEXNOW_KEY_PATH, INDEXNOW_KEY_PATH_ANTERIOR]) {
  indexNowRouter.get(`/:slug${path}`, async (c) => {
    const tenant = await store.getTenantBySlug(c.req.param('slug'))
    if (!tenant) return c.text('Tenant not found', 404)
    return c.text(await claveIndexNow(tenant.embedSecret), 200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    })
  })
}

/**
 * Aviso de que el portal y los precios cambiaron. Fire and forget: no espera,
 * no lanza. Solo con dominio público: en localhost no hay nada que indexar.
 */
export function avisarIndexNow(tenant: Tenant): void {
  const host = dominioVerificable(tenant.originUrl)
  if (!host) return
  void claveIndexNow(tenant.embedSecret).then((key) => pingIndexNow(host, urlsIndexNow(host), key))
}
