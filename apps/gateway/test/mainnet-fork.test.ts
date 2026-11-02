// El gateway en modo mainnet (NEXT_PUBLIC_RED=mainnet) contra una copia local
// de Arbitrum One: el USDC de Circle y el USDG de Paxos reales, con su
// EIP-712 y su EIP-3009 de verdad, y PeajeSettlementV3 de contracts/. Cubre:
// el 402 solo ofrece Arbitrum One y Tempo mainnet (nada de testnet, Robinhood
// ni Arc), el 2% de Tempo va a PEAJE_FEE_RECIPIENT, el contrato arranca solo
// con USDC (decisión del 1 nov 2026) y USDG aparece cuando el owner lo agrega,
// y un pago en cada token llega al negocio en la misma tx.
//
// Corre solo con FORK_ARBITRUM_ONE_RPC (un RPC de Arbitrum One); sin él se
// salta. Necesita `anvil` (Foundry) con anvil_dealERC20 y `cd contracts && forge build`.
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { after, before, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NETWORKS } from '@peaje/shared'
import { Challenge } from 'mppx'
import { Mppx as MppxCliente } from 'mppx/client'
import { charge as cargoEvm } from 'mppx/evm/client'
import { createPublicClient, createTestClient, createWalletClient, defineChain, erc20Abi, http, toHex, type Abi, type Hex } from 'viem'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'

const FORK = process.env.FORK_ARBITRUM_ONE_RPC

const MNEMONICO = 'test test test test test test test test test test test junk'
const cuenta = (i: number) => mnemonicToAccount(MNEMONICO, { addressIndex: i })
const llave = (i: number) => toHex(cuenta(i).getHdKey().privateKey!)

const owner = cuenta(0)
const relayer = cuenta(1)
const feeRecipient = cuenta(2)
const guardian = cuenta(3)
const merchant = cuenta(4)
// Las cuentas del mnemónico de prueba tienen una delegación EIP-7702 en
// Arbitrum One (alguien las barre): el USDC de Circle las trata como contrato
// (ERC-1271) y rechaza su firma. El pagador es una wallet nueva, sin código.
const pagador = privateKeyToAccount(generatePrivateKey())
const treasury = cuenta(7)

const USDC = NETWORKS.arbitrum.mainnet!
const USDG = NETWORKS['arbitrum-usdg'].mainnet!
const PUERTO = 19_545 + Math.floor(Math.random() * 1000)
const RPC = `http://127.0.0.1:${PUERTO}`
const chain = defineChain({
  id: USDC.chainId,
  name: 'anvil arbitrum one',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

const OUT = fileURLToPath(new URL('../../../contracts/out/', import.meta.url))
const artefacto = (archivo: string, contrato: string) =>
  JSON.parse(readFileSync(`${OUT}${archivo}/${contrato}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex } }

let anvil: ChildProcess
const lector = createPublicClient({ chain, transport: http(RPC, { timeout: 60_000 }) })
const admin = createTestClient({ chain, mode: 'anvil', transport: http(RPC, { timeout: 60_000 }) })
let contrato: `0x${string}`

let cobrarYServir: typeof import('../src/cobrar.js').cobrarYServir
let store: typeof import('../src/store.js').store
let settlement: typeof import('../src/settlement.js')
let v3Abi: Abi

const saldo = (token: `0x${string}`, address: `0x${string}`) =>
  lector.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })

if (!FORK) {
  test('mainnet contra una copia de Arbitrum One', { skip: 'sin FORK_ARBITRUM_ONE_RPC' }, () => {})
} else {
  before(async () => {
    assert.ok(existsSync(`${OUT}PeajeSettlementV3.sol/PeajeSettlementV3.json`), 'falta `cd contracts && forge build`')
    anvil = spawn('anvil', ['--fork-url', FORK, '--port', String(PUERTO), '--silent'], { stdio: 'ignore' })
    for (let i = 0; ; i++) {
      try {
        await lector.getChainId()
        break
      } catch {
        if (i > 300) throw new Error('anvil no arrancó')
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    // El constructor del contrato acepta un owner EOA; el script de deploy es
    // el que exige el Safe en mainnet, y acá no se usa.
    const v3 = artefacto('PeajeSettlementV3.sol', 'PeajeSettlementV3')
    v3Abi = v3.abi
    const constructor = v3.abi.find((x) => x.type === 'constructor') as { inputs: { name: string }[] }
    const valores: Record<string, unknown> = {
      initialOwner: owner.address,
      guardian_: guardian.address,
      feeRecipient_: feeRecipient.address,
      relayers: [relayer.address],
      // Como el script de deploy de arbitrum-one: solo USDC.
      tokens: [USDC.token],
      maxNetworkFees: [20_000n],
    }
    const args = constructor.inputs.map((i) => {
      if (!(i.name in valores)) throw new Error(`constructor de v3 con un parámetro nuevo: ${i.name}`)
      return valores[i.name]
    })
    const wallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
    const hash = await wallet.deployContract({ abi: v3.abi, bytecode: v3.bytecode.object, args })
    contrato = (await lector.waitForTransactionReceipt({ hash })).contractAddress!

    // Saldo real de los dos stablecoins para el pagador (anvil escribe el storage del token).
    for (const token of [USDC.token, USDG.token]) {
      await admin.request({ method: 'anvil_dealERC20' as never, params: [pagador.address, token, toHex(10_000_000n)] as never })
    }

    Object.assign(process.env, {
      NEXT_PUBLIC_RED: 'mainnet',
      MPP_SECRET_KEY: 'prueba-mainnet-fork-0123456789abcdef0123456789',
      TREASURY_ADDRESS: treasury.address,
      TREASURY_PRIVATE_KEY: llave(7),
      PEAJE_FEE_RECIPIENT: feeRecipient.address,
      INTERNAL_API_SECRET: 'interno',
      RELAYER_PRIVATE_KEY: llave(1),
      PEAJE_SETTLEMENT_V3_ARBITRUM_ONE: contrato,
      ARBITRUM_ONE_RPC_URL: RPC,
      // Sin red: el chequeo de depeg falla rápido y no pausa nada.
      CHAINLINK_RPC_URL: 'http://127.0.0.1:9',
      AGENTS_SCHEDULER: 'off',
    })
    // Lo de testnet no puede colarse en mainnet aunque esté en el entorno.
    process.env.PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET = '0x3e0f648349432A5195e498D8D3b7Fa7d759752cC'
    process.env.PEAJE_SETTLEMENT_V3_ARC_TESTNET = '0x5a810d1317412A9635D0F84B74ff9F2DFbEc0E21'
    process.env.CIRCLE_NANOPAYMENTS_ENABLED = 'true'
    delete process.env.TEMPO_NETWORK

    ;({ cobrarYServir } = await import('../src/cobrar.js'))
    ;({ store } = await import('../src/store.js'))
    settlement = await import('../src/settlement.js')
  })

  after(() => {
    anvil?.kill()
  })

  let n = 0
  async function negocio() {
    const slug = `mainnet-${++n}`
    const tenant = await store.createTenant({ slug, name: slug, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
    await store.setPayoutWallet(tenant.id, merchant.address)
    return (await store.getTenantById(tenant.id))!
  }

  function cobrar(tenant: Awaited<ReturnType<typeof negocio>>, headers: Record<string, string> = {}) {
    return cobrarYServir({
      tenant,
      cobrable: new Request(`https://${tenant.slug}.example/api/dato`, { headers }),
      priceUsd: '1',
      description: 'dato',
      routeId: null,
      path: '/api/dato',
      pedirOrigen: async () => Response.json({ ok: true }),
      mensajeCaido: 'caído',
    })
  }

  /** Las monedas de las ofertas evm del 402, en minúscula y ordenadas. */
  async function monedasDel402() {
    const r = await cobrar(await negocio())
    assert.equal(r.status, 402)
    const ofertas = Challenge.fromResponseList(r)
    return { ofertas, monedas: ofertas.filter((o) => o.method === 'evm').map((o) => (o.request as { currency: string }).currency.toLowerCase()).sort() }
  }

  test('el 402 en mainnet: USDC de Arbitrum One y Tempo mainnet, nada de testnet ni USDG', async () => {
    const { ofertas, monedas } = await monedasDel402()
    const evm = ofertas.filter((o) => o.method === 'evm')
    const tempo = ofertas.filter((o) => o.method === 'tempo')

    // Solo USDC de Arbitrum One, pagando al contrato: USDG no está en su lista.
    assert.deepEqual(monedas, [USDC.token.toLowerCase()])
    // Los documentos tampoco lo nombran (leen lo último que respondió el contrato).
    assert.deepEqual(settlement.redesDocumentadas(), ['arbitrum', 'tempo'])
    for (const o of evm) {
      const req = o.request as { recipient: string; methodDetails?: { chainId?: number }; chainId?: number }
      assert.equal(req.recipient.toLowerCase(), contrato.toLowerCase())
      assert.equal(req.methodDetails?.chainId ?? req.chainId, 42161)
    }

    // Tempo mainnet: el neto al negocio y el 2% a la dirección fría, nunca a la treasury.
    assert.equal(tempo.length, 1)
    const t = JSON.stringify(tempo[0]!.request).toLowerCase()
    assert.match(t, /4217/)
    assert.match(t, new RegExp(feeRecipient.address.toLowerCase()))
    assert.doesNotMatch(t, new RegExp(treasury.address.toLowerCase()))

    // Ninguna cadena ni token de testnet en ninguna oferta.
    const todo = JSON.stringify(ofertas.map((o) => o.request)).toLowerCase()
    for (const id of ['arbitrum', 'arbitrum-usdg', 'robinhood', 'arc'] as const) {
      assert.doesNotMatch(todo, new RegExp(NETWORKS[id].testnet.token.toLowerCase()), `token de testnet de ${id}`)
    }
    for (const chainId of [421614, 46630, 5042002, 42431]) assert.doesNotMatch(todo, new RegExp(`"chainid":${chainId}\\b`))
  })

  test('el owner agrega USDG al contrato y el 402 lo ofrece sin tocar el env', async () => {
    const wallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
    const hash = await wallet.writeContract({ address: contrato, abi: v3Abi, functionName: 'setAcceptedToken', args: [USDG.token, true, 20_000n] })
    assert.equal((await lector.waitForTransactionReceipt({ hash })).status, 'success')

    // La lista se cachea un minuto: se adelanta el reloj para leerla de nuevo.
    mock.timers.enable({ apis: ['Date'], now: Date.now() })
    try {
      mock.timers.tick(61_000)
      assert.equal(await settlement.aceptaToken('arbitrum-usdg'), true)
    } finally {
      mock.timers.reset()
    }
    const { monedas } = await monedasDel402()
    assert.deepEqual(monedas, [USDC.token, USDG.token].map((t) => t.toLowerCase()).sort())
    assert.deepEqual(settlement.redesDocumentadas(), ['arbitrum', 'arbitrum-usdg', 'tempo'])
  })

  for (const [nombre, red, net] of [
    ['USDC', USDC, 'arbitrum'],
    ['USDG', USDG, 'arbitrum-usdg'],
  ] as const) {
    test(`pago en ${nombre} de Arbitrum One: el 98% llega al negocio en la misma tx`, async () => {
      const tenant = await negocio()
      const desafio = await cobrar(tenant)
      const cliente = MppxCliente.create({
        polyfill: false,
        methods: [cargoEvm({ account: pagador, networks: [42161], currencies: [red.token], authorization: NETWORKS[net].eip3009! })],
        // Dos ofertas evm en la misma cadena: el cliente toma la primera, así que se deja solo la de este token.
        orderChallenges: (c: { challenge: { request: unknown } }[]) =>
          c.filter((x) => (x.challenge.request as { currency?: string }).currency?.toLowerCase() === red.token.toLowerCase()),
      })
      const auth = await cliente.createCredential(desafio)

      const [antesMerchant, antesFee, antesPagador] = await Promise.all([
        saldo(red.token, merchant.address),
        saldo(red.token, feeRecipient.address),
        saldo(red.token, pagador.address),
      ])
      const r = await cobrar(tenant, { authorization: auth })
      assert.equal(r.status, 200, await r.clone().text())
      assert.ok(r.headers.get('payment-receipt'))

      // 1 USD más el costo de red que cotizó el gateway (0 si todavía no lo calculó).
      const pagado = antesPagador - (await saldo(red.token, pagador.address))
      const costoRed = pagado - 1_000_000n
      assert.ok(costoRed >= 0n && costoRed <= 20_000n, `costo de red fuera del tope: ${costoRed}`)
      assert.equal((await saldo(red.token, merchant.address)) - antesMerchant, 980_000n)
      assert.equal((await saldo(red.token, feeRecipient.address)) - antesFee, 20_000n + costoRed)
      assert.equal(await saldo(red.token, contrato), 0n)

      const [pago] = await store.listPayments(tenant.id)
      assert.ok(pago)
      assert.equal(pago.network, net)
      assert.equal(pago.payoutAddress?.toLowerCase(), merchant.address.toLowerCase())
      const tx = await lector.getTransactionReceipt({ hash: pago.receiptRef as Hex })
      assert.equal(tx.status, 'success')
      assert.equal(tx.to?.toLowerCase(), contrato.toLowerCase())
    })
  }
}
