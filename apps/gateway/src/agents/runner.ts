import type { Agent, AgentRun } from '@peaje/db'
import { isNetworkId, nextRunAt, NETWORKS, type AgentFrequencyId } from '@peaje/shared'
import { Mppx, evm, tempo } from 'mppx/client'
import { Receipt } from 'mppx'
import { store } from '../store.js'
import { descubrirCandidatos, elegir, evaluar } from './discovery.js'
import { entregar } from './entrega.js'
import { explicarDecision, expandirMision } from './llm.js'
import { agentAccount, agentBalance } from './wallet.js'

/**
 * Ejecuta la misión de un agente: descubre, decide, paga y registra.
 *
 * Es una función invocable, no un loop: la llama el botón del dashboard o el
 * scheduler. Ese es el punto de diseño que hace que las frecuencias salgan
 * casi gratis.
 */
export async function ejecutarMision(agent: Agent): Promise<AgentRun> {
  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const inicio = Date.now()

  const registrar = (run: Omit<Parameters<typeof store.recordAgentRun>[0], 'agentId'>) =>
    store.recordAgentRun({ agentId: agent.id, ...run })

  // 1. Techo duro: lo que el agente tiene en su wallet.
  let saldo: number
  try {
    saldo = Number(await agentBalance(agent.walletAddress as `0x${string}`, network))
  } catch (error) {
    console.error('[agents] no se pudo leer el saldo de', agent.name, error)
    return registrar({
      status: 'failed',
      decision: null,
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: 'No se pudo leer el saldo de la wallet del agente.',
    })
  }

  const tope = Math.min(Number(agent.maxPerRun), saldo)
  if (tope <= 0) {
    await store.updateAgent(agent.id, { status: 'done', nextRunAt: null })
    return registrar({
      status: 'skipped',
      decision: null,
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: `Sin presupuesto: saldo ${saldo} ${NETWORKS[network].tokenSymbol}. El agente queda detenido.`,
    })
  }

  // 2. Descubrimiento (The Graph + directorio) y decisión determinista.
  //    El modelo solo aporta sinónimos para el matching; no elige.
  const [candidatos, terminos] = await Promise.all([
    descubrirCandidatos(),
    expandirMision(agent.mission),
  ])
  const evaluados = evaluar(candidatos, agent.mission, tope, terminos)
  const elegido = elegir(evaluados)

  // El log separa dos cosas que no son comparables entre sí: lo que el agente
  // VIO del mercado (registro ERC-8004: contexto y reputación, no comprable
  // hoy) y lo que pudo COMPRAR. La justificación se redacta solo sobre lo
  // segundo, que es donde el elegido compite de igual a igual.
  const comprables = evaluados.filter((e) => e.url !== null && e.precio !== null && e.aceptaPagos)
  const comparados = comprables.slice(0, 5)
  const justificacion = elegido ? await explicarDecision(agent.mission, elegido, comparados) : null

  const resumir = (e: (typeof evaluados)[number]) => ({
    nombre: e.nombre,
    fuente: e.fuente,
    score: e.score,
    precio: e.precio,
    reputacion: e.reputacion,
    motivos: e.motivos,
  })

  const decision = {
    mision: agent.mission,
    topePorCorrida: tope,
    terminosBusqueda: terminos,
    mercado: {
      consultados: candidatos.length,
      conReputacionOnchain: candidatos.filter((c) => c.reputacion !== null).length,
      // Lo más afín del registro: no se puede comprar todavía, pero es la
      // señal de mercado que justifica el precio y la elección.
      afines: evaluados
        .filter((e) => e.fuente === 'erc8004' && e.score > 0)
        .slice(0, 3)
        .map(resumir),
    },
    comparados: comparados.map((e) => ({
      ...resumir(e),
      elegido: elegido !== null && e.url === elegido.url,
    })),
    justificacion,
    elegido: elegido ? { nombre: elegido.nombre, url: elegido.url, precio: elegido.precio } : null,
  }

  if (!elegido || !elegido.url) {
    return registrar({
      status: 'skipped',
      decision,
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: `Ningún servicio pagable dentro de $${tope} coincide con la misión.`,
    })
  }

  // 3. Pago real: fetch propio del agente (polyfill: false para que dos
  //    agentes concurrentes no se pisen el fetch global).
  if (!agent.privyWalletId) {
    return registrar({
      status: 'failed',
      decision,
      targetUrl: elegido.url,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: 'El agente no tiene wallet de Privy asociada para firmar.',
    })
  }

  const account = agentAccount(agent.privyWalletId, agent.walletAddress as `0x${string}`)
  const cliente = Mppx.create({
    polyfill: false,
    methods:
      network === 'arc'
        ? [
            evm({
              account,
              authorization: NETWORKS.arc.eip3009!,
              networks: [NETWORKS.arc.testnet.chainId],
            }),
          ]
        : [tempo({ account })],
  })

  try {
    const res = await cliente.fetch(elegido.url)
    const header = res.headers.get('Payment-Receipt')
    const receipt = header ? Receipt.deserialize(header) : null
    const body = await res.text()

    if (!res.ok) {
      return registrar({
        status: 'failed',
        decision,
        targetUrl: elegido.url,
        amount: null,
        network,
        receiptRef: receipt?.reference ?? null,
        resultExcerpt: body.slice(0, 500),
        result: body.slice(0, 200_000),
        error: `El servicio respondió ${res.status}.`,
      })
    }

    console.log('[agents] compra', {
      agente: agent.name,
      servicio: elegido.nombre,
      precio: elegido.precio,
      ms: Date.now() - inicio,
    })

    const run = await registrar({
      status: 'success',
      decision,
      targetUrl: elegido.url,
      amount: elegido.precio !== null ? elegido.precio.toFixed(6) : null,
      network,
      receiptRef: receipt?.reference ?? null,
      resultExcerpt: body.slice(0, 1000),
      // El panel es donde la persona lee el resultado: se guarda completo.
      result: body.slice(0, 200_000),
      error: null,
    })

    // La entrega usa el cuerpo completo, no el preview de la bitácora.
    await entregar(agent, run, body)
    return run
  } catch (error) {
    console.error('[agents] falló la compra de', agent.name, error)
    return registrar({
      status: 'failed',
      decision,
      targetUrl: elegido.url,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: error instanceof Error ? error.message.slice(0, 300) : 'Error desconocido al pagar.',
    })
  }
}

/**
 * Corre la misión y reprograma según la frecuencia. Es lo que llaman tanto el
 * botón del dashboard como el scheduler.
 *
 * Toma el agente antes de ejecutar: si el scheduler y el botón caen a la vez
 * sobre la misma misión, uno solo pasa. Sin esto se gasta doble (lo vimos).
 * Devuelve null cuando otro worker ya lo tenía.
 */
export async function correrYReprogramar(agent: Agent): Promise<AgentRun | null> {
  const tomado = await store.claimAgent(agent.id)
  if (!tomado) {
    console.log(`[agents] ${agent.name} ya estaba corriendo: se omite`)
    return null
  }

  const run = await ejecutarMision(tomado)

  const runsCount = tomado.runsCount + 1
  const alcanzoTope = tomado.runsMax !== null && runsCount >= tomado.runsMax
  const sinPresupuesto = run.status === 'skipped' && (run.error ?? '').startsWith('Sin presupuesto')
  const proxima = alcanzoTope || sinPresupuesto ? null : nextRunAt(tomado.frequency as AgentFrequencyId)

  await store.updateAgent(tomado.id, {
    runsCount,
    lastRunAt: new Date().toISOString(),
    nextRunAt: proxima ? proxima.toISOString() : null,
    status: proxima ? 'idle' : 'done',
  })

  return run
}
