'use server'

import { revalidatePath } from 'next/cache'
import { getDict } from '@/lib/i18n'
import { freshScan, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'

/** Corre (o re-corre) el scan de Ora sobre el dominio del tenant. ~30 s. */
export async function correrScore(slug: string): Promise<{ ok: boolean; error?: string }> {
  const { kit: d } = await getDict()
  const tenant = await requireTenant(slug)
  const domain = scannableDomain(tenant.originUrl)
  if (!domain) {
    return { ok: false, error: d.errorOriginLocal }
  }
  const result = await freshScan(domain)
  if (!result) return { ok: false, error: d.errorScan }
  revalidatePath(`/t/${slug}/kit`)
  return { ok: true }
}

export type ChequeoId = 'dominio' | 'proxy' | 'frescura' | 'json-ld' | 'links' | 'robots'

export type ChequeoIntegracion = {
  id: ChequeoId
  label: string
  ok: boolean
  detalle: string
  /** Para el proxy: las rutas que todavía no responden desde el dominio. */
  faltantes?: string[]
}

/** Fetch que reporta el status, no solo si fue 2xx: un 402 es un éxito acá. */
async function sonda(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; text: string; delGateway: boolean }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'peaje-verificador/1.0', ...(init?.headers ?? {}) },
      ...init,
    })
    // Solo leemos el cuerpo cuando lo vamos a mirar: el resto es peso al pedo.
    const text = res.status < 400 ? await res.text() : ''
    // El gateway firma cada respuesta con RateLimit-Policy. Un archivo estático
    // o un route handler del sitio no la traen: es la huella de quién sirvió.
    return { status: res.status, text, delGateway: res.headers.has('ratelimit-policy') }
  } catch {
    return { status: 0, text: '', delGateway: false }
  }
}

/**
 * Rutas que prueban que el proxy está puesto. No están todas a propósito:
 * estas cinco son las que mueven el score, y una lista de dieciocho vueltas
 * convierte un semáforo en una auditoría.
 */
const SONDAS_PROXY: { path: string; esperado: number; post?: boolean }[] = [
  { path: '/.well-known/ard.json', esperado: 200 },
  { path: '/openapi.json', esperado: 200 },
  { path: '/discovery/resources', esperado: 200 },
  { path: '/.well-known/ucp', esperado: 200 },
  { path: '/developers', esperado: 200 },
  { path: '/mcp', esperado: 200, post: true },
]

/**
 * Rutas donde una copia congelada hace más daño. Un 200 no alcanza: la copia
 * también responde 200. Lo que la delata es que no viene del gateway, y eso
 * se ve en las cabeceras. Es el bug que dejó un ai-catalog.json con esquema
 * 0.91 sirviéndose durante días mientras el gateway ya emitía 1.0.
 */
const TAPABLES = ['/.well-known/ard.json', '/openapi.json', '/.well-known/api-catalog', '/llms.txt']

/**
 * Qué del kit está realmente publicado en el dominio del negocio.
 *
 * El chequeo del proxy es uno solo con varias sondas adentro: para el usuario
 * "conectaste el dominio" es una sola decisión, y partirla en cinco líneas
 * rojas hace parecer que hay cinco cosas por hacer cuando hay una.
 */
export async function verificarIntegracion(slug: string): Promise<ChequeoIntegracion[]> {
  const { kit: d } = await getDict()
  const tenant = await requireTenant(slug)
  const domain = scannableDomain(tenant.originUrl)
  if (!domain) {
    return [{ id: 'dominio', label: d.chequeoDominio, ok: false, detalle: d.chequeoDominioDetalle }]
  }

  const site = `https://${domain}`

  const [proxy, frescura, home, robots] = await Promise.all([
    Promise.all(
      SONDAS_PROXY.map(async (s) => ({
        path: s.path,
        ok:
          (await sonda(
            `${site}${s.path}`,
            s.post
              ? {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                  },
                  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
                }
              : undefined,
          )).status === s.esperado,
      })),
    ),
    Promise.all(
      TAPABLES.map(async (path) => {
        const r = await sonda(`${site}${path}`)
        // Un 404 no es una copia: eso lo reporta el chequeo del proxy.
        return { path, vieja: r.status === 200 && !r.delGateway }
      }),
    ),
    sonda(site),
    sonda(`${site}/robots.txt`),
  ])

  const faltantes = proxy.filter((p) => !p.ok).map((p) => p.path)
  const viejas = frescura.filter((f) => f.vieja).map((f) => f.path)
  const html = home.text

  return [
    {
      id: 'proxy',
      label: d.chequeoProxy,
      ok: faltantes.length === 0,
      detalle:
        faltantes.length === 0
          ? d.chequeoProxyOk
          : faltantes.length === SONDAS_PROXY.length
            ? d.chequeoProxyFalta
            : d.chequeoProxyParcial(faltantes.length, SONDAS_PROXY.length),
      faltantes,
    },
    {
      id: 'frescura',
      label: d.chequeoFrescura,
      ok: viejas.length === 0,
      detalle: viejas.length === 0 ? d.chequeoFrescuraOk : d.chequeoFrescuraVieja(viejas.join(', ')),
      faltantes: viejas,
    },
    {
      id: 'json-ld',
      label: d.chequeoJsonLd,
      ok: html.includes('application/ld+json'),
      detalle: html.includes('application/ld+json') ? d.chequeoJsonLdOk : d.chequeoJsonLdFalta,
    },
    {
      id: 'links',
      label: d.chequeoLink,
      // `service-desc` es la relación registrada que emite el kit; la vieja
      // `payment-discovery` sigue contando para no marcar en rojo a quien ya
      // aplicó la versión anterior.
      ok: html.includes('rel="service-desc"') || html.includes('payment-discovery'),
      detalle:
        html.includes('rel="service-desc"') || html.includes('payment-discovery')
          ? d.chequeoLinkOk
          : home.status === 200
            ? d.chequeoLinkFalta
            : d.chequeoLinkSinHome,
    },
    {
      id: 'robots',
      label: d.chequeoRobots,
      ok: robots.status === 200 && !/Disallow:\s*\/\s*$/m.test(robots.text),
      detalle:
        robots.status !== 200
          ? d.chequeoRobotsFalta
          : /Disallow:\s*\/\s*$/m.test(robots.text)
            ? d.chequeoRobotsBloquea
            : d.chequeoRobotsOk,
    },
  ]
}
