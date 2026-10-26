import { NextResponse, type NextRequest } from 'next/server'
import { peajeProxy } from '@peaje/next/proxy'
import { RUTAS_DINAMICAS, RUTAS_PROXY } from '@peaje/shared/kit/rutas'
import { politicaCsp } from './lib/csp'

// Los archivos del kit (llms.txt, openapi.json, .well-known/*, /developers…)
// los sirve el gateway por los rewrites de withPeaje: no son páginas de este
// dashboard y llevan su propia política (el portal /developers tiene su HTML).
const KIT = new Set<string>(RUTAS_PROXY.map((r) => r.path))
const esKit = (path: string) => KIT.has(path) || RUTAS_DINAMICAS.some((r) => path.startsWith(r.prefijo))

/**
 * CSP con nonce por request (guía de CSP de Next.js 16). El nonce va en el
 * header de la request para que Next lo ponga en sus scripts y en `x-nonce`
 * para el script del tema del layout. Los otros headers de seguridad
 * (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) van fijos en
 * next.config.ts.
 */
function conCsp(req: NextRequest) {
  if (esKit(req.nextUrl.pathname)) return NextResponse.next()
  const nonce = btoa(crypto.randomUUID())
  const csp = politicaCsp(nonce)
  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

// Responde el 402 en usepeaje.com para las rutas con precio del sitio "peaje";
// lo demás (login, dashboard, radar) sigue a conCsp.
export default peajeProxy({ slug: 'peaje' }, conCsp)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
