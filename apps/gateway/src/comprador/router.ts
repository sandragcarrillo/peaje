import type { Tenant } from '@peaje/db'
import { Hono, type MiddlewareHandler } from 'hono'
import { env } from '../env.js'
import { store } from '../store.js'
import { probarAhora } from './misterioso.js'
// ---- M9 ----
import { sinPro } from '../billing/acceso.js'
import { cobrarAccion } from '../tareas/creditos.js'

/**
 * Comprador misterioso, para el dashboard (secreto interno):
 *   GET  /_internal/:slug/mystery       la última corrida
 *   POST /_internal/:slug/mystery/run   corre ahora (una vez cada 6 horas por negocio)
 *                                       {language?}: cuesta `comprador` en créditos, como en el chat;
 *                                       sin saldo, 429 con error 'not-enough-credits' y el texto del chat
 *
 * Nunca paga ni firma nada: descubre, elige y pide el 402 sin pagar.
 */
export const compradorRouter = new Hono<{ Variables: { tenant: Tenant } }>()

compradorRouter.onError((err, c) => {
  console.error('[comprador] error no manejado', err)
  return c.json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
})

const auth: MiddlewareHandler<{ Variables: { tenant: Tenant } }> = async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  const tenant = await store.getTenantBySlug(c.req.param('slug') ?? '')
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  c.set('tenant', tenant)
  await next()
}
compradorRouter.use('/:slug/mystery', auth)
compradorRouter.use('/:slug/mystery/*', auth)

compradorRouter.get('/:slug/mystery', async (c) => c.json({ run: await store.lastMysteryRun(c.get('tenant').id) }))

compradorRouter.post('/:slug/mystery/run', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { language?: unknown }
  const idioma = b.language === 'es' ? 'es' : 'en'
  const tenant = c.get('tenant')
  const bloqueo = sinPro(tenant, idioma) // M9: el comprador misterioso es Pro
  if (bloqueo) return c.json(bloqueo, 403)
  // Cuesta lo mismo que run_mystery_shopper en el chat; si toca esperar o falla, se devuelve.
  const r = await cobrarAccion(tenant, 'comprador', { idioma, motivo: 'dashboard:run_mystery_shopper', entrego: (x) => !('error' in x) }, () => probarAhora(tenant))
  if ('sinCreditos' in r) return c.json(r.sinCreditos, 429)
  if ('error' in r.valor) return c.json(r.valor, 429)
  return c.json({ run: r.valor })
})
