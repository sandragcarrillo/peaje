import type { GoogleConnection, Tenant } from '@peaje/db'
import { store } from '../store.js'
import { configurado, ErrorGoogle, inspeccionar, rendimiento, sitemaps, urlEnPropiedad, type Fila, type Filtro } from './api.js'

/**
 * Lo que el agente lee del Search Console del negocio: totales, búsquedas y
 * páginas, y dos listas de oportunidades (se ven y nadie hace clic; casi en
 * la primera página). Más la inspección de una URL. Cada lectura deja
 * last_used_at o, si Google la rechaza, last_error para el dashboard.
 */

const DASHBOARD = (process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com').replace(/\/$/, '')
export const urlConectar = (slug: string) => `${DASHBOARD}/t/${slug}/integraciones#google`

/** Una fecha YYYY-MM-DD en hora del Pacífico (la de Search Console), `menos` días atrás. */
export function fechaPacifico(ahora: Date, menos: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
  const d = new Date(`${hoy}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - menos)
  return d.toISOString().slice(0, 10)
}

/** `dias` días que terminan ayer. Los últimos dos pueden venir incompletos. */
export const rango = (dias: number, ahora = new Date()) => ({ desde: fechaPacifico(ahora, dias), hasta: fechaPacifico(ahora, 1) })

const cifras = (f: Fila) => ({ clicks: f.clicks, impressions: f.impressions, ctrPct: Math.round(f.ctr * 1000) / 10, position: Math.round(f.position * 10) / 10 })

export type SinDatos = { connected: false; reason: 'not-configured' | 'not-connected' | 'no-property'; message: string; howToConnect: string }
export type ConError = { connected: true; error: 'reconnect' | 'no-property' | 'google'; message: string; howToConnect: string }

type Lista = { con: GoogleConnection; propiedad: string }

async function conexion(tenant: Tenant): Promise<Lista | SinDatos> {
  const howToConnect = urlConectar(tenant.slug)
  if (!configurado()) return { connected: false, reason: 'not-configured', message: 'Google Search Console is not set up in Peaje yet.', howToConnect }
  const con = await store.getGoogleConnection(tenant.id)
  if (!con) return { connected: false, reason: 'not-connected', message: 'The owner has not connected Google Search Console. They connect it in Integrations, Google Search Console.', howToConnect }
  if (!con.property) {
    return {
      connected: false,
      reason: 'no-property',
      message: `The Google account${con.email ? ` ${con.email}` : ''} is connected but has no Search Console property for this site. The owner adds the site in Search Console or picks another property in Integrations.`,
      howToConnect,
    }
  }
  return { con, propiedad: con.property }
}

/** Un error de Google queda en la fila (el dashboard lo muestra) y vuelve al agente con el link para reconectar. */
async function fallo(tenant: Tenant, e: unknown): Promise<ConError> {
  const codigo = e instanceof ErrorGoogle && (e.codigo === 'reconnect' || e.codigo === 'no-property') ? e.codigo : 'google'
  const message = e instanceof Error ? e.message : String(e)
  await store.updateGoogleConnection(tenant.id, { lastError: `${codigo}: ${message}`.slice(0, 300) }).catch(() => undefined)
  return { connected: true, error: codigo, message, howToConnect: urlConectar(tenant.slug) }
}

const usada = (tenant: Tenant) => store.updateGoogleConnection(tenant.id, { lastUsedAt: new Date().toISOString(), lastError: null }).catch(() => undefined)

export type Resumen = Awaited<ReturnType<typeof resumenConsola>>

export async function resumenConsola(tenant: Tenant, op: { dias: 7 | 28 | 90; consulta?: string; pagina?: string }, ahora = new Date()) {
  const c = await conexion(tenant)
  if ('connected' in c) return c
  const { desde, hasta } = rango(op.dias, ahora)
  const filtros: Filtro[] = [
    ...(op.consulta ? [{ dimension: 'query' as const, operator: 'contains' as const, expression: op.consulta.slice(0, 200) }] : []),
    ...(op.pagina ? [{ dimension: 'page' as const, operator: 'contains' as const, expression: op.pagina.slice(0, 200) }] : []),
  ]
  try {
    const [total, consultas, paginas, mapas] = await Promise.all([
      rendimiento(c.con, c.propiedad, { desde, hasta, dimensiones: [], filas: 1, filtros }),
      rendimiento(c.con, c.propiedad, { desde, hasta, dimensiones: ['query'], filas: 250, filtros }),
      rendimiento(c.con, c.propiedad, { desde, hasta, dimensiones: ['page'], filas: 250, filtros }),
      sitemaps(c.con, c.propiedad).catch(() => []),
    ])
    await usada(tenant)
    // Con pocos datos un umbral fijo deja todo afuera: escala con el rango.
    const minimo = Math.max(5, Math.round(op.dias / 3))
    const porImpresiones = (a: Fila, b: Fila) => b.impressions - a.impressions
    const fila = (f: Fila) => ({ key: f.keys[0] ?? '', ...cifras(f) })
    return {
      connected: true as const,
      property: c.propiedad,
      account: c.con.email,
      range: { from: desde, to: hasta, days: op.dias, timezone: 'America/Los_Angeles' },
      filters: filtros.length ? { query: op.consulta ?? null, page: op.pagina ?? null } : null,
      totals: total[0] ? cifras(total[0]) : { clicks: 0, impressions: 0, ctrPct: 0, position: null },
      topQueries: consultas.slice(0, 20).map(fila),
      topPages: paginas.slice(0, 20).map(fila),
      opportunities: {
        // Google ya muestra el sitio en estas búsquedas y nadie entra: título, descripción o la respuesta de la página.
        queriesWithoutClicks: consultas.filter((f) => f.clicks === 0 && f.impressions >= minimo).sort(porImpresiones).slice(0, 10).map(fila),
        // Entre el puesto 8 y el 20: un empujón las pone donde se hace clic.
        queriesAlmostFirstPage: consultas.filter((f) => f.position >= 8 && f.position <= 20 && f.impressions >= minimo).sort(porImpresiones).slice(0, 10).map(fila),
        pagesWithoutClicks: paginas.filter((f) => f.clicks === 0 && f.impressions >= minimo).sort(porImpresiones).slice(0, 10).map(fila),
      },
      sitemaps: mapas.map((s) => ({ path: s.path ?? null, lastDownloaded: s.lastDownloaded ?? null, pending: !!s.isPending, errors: Number(s.errors ?? 0), warnings: Number(s.warnings ?? 0) })),
      note: 'Google Search numbers (web). They include AI Overviews and AI Mode without separating them: the AI-only report exists in Search Console but not in its API. The last two days can be incomplete. ctrPct is a percentage; position is the average rank (1 is the top).',
    }
  } catch (e) {
    return fallo(tenant, e)
  }
}

/** Qué sabe Google de una URL del sitio: si está indexada, cuándo pasó, qué canónica eligió. */
export async function inspeccionUrl(tenant: Tenant, url: string, idioma: 'es' | 'en') {
  const c = await conexion(tenant)
  if ('connected' in c) return c
  if (!urlEnPropiedad(url, c.propiedad)) return { connected: true as const, error: 'outside-property' as const, message: `${url} is not under the Search Console property ${c.propiedad}.` }
  try {
    const r = await inspeccionar(c.con, c.propiedad, url, idioma)
    await usada(tenant)
    const i = r.indexStatusResult ?? {}
    return {
      connected: true as const,
      url,
      indexed: i.verdict === 'PASS',
      verdict: i.verdict ?? null,
      coverage: i.coverageState ?? null,
      lastCrawl: i.lastCrawlTime ?? null,
      fetch: i.pageFetchState ?? null,
      robotsTxt: i.robotsTxtState ?? null,
      indexing: i.indexingState ?? null,
      googleCanonical: i.googleCanonical ?? null,
      declaredCanonical: i.userCanonical ?? null,
      // Google eligió otra canónica que la declarada: esta URL no va a salir como tal.
      canonicalMismatch: !!(i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical),
      inSitemaps: i.sitemap ?? [],
      linkedFrom: (i.referringUrls ?? []).slice(0, 5),
      openInSearchConsole: r.inspectionResultLink ?? null,
    }
  } catch (e) {
    return fallo(tenant, e)
  }
}
