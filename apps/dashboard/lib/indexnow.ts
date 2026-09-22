import 'server-only'
import type { Tenant } from '@peaje/db'
import { claveIndexNow, dominioVerificable, pingIndexNow, urlsIndexNow } from '@peaje/shared'
import { after } from 'next/server'

/**
 * Aviso a IndexNow (Bing, Copilot) de que el portal y los precios cambiaron.
 * Se llama desde las server actions que crean o borran rutas y links: son
 * las únicas mutaciones de precios, y viven acá y no en el gateway.
 *
 * `after()` corre cuando la respuesta ya salió: la acción no espera al ping y
 * en Vercel la función no se congela antes de que termine. Nunca lanza. Solo
 * con dominio público: en localhost no hay nada que Bing pueda indexar.
 */
export function avisarIndexNow(tenant: Tenant): void {
  const host = dominioVerificable(tenant.originUrl)
  if (!host) return
  after(async () => {
    const key = await claveIndexNow(tenant.embedSecret)
    await pingIndexNow(host, urlsIndexNow(host), key)
  })
}
