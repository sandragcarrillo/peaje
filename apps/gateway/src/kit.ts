/**
 * El kit de instalación servido por tenant.
 *
 *   GET /:slug/kit.json?host=next     archivos listos + qué falta + qué borrar
 *   GET /:slug/kit/verify             qué está publicado en el dominio del negocio
 *   GET /:slug/kit/INSTALL.md         las instrucciones cortas para el coding agent
 *   POST /:slug/kit/visita            el proxy reporta una página que leyó un bot
 *
 * Reemplaza al prompt de 2.800 tokens que el dueño pegaba en su agente: los
 * bytes salen de acá y el agente solo decide cómo fusionar. Los datos son
 * públicos (las mismas rutas y precios que ya publica /discovery/resources),
 * así que no hay auth; lo que sí se acota es `verify`, que dispara una docena
 * de fetches al dominio del tenant por llamada.
 */
import type { Resource, Route, Tenant } from '@peaje/db'
import {
  construirKit,
  filtrarChequeos,
  parsearCapas,
  KIT_VERSION,
  manifiestoProxy,
  dominioVerificable,
  type Patron,
  installMd,
  verificarIntegracion,
  type Chequeo,
  type Entidad,
  type Oferta,
} from '@peaje/shared'
import { Hono } from 'hono'
import { gatewayBase } from './base.js'
import { resourceTitle } from './mcp.js'
import { store } from './store.js'
import { lecturaDelKit, registrarLectura } from './visitas.js'

export const kitRouter = new Hono()

/** Memo por tenant: el mismo resultado durante 15 s, para que nadie use verify como cañón. */
const VERIFY_TTL_MS = 15_000
const memo = new Map<string, { at: number; chequeos: Promise<Chequeo[]> }>()

export async function verificarConMemo(tenant: Tenant): Promise<Chequeo[]> {
  const ahora = Date.now()
  const previo = memo.get(tenant.id)
  if (previo && ahora - previo.at < VERIFY_TTL_MS) return previo.chequeos
  const chequeos = verificarIntegracion(tenant.originUrl)
  memo.set(tenant.id, { at: ahora, chequeos })
  if (memo.size > 1000) for (const [k, v] of memo) if (ahora - v.at > VERIFY_TTL_MS) memo.delete(k)
  return chequeos
}

/**
 * Ofertas para el JSON-LD y el 402 de prueba: links con precio y rutas de API
 * con path concreto. Los patrones (`/*`, `/:id`) no son una URL que un
 * comprador pueda abrir, así que quedan fuera.
 */
export function ofertasDe(tenant: Tenant, resources: Resource[], routes: Route[] = []): Oferta[] {
  const base = gatewayBase(tenant)
  const links = resources
    .filter((r) => r.active)
    .map((r) => ({ titulo: resourceTitle(r), priceUsd: Number(r.priceUsd), url: `${base}/r/${r.slug}` }))
  const apis = routes
    .filter((r) => r.active && r.method === 'GET' && !/[*:]/.test(r.pathPattern))
    .map((r) => ({ titulo: r.description ?? r.pathPattern, priceUsd: Number(r.priceUsd), url: `${base}${r.pathPattern}` }))
  return [...links, ...apis]
}

/** Rutas de API con precio, para el proxy del negocio (manifiesto y archivos del kit). */
export function patronesDe(routes: Route[]): Patron[] {
  return routes.filter((r) => r.active && Number(r.priceUsd) > 0).map((r) => ({ method: r.method, path: r.pathPattern }))
}

function originHostDe(tenant: Tenant): string {
  return dominioVerificable(tenant.originUrl) ?? new URL(tenant.originUrl).hostname
}

/** Los datos de entidad del dashboard, con los nombres que espera el builder. */
export function entidadDe(tenant: Tenant): Entidad {
  return {
    logoUrl: tenant.entityLogoUrl,
    telefono: tenant.entityPhone,
    direccion: tenant.entityAddress,
    sameAs: tenant.entitySameAs,
    descripcion: tenant.entityDescription,
  }
}

async function armarKit(tenant: Tenant, host: string | null, soloFaltantes: boolean, layers?: string | null) {
  const [resources, routes, chequeos] = await Promise.all([
    store.listResources(tenant.id),
    store.listRoutes(tenant.id),
    soloFaltantes ? verificarConMemo(tenant) : Promise.resolve(null),
  ])
  return construirKit({
    slug: tenant.slug,
    nombre: tenant.name,
    originHost: originHostDe(tenant),
    base: gatewayBase(tenant),
    ofertas: ofertasDe(tenant, resources, routes),
    patrones: patronesDe(routes),
    host,
    // Sin dominio público no hay nada que medir: va el kit completo.
    chequeos: chequeos && chequeos[0]?.id !== 'dominio' ? chequeos : null,
    entidad: entidadDe(tenant),
    sinEntrenamiento: tenant.robotsBlockTraining,
    capas: parsearCapas(layers),
  })
}

kitRouter.get('/:slug/kit.json', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  // `?all=1` trae todo aunque ya esté publicado (para el CLI en modo plan).
  // `?layers=aeo` deja fuera el proxy: solo lo que leen los motores de respuesta.
  const kit = await armarKit(tenant, c.req.query('host') ?? null, c.req.query('all') !== '1', c.req.query('layers'))
  return c.json(kit)
})

/**
 * Lista de rutas para proxies que la leen en vivo (el Worker de Cloudflare).
 * Cacheable: cambia solo cuando se despliega un gateway con rutas nuevas.
 */
kitRouter.get('/:slug/kit/manifest.json', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const routes = await store.listRoutes(tenant.id)
  // Un minuto: es lo que tarda una ruta nueva en cobrar en el dominio del negocio.
  return c.json(manifiestoProxy(gatewayBase(tenant), KIT_VERSION, patronesDe(routes)), 200, {
    'cache-control': 'public, max-age=60',
  })
})

/**
 * El proxy del kit reporta acá las páginas del sitio que leyó un bot de IA:
 * la home, el blog, todo lo que el sitio sirve solo y el gateway no ve. Sin
 * auth, como el resto del kit: hoy cualquiera ya puede pedirle una ruta al
 * gateway con el user-agent de un bot y queda registrada, y esto no abre más
 * que eso. Se acepta solo un bot de la lista, un GET o HEAD, y largos acotados.
 */
kitRouter.post('/:slug/kit/visita', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const lectura = lecturaDelKit(await c.req.json().catch(() => null))
  if (lectura === 'invalida') {
    return c.json({ error: 'Expected { path, method, userAgent }: a GET or HEAD of a page by a known AI bot.' }, 400)
  }
  if (lectura !== 'ignorar') registrarLectura(tenant.id, lectura)
  return c.body(null, 204)
})

kitRouter.get('/:slug/kit/verify', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const capas = parsearCapas(c.req.query('layers'))
  const chequeos = filtrarChequeos(await verificarConMemo(tenant), capas)
  return c.json({
    domain: dominioVerificable(tenant.originUrl),
    layers: capas,
    ok: chequeos.every((x) => x.ok),
    checks: chequeos,
    measuredAt: new Date().toISOString(),
  })
})

kitRouter.get('/:slug/kit/INSTALL.md', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.text('Tenant not found', 404)
  const kit = await armarKit(tenant, c.req.query('host') ?? null, false, c.req.query('layers'))
  return c.text(installMd(kit), 200, { 'content-type': 'text/markdown; charset=utf-8' })
})
