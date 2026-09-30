import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isDirectRail, railExplorerTxUrl, railLabel, splitPrecio, TEMPO_SPLIT_RAIL } from '../src/index'

test('splitPrecio trunca el fee como PeajeSettlement y reparte el precio completo', () => {
  assert.deepEqual(splitPrecio(10_000n, 200n), { netMicro: 9_800n, feeMicro: 200n })
  assert.deepEqual(splitPrecio(1_234_567n, 200n), { netMicro: 1_209_876n, feeMicro: 24_691n })
  // Precio tan chico que el 2% no llega a un micro-dólar: todo al negocio.
  assert.deepEqual(splitPrecio(49n, 200n), { netMicro: 49n, feeMicro: 0n })
  for (const p of [1n, 50n, 999_999n, 10_000_000n]) {
    const { netMicro, feeMicro } = splitPrecio(p, 200n)
    assert.equal(netMicro + feeMicro, p)
  }
})

test('el riel directo de Tempo tiene etiqueta y link al explorer de Tempo', () => {
  assert.equal(isDirectRail(TEMPO_SPLIT_RAIL), true)
  assert.equal(isDirectRail('tempo'), false)
  assert.equal(railLabel(TEMPO_SPLIT_RAIL), 'Tempo · Direct')
  assert.equal(railExplorerTxUrl(TEMPO_SPLIT_RAIL, '0xabc', true), 'https://explore.testnet.tempo.xyz/tx/0xabc')
})
