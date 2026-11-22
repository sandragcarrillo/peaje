import { gatewayUrl } from '@/lib/config'
import { onboardMd } from '@/lib/onboard'

/**
 * El archivo que lee el agente del dueño para configurar Peaje. Es el mismo
 * para todos: no lleva datos de ningún negocio ni secretos (lib/onboard.ts).
 */
export const dynamic = 'force-static'

export function GET() {
  return new Response(onboardMd(`${gatewayUrl}/_owner/mcp`, process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  })
}
