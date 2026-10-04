/**
 * Sitio desechable con wallet custodiada y una ruta a US$0,05, para probar un
 * pago completo contra producción. Borrarlo después con la consulta de abajo.
 * Uso (desde apps/gateway): pnpm exec tsx --env-file=../../.env scripts/sitio-de-prueba.mts
 * Borrar: delete from tenants where slug like 'prueba-e2e-%';
 */
import { generateEmbedSecret } from '@peaje/shared'
import { store } from '../src/store.js'
import { createAgentWallet } from '../src/agents/wallet.js'

const slug = `prueba-e2e-${Date.now().toString(36)}`
const w = await createAgentWallet(`e2e-${slug}`)
const t = await store.createTenant({
  slug, name: 'Prueba E2E', originUrl: 'https://example.com', embedSecret: generateEmbedSecret(),
  payoutWallet: w.address, custodialWallet: w.address, custodialWalletId: w.id,
})
await store.addAllowedOrigin(t.id, 'https://example.com')
const r = await store.createRoute({ tenantId: t.id, method: 'GET', pathPattern: '/', priceUsd: '0.05', description: 'Pagina de prueba' })
console.log(JSON.stringify({ slug, tenantId: t.id, wallet: w.address, routeId: r.id }))
