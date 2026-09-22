/**
 * El kit de instalación servido por tenant.
 *
 *   GET /:slug/kit.json?host=next     archivos listos + qué falta + qué borrar
 *   GET /:slug/kit/verify             qué está publicado en el dominio del negocio
 *   GET /:slug/kit/INSTALL.md         las instrucciones cortas para el coding agent
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
  KIT_VERSION,
  manifiestoProxy,
  dominioVerificable,
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

async function armarKit(tenant: Tenant, host: string | null, soloFaltantes: boolean) {
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
    host,
    // Sin dominio público no hay nada que medir: va el kit completo.
    chequeos: chequeos && chequeos[0]?.id !== 'dominio' ? chequeos : null,
    entidad: entidadDe(tenant),
    sinEntrenamiento: tenant.robotsBlockTraining,
  })
}

kitRouter.get('/:slug/kit.json', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  // `?all=1` trae todo aunque ya esté publicado (para el CLI en modo plan).
  const kit = await armarKit(tenant, c.req.query('host') ?? null, c.req.query('all') !== '1')
  return c.json(kit)
})

/**
 * Lista de rutas para proxies que la leen en vivo (el Worker de Cloudflare).
 * Cacheable: cambia solo cuando se despliega un gateway con rutas nuevas.
 */
kitRouter.get('/:slug/kit/manifest.json', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  return c.json(manifiestoProxy(gatewayBase(tenant), KIT_VERSION), 200, {
    'cache-control': 'public, max-age=300',
  })
})

kitRouter.get('/:slug/kit/verify', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
  const chequeos = await verificarConMemo(tenant)
  return c.json({
    domain: dominioVerificable(tenant.originUrl),
    ok: chequeos.every((x) => x.ok),
    checks: chequeos,
    measuredAt: new Date().toISOString(),
  })
})

kitRouter.get('/:slug/kit/INSTALL.md', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.text('Tenant not found', 404)
  const kit = await armarKit(tenant, c.req.query('host') ?? null, false)
  return c.text(installMd(kit), 200, { 'content-type': 'text/markdown; charset=utf-8' })
})
