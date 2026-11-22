import { gatewayUrl } from '@/lib/config'
import { llmsPropio } from '@/lib/llms'

/**
 * El llms.txt propio del sitio. Los visitantes ven el del gateway (rewrite de
 * withPeaje), que lee este con `x-peaje-fetch` y le agrega la sección de pagos.
 */
export const dynamic = 'force-static'

export function GET() {
  return new Response(llmsPropio(process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com', `${gatewayUrl}/_owner/mcp`), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
