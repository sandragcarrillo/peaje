import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cadena, chainLabels, modoTestnet, NETWORK_IDS, NETWORKS, redesActivas } from '../src/index'

test('modoTestnet: sin valor es testnet, mainnet lo apaga, lo demás es error', () => {
  assert.equal(modoTestnet(undefined), true)
  assert.equal(modoTestnet(''), true)
  assert.equal(modoTestnet('testnet'), true)
  assert.equal(modoTestnet(' mainnet '), false)
  assert.throws(() => modoTestnet('Mainnet'), /testnet o mainnet/)
  assert.throws(() => modoTestnet('prod'), /testnet o mainnet/)
})

test('en mainnet solo existen Arbitrum One (USDC y USDG) y Tempo', () => {
  assert.deepEqual(redesActivas(false), ['arbitrum', 'arbitrum-usdg', 'tempo'])
  assert.deepEqual(chainLabels(false), ['Arbitrum', 'Tempo'])
  assert.equal(cadena('robinhood', false), null)
  assert.equal(cadena('arc', false), null)
  assert.equal(cadena('arbitrum', false)?.chainId, 42161)
  assert.equal(cadena('arbitrum', false)?.token, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831')
  assert.equal(cadena('arbitrum-usdg', false)?.token, '0x004B506865409877C9fA29bfb1ebA929984B9bbC')
  assert.equal(cadena('tempo', false)?.chainId, 4217)
})

test('testnet sigue igual: las cinco redes y sus cadenas de prueba', () => {
  assert.deepEqual(redesActivas(true), NETWORK_IDS)
  assert.deepEqual(chainLabels(true), ['Arbitrum', 'Robinhood', 'Tempo', 'Arc'])
  assert.equal(cadena('arbitrum', true)?.chainId, 421614)
})

test('ninguna cadena de mainnet comparte chainId ni token EVM con testnet', () => {
  for (const id of NETWORK_IDS) {
    const main = NETWORKS[id].mainnet
    if (!main) continue
    for (const otra of NETWORK_IDS) assert.notEqual(main.chainId, NETWORKS[otra].testnet.chainId)
    // Tempo usa la misma dirección de pathUSD en las dos (TIP-20 precompilado).
    if (id !== 'tempo') assert.notEqual(main.token.toLowerCase(), NETWORKS[id].testnet.token.toLowerCase())
  }
})
