/**
 * IndexNow del lado del gateway: la clave que Bing va a buscar al dominio del
 * negocio y el aviso cuando cambian precios.
 *
 *   GET /:slug/.well-known/peaje-indexnow.txt   la clave, en texto plano
 *
 * El proxy del kit reenvía esa ruta desde el dominio del negocio, así que
 * `keyLocation` apunta ahí y Bing la valida contra el mismo host que las
 * URLs avisadas. La derivación y el POST viven en @peaje/shared porque las
 * mutaciones de rutas están en el dashboard; acá solo se sirve la clave.
 */
import type { Tenant } from '@peaje/db'
import { claveIndexNow, dominioVerificable, INDEXNOW_KEY_PATH, pingIndexNow, urlsIndexNow } from '@peaje/shared'
import { Hono } from 'hono'
import { store } from './store.js'

export { pingIndexNow }

export const indexNowRouter = new Hono()

indexNowRouter.get(`/:slug${INDEXNOW_KEY_PATH}`, async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.text('Tenant not found', 404)
  return c.text(await claveIndexNow(tenant.embedSecret), 200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'public, max-age=3600',
  })
})

/**
 * Aviso de que el portal y los precios cambiaron. Fire and forget: no espera,
 * no lanza. Solo con dominio público: en localhost no hay nada que indexar.
 */
export function avisarIndexNow(tenant: Tenant): void {
  const host = dominioVerificable(tenant.originUrl)
  if (!host) return
  void claveIndexNow(tenant.embedSecret).then((key) => pingIndexNow(host, urlsIndexNow(host), key))
}
