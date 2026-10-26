/**
 * Content Security Policy del dashboard (usepeaje.com), armada por request en
 * proxy.ts con un nonce nuevo. Next.js lee el nonce del header de la request
 * y lo pone solo en sus scripts; el script del tema en app/layout.tsx lo lee
 * de `x-nonce`.
 *
 * Sin 'unsafe-inline' en scripts: solo corren los del mismo origen, los que
 * traen el nonce y los hosts listados. Sin 'strict-dynamic' a propósito: con
 * él los hosts no cuentan y el toolbar de Vercel (preview) quedaría afuera;
 * los dos scripts de terceros que se cargan solos (Paddle.js y Turnstile de
 * Privy) están listados por host.
 *
 * De dónde sale cada dominio:
 * - Privy (docs.privy.io/security/implementation-guide/content-security-policy):
 *   auth.privy.io (iframe y API), *.rpc.privy.systems (RPC de las wallets
 *   embebidas), explorer-api.walletconnect.com (el SDK lo pide al cargar
 *   aunque no haya wallets externas), challenges.cloudflare.com (Turnstile,
 *   si se prende el captcha en el dashboard de Privy). Login solo por email:
 *   sin los relays de WalletConnect ni Coinbase.
 * - Paddle.js: cdn.paddle.com (el script; en sandbox su CSS viene de
 *   sandbox-cdn.paddle.com, en style-src), el checkout en iframe
 *   ([sandbox-]buy.paddle.com) y su API ([sandbox-]checkout-service.paddle.com).
 *   Paddle no publica una lista; se verificó abriendo el checkout en sandbox.
 * - Gateway de Peaje: NEXT_PUBLIC_GATEWAY_URL y api.usepeaje.com.
 * - Vercel: vercel.live y compañía solo en preview (toolbar y comentarios,
 *   vercel.com/docs/vercel-toolbar/managing-toolbar).
 * - Fuentes: next/font las sirve desde el mismo origen.
 */

const origen = (url: string | undefined): string | null => {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

export function politicaCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development'
  const preview = process.env.VERCEL_ENV === 'preview'
  const sandbox = process.env.NEXT_PUBLIC_PADDLE_ENV !== 'production'

  const paddleCheckout = sandbox ? 'https://sandbox-buy.paddle.com' : 'https://buy.paddle.com'
  const paddleApi = sandbox ? 'https://sandbox-checkout-service.paddle.com' : 'https://checkout-service.paddle.com'
  // paddle.js sale siempre de cdn.paddle.com; en sandbox trae su CSS (y lo que cargue) de sandbox-cdn.
  const paddleCdn = sandbox ? ['https://cdn.paddle.com', 'https://sandbox-cdn.paddle.com'] : ['https://cdn.paddle.com']
  const gateways = [...new Set([origen(process.env.NEXT_PUBLIC_GATEWAY_URL), 'https://api.usepeaje.com'].filter((x): x is string => !!x))]
  const vercel = (...x: string[]) => (preview ? x : [])

  const marcos = ['https://auth.privy.io', 'https://challenges.cloudflare.com', paddleCheckout, ...vercel('https://vercel.live')]

  const directivas: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      ...paddleCdn,
      'https://challenges.cloudflare.com',
      // React usa eval en desarrollo para reconstruir los stacks del server; en producción no.
      ...(dev ? ["'unsafe-eval'"] : []),
      ...vercel('https://vercel.live'),
    ],
    // Privy, Paddle.js y Next ponen estilos inline: la guía de Privy pide 'unsafe-inline' acá.
    'style-src': ["'self'", "'unsafe-inline'", ...paddleCdn, ...vercel('https://vercel.live')],
    'img-src': ["'self'", 'data:', 'blob:', ...vercel('https://vercel.live', 'https://vercel.com')],
    'font-src': ["'self'", ...vercel('https://vercel.live', 'https://assets.vercel.com')],
    'connect-src': [
      "'self'",
      'https://auth.privy.io',
      'https://*.rpc.privy.systems',
      // Privy lo consulta al cargar aunque el login sea solo por email.
      'https://explorer-api.walletconnect.com',
      paddleApi,
      ...gateways,
      ...vercel('https://vercel.live', 'wss://ws-us3.pusher.com'),
    ],
    'frame-src': marcos,
    'child-src': marcos,
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }

  const texto = Object.entries(directivas).map(([k, v]) => `${k} ${v.join(' ')}`)
  // En local (http://localhost) subir a https rompería el gateway en :8787.
  if (!dev) texto.push('upgrade-insecure-requests')
  return texto.join('; ')
}
