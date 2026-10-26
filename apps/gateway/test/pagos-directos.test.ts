// Pagos directos con PeajeSettlementV3, de punta a punta contra un anvil local
// con el contrato de contracts/ (artefactos de `forge build`). Cubre: el 402
// solo ofrece rieles con dirección de cobro, Circle apagado, el pago llega a
// la wallet del negocio en la misma tx, sin 5xx del origen no hay settle, el
// pago adelantado queda registrado para el Safe, y la vista de ingresos.
//
// Necesita `anvil` (Foundry) en el PATH y `cd contracts && forge build`.
// Solo cuentas por defecto de Foundry (mnemónico de prueba). Store en memoria.
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_SERVICE_ROLE_KEY

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NETWORKS } from '@peaje/shared'
import { Challenge, Credential } from 'mppx'
import { Mppx as MppxCliente } from 'mppx/client'
import { charge as cargoEvm } from 'mppx/evm/client'
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseSignature,
  toHex,
  type Abi,
  type Hex,
} from 'viem'
import { mnemonicToAccount } from 'viem/accounts'

const MNEMONICO = 'test test test test test test test test test test test junk'
const cuenta = (i: number) => mnemonicToAccount(MNEMONICO, { addressIndex: i })
const llave = (i: number) => toHex(cuenta(i).getHdKey().privateKey!)

const owner = cuenta(0)
const relayer = cuenta(1)
const feeRecipient = cuenta(2)
const guardian = cuenta(3)
const merchant = cuenta(4)
const pagador = cuenta(5)
const tercero = cuenta(6)
const treasury = cuenta(7)

const DEF = NETWORKS.arbitrum
const TOKEN = DEF.token
const PUERTO = 18_545 + Math.floor(Math.random() * 1000)
const RPC = `http://127.0.0.1:${PUERTO}`
const chain = defineChain({
  id: DEF.testnet.chainId,
  name: 'anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

const OUT = fileURLToPath(new URL('../../../contracts/out/', import.meta.url))
const artefacto = (archivo: string, contrato: string) =>
  JSON.parse(readFileSync(`${OUT}${archivo}/${contrato}.json`, 'utf8')) as { abi: Abi; bytecode: { object: Hex } }

let anvil: ChildProcess
const lector = createPublicClient({ chain, transport: http(RPC) })
const admin = createTestClient({ chain, mode: 'anvil', transport: http(RPC) })
let contrato: `0x${string}`

// Módulos del gateway: se importan después de fijar el env.
let cobrarYServir: typeof import('../src/cobrar.js').cobrarYServir
let store: typeof import('../src/store.js').store
let liquidarV3: typeof import('../src/liquidacion-v3.js').liquidarV3
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

before(async () => {
  assert.ok(existsSync(`${OUT}PeajeSettlementV3.sol/PeajeSettlementV3.json`), 'falta `cd contracts && forge build`')
  anvil = spawn('anvil', ['--port', String(PUERTO), '--chain-id', String(DEF.testnet.chainId), '--silent'], { stdio: 'ignore' })
  await esperarAnvil()

  // El token mock (EIP-3009, dominio "USD Coin"/"2") se pone en la dirección
  // real del USDC de Arbitrum Sepolia: el gateway lo lee de NETWORKS.
  const mock = artefacto('MockStablecoinV3.sol', 'MockStablecoin')
  const temporal = await desplegar(mock.abi, mock.bytecode.object, ['USD Coin', '2', 6])
  await admin.setCode({ address: TOKEN, bytecode: (await lector.getCode({ address: temporal }))! })
  const ownerWallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
  const mint = await ownerWallet.writeContract({ address: TOKEN, abi: mock.abi, functionName: 'mint', args: [pagador.address, 100_000_000n] })
  await lector.waitForTransactionReceipt({ hash: mint })

  // PeajeSettlementV3 con roles separados. Los argumentos salen del ABI del
  // artefacto, por nombre: el constructor puede ganar parámetros (guardian).
  const v3 = artefacto('PeajeSettlementV3.sol', 'PeajeSettlementV3')
  const constructor = v3.abi.find((x) => x.type === 'constructor') as { inputs: { name: string }[] }
  const valores: Record<string, unknown> = {
    initialOwner: owner.address,
    guardian_: guardian.address,
    feeRecipient_: feeRecipient.address,
    relayers: [relayer.address],
    tokens: [TOKEN],
    maxNetworkFees: [50_000n],
  }
  const args = constructor.inputs.map((i) => {
    if (!(i.name in valores)) throw new Error(`constructor de v3 con un parámetro nuevo: ${i.name}`)
    return valores[i.name]
  })
  contrato = await desplegar(v3.abi, v3.bytecode.object, args)

  Object.assign(process.env, {
    MPP_SECRET_KEY: 'prueba-pagos-directos-0123456789abcdef0123456789',
    TREASURY_ADDRESS: treasury.address,
    TREASURY_PRIVATE_KEY: llave(7),
    INTERNAL_API_SECRET: 'interno',
    RELAYER_PRIVATE_KEY: llave(1),
    PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA: contrato,
    ARBITRUM_SEPOLIA_RPC_URL: RPC,
    // Sin red: el chequeo de depeg falla rápido y no pausa nada.
    CHAINLINK_RPC_URL: 'http://127.0.0.1:9',
    AGENTS_SCHEDULER: 'off',
  })
  delete process.env.CIRCLE_NANOPAYMENTS_ENABLED
  delete process.env.PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET
  delete process.env.PEAJE_SETTLEMENT_V3_ARC_TESTNET

  ;({ cobrarYServir } = await import('../src/cobrar.js'))
  ;({ store } = await import('../src/store.js'))
  errores = await import('../src/liquidacion-v3.js')
  liquidarV3 = errores.liquidarV3
})

after(() => {
  anvil?.kill()
})

let n = 0
async function negocio(payoutWallet: string | null) {
  const slug = `negocio-${++n}`
  const tenant = await store.createTenant({ slug, name: slug, originUrl: `https://${slug}.example`, embedSecret: 'x', email: `${slug}@example.com` })
  if (!payoutWallet) return tenant
  await store.setPayoutWallet(tenant.id, payoutWallet)
  return (await store.getTenantById(tenant.id))!
}

type Origen = { status: number; llamadas: number }
function cobrar(tenant: Awaited<ReturnType<typeof negocio>>, origen: Origen, headers: Record<string, string> = {}) {
  return cobrarYServir({
    tenant,
    cobrable: new Request(`https://${tenant.slug}.example/api/dato`, { headers }),
    priceUsd: '1',
    description: 'dato',
    routeId: null,
    path: '/api/dato',
    pedirOrigen: async () => {
      origen.llamadas++
      return Response.json({ ok: origen.status < 500 }, { status: origen.status })
    },
    mensajeCaido: 'caído',
  })
}

/** Firma la credencial del 402 con la wallet del pagador (cliente MPP real). */
async function credencial(respuesta402: Response) {
  const cliente = MppxCliente.create({
    polyfill: false,
    methods: [cargoEvm({ account: pagador, networks: [DEF.testnet.chainId], currencies: [TOKEN], authorization: DEF.eip3009! })],
  })
  return cliente.createCredential(respuesta402)
}

test('sin dirección de cobro no hay oferta: 503 con el aviso para el dueño', async () => {
  for (const tenant of [await negocio(null), await negocio(treasury.address)]) {
    const origen = { status: 200, llamadas: 0 }
    const r = await cobrar(tenant, origen)
    assert.equal(r.status, 503)
    const cuerpo = (await r.json()) as { code: string; hint: string }
    assert.equal(cuerpo.code, 'no-payout-address')
    assert.match(cuerpo.hint, new RegExp(`/t/${tenant.slug}/ingresos`))
    assert.equal(origen.llamadas, 0)
  }
})

test('el 402 ofrece Tempo con split y v3 por red, y nada de Circle', async () => {
  const tenant = await negocio(merchant.address)
  const r = await cobrar(tenant, { status: 200, llamadas: 0 })
  assert.equal(r.status, 402)
  const ofertas = Challenge.fromResponseList(r)
  const evm = ofertas.filter((o) => o.method === 'evm')
  const tempo = ofertas.filter((o) => o.method === 'tempo')
  assert.equal(tempo.length, 1)
  assert.equal((tempo[0]!.request as { recipient: string }).recipient.toLowerCase(), merchant.address.toLowerCase())
  // USDC y USDG de Arbitrum (mismo contrato). Robinhood y Arc sin dirección v3: sin oferta.
  assert.equal(evm.length, 2)
  for (const o of evm) assert.equal((o.request as { recipient: string }).recipient.toLowerCase(), contrato.toLowerCase())
  // Circle apagado: ninguna oferta a la treasury ni con el dominio de Gateway.
  for (const o of ofertas) assert.notEqual((o.request as { recipient?: string }).recipient?.toLowerCase(), treasury.address.toLowerCase())
})

test('pago v3: el origen responde y el neto llega a la wallet del negocio en la misma tx', async () => {
  const tenant = await negocio(merchant.address)
  const origen = { status: 200, llamadas: 0 }
  const desafio = await cobrar(tenant, origen)
  const auth = await credencial(desafio)

  const [antesMerchant, antesFee, antesPagador] = await Promise.all([saldo(merchant.address), saldo(feeRecipient.address), saldo(pagador.address)])
  const r = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(r.status, 200)
  assert.equal(origen.llamadas, 1)
  assert.ok(r.headers.get('payment-receipt'))

  // 1 USD, 2% de fee, sin costo de red (costoRed sin calcular en el test).
  assert.equal((await saldo(merchant.address)) - antesMerchant, 980_000n)
  assert.equal((await saldo(feeRecipient.address)) - antesFee, 20_000n)
  assert.equal(antesPagador - (await saldo(pagador.address)), 1_000_000n)
  assert.equal(await saldo(contrato), 0n)

  // Vista de ingresos: el pago con su tx, el neto y la dirección a la que llegó.
  const [pago] = await store.listPayments(tenant.id)
  assert.ok(pago)
  assert.equal(pago.network, 'arbitrum')
  assert.equal(Number(pago.amount), 0.98)
  assert.equal(Number(pago.platformFee), 0.02)
  assert.equal(pago.payoutAddress?.toLowerCase(), merchant.address.toLowerCase())
  const tx = await lector.getTransactionReceipt({ hash: pago.receiptRef as Hex })
  assert.equal(tx.status, 'success')
  assert.equal(tx.from.toLowerCase(), relayer.address.toLowerCase())
})

test('origen con 5xx: el settle no se envía, el agente no paga y la autorización queda sin usar', async () => {
  const tenant = await negocio(merchant.address)
  const origen = { status: 503, llamadas: 0 }
  const auth = await credencial(await cobrar(tenant, origen))
  const antes = await saldo(pagador.address)
  const bloque = await lector.getBlockNumber()

  const r = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(r.status, 503)
  assert.equal(r.headers.get('x-peaje-payment'), 'not-charged')
  assert.equal(origen.llamadas, 1)
  assert.equal(await saldo(pagador.address), antes)
  assert.equal(await lector.getBlockNumber(), bloque)
  assert.equal((await store.listPayments(tenant.id)).length, 0)
})

test('origen caído (excepción): 502 propio y no se cobra', async () => {
  const tenant = await negocio(merchant.address)
  const auth = await credencial(await cobrar(tenant, { status: 200, llamadas: 0 }))
  const antes = await saldo(pagador.address)
  const r = await cobrarYServir({
    tenant,
    cobrable: new Request(`https://${tenant.slug}.example/api/dato`, { headers: { authorization: auth } }),
    priceUsd: '1',
    description: 'dato',
    routeId: null,
    path: '/api/dato',
    pedirOrigen: async () => {
      throw new Error('ECONNREFUSED')
    },
    mensajeCaido: 'caído',
  })
  assert.equal(r.status, 502)
  assert.equal(((await r.json()) as { code: string }).code, 'origin-failed-not-charged')
  assert.equal(await saldo(pagador.address), antes)
})

/** Un tercero manda la autorización de la credencial directo al token, antes que el relayer. */
async function adelantar(auth: string) {
  const { payload } = Credential.deserialize<{ from: Hex; to: Hex; value: string; validAfter: string; validBefore: string; nonce: Hex; signature: Hex }>(
    auth,
  )
  const { v, r: rr, s } = parseSignature(payload.signature)
  const terceroWallet = createWalletClient({ account: tercero, chain, transport: http(RPC) })
  const hash = await terceroWallet.writeContract({
    address: TOKEN,
    abi: errores.eip3009Abi,
    functionName: 'transferWithAuthorization',
    args: [payload.from, payload.to, BigInt(payload.value), BigInt(payload.validAfter), BigInt(payload.validBefore), payload.nonce, Number(v), rr, s],
  })
  await lector.waitForTransactionReceipt({ hash })
  return payload
}

test('pago adelantado con la plata en el contrato: se registra y se sirve una sola vez', async () => {
  const tenant = await negocio(merchant.address)
  const origen = { status: 200, llamadas: 0 }
  const auth = await credencial(await cobrar(tenant, origen))
  const antes = await saldo(contrato)
  const payload = await adelantar(auth)
  assert.equal((await saldo(contrato)) - antes, BigInt(payload.value))

  // Primer intento: autorización usada, saldo del contrato que la cubre y
  // ningún PaymentSettled de ese nonce. Se sirve, marcado pending-split.
  const r = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('x-peaje-payment'), 'pending-split')
  assert.equal(r.headers.get('payment-receipt'), null)
  assert.equal(origen.llamadas, 1)

  const stray = (await store.listStrays('pending')).find((x) => x.nonce === payload.nonce.toLowerCase())
  assert.ok(stray)
  assert.equal(stray.merchant.toLowerCase(), merchant.address.toLowerCase())
  assert.equal(stray.payer, pagador.address.toLowerCase())
  assert.equal(stray.value, payload.value)
  assert.equal(stray.tenantId, tenant.id)
  // Nada se barre: los fondos siguen en el contrato hasta que el Safe reparta.
  assert.equal((await saldo(contrato)) - antes, BigInt(payload.value))

  // Segundo intento con la misma credencial: no se sirve ni se duplica la fila.
  const otra = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(otra.status, 409)
  assert.equal(((await otra.json()) as { code: string }).code, 'authorization-front-run')
  assert.equal(origen.llamadas, 1)
  assert.equal((await store.listStrays('pending')).filter((x) => x.nonce === stray.nonce).length, 1)

  const resuelto = await store.resolveStray(stray.id, `0x${'ab'.repeat(32)}`)
  assert.equal(resuelto?.status, 'settled')
})

test('autorización usada sin prueba de que la plata esté en el contrato: 409 y no se sirve', async () => {
  const tenant = await negocio(merchant.address)
  const origen = { status: 200, llamadas: 0 }

  // Un pago normal ya liquidado. El contrato todavía guarda el adelanto del
  // test anterior (cubre el monto), pero este nonce ya tiene PaymentSettled.
  const auth = await credencial(await cobrar(tenant, origen))
  assert.equal((await cobrar(tenant, origen, { authorization: auth })).status, 200)
  assert.equal(origen.llamadas, 1)
  assert.ok((await saldo(contrato)) >= 1_000_000n)

  const repetido = await cobrar(tenant, origen, { authorization: auth })
  assert.equal(repetido.status, 409)
  assert.equal(repetido.headers.get('x-peaje-payment'), 'not-verified')
  assert.equal(((await repetido.json()) as { code: string }).code, 'authorization-used')
  assert.equal(origen.llamadas, 1)
  const { payload } = Credential.deserialize<{ nonce: Hex }>(auth)
  assert.equal((await store.listStrays()).some((x) => x.nonce === payload.nonce.toLowerCase()), false)
})

test('corte por origen caído: 3 fallos en 10 minutos apagan el 402, avisa una vez y vuelve tras el enfriamiento', async () => {
  const corte = await import('../src/cortacircuito.js')
  const avisos: string[] = []
  corte.fijarAvisador(async (t) => {
    avisos.push(t.slug)
  })
  let ahora = Date.now()
  corte.fijarReloj(() => ahora)
  try {
    const tenant = await negocio(merchant.address)
    const origen = { status: 500, llamadas: 0 }
    for (let i = 0; i < 3; i++) {
      const auth = await credencial(await cobrar(tenant, origen))
      const r = await cobrar(tenant, origen, { authorization: auth })
      assert.equal(r.headers.get('x-peaje-payment'), 'not-charged')
    }
    assert.equal(origen.llamadas, 3)
    assert.deepEqual(avisos, [tenant.slug])

    // Cortado: ni 402 ni origen, para cualquier riel.
    const pausado = await cobrar(tenant, origen)
    assert.equal(pausado.status, 503)
    assert.equal(((await pausado.json()) as { code: string }).code, 'origin-paused')
    assert.ok(Number(pausado.headers.get('retry-after')) > 0)
    assert.equal(origen.llamadas, 3)

    // Pasado el enfriamiento (15 min) vuelve a ofrecer el 402.
    ahora += 16 * 60_000
    origen.status = 200
    assert.equal((await cobrar(tenant, origen)).status, 402)
    const auth = await credencial(await cobrar(tenant, origen))
    assert.equal((await cobrar(tenant, origen, { authorization: auth })).status, 200)
    assert.deepEqual(avisos, [tenant.slug])
  } finally {
    corte.fijarReloj(() => Date.now())
  }
})

test('liquidarV3: costo de red al fee recipient, simulación antes del origen, merchant obligatorio', async () => {
  const rielV3 = {
    publicClient: lector as never,
    relayer: createWalletClient({ account: relayer, chain, transport: http(RPC) }),
    contrato,
    token: TOKEN,
  }
  const firmar = async (value: bigint) => {
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600)
    const signature = await pagador.signTypedData({
      domain: { ...DEF.eip3009!, chainId: DEF.testnet.chainId, verifyingContract: TOKEN },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: { from: pagador.address, to: contrato, value, validAfter: 0n, validBefore, nonce },
    })
    return { from: pagador.address, to: contrato, value: String(value), validAfter: '0', validBefore: String(validBefore), nonce, signature }
  }

  // Costo de red de 0,01: el negocio recibe el 98% del precio, Peaje el 2% más el costo.
  const antesMerchant = await saldo(merchant.address)
  const antesFee = await saldo(feeRecipient.address)
  const orden: string[] = []
  const ok = await liquidarV3(rielV3, { merchant: merchant.address, auth: await firmar(510_000n), networkFee: 10_000n }, {
    antesDeEnviar: async () => {
      orden.push('origen')
      return true
    },
  })
  assert.deepEqual(orden, ['origen'])
  assert.equal(ok.net, 490_000n)
  assert.equal(ok.fee, 10_000n)
  assert.equal((await saldo(merchant.address)) - antesMerchant, 490_000n)
  assert.equal((await saldo(feeRecipient.address)) - antesFee, 20_000n)

  // Costo de red sobre el tope: la simulación lo rechaza y el origen no se llama.
  let llamado = false
  await assert.rejects(
    liquidarV3(rielV3, { merchant: merchant.address, auth: await firmar(1_000_000n), networkFee: 60_000n }, { antesDeEnviar: async () => (llamado = true) }),
    (e: unknown) => e instanceof errores.LiquidacionRechazada && /NetworkFeeTooHigh/.test(e.motivo),
  )
  assert.equal(llamado, false)

  // Sin merchant no hay fallback al relayer.
  await assert.rejects(
    liquidarV3(rielV3, { merchant: null, auth: await firmar(1_000_000n), networkFee: 0n }),
    (e: unknown) => e instanceof errores.LiquidacionRechazada,
  )
  // El fee recipient como merchant: el contrato lo rechaza en la simulación.
  await assert.rejects(
    liquidarV3(rielV3, { merchant: feeRecipient.address, auth: await firmar(1_000_000n), networkFee: 0n }),
    (e: unknown) => e instanceof errores.LiquidacionRechazada && /InvalidMerchant/.test(e.motivo),
  )
  // El origen falla: OrigenFallo y nada se mueve.
  const antesPagador = await saldo(pagador.address)
  await assert.rejects(
    liquidarV3(rielV3, { merchant: merchant.address, auth: await firmar(1_000_000n), networkFee: 0n }, { antesDeEnviar: async () => false }),
    (e: unknown) => e instanceof errores.OrigenFallo,
  )
  assert.equal(await saldo(pagador.address), antesPagador)
})
