/**
 * `<PeajeHead slug="..." />`: el bloque del <head> que ningún proxy puede
 * poner por vos. JSON-LD WebAPI con las ofertas reales del gateway y los
 * cuatro <link> de discovery. Server component: corre en build o en request,
 * nunca en el cliente.
 *
 * Regla dura: un gateway caído no puede romper el build ni el render. Todo
 * fetch tiene timeout corto y cualquier error degrada a JSON-LD sin ofertas.
 */
import { jsonLdWebApi, jsonParaScript, LINKS_HEAD } from '@peaje/shared'
import { baseDe, type OpcionesPeaje } from './index'

/** Igual al `Oferta` de shared, redeclarado para que el .d.ts publicado no apunte a un paquete privado. */
export type Oferta = { titulo: string; priceUsd: number; url: string }

export type PropsPeajeHead = OpcionesPeaje & {
  /** Host del negocio para las URLs del JSON-LD. Por defecto, el de la request. */
  originHost?: string
  /** Nombre del negocio. Por defecto se lee del gateway, o se usa el slug. */
  name?: string
}

const TIMEOUT_MS = 2_000

/** Un `fetch` que devuelve null ante cualquier falla, incluida la ausencia de red. */
async function leerJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // `next` es la extensión de Next.js al RequestInit; fuera de Next se ignora.
      ...({ next: { revalidate: 3600 } } as Record<string, unknown>),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

type Discovery = {
  items?: { resource: string; extensions?: { bazaar?: { info?: { title?: string; priceUsd?: number } } } }[]
}

/**
 * Ofertas desde `/discovery/resources`, el catálogo canónico: así el JSON-LD
 * dice lo mismo que el 402 cobra. Los patrones (`/*`, `/:id`) no son una URL
 * que un comprador pueda abrir, así que quedan fuera.
 */
export async function ofertasDesdeGateway(base: string): Promise<Oferta[]> {
  const cuerpo = await leerJson<Discovery>(`${base}/discovery/resources`)
  return (cuerpo?.items ?? [])
    .filter((i) => typeof i.resource === 'string' && esUrlConcreta(i.resource))
    .map((i) => ({
      titulo: i.extensions?.bazaar?.info?.title ?? i.resource,
      priceUsd: Number(i.extensions?.bazaar?.info?.priceUsd ?? 0),
      url: i.resource,
    }))
}

function esUrlConcreta(url: string): boolean {
  try {
    return !/[*:]/.test(new URL(url).pathname)
  } catch {
    return false
  }
}

async function nombreDesdeGateway(base: string): Promise<string | null> {
  const card = await leerJson<{ name?: string }>(`${base}/.well-known/agent-card.json`)
  return card?.name ?? null
}

/**
 * Host de la request vía `next/headers`. Import dinámico y en try: fuera de
 * un request scope (build estático, tests, otro framework) `headers()` lanza
 * o no existe, y en ese caso se usa el prop.
 */
async function hostDeLaRequest(): Promise<string | null> {
  try {
    const mod = (await import('next/headers')) as { headers: () => Promise<Headers> | Headers }
    const h = await mod.headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    return host ? host.split(',')[0]!.trim() : null
  } catch {
    return null
  }
}

export async function PeajeHead(props: PropsPeajeHead) {
  const base = baseDe(props)
  const [ofertas, nombreRemoto, hostRequest] = await Promise.all([
    ofertasDesdeGateway(base),
    props.name ? Promise.resolve(null) : nombreDesdeGateway(base),
    props.originHost ? Promise.resolve(null) : hostDeLaRequest(),
  ])
  const originHost = props.originHost ?? hostRequest ?? 'localhost'
  const datos = jsonLdWebApi({
    nombre: props.name ?? nombreRemoto ?? props.slug,
    slug: props.slug,
    originHost,
    ofertas,
  })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonParaScript(datos) }} />
      {LINKS_HEAD.map((l) => (
        <link key={l.rel} rel={l.rel} type={l.type} href={l.href} />
      ))}
    </>
  )
}

export default PeajeHead
