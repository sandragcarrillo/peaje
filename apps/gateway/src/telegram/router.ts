import { Hono } from 'hono'
import { env } from '../env.js'
import { store } from '../store.js'
import { bandeja, modoPrueba, tg } from './api.js'
import { enlaceParaConectar, procesarUpdate, type Update } from './bot.js'

/**
 *   POST /telegram/webhook                  updates de Telegram (header secreto)
 *   POST /_internal/:slug/telegram/link     enlace de un solo uso para conectar
 *   GET  /_internal/:slug/telegram          chats conectados
 *   DELETE /_internal/:slug/telegram        desconecta todos
 *   GET  /_internal/telegram/outbox         lo que el bot habría mandado (solo modo prueba)
 */
export const telegramRouter = new Hono()

const secretoWebhook = () => process.env.TELEGRAM_WEBHOOK_SECRET ?? ''

telegramRouter.post('/telegram/webhook', async (c) => {
  const ok = modoPrueba()
    ? /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.req.header('host') ?? '')
    : !!secretoWebhook() && c.req.header('x-telegram-bot-api-secret-token') === secretoWebhook()
  if (!ok) return c.json({ ok: false }, 401)
  const update = (await c.req.json().catch(() => null)) as Update | null
  // Telegram espera un 200 rápido; el agente puede tardar. Se procesa aparte,
  // pero en fila por chat: si no, un mensaje puede adelantarse a /start.
  if (update) encolar(update)
  return c.json({ ok: true })
})

const filas = new Map<number, Promise<void>>()
function encolar(update: Update): void {
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? 0
  const previa = filas.get(chatId) ?? Promise.resolve()
  const siguiente = previa.then(() => procesarUpdate(update)).catch((e) => console.error('[telegram] update', e))
  filas.set(chatId, siguiente)
  void siguiente.finally(() => {
    if (filas.get(chatId) === siguiente) filas.delete(chatId)
  })
}

telegramRouter.use('/_internal/*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) return c.json({ error: 'No autorizado' }, 401)
  await next()
})

telegramRouter.get('/_internal/telegram/outbox', (c) => c.json({ testMode: modoPrueba(), outbox: modoPrueba() ? bandeja : [] }))

telegramRouter.post('/_internal/:slug/telegram/link', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  return c.json(await enlaceParaConectar(tenant))
})

telegramRouter.get('/_internal/:slug/telegram', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const links = await store.listTelegramLinks(tenant.id)
  return c.json({ configured: !modoPrueba(), links: links.map((l) => ({ username: l.username, language: l.language, linkedAt: l.linkedAt })) })
})

telegramRouter.delete('/_internal/:slug/telegram', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  await store.unlinkTelegram({ tenantId: tenant.id })
  return c.json({ ok: true })
})

/** Registra el webhook al arrancar (idempotente). Sin token o sin URL pública, no hace nada. */
export async function registrarWebhook(): Promise<void> {
  if (modoPrueba() || !secretoWebhook()) return
  const base = process.env.GATEWAY_PUBLIC_URL ?? env.publicUrl
  if (!/^https:\/\//.test(base)) return
  await tg('setWebhook', { url: `${base.replace(/\/$/, '')}/telegram/webhook`, secret_token: secretoWebhook(), allowed_updates: ['message', 'callback_query'] })
  await tg('setMyCommands', {
    commands: [
      { command: 'help', description: 'What I can do' },
      { command: 'stop', description: 'Disconnect this chat' },
    ],
  })
}
