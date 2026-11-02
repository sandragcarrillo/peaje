// El env del gateway en mainnet se valida al importar: se prueba en un
// proceso aparte por caso, con el entorno justo.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const GATEWAY = fileURLToPath(new URL('..', import.meta.url))
const TREASURY = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'
const FRIA = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

function cargarEnv(extra: Record<string, string>) {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', "import('./src/env.ts').then(({ env }) => console.log(JSON.stringify({ testnet: env.testnet, fee: env.tempoFeeRecipient, v3: env.settlementV3, rpc: env.settlementRpcUrls, circle: env.circleNanopayments })))"],
    {
      cwd: GATEWAY,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        MPP_SECRET_KEY: 'prueba-red-mainnet-0123456789abcdef0123456789',
        TREASURY_ADDRESS: TREASURY,
        TREASURY_PRIVATE_KEY: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
        INTERNAL_API_SECRET: 'interno',
        // Lo de testnet en el entorno no puede colarse en mainnet.
        PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA: '0xcd29503DEcd337Fe005ca07d1B0343AEE05CdF42',
        PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET: '0x3e0f648349432A5195e498D8D3b7Fa7d759752cC',
        PEAJE_SETTLEMENT_V3_ARC_TESTNET: '0x5a810d1317412A9635D0F84B74ff9F2DFbEc0E21',
        CIRCLE_NANOPAYMENTS_ENABLED: 'true',
        ...extra,
      },
    },
  )
  return { ok: r.status === 0, salida: r.stdout.trim(), error: r.stderr }
}

test('mainnet sin PEAJE_FEE_RECIPIENT no arranca', () => {
  const r = cargarEnv({ NEXT_PUBLIC_RED: 'mainnet' })
  assert.equal(r.ok, false)
  assert.match(r.error, /Falta PEAJE_FEE_RECIPIENT/)
})

test('mainnet con la treasury como destino del 2% no arranca', () => {
  const r = cargarEnv({ NEXT_PUBLIC_RED: 'mainnet', PEAJE_FEE_RECIPIENT: TREASURY })
  assert.equal(r.ok, false)
  assert.match(r.error, /no puede ser la treasury/)
})

test('un valor de red mal escrito no arranca en vez de caer a testnet', () => {
  const r = cargarEnv({ NEXT_PUBLIC_RED: 'produccion' })
  assert.equal(r.ok, false)
  assert.match(r.error, /testnet o mainnet/)
})

test('mainnet: solo Arbitrum One, con su contrato y su RPC; Robinhood, Arc y Circle apagados', () => {
  const r = cargarEnv({
    NEXT_PUBLIC_RED: 'mainnet',
    PEAJE_FEE_RECIPIENT: FRIA,
    PEAJE_SETTLEMENT_V3_ARBITRUM_ONE: '0x00000000000000000000000000000000000000aa',
  })
  assert.ok(r.ok, r.error)
  const env = JSON.parse(r.salida)
  assert.equal(env.testnet, false)
  assert.equal(env.fee, FRIA)
  assert.deepEqual(env.v3, {
    arbitrum: '0x00000000000000000000000000000000000000aa',
    'arbitrum-usdg': '0x00000000000000000000000000000000000000aa',
    robinhood: null,
    arc: null,
  })
  assert.equal(env.rpc.arbitrum, 'https://arb1.arbitrum.io/rpc')
  assert.equal(env.rpc.robinhood, null)
  assert.equal(env.circle, false)
})

test('testnet sin variables nuevas queda como antes: el 2% de Tempo a la treasury', () => {
  const r = cargarEnv({})
  assert.ok(r.ok, r.error)
  const env = JSON.parse(r.salida)
  assert.equal(env.testnet, true)
  assert.equal(env.fee, TREASURY)
  assert.equal(env.v3.arbitrum, '0xcd29503DEcd337Fe005ca07d1B0343AEE05CdF42')
  assert.equal(env.circle, true)
})

/** Corre un script en un proceso con el entorno de cargarEnv y devuelve su JSON. */
function correr(script: string, extra: Record<string, string>) {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
    cwd: GATEWAY,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      MPP_SECRET_KEY: 'prueba-red-mainnet-0123456789abcdef0123456789',
      TREASURY_ADDRESS: TREASURY,
      TREASURY_PRIVATE_KEY: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
      INTERNAL_API_SECRET: 'interno',
      ...extra,
    },
  })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout.trim().split('\n').at(-1)!)
}

// Graba un pago de testnet y uno de mainnet en el mismo store y lee en el modo del proceso.
const LEDGER = `
const { MemoryStore } = await import('@peaje/db')
const { cobraEnEsteModo, conPrecioVigente } = await import('./src/cobro.ts')
const store = new MemoryStore()
const t = await store.createTenant({ slug: 'x', name: 'x', originUrl: 'https://x.example', embedSecret: 'x', email: 'x@example.com' })
const pago = (testnet, ref) => store.recordPayment({ tenantId: t.id, routeId: null, path: '/a', agentWallet: null, amount: '1', receiptRef: ref, method: 'evm', network: 'arbitrum', testnet })
await pago(true, '0x01'); await pago(false, '0x02'); await pago(false, '0x03')
// El store en memoria devuelve el mismo objeto: se mide antes de activar.
const apagado = await store.getTenantById(t.id)
const cobraApagado = cobraEnEsteModo(apagado)
const precioApagado = conPrecioVigente(apagado, [{ priceUsd: '0.05' }])[0].priceUsd
await store.setCobrosActivos(t.id, true)
const prendido = await store.getTenantById(t.id)
console.log(JSON.stringify({
  pagos: (await store.listPayments(t.id)).map((p) => p.receiptRef).sort(),
  revenue: (await store.balance(t.id)).revenue,
  cobraApagado,
  cobraPrendido: cobraEnEsteModo(prendido),
  precioApagado,
  activadoAt: !!prendido.cobrosActivadosAt,
}))
`

test('mainnet: el registro solo ve pagos de mainnet, y sin cobros activos el precio que rige es 0', () => {
  const r = correr(`(async () => {${LEDGER}})()`, { NEXT_PUBLIC_RED: 'mainnet', PEAJE_FEE_RECIPIENT: FRIA })
  assert.deepEqual(r.pagos, ['0x02', '0x03'])
  assert.equal(r.revenue, '2.000000')
  assert.equal(r.cobraApagado, false)
  assert.equal(r.cobraPrendido, true)
  assert.equal(r.precioApagado, '0')
  assert.equal(r.activadoAt, true)
})

test('testnet: el registro solo ve pagos de testnet, y todos cobran aunque no activen nada', () => {
  const r = correr(`(async () => {${LEDGER}})()`, {})
  assert.deepEqual(r.pagos, ['0x01'])
  assert.equal(r.revenue, '1.000000')
  assert.equal(r.cobraApagado, true)
  assert.equal(r.precioApagado, '0.05')
})
