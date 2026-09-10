import type { Agent, AgentDelivery } from '@peaje/db'
import {
  AGENT_FREQUENCIES,
  explorerTxUrl,
  isNetworkId,
  nextRunAt,
  type AgentFrequencyId,
} from '@peaje/shared'
import { Hono } from 'hono'
import { env } from '../env.js'
import { store } from '../store.js'
import { sendPayout } from '../treasury.js'
import { estadoRegistro, registrarAgente } from './erc8004.js'
import { correrYReprogramar } from './runner.js'
import { agentBalance, createAgentWallet, sweepAgent } from './wallet.js'

/**
 * API interna de agentes compradores. La consume el dashboard con el mismo
 * secreto compartido que los retiros; la firma de las wallets vive acá.
 */
export const agentsRouter = new Hono()

agentsRouter.use('*', async (c, next) => {
  if (c.req.header('authorization') !== `Bearer ${env.internalSecret}`) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  await next()
})

async function conSaldo(agent: Agent) {
  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const balance = await agentBalance(agent.walletAddress as `0x${string}`, network).catch(() => null)
  return { ...agent, balance }
}

agentsRouter.get('/:slug/agents', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const agents = await store.listAgents(tenant.id)
  return c.json({ agents: await Promise.all(agents.map(conSaldo)) })
})

agentsRouter.post('/:slug/agents', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const body = await c.req.json<{
    name?: string
    mission?: string
    network?: string
    maxPerRun?: string
    frequency?: string
    deliveryKind?: string
    deliveryTarget?: string | null
    runsMax?: number | null
  }>()

  const name = (body.name ?? '').trim()
  const mission = (body.mission ?? '').trim()
  if (!name) return c.json({ error: 'Falta el nombre del agente.' }, 400)
  if (mission.length < 5) return c.json({ error: 'Describe la misión del agente.' }, 400)

  const network = body.network ?? 'arc'
  if (!isNetworkId(network)) return c.json({ error: 'Red inválida.' }, 400)

  const frequency = (body.frequency ?? 'once') as AgentFrequencyId
  if (!AGENT_FREQUENCIES.some((f) => f.id === frequency)) {
    return c.json({ error: 'Frecuencia inválida.' }, 400)
  }

  const maxPerRun = Number(body.maxPerRun ?? '0.05')
  if (!Number.isFinite(maxPerRun) || maxPerRun <= 0) {
    return c.json({ error: 'Tope por corrida inválido.' }, 400)
  }

  const deliveryKind = (body.deliveryKind ?? 'dashboard') as AgentDelivery
  if (!['dashboard', 'webhook', 'email'].includes(deliveryKind)) {
    return c.json({ error: 'Forma de entrega inválida.' }, 400)
  }
  const deliveryTarget = (body.deliveryTarget ?? '').trim() || null
  if (deliveryKind === 'webhook') {
    if (!deliveryTarget || !/^https?:\/\//.test(deliveryTarget)) {
      return c.json({ error: 'El webhook necesita una URL http(s).' }, 400)
    }
  }
  if (deliveryKind === 'email' && (!deliveryTarget || !deliveryTarget.includes('@'))) {
    return c.json({ error: 'Pon un correo válido para la entrega.' }, 400)
  }

  const wallet = await createAgentWallet(name)
  const agent = await store.createAgent({
    tenantId: tenant.id,
    name,
    mission,
    walletAddress: wallet.address,
    privyWalletId: wallet.id,
    network,
    maxPerRun: maxPerRun.toFixed(6),
    frequency,
    deliveryKind,
    deliveryTarget,
    runsMax: body.runsMax ?? null,
    // Sin saldo todavía: la primera corrida se programa al fondearlo.
    nextRunAt: null,
  })

  // Identidad on-chain (ERC-8004). No bloquea el alta: si falla, el agente
  // funciona igual, solo que anónimo para los vendedores.
  const registro = await registrarAgente(tenant, agent)
  const final = registro
    ? await store.updateAgent(agent.id, {
        erc8004AgentId: registro.agentId,
        erc8004ChainId: registro.chainId,
        erc8004Tx: registro.tx,
      })
    : agent

  return c.json({ agent: await conSaldo(final) })
})

/** Estado del registro on-chain (¿tiene gas la treasury en Base Sepolia?). */
agentsRouter.get('/erc8004/status', async (c) => c.json(await estadoRegistro()))

/** Registra (o re-registra) un agente ya creado. */
agentsRouter.post('/:slug/agents/:id/register', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)

  const registro = await registrarAgente(tenant, agent)
  if (!registro) {
    return c.json(
      { error: 'No se pudo registrar. Revisa que la treasury tenga gas en Base Sepolia y que GATEWAY_PUBLIC_URL sea público.' },
      502,
    )
  }
  const final = await store.updateAgent(agent.id, {
    erc8004AgentId: registro.agentId,
    erc8004ChainId: registro.chainId,
    erc8004Tx: registro.tx,
  })
  return c.json({ agent: await conSaldo(final), registro })
})

/**
 * Fondear un agente es un retiro del saldo del tenant hacia la wallet del
 * agente: la plata sale del ledger del negocio y pasa a ser el techo duro del
 * agente. Por eso reusa el mismo camino que un retiro externo.
 */
agentsRouter.post('/:slug/agents/:id/fund', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)

  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const { amount } = await c.req.json<{ amount?: string }>()
  const monto = Number(amount)
  if (!Number.isFinite(monto) || monto <= 0) return c.json({ error: 'Monto inválido.' }, 400)

  const balances = await store.balanceByNetwork(tenant.id)
  const disponible = Number(balances.find((b) => b.network === network)?.available ?? 0)
  if (monto > disponible + 1e-9) {
    return c.json(
      { error: `Saldo insuficiente en ${network}: disponible $${disponible.toFixed(6)}` },
      400,
    )
  }

  const withdrawal = await store.createWithdrawal({
    tenantId: tenant.id,
    amount: monto.toFixed(6),
    toWallet: agent.walletAddress,
    network,
  })

  try {
    const hash = await sendPayout(network, agent.walletAddress as `0x${string}`, monto.toFixed(6))
    await store.updateWithdrawal(withdrawal.id, { txRef: hash })
    // Con saldo, el agente ya puede correr: se programa para ahora.
    const actualizado = await store.updateAgent(agent.id, {
      status: 'idle',
      nextRunAt: new Date().toISOString(),
    })
    return c.json({
      agent: await conSaldo(actualizado),
      tx: hash,
      explorerUrl: explorerTxUrl(network, hash, env.testnet),
    })
  } catch (error) {
    await store.updateWithdrawal(withdrawal.id, { status: 'failed' })
    console.error('[agents] fallo el fondeo', error)
    return c.json({ error: 'No se pudo fondear al agente. Reintenta.' }, 502)
  }
})

agentsRouter.post('/:slug/agents/:id/run', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)

  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)

  const run = await correrYReprogramar(agent)
  if (!run) return c.json({ error: 'El agente ya está corriendo. Espera a que termine.' }, 409)
  const actualizado = await store.getAgent(agent.id)
  return c.json({ run, agent: actualizado ? await conSaldo(actualizado) : null })
})

/** Barrido: el agente devuelve su saldo a la wallet del negocio. */
agentsRouter.post('/:slug/agents/:id/sweep', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  if (!tenant.payoutWallet) return c.json({ error: 'El negocio no tiene wallet de destino.' }, 400)

  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)
  if (!agent.privyWalletId) return c.json({ error: 'El agente no tiene wallet firmable.' }, 400)

  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const saldo = Number(await agentBalance(agent.walletAddress as `0x${string}`, network))
  if (saldo <= 0) return c.json({ error: 'El agente no tiene saldo para devolver.' }, 400)

  try {
    const hash = await sweepAgent(
      agent.privyWalletId,
      agent.walletAddress as `0x${string}`,
      network,
      tenant.payoutWallet as `0x${string}`,
      saldo.toFixed(6),
    )
    const actualizado = await store.updateAgent(agent.id, { status: 'done', nextRunAt: null })
    return c.json({
      agent: await conSaldo(actualizado),
      tx: hash,
      explorerUrl: explorerTxUrl(network, hash, env.testnet),
    })
  } catch (error) {
    console.error('[agents] fallo el barrido', error)
    return c.json({ error: 'No se pudo devolver el saldo. Reintenta.' }, 502)
  }
})

agentsRouter.get('/:slug/agents/:id/runs', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)

  const runs = await store.listAgentRuns(agent.id, 20)
  return c.json({
    runs: runs.map((r) => ({
      ...r,
      explorerUrl:
        r.receiptRef && r.network && isNetworkId(r.network)
          ? explorerTxUrl(r.network, r.receiptRef, env.testnet)
          : null,
    })),
  })
})

agentsRouter.post('/:slug/agents/:id/pause', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  const agent = await store.getAgent(c.req.param('id'))
  if (!agent || agent.tenantId !== tenant.id) return c.json({ error: 'Agente no encontrado' }, 404)

  const pausar = agent.status !== 'paused'
  const actualizado = await store.updateAgent(agent.id, {
    status: pausar ? 'paused' : 'idle',
    nextRunAt: pausar
      ? null
      : (nextRunAt(agent.frequency as AgentFrequencyId) ?? new Date()).toISOString(),
  })
  return c.json({ agent: await conSaldo(actualizado) })
})

agentsRouter.delete('/:slug/agents/:id', async (c) => {
  const tenant = await store.getTenantBySlug(c.req.param('slug'))
  if (!tenant) return c.json({ error: 'Tenant no encontrado' }, 404)
  await store.deleteAgent(tenant.id, c.req.param('id'))
  return c.json({ ok: true })
})
