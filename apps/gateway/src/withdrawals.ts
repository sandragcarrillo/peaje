import { Hono } from 'hono'
import { explorerTxUrl, isNetworkId, NETWORK_IDS, type NetworkId } from '@peaje/shared'
import { env } from './env.js'
import { store } from './store.js'
import { payoutConfirmed, sendPayout, treasuryBalance } from './treasury.js'

/**
 * API interna de retiros. La consume solo el dashboard, autenticada con un
 * secreto compartido: la clave de la treasury vive únicamente en el gateway.
 */
export const withdrawals = new Hono()

withdrawals.use('*', async (c, next) => {
  const auth = c.req.header('authorization')
  if (auth !== `Bearer ${env.internalSecret}`) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  await next()
})

/** Ledger interno del tenant. Lo consume el dashboard. */
withdrawals.get('/:slug/ledger', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const payments = await store.listPayments(tenant.id)
  return c.json({
    balance: await store.balance(tenant.id),
    balanceByNetwork: await store.balanceByNetwork(tenant.id),
    payments: payments.map((p) => ({
      ...p,
      explorer: isNetworkId(p.network) ? explorerTxUrl(p.network, p.receiptRef, env.testnet) : null,
    })),
  })
})

withdrawals.post('/:slug/withdraw', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const body = await c.req.json<{ amount?: string; toWallet?: string; network?: string }>()
  const toWallet = (body.toWallet ?? tenant.payoutWallet ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(toWallet)) {
    return c.json({ error: 'Wallet de destino inválida' }, 400)
  }

  const network = body.network ?? 'tempo'
  if (!isNetworkId(network)) {
    return c.json({ error: `Red inválida. Soportadas: ${NETWORK_IDS.join(', ')}` }, 400)
  }

  // El saldo disponible es POR RED: el payout sale de la treasury de esa red.
  const balances = await store.balanceByNetwork(tenant.id)
  const balance = balances.find((b) => b.network === network)
  const available = Number(balance?.available ?? 0)
  const amount = Number(body.amount ?? available)
  if (!Number.isFinite(amount) || amount <= 0) {
    return c.json({ error: 'Monto inválido' }, 400)
  }
  if (amount > available + 1e-9) {
    return c.json({ error: `Saldo insuficiente en ${network}: disponible $${available.toFixed(6)}` }, 400)
  }

  // El retiro se registra ANTES de mandar la tx: si el broadcast falla,
  // queda en pending y se marca failed, nunca se pierde plata del ledger.
  const withdrawal = await store.createWithdrawal({
    tenantId: tenant.id,
    amount: amount.toFixed(6),
    toWallet,
    network,
  })

  try {
    const hash = await sendPayout(network, toWallet as `0x${string}`, amount.toFixed(6))
    const updated = await store.updateWithdrawal(withdrawal.id, { txRef: hash })
    return c.json({
      withdrawal: updated,
      explorerUrl: explorerTxUrl(network, hash, env.testnet),
    })
  } catch (error) {
    await store.updateWithdrawal(withdrawal.id, { status: 'failed' })
    console.error('[withdraw] fallo el payout', error)
    return c.json({ error: 'No se pudo enviar la transferencia. Reintenta.' }, 502)
  }
})

withdrawals.get('/:slug/withdrawals/:id', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const withdrawal = await store.getWithdrawal(c.req.param('id'))
  if (!withdrawal || withdrawal.tenantId !== tenant.id) {
    return c.json({ error: 'Retiro no encontrado' }, 404)
  }

  const network: NetworkId = isNetworkId(withdrawal.network) ? withdrawal.network : 'tempo'
  const explorer = (hash: string) => explorerTxUrl(network, hash, env.testnet)

  // Si sigue pending y hay tx, consultamos la chain y actualizamos.
  if (withdrawal.status === 'pending' && withdrawal.txRef) {
    const confirmed = await payoutConfirmed(network, withdrawal.txRef as `0x${string}`)
    if (confirmed === true) {
      const updated = await store.updateWithdrawal(withdrawal.id, { status: 'confirmed' })
      return c.json({ withdrawal: updated, explorerUrl: explorer(updated.txRef!) })
    }
    if (confirmed === false) {
      const updated = await store.updateWithdrawal(withdrawal.id, { status: 'failed' })
      return c.json({ withdrawal: updated, explorerUrl: explorer(updated.txRef!) })
    }
  }

  return c.json({
    withdrawal,
    explorerUrl: withdrawal.txRef ? explorer(withdrawal.txRef) : null,
  })
})

withdrawals.get('/treasury/balance', async (c) => {
  const balances = Object.fromEntries(
    await Promise.all(
      NETWORK_IDS.map(async (network) => {
        const balance = await treasuryBalance(network).catch(() => null)
        return [network, balance] as const
      }),
    ),
  )
  return c.json({ address: env.treasuryAddress, balances })
})
