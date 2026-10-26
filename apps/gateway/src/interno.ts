import { Hono } from 'hono'
import { GATEWAY_RAIL_IDS, NETWORK_IDS, railExplorerTxUrl, SETTLEMENT_NETWORKS } from '@peaje/shared'
import { env } from './env.js'
import { contratoV3, feeRecipientV3, relayerAddress } from './settlement.js'
import { store } from './store.js'
import { treasuryBalance } from './treasury.js'

/**
 * API interna del gateway. La consume solo el dashboard (y el equipo, para
 * los pagos adelantados), autenticada con un secreto compartido: las llaves
 * de la treasury y del relayer viven únicamente en el gateway.
 *
 * Ya no hay retiros: cada pago llega a la wallet de cobro del negocio en la
 * misma transacción (docs/pagos-directos.md).
 */
export const interno = new Hono()

interno.use('*', async (c, next) => {
  const auth = c.req.header('authorization')
  if (auth !== `Bearer ${env.internalSecret}`) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  await next()
})

/** Ingresos del negocio: cada pago con su tx, el neto y la dirección a la que llegó. */
interno.get('/:slug/ledger', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const payments = await store.listPayments(tenant.id)
  const balance = await store.balance(tenant.id)
  return c.json({
    revenue: { net: balance.revenue, requestCount: balance.requestCount },
    payoutWallet: tenant.payoutWallet,
    payments: payments.map((p) => ({
      ...p,
      explorer: railExplorerTxUrl(p.network, p.receiptRef, env.testnet),
    })),
  })
})

/**
 * Pagos adelantados (front-run) que el Safe tiene que repartir con
 * settleStray. Cada fila trae los argumentos tal cual los pide el contrato.
 */
interno.get('/strays', async (c) => {
  const estado = c.req.query('status')
  const strays = await store.listStrays(estado === 'settled' ? 'settled' : estado === 'all' ? undefined : 'pending')
  return c.json({
    strays: strays.map((s) => ({
      ...s,
      settleStrayArgs: { token: s.token, merchant: s.merchant, from: s.payer, value: s.value, nonce: s.nonce, networkFee: s.networkFee },
    })),
  })
})

/** El Safe ya corrió settleStray: se anota la tx y la fila deja de estar pendiente. */
interno.post('/strays/:id/settled', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { tx?: string }
  if (!body.tx || !/^0x[0-9a-fA-F]{64}$/.test(body.tx)) return c.json({ error: 'tx inválida' }, 400)
  const stray = await store.resolveStray(c.req.param('id'), body.tx)
  if (!stray) return c.json({ error: 'No encontrado' }, 404)
  return c.json({ stray })
})

/** Saldos propios de Peaje (treasury) y estado de los rieles de contrato. */
interno.get('/treasury/balance', async (c) => {
  const balances = Object.fromEntries(
    await Promise.all(
      [...NETWORK_IDS, ...GATEWAY_RAIL_IDS].map(async (network) => {
        const balance = await treasuryBalance(network).catch(() => null)
        return [network, balance] as const
      }),
    ),
  )
  const contratos = Object.fromEntries(
    await Promise.all(
      SETTLEMENT_NETWORKS.map(async (network) => {
        const contrato = contratoV3(network)
        return [network, { contract: contrato, feeRecipient: contrato ? await feeRecipientV3(network) : null }] as const
      }),
    ),
  )
  return c.json({ address: env.treasuryAddress, relayer: relayerAddress, balances, settlementV3: contratos })
})
