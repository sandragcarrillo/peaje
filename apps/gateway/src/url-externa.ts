import type { Tenant } from '@peaje/db'
import { PEAJE_HOST_HEADER } from '@peaje/shared'

/**
 * Detrás del proxy de Railway el TLS termina antes de llegar acá: Node ve la
 * petición como http:// aunque el cliente pidió https://. mppx mete esa URL
 * en el challenge 402 como `resource.url`, y los clientes x402 comparan esa
 * URL contra la que pidieron: si difiere el esquema, abortan el pago
 * ("payment-required resource does not match response URL"). Se reconstruye
 * la Request con el esquema/host externos (X-Forwarded-*) antes de cobrar.
 */
export function conUrlExterna(req: Request, tenant?: Tenant): Request {
  const proto = req.headers.get('x-forwarded-proto')
  // El borde de Railway pisa X-Forwarded-Host con el host del gateway, así que
  // el proxy del negocio manda el suyo también en PEAJE_HOST_HEADER. Solo vale
  // si es el dominio del tenant: nadie puede hacer que el 402 nombre otro host.
  const propio = req.headers.get(PEAJE_HOST_HEADER)?.split(',')[0]?.trim()
  const host =
    (tenant && propio && esHostDelTenant(propio, tenant) ? propio : null) ??
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ??
    req.headers.get('host')
  if (!proto && !host) return req
  const url = new URL(req.url)
  // Cuando la petición entra por el proxy del negocio (rewrite en su host), el
  // cliente pidió `https://negocio.com/r/x`, no `https://gateway/slug/r/x`.
  // Si el host reenviado es el del negocio, el challenge tiene que nombrar esa
  // URL sin el prefijo del slug, o los clientes x402 estrictos abortan.
  let pathname = url.pathname
  if (tenant && host && esHostDelTenant(host, tenant) && pathname.startsWith(`/${tenant.slug}/`)) {
    pathname = pathname.slice(tenant.slug.length + 1)
  }
  const externa = `${proto ?? url.protocol.replace(':', '')}://${host ?? url.host}${pathname}${url.search}`
  if (externa === req.url) return req
  if (req.method === 'GET' || req.method === 'HEAD' || req.body === null) {
    return new Request(externa, req)
  }
  // Con body en stream, Node exige declarar duplex al clonar. Sin spread: una
  // Request no tiene propiedades propias y {...req} armaba un GET sin headers
  // ni body, así que el POST pago perdía la credencial y quedaba en 402.
  return new Request(externa, { method: req.method, headers: req.headers, body: req.body, duplex: 'half' } as RequestInit & { duplex: 'half' })
}

export function esHostDelTenant(host: string, tenant: Tenant): boolean {
  try {
    const origen = new URL(tenant.originUrl).hostname.replace(/^www\./, '')
    const h = host.split(':')[0]?.replace(/^www\./, '') ?? ''
    return h !== '' && (h === origen || h.endsWith(`.${origen}`))
  } catch {
    return false
  }
}
