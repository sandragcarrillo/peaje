// Auditoría off-chain de PeajeSettlementV3 (gateway como relayer, 28 oct 2026):
// cada hallazgo, ya arreglado, queda como prueba de regresión contra un anvil local con el contrato y el token mock de
// contracts/ (artefactos de `forge build`). Nada de RPC reales: el feed de
// Chainlink también vive en el anvil. Store en memoria.
//
// Artefactos: AUDITORIA_CONTRACTS_OUT (carpeta `out` de forge) o contracts/out.
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NETWORKS } from '@peaje/shared'
import { Credential } from 'mppx'
import { Mppx as MppxCliente } from 'mppx/client'
import { charge as cargoEvm } from 'mppx/evm/client'
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseAbi,
  parseSignature,
  toHex,
  type Abi,
  type Hex,
  type LocalAccount,
} from 'viem'
import { mnemonicToAccount } from 'viem/accounts'

const MNEMONICO = 'test test test test test test test test test test test junk'
const cuenta = (i: number) => mnemonicToAccount(MNEMONICO, { addressIndex: i })
const llave = (i: number) => toHex(cuenta(i).getHdKey().privateKey!)

const owner = cuenta(0)
const relayer = cuenta(1)
const feeRecipient = cuenta(2)
const guardian = cuenta(3)
const merchantB = cuenta(4)
const victima = cuenta(5)
const atacante = cuenta(6)
const treasury = cuenta(7)
const cobroAtacante = cuenta(8)
const otraDelAtacante = cuenta(9)
const pagadores = [10, 11, 12, 13].map(cuenta)

const DEF = NETWORKS.arbitrum
const TOKEN = DEF.token
const PUERTO = 19_545 + Math.floor(Math.random() * 1000)
const RPC = `http://127.0.0.1:${PUERTO}`
const chain = defineChain({
  id: DEF.testnet.chainId,
  name: 'anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

const OUT = process.env.AUDITORIA_CONTRACTS_OUT
  ? `${process.env.AUDITORIA_CONTRACTS_OUT.replace(/\/$/, '')}/`
  : fileURLToPath(new URL('../../../contracts/out/', import.meta.url))
const artefacto = (archivo: string, contrato: string) =>
  JSON.parse(readFileSync(`${OUT}${archivo}/${contrato}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex } }

/** Feeds de Chainlink (los mismos que chainlink.ts) y un agregador mínimo que devuelve un precio fijo. */
const FEED_USDC = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6' as const
const FEED_ETH = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419' as const
/** latestRoundData() -> (1, answer, 1, 1, 1) para cualquier selector. */
function agregador(answer: bigint): Hex {
  const a = answer.toString(16).padStart(16, '0') // PUSH8
  return `0x6001600052${`67${a}602052`}600160405260016060526001608052${'60a06000f3'}` as Hex
}

let anvil: ChildProcess
const lector = createPublicClient({ chain, transport: http(RPC) })
const admin = createTestClient({ chain, mode: 'anvil', transport: http(RPC) })
let contrato: `0x${string}`
let v3Abi: Abi

let cobrarYServir: typeof import('../src/cobrar.js').cobrarYServir
let store: typeof import('../src/store.js').store
let errores: typeof import('../src/liquidacion-v3.js')

async function esperarAnvil() {
  for (let i = 0; i < 100; i++) {
    try {
      await lector.getChainId()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error('anvil no arrancó')
}

async function desplegar(abi: Abi, bytecode: Hex, args: unknown[]) {
  const wallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
  const hash = await wallet.deployContract({ abi, bytecode, args })
  const receipt = await lector.waitForTransactionReceipt({ hash })
  return receipt.contractAddress!
}

const saldo = (address: `0x${string}`) => lector.readContract({ address: TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

before(async () => {
  assert.ok(existsSync(`${OUT}PeajeSettlementV3.sol/PeajeSettlementV3.json`), `faltan artefactos en ${OUT}`)
  assert.ok(existsSync(`${OUT}MockStablecoinV3.sol/MockStablecoin.json`), `falta el mock en ${OUT}`)
  anvil = spawn('anvil', ['--port', String(PUERTO), '--chain-id', String(DEF.testnet.chainId), '--accounts', '20', '--silent'], { stdio: 'ignore' })
  await esperarAnvil()

  const mock = artefacto('MockStablecoinV3.sol', 'MockStablecoin')
  const temporal = await desplegar(mock.abi, mock.bytecode.object, ['USD Coin', '2', 6])
  await admin.setCode({ address: TOKEN, bytecode: (await lector.getCode({ address: temporal }))! })
  const ownerWallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
  for (const a of [victima, ...pagadores]) {
    const mint = await ownerWallet.writeContract({ address: TOKEN, abi: mock.abi, functionName: 'mint', args: [a.address, 100_000_000n] })
    await lector.waitForTransactionReceipt({ hash: mint })
  }

  // Mismo tope que el script de deploy real: US$0,02 en Arbitrum
  // (contracts/script/DeployPeajeSettlementV3.s.sol, _arbitrum: 20_000).
  const v3 = artefacto('PeajeSettlementV3.sol', 'PeajeSettlementV3')
  v3Abi = v3.abi
  const constructor = v3.abi.find((x) => x.type === 'constructor') as { inputs: { name: string }[] }
  const valores: Record<string, unknown> = {
    initialOwner: owner.address,
    guardian_: guardian.address,
    feeRecipient_: feeRecipient.address,
    relayers: [relayer.address],
    tokens: [TOKEN],
    maxNetworkFees: [20_000n],
  }
  contrato = await desplegar(v3.abi, v3.bytecode.object, constructor.inputs.map((i) => valores[i.name]))

  // Feeds de Chainlink en el anvil: USDC/USD y ETH/USD a 1e8 (US$1) por ahora.
  await admin.setCode({ address: FEED_USDC, bytecode: agregador(100_000_000n) })
  // ETH/USD a US$4.000: precio realista; con el gas de anvil el costo de red pasa el tope on-chain.
  await admin.setCode({ address: FEED_ETH, bytecode: agregador(400_000_000_000n) })

  Object.assign(process.env, {
    MPP_SECRET_KEY: 'auditoria-liquidacion-v3-0123456789abcdef0123456789',
    TREASURY_ADDRESS: treasury.address,
    TREASURY_PRIVATE_KEY: llave(7),
    INTERNAL_API_SECRET: 'interno',
    RELAYER_PRIVATE_KEY: llave(1),
    PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA: contrato,
    ARBITRUM_SEPOLIA_RPC_URL: RPC,
    CHAINLINK_RPC_URL: RPC,
    AGENTS_SCHEDULER: 'off',
  })
  delete process.env.CIRCLE_NANOPAYMENTS_ENABLED
  delete process.env.PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET
  delete process.env.PEAJE_SETTLEMENT_V3_ARC_TESTNET

  ;({ cobrarYServir } = await import('../src/cobrar.js'))
  ;({ store } = await import('../src/store.js'))
  errores = await import('../src/liquidacion-v3.js')
})

after(async () => {
  await admin.setAutomine(true).catch(() => {})
  anvil?.kill()
})

let n = 0
async function negocio(payoutWallet: string) {
  const slug = `auditoria-${++n}`
  const tenant = await store.createTenant({ slug, name: slug, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
  await store.setPayoutWallet(tenant.id, payoutWallet)
  return (await store.getTenantById(tenant.id))!
}

type Origen = { status: number; llamadas: number; demoraMs?: number }
function cobrar(tenant: Awaited<ReturnType<typeof negocio>>, origen: Origen, headers: Record<string, string> = {}, priceUsd = '1') {
  return cobrarYServir({
    tenant,
    cobrable: new Request(`https://${tenant.slug}.example/api/dato`, { headers }),
    priceUsd,
    description: 'dato',
    routeId: null,
    path: '/api/dato',
    pedirOrigen: async () => {
      origen.llamadas++
      if (origen.demoraMs) await dormir(origen.demoraMs)
      return Response.json({ secreto: 'contenido pago' }, { status: origen.status })
    },
    mensajeCaido: 'caído',
  })
}

async function credencial(respuesta402: Response, account: LocalAccount) {
  const cliente = MppxCliente.create({
    polyfill: false,
    methods: [cargoEvm({ account, networks: [DEF.testnet.chainId], currencies: [TOKEN], authorization: DEF.eip3009! })],
  })
  return cliente.createCredential(respuesta402)
}

type Payload = { from: Hex; to: Hex; value: string; validAfter: string; validBefore: string; nonce: Hex; signature: Hex }
const payloadDe = (auth: string) => Credential.deserialize<Payload>(auth).payload

const TIPOS = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

/** Firma y somete al token una TransferWithAuthorization (el que la manda paga el gas). */
async function transferirConAutorizacion(firmante: LocalAccount, to: `0x${string}`, value: bigint, nonce: Hex, remitente: LocalAccount) {
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600)
  const signature = await firmante.signTypedData({
    domain: { ...DEF.eip3009!, chainId: DEF.testnet.chainId, verifyingContract: TOKEN },
    types: TIPOS,
    primaryType: 'TransferWithAuthorization',
    message: { from: firmante.address, to, value, validAfter: 0n, validBefore, nonce },
  })
  const { v, r, s } = parseSignature(signature)
  const wallet = createWalletClient({ account: remitente, chain, transport: http(RPC) })
  const hash = await wallet.writeContract({
    address: TOKEN,
    abi: errores.eip3009Abi,
    functionName: 'transferWithAuthorization',
    args: [firmante.address, to, value, 0n, validBefore, nonce, Number(v), r, s],
  })
  await lector.waitForTransactionReceipt({ hash })
}

/** Un adelanto legítimo: la autorización de la víctima a favor del contrato, sometida directo al token. */
async function adelantoDeVictima(value: bigint) {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  await transferirConAutorizacion(victima, contrato, value, nonce, atacante)
  return nonce
}

// ---------------------------------------------------------------------------
// H1. Pago adelantado "probado" sin pagar: el atacante quema el nonce de su
// propia autorización con otra TransferWithAuthorization (mismo nonce, otro
// `to`, valor 0). Antes la prueba (nonce usado + saldo del contrato que cubre
// + ningún PaymentSettled) la cubría el saldo de OTRO adelanto y se servía gratis.
// Ahora la tx que usó el nonce tiene que haberle transferido ESE valor al contrato.
// ---------------------------------------------------------------------------
test('auditoria H1 (arreglado): un nonce quemado no se sirve aunque el contrato tenga saldo de otros', async () => {
  // Un adelanto legítimo de otra persona queda esperando al Safe: 1 USDC en el contrato.
  await adelantoDeVictima(1_000_000n)
  const saldoContrato = await saldo(contrato)
  assert.ok(saldoContrato >= 1_000_000n)

  const victimaB = await negocio(merchantB.address)
  const origen: Origen = { status: 200, llamadas: 0 }
  for (let i = 0; i < 3; i++) {
    const auth = await credencial(await cobrar(victimaB, origen), atacante)
    const { nonce } = payloadDe(auth)
    await transferirConAutorizacion(atacante, otraDelAtacante.address, 0n, nonce, atacante)
    const r = await cobrar(victimaB, origen, { authorization: auth })
    assert.equal(r.status, 409, `intento ${i}: no se sirve`)
    assert.equal(r.headers.get('x-peaje-payment'), 'not-verified')
  }
  assert.equal(origen.llamadas, 0, 'el origen no se llamó')
  assert.equal(await saldo(contrato), saldoContrato)
  const filas = (await store.listStrays('pending')).filter((x) => x.payer === atacante.address.toLowerCase())
  assert.equal(filas.length, 0, 'ningún adelanto falso para el Safe')
})

// ---------------------------------------------------------------------------
// H2. El receipt no llega en 30 s (RPC lento): antes el agente leía "You were
// not charged" y la tx se minaba después, cobrada y fuera del ledger. Ahora
// queda pendiente; el reintento con la misma credencial encuentra la
// liquidación de Peaje, se sirve y se registra una sola vez.
// ---------------------------------------------------------------------------
test('auditoria H2 (arreglado): receipt tardío = pendiente; el reintento con la misma credencial se sirve y entra al ledger una vez', async () => {
  const merchant = cuenta(14)
  const tenant = await negocio(merchant.address)
  const pagador = pagadores[0]!
  const origen: Origen = { status: 200, llamadas: 0 }
  const auth = await credencial(await cobrar(tenant, origen), pagador)
  const antesPagador = await saldo(pagador.address)

  await admin.setAutomine(false)
  let r: Response
  try {
    r = await cobrar(tenant, origen, { authorization: auth })
  } finally {
    await admin.mine({ blocks: 1 })
    await admin.setAutomine(true)
  }
  assert.equal(r.status, 503)
  assert.equal(r.headers.get('x-peaje-payment'), 'pending')
  const cuerpo = (await r.json()) as { code: string; hint: string }
  assert.equal(cuerpo.code, 'settlement-pending')
  assert.match(cuerpo.hint, /Do not pay again/)
  assert.equal(antesPagador - (await saldo(pagador.address)), 1_000_000n, 'la tx se minó: pagó una vez')

  const reintento = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(reintento.status, 200)
  assert.deepEqual(await reintento.json(), { secreto: 'contenido pago' })
  assert.equal((await store.listPayments(tenant.id)).length, 1, 'queda en el ledger')

  const otraVez = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(otraVez.status, 409, 'ya se sirvió: no se vuelve a servir')
  assert.equal((await store.listPayments(tenant.id)).length, 1)
  assert.equal(antesPagador - (await saldo(pagador.address)), 1_000_000n, 'nunca pagó dos veces')
})

// ---------------------------------------------------------------------------
// H3. Dos pagos legítimos distintos al mismo tiempo: antes los dos envíos
// leían el mismo nonce pendiente del relayer y uno chocaba. Con nonceManager
// los dos pasan.
// ---------------------------------------------------------------------------
test('auditoria H3 (arreglado): pagos concurrentes de pagadores distintos se cobran y se sirven los dos', async () => {
  const merchant = cuenta(15)
  const tenant = await negocio(merchant.address)
  const origen: Origen = { status: 200, llamadas: 0, demoraMs: 300 }
  const [p1, p2] = [pagadores[1]!, pagadores[2]!]
  const a1 = await credencial(await cobrar(tenant, origen), p1)
  const a2 = await credencial(await cobrar(tenant, origen), p2)
  const antes = await Promise.all([saldo(p1.address), saldo(p2.address)])

  const respuestas = await Promise.all([cobrar(tenant, origen, { authorization: a1 }), cobrar(tenant, origen, { authorization: a2 })])
  const cobrados = (await Promise.all([saldo(p1.address), saldo(p2.address)])).map((x, i) => antes[i]! - x)
  assert.deepEqual(respuestas.map((x) => x.status), [200, 200])
  assert.deepEqual(cobrados, [1_000_000n, 1_000_000n])
})

// ---------------------------------------------------------------------------
// H4. Tope del costo de red: antes costoRed.ts topaba en US$0,05 y el
// contrato en US$0,02, y con el gas alto se rechazaban todos los pagos del
// riel. Ahora el tope sale del contrato (maxNetworkFee).
// ---------------------------------------------------------------------------
test('auditoria H4 (arreglado): el costo de red cotizado nunca pasa el tope del contrato y el pago se liquida', async () => {
  const costo = await import('../src/costoRed.js')
  costo.iniciarCostoRed()
  for (let i = 0; i < 100 && costo.costoRedUsd('arbitrum') === 0; i++) await dormir(100)
  const usd = costo.costoRedUsd('arbitrum')
  assert.equal(usd, 0.02, 'con ETH a US$4.000 el costo crudo pasa el tope: queda en el del contrato')

  const tenant = await negocio(cuenta(16).address)
  const pagador = pagadores[3]!
  const origen: Origen = { status: 200, llamadas: 0 }
  const auth = await credencial(await cobrar(tenant, origen), pagador)
  assert.equal(BigInt(payloadDe(auth).value), 1_000_000n + 20_000n)

  const antes = await saldo(pagador.address)
  const r = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(r.status, 200)
  assert.equal(origen.llamadas, 1)
  assert.equal(antes - (await saldo(pagador.address)), 1_020_000n)
})
