import type { Agent, AgentRun } from '@peaje/db'
import { isNetworkId, nextRunAt, NETWORKS, type AgentFrequencyId } from '@peaje/shared'
import { Mppx, evm, tempo } from 'mppx/client'
import { Receipt } from 'mppx'
import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch'
import { store } from '../store.js'
import { BASE_CAIP2, baseUsdcBalance } from './base-mainnet.js'
import { descubrirCandidatos, elegirVarios, evaluar, type Evaluado } from './discovery.js'
import { entregar } from './entrega.js'
import {
  explicarDecision,
  expandirMision,
  completarConsulta,
  sintetizarResultado,
  validarCompra,
} from './llm.js'
import { agentAccount, agentBalance } from './wallet.js'

/**
 * Ejecuta la misión de un agente: descubre, decide, paga y registra.
 *
 * Es una función invocable, no un loop: la llama el botón del dashboard o el
 * scheduler. Ese es el punto de diseño que hace que las frecuencias salgan
 * casi gratis.
 */
export type OpcionesCorrida = {
  /**
   * URL confirmada por la persona en el flujo de "ask": se compra exactamente
   * ese servicio, sin re-decidir. El veto del modelo se salta porque la
   * confirmación humana pesa más.
   */
  urlFijada?: string
}

export async function ejecutarMision(agent: Agent, opts: OpcionesCorrida = {}): Promise<AgentRun> {
  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const inicio = Date.now()

  const registrar = (run: Omit<Parameters<typeof store.recordAgentRun>[0], 'agentId'>) =>
    store.recordAgentRun({ agentId: agent.id, ...run })

  // 1. Techo duro: lo que el agente tiene en su wallet, POR RIEL. La misma
  //    address firma en testnet (Tempo/Arc, demo) y en Base mainnet (mercado
  //    real de x402 con USDC de verdad). Si un RPC falla, ese riel queda en
  //    cero y el otro sigue disponible.
  const address = agent.walletAddress as `0x${string}`
  const [saldoTestnet, saldoBase] = await Promise.all([
    agentBalance(address, network).then(Number).catch(() => Number.NaN),
    baseUsdcBalance(address).then(Number).catch(() => Number.NaN),
  ])
  if (Number.isNaN(saldoTestnet) && Number.isNaN(saldoBase)) {
    return registrar({
      status: 'failed',
      decision: null,
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: 'No se pudo leer el saldo de la wallet del agente en ninguna red.',
    })
  }

  const maxPorCorrida = Number(agent.maxPerRun)
  const topeTestnet = Math.min(maxPorCorrida, Number.isNaN(saldoTestnet) ? 0 : saldoTestnet)
  const topeBase = Math.min(maxPorCorrida, Number.isNaN(saldoBase) ? 0 : saldoBase)
  const topePara = (chain: string | undefined) => (chain === BASE_CAIP2 ? topeBase : topeTestnet)
  const tope = Math.max(topeTestnet, topeBase)
  if (tope <= 0) {
    await store.updateAgent(agent.id, { status: 'done', nextRunAt: null })
    return registrar({
      status: 'skipped',
      decision: { codigo: 'fondos' },
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error: `Sin presupuesto: $${Number.isNaN(saldoTestnet) ? '?' : saldoTestnet} ${NETWORKS[network].tokenSymbol} y $${Number.isNaN(saldoBase) ? '?' : saldoBase} USDC en Base. El agente queda detenido.`,
    })
  }

  // 2. Descubrimiento (The Graph + directorio) y decisión determinista.
  //    El modelo solo aporta sinónimos para el matching; no elige.
  const [candidatos, terminos] = await Promise.all([
    descubrirCandidatos(),
    expandirMision(agent.mission),
  ])
  const evaluados = evaluar(candidatos, agent.mission, tope, terminos)

  // Lista corta + veto: el score encuentra lo más parecido, pero antes de
  // pagar la capa de lenguaje confirma que el servicio entrega el DATO de la
  // misión. Documentación pertinente ya no se compra: se pasa al siguiente,
  // y si ninguno sirve, no se gasta.
  const vetados: { nombre: string; motivo: string }[] = []
  let elegido: Evaluado | null = null
  let veredicto: string | null = null
  // 'fondos' = habia servicio pero falta saldo; 'sin-match' = nada sirve.
  // El dashboard usa este codigo para mostrar el mensaje en el idioma del UI.
  let codigoSkip: 'fondos' | 'sin-match' = 'sin-match'
  if (opts.urlFijada) {
    const fijado = evaluados.find((e) => e.url === opts.urlFijada && e.pagable)
    if (fijado && fijado.precio !== null && fijado.precio <= topePara(fijado.chain)) {
      elegido = fijado
      veredicto = 'Servicio confirmado por la persona.'
    } else if (fijado) {
      codigoSkip = 'fondos'
      vetados.push({ nombre: fijado.nombre, motivo: 'el saldo en su red ya no alcanza' })
    } else {
      vetados.push({ nombre: opts.urlFijada, motivo: 'ya no aparece en el mercado' })
    }
  }
  if (!elegido && !opts.urlFijada) for (const candidato of elegirVarios(evaluados, 4)) {
    if (candidato.precio !== null && candidato.precio > topePara(candidato.chain)) {
      vetados.push({
        nombre: candidato.nombre,
        motivo: `cuesta $${candidato.precio} y el saldo en su red no alcanza`,
      })
      continue
    }
    const v = await validarCompra(agent.mission, candidato)
    if (v.compra) {
      elegido = candidato
      veredicto = v.motivo
      break
    }
    vetados.push({ nombre: candidato.nombre, motivo: v.motivo })
  }

  // El log separa dos cosas que no son comparables entre sí: lo que el agente
  // VIO del mercado (registro ERC-8004: contexto y reputación, no comprable
  // hoy) y lo que pudo COMPRAR. La justificación se redacta solo sobre lo
  // segundo, que es donde el elegido compite de igual a igual.
  const comprables = evaluados.filter((e) => e.url !== null && e.precio !== null && e.pagable)
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
    saldos: { [network]: saldoTestnet, base: saldoBase },
    codigo: elegido ? null : codigoSkip,
    veredicto,
    vetados,
    terminosBusqueda: terminos,
    mercado: {
      consultados: candidatos.length,
      conReputacionOnchain: candidatos.filter((c) => c.reputacion !== null).length,
      // Lo más afín del registro: no se puede comprar todavía, pero es la
      // señal de mercado que justifica el precio y la elección.
      afines: evaluados
        .filter((e) => !e.pagable && e.score > 0)
        .slice(0, 5)
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
    const primerVeto = vetados[0]
    return registrar({
      status: 'skipped',
      decision,
      targetUrl: null,
      amount: null,
      network,
      receiptRef: null,
      resultExcerpt: null,
      result: null,
      error:
        codigoSkip === 'fondos' && primerVeto
          ? `Falta saldo para esta compra: ${primerVeto.nombre} cuesta más de lo que el agente tiene en esa red. Fondéalo y vuelve a intentar.`
          : primerVeto
            ? `No compré nada: lo mejor del mercado no responde tu pedido y gastar en eso sería tirar tu plata.${primerVeto.motivo ? ` (${primerVeto.nombre}: ${primerVeto.motivo})` : ''}`
            : `Ningún servicio pagable dentro de $${tope} coincide con la misión.`,
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
  const esBase = elegido.chain === BASE_CAIP2
  const redCompra = esBase ? 'base' : network

  try {
    // Si lo elegido es una API, la capa de lenguaje completa la consulta a
    // partir de la misión (ciudad, fechas, variables). No cambia QUÉ se
    // compra, solo cómo se le pregunta.
    let urlCompra = elegido.url
    const esApi = elegido.descripcion?.includes('· API ') || elegido.fuente === 'x402'
    if (esApi && !urlCompra.includes('?') && !urlCompra.includes('/:')) {
      const params = await completarConsulta(agent.mission, urlCompra, elegido.descripcion)
      const qs = new URLSearchParams(
        Object.entries(params).filter(([k, v]) => k.length < 40 && v.length < 120),
      ).toString()
      if (qs) urlCompra = `${urlCompra}?${qs}`
    }

    let res: Response
    let receiptRef: string | null = null
    if (esBase) {
      // Mercado real: x402 sobre Base mainnet, USDC de verdad. El tope va
      // también en el cliente (maxValue): ni un bug puede pagar de más.
      const fetchConPago = wrapFetchWithPayment(
        globalThis.fetch,
        account,
        BigInt(Math.round(topeBase * 1e6)),
      )
      res = await fetchConPago(urlCompra)
      const xpr = res.headers.get('x-payment-response')
      if (xpr) {
        try {
          receiptRef = decodeXPaymentResponse(xpr)?.transaction ?? null
        } catch {}
      }
    } else {
      // Un método por agente: cada red EVM firma con su propio dominio EIP-712
      // (el USDC de Arc y el de Arbitrum no comparten nombre). `currencies`
      // desempata cuando una cadena ofrece más de un stablecoin.
      const cliente = Mppx.create({
        polyfill: false,
        methods:
          network === 'tempo'
            ? [tempo({ account })]
            : [
                evm({
                  account,
                  authorization: NETWORKS[network].eip3009!,
                  networks: [NETWORKS[network].testnet.chainId],
                  currencies: [NETWORKS[network].token],
                }),
              ],
      })
      res = await cliente.fetch(urlCompra)
      const header = res.headers.get('Payment-Receipt')
      receiptRef = header ? (Receipt.deserialize(header)?.reference ?? null) : null
    }
    const body = await res.text()

    // Pagar por nada no es un éxito: si el servicio devolvió el cuerpo vacío,
    // la corrida queda como fallida y la persona ve por qué.
    if (res.ok && body.trim().length === 0) {
      return registrar({
        status: 'failed',
        decision,
        targetUrl: urlCompra,
        amount: elegido.precio !== null ? elegido.precio.toFixed(6) : null,
        network: redCompra,
        receiptRef,
        resultExcerpt: null,
        result: null,
        error: 'El servicio cobró pero devolvió una respuesta vacía.',
      })
    }

    if (!res.ok) {
      return registrar({
        status: 'failed',
        decision,
        targetUrl: elegido.url,
        amount: null,
        network: redCompra,
        receiptRef,
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

    // El paso que faltaba: responder la MISIÓN con lo comprado, no entregar
    // el HTML crudo. Si el contenido no alcanza, la síntesis lo dice.
    const sintesis = await sintetizarResultado(agent.mission, elegido.nombre, body)
    // La línea de fuente va sin etiqueta: el idioma lo pone el dashboard.
    const entregable = sintesis
      ? `${sintesis}\n\n— ${elegido.nombre} · ${urlCompra}`
      : body.slice(0, 200_000)

    const run = await registrar({
      status: 'success',
      decision,
      targetUrl: urlCompra,
      amount: elegido.precio !== null ? elegido.precio.toFixed(6) : null,
      network: redCompra,
      receiptRef,
      resultExcerpt: entregable.slice(0, 1000),
      // El panel es donde la persona lee el resultado: la respuesta primero.
      result: entregable.slice(0, 200_000),
      error: null,
    })

    await entregar(agent, run, entregable)
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
export async function correrYReprogramar(
  agent: Agent,
  opts: OpcionesCorrida = {},
): Promise<AgentRun | null> {
  const tomado = await store.claimAgent(agent.id)
  if (!tomado) {
    console.log(`[agents] ${agent.name} ya estaba corriendo: se omite`)
    return null
  }

  // Si la corrida (o el propio Supabase) explota después del claim, el
  // candado se suelta igual: un agente trabado en "running" sin corrida real
  // deja Run now en 409 para siempre. Pasó con un Gateway Timeout de la DB.
  try {
    const run = await ejecutarMision(tomado, opts)

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
  } catch (error) {
    console.error(`[agents] ${agent.name}: la corrida explotó tras el claim; se libera`, error)
    await store.updateAgent(tomado.id, { status: 'idle' }).catch(() => {})
    throw error
  }
}

/**
 * El plan del flujo "ask": qué compraría el agente para este pedido, sin
 * comprar nada. La persona confirma y recién ahí corre la compra (con la URL
 * fijada). Se evalúa contra maxPerRun aunque no haya saldo: así la respuesta
 * puede ser "esto cuesta $0.01, fondea tu agente para correrlo".
 */
export async function planearCompra(agent: Agent, texto: string) {
  const network = isNetworkId(agent.network) ? agent.network : 'arc'
  const address = agent.walletAddress as `0x${string}`
  const [saldoTestnet, saldoBase] = await Promise.all([
    agentBalance(address, network).then(Number).catch(() => 0),
    baseUsdcBalance(address).then(Number).catch(() => 0),
  ])
  const maxPorCorrida = Number(agent.maxPerRun)
  const topePara = (chain: string | undefined) =>
    chain === BASE_CAIP2 ? Math.min(maxPorCorrida, saldoBase) : Math.min(maxPorCorrida, saldoTestnet)

  const [candidatos, terminos] = await Promise.all([descubrirCandidatos(), expandirMision(texto)])
  const evaluados = evaluar(candidatos, texto, maxPorCorrida, terminos)
  const lista = elegirVarios(evaluados, 4)

  const vetados: { nombre: string; motivo: string }[] = []
  let elegido: Evaluado | null = null
  let veredicto: string | null = null
  for (const candidato of lista) {
    const v = await validarCompra(texto, candidato)
    if (v.compra) {
      elegido = candidato
      veredicto = v.motivo
      break
    }
    vetados.push({ nombre: candidato.nombre, motivo: v.motivo })
  }

  const publico = (e: Evaluado) => ({
    nombre: e.nombre,
    descripcion: e.descripcion,
    url: e.url,
    precio: e.precio,
    red: e.chain === BASE_CAIP2 ? 'base' : network,
    fuente: e.fuente,
    reputacion: e.reputacion,
  })

  return {
    consultados: candidatos.length,
    saldos: { [network]: saldoTestnet, base: saldoBase },
    elegido: elegido ? publico(elegido) : null,
    veredicto,
    vetados,
    alternativas: lista.filter((c) => c !== elegido).slice(0, 3).map(publico),
    // true = el servicio existe pero falta plata en su red.
    faltaFondeo:
      elegido !== null && elegido.precio !== null && elegido.precio > topePara(elegido.chain),
  }
}
