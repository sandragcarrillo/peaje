/**
 * Validación de "usar mi propia dirección", con el store en memoria y RPC falso.
 *   cd apps/dashboard && npx tsx --test test/direccion-propia.test.ts
 */
import { MemoryStore } from '@peaje/db'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAddress } from 'viem'
import { validarDireccionPropia, type DepsDireccion } from '../lib/direccion-propia'

const EOA = '0x52908400098527886E0F7030069857D2E4169EE7' // vector de EIP-55
const CONTRATO = '0x36F9aEBeBce767A1FEE25Fa90F9bF13137E61231'
const TREASURY = '0x3715986D44f5d56BC6ae3E983D1928CEc37dE253'
const DUENO = '0x8617E340B3D01FA5F11F306F4090FD50E238070D'

async function deps(over: Partial<DepsDireccion> = {}): Promise<DepsDireccion> {
  const store = new MemoryStore()
  const t = await store.createTenant({ slug: 'x', name: 'x', originUrl: 'https://x.test', embedSecret: 's' })
  await store.createAgent({
    tenantId: t.id,
    name: 'a',
    mission: 'm',
    walletAddress: '0x75ba000000000000000000000000000000007196',
    privyWalletId: 'w-agente',
    network: 'arc',
    maxPerRun: '0.05',
    frequency: 'once',
  })
  const codigos: Record<string, string> = { [CONTRATO.toLowerCase()]: '0x6080604052' }
  return {
    treasury: TREASURY,
    redes: ['arbitrum', 'robinhood', 'tempo', 'arc'],
    codigoEn: async (_red, a) => codigos[a.toLowerCase()] ?? '0x',
    esWalletDeAgente: async (a) => (await store.getAgentByWalletAddress(a)) !== null,
    idWalletDeLaApp: async (a) => (a.toLowerCase() === '0xc2db000000000000000000000000000000c274ec' ? 'w-otra-cuenta' : null),
    walletDelDueno: { id: 'w-dueno', address: DUENO },
    ...over,
  }
}

test('acepta una EOA con checksum correcto', async () => {
  assert.deepEqual(await validarDireccionPropia(EOA, await deps()), { ok: true, address: EOA })
})

test('acepta todo en minúsculas y lo devuelve con checksum', async () => {
  assert.deepEqual(await validarDireccionPropia(` ${EOA.toLowerCase()} `, await deps()), { ok: true, address: EOA })
})

test('rechaza checksum EIP-55 roto (un typo de mayúscula)', async () => {
  const roto = EOA.replace('E0F', 'e0F')
  assert.deepEqual(await validarDireccionPropia(roto, await deps()), { ok: false, motivo: 'checksum' })
})

test('rechaza formato inválido', async () => {
  for (const raw of ['', '0x123', 'hola', `${EOA}00`, EOA.slice(2)]) {
    assert.deepEqual(await validarDireccionPropia(raw, await deps()), { ok: false, motivo: 'formato' }, raw)
  }
})

test('rechaza la treasury', async () => {
  assert.deepEqual(await validarDireccionPropia(TREASURY, await deps()), { ok: false, motivo: 'treasury' })
})

test('rechaza un contrato', async () => {
  assert.deepEqual(await validarDireccionPropia(CONTRATO, await deps()), { ok: false, motivo: 'contrato' })
})

test('acepta una EOA con delegación EIP-7702', async () => {
  const d = await deps({ codigoEn: async () => '0xef0100' + 'ab'.repeat(20) })
  assert.equal((await validarDireccionPropia(EOA, d)).ok, true)
})

test('rechaza la wallet de un agente de Peaje', async () => {
  const r = await validarDireccionPropia(getAddress('0x75ba000000000000000000000000000000007196'), await deps())
  assert.deepEqual(r, { ok: false, motivo: 'agente' })
})

test('rechaza una wallet de Privy de otra cuenta', async () => {
  const r = await validarDireccionPropia('0xc2db000000000000000000000000000000c274ec', await deps())
  assert.deepEqual(r, { ok: false, motivo: 'ajena' })
})

test('volver a la wallet del dueño siempre se permite', async () => {
  const d = await deps({ idWalletDeLaApp: async () => 'w-dueno', codigoEn: async () => { throw new Error('rpc caído') } })
  assert.deepEqual(await validarDireccionPropia(DUENO.toLowerCase(), d), { ok: true, address: getAddress(DUENO) })
})

test('si una red no responde, no guarda sin verificar', async () => {
  const d = await deps({ codigoEn: async (red) => { if (red === 'tempo') throw new Error('timeout'); return '0x' } })
  assert.deepEqual(await validarDireccionPropia(EOA, d), { ok: false, motivo: 'sin-verificar' })
})

test('sin treasury configurada, esa regla se salta', async () => {
  assert.equal((await validarDireccionPropia(TREASURY, await deps({ treasury: null }))).ok, true)
})
