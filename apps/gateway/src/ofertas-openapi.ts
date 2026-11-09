import type { Tenant } from '@peaje/db'
import { cadena, isSettlementNetwork } from '@peaje/shared'
import { generate } from 'mppx/discovery'
import { contextoCobro, nuevoContexto } from './contexto.js'
import { env } from './env.js'
import { mppx } from './mpp.js'
import { redesDocumentadas } from './settlement.js'

type RutaConPrecio = { method: string; pathPattern: string; priceUsd: string; description?: string | null }
type Operacion = { 'x-payment-info'?: { offers?: { method?: string; currency?: string }[] } }

/**
 * El openapi.json con las ofertas de pago de cada ruta con precio, iguales a
 * las del 402. Cada oferta se arma dentro del contexto de un cobro de este
 * negocio: sin él, la de Tempo salía sin el reparto y con la treasury de Peaje
 * como destino, en vez de la wallet del negocio con el 2% aparte. Y como
 * `generate` no corre canOffer, se sacan a mano las ofertas de contrato cuyo
 * token el contrato no acepta (ver aceptaToken en settlement.ts).
 */
export function openapiConOfertas(tenant: Pick<Tenant, 'id' | 'name' | 'payoutWallet'>, routes: RutaConPrecio[]) {
  const doc = generate(mppx, {
    info: { title: `${tenant.name} · Peaje`, version: '1.0.0' },
    routes: routes.map((route) => ({
      handler: contextoCobro.run(nuevoContexto(tenant.payoutWallet, route.priceUsd, { tenantId: tenant.id, path: route.pathPattern }), () =>
        mppx.charge({
          amount: route.priceUsd,
          description: route.description ?? `${route.method} ${route.pathPattern}`,
        }),
      ),
      method: route.method,
      path: route.pathPattern,
      summary: route.description ?? undefined,
    })),
  })
  const aceptados = new Set(
    redesDocumentadas()
      .filter(isSettlementNetwork)
      .map((id) => cadena(id, env.testnet)!.token.toLowerCase()),
  )
  for (const operaciones of Object.values((doc.paths ?? {}) as Record<string, Record<string, Operacion>>)) {
    for (const op of Object.values(operaciones)) {
      const info = op['x-payment-info']
      if (info?.offers) info.offers = info.offers.filter((o) => o.method !== 'evm' || aceptados.has(String(o.currency).toLowerCase()))
    }
  }
  return doc
}
