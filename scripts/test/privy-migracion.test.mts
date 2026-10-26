/**
 * Re-match por email y migración a la app de Privy nueva, con el store en
 * memoria y Privy falso. Correr desde la raíz:
 *   pnpm exec tsx --test scripts/test/privy-migracion.test.mts
 */
import { MemoryStore, patchWalletDueno, revincularPorEmail, tipoWalletCobro, type Agent, type WalletPrivy } from '@peaje/db'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicar, planear, type PrivyEscritura, type PrivyLectura } from '../privy-migracion.mts'

const W = (n: number) => `0x${String(n).padStart(40, '0')}`

async function escenario() {
  const store = new MemoryStore()
  const base = { name: 'x', originUrl: 'https://x.test', embedSecret: 's' }
  const portafolio = await store.createTenant({
    ...base,
    slug: 'sandra-portafolio',
    email: 'San@Example.com',
    privyUserId: 'did:privy:viejo-san',
    payoutWallet: W(1),
    custodialWallet: W(1),
    custodialWalletId: 'w-viejo-1',
  })
  const peaje = await store.createTenant({
    ...base,
    slug: 'peaje',
    email: 'san@example.com',
    privyUserId: 'did:privy:viejo-san',
    payoutWallet: W(2),
    custodialWallet: W(2),
    custodialWalletId: 'w-viejo-2',
  })
  // Cobra en una address externa: se respeta.
  const externo = await store.createTenant({
    ...base,
    slug: 'invitara',
    email: 'inv@example.com',
    privyUserId: 'did:privy:viejo-inv',
    payoutWallet: W(99),
    custodialWallet: W(3),
    custodialWalletId: 'w-viejo-3',
  })
  // No se toca nunca.
  const clima = await store.createTenant({ ...base, slug: 'clima-andino', email: 'otro@example.com', payoutWallet: W(50) })
  const agente = await store.createAgent({
    tenantId: portafolio.id,
    name: 'Your agent',
    mission: 'm',
    walletAddress: W(7),
    privyWalletId: 'w-agente-viejo',
    network: 'arc',
    maxPerRun: '0.05',
    frequency: 'once',
  })
  return { store, portafolio, peaje, externo, clima, agente }
}

// ---- re-match por email (lo que corre al entrar) ----

test('re-match: el DID nuevo toma los negocios del mismo email, sin distinguir mayúsculas', async () => {
  const { store } = await escenario()
  const { tenants, revinculados } = await revincularPorEmail(store, 'did:privy:nuevo-san', 'SAN@example.com')
  assert.deepEqual(revinculados.toSorted(), ['peaje', 'sandra-portafolio'])
  assert.equal(tenants.length, 2)
  for (const t of tenants) {
    assert.equal(t.privyUserId, 'did:privy:nuevo-san')
    assert.equal(t.privyUserIdLegacy, 'did:privy:viejo-san')
  }
  // El de otro email no se mueve.
  assert.equal((await store.getTenantBySlug('invitara'))!.privyUserId, 'did:privy:viejo-inv')
})

test('re-match: un negocio ya migrado no se vuelve a mover', async () => {
  const { store } = await escenario()
  await revincularPorEmail(store, 'did:privy:nuevo-san', 'san@example.com')
  const segundo = await revincularPorEmail(store, 'did:privy:intruso', 'san@example.com')
  assert.deepEqual(segundo.revinculados, [])
  assert.equal(segundo.tenants.length, 0)
  assert.equal((await store.getTenantBySlug('peaje'))!.privyUserId, 'did:privy:nuevo-san')
})

test('re-match: sin email o sin dueño no toma nada', async () => {
  const { store } = await escenario()
  assert.equal((await revincularPorEmail(store, 'did:privy:x', null)).tenants.length, 0)
  // clima-andino no tiene privyUserId: no se toma por email.
  const r = await revincularPorEmail(store, 'did:privy:x', 'otro@example.com')
  assert.deepEqual(r.revinculados, [])
  assert.equal((await store.getTenantBySlug('clima-andino'))!.privyUserId, null)
})

test('re-match: el mismo DID vuelve a entrar y no cambia nada', async () => {
  const { store } = await escenario()
  await revincularPorEmail(store, 'did:privy:nuevo-san', 'san@example.com')
  const otra = await revincularPorEmail(store, 'did:privy:nuevo-san', 'san@example.com')
  assert.deepEqual(otra.revinculados, [])
  assert.equal(otra.tenants.length, 2)
})

// ---- wallet del dueño ----

test('wallet del dueño: pasa a cobro, la custodiada queda en legacy', async () => {
  const { portafolio } = await escenario()
  const w: WalletPrivy = { id: 'w-nueva', address: W(100) }
  const patch = patchWalletDueno(portafolio, w)!
  assert.equal(patch.payoutWallet, W(100))
  assert.equal(patch.ownerWallet, W(100))
  assert.equal(patch.custodialWallet, null)
  assert.equal(patch.custodialWalletId, null)
  assert.equal(patch.custodialWalletLegacy, W(1))
  assert.equal(patch.custodialWalletIdLegacy, 'w-viejo-1')
  assert.equal(patchWalletDueno({ ...portafolio, ...patch }, w), null)
})

test('wallet del dueño: una address externa del dueño se respeta', async () => {
  const { externo } = await escenario()
  const patch = patchWalletDueno(externo, { id: 'w-inv', address: W(101) })!
  assert.equal(patch.payoutWallet, undefined)
  assert.equal(tipoWalletCobro({ ...externo, ...patch }), 'externa')
})

// ---- script de migración ----

function privyFalsa() {
  const viejos: Record<string, string> = { 'did:privy:viejo-san': 'san@example.com', 'did:privy:viejo-inv': 'inv@example.com' }
  const nuevos = new Map<string, { did: string; wallet: WalletPrivy | null }>()
  const agentes = new Map<string, WalletPrivy>()
  const llamadas = { importar: 0, crearAgente: 0 }
  let n = 200
  const lectura: PrivyLectura = {
    emailViejo: async (did) => viejos[did] ?? null,
    usuarioNuevoPorEmail: async (email) => nuevos.get(email.toLowerCase()) ?? null,
    walletAgenteNueva: async (id) => agentes.get(id) ?? null,
  }
  const escritura: PrivyEscritura = {
    async importarUsuarios(emails) {
      llamadas.importar += emails.length
      const m = new Map<string, string>()
      for (const e of emails) {
        const u = { did: `did:privy:nuevo-${e}`, wallet: { id: `w-${e}`, address: W(n++) } }
        nuevos.set(e, u)
        m.set(e, u.did)
      }
      return m
    },
    async walletDelUsuario(did) {
      return [...nuevos.values()].find((u) => u.did === did)!.wallet!
    },
    async crearWalletAgente(agent: Agent) {
      llamadas.crearAgente++
      const w = { id: `w-agente-${agent.id}`, address: W(n++) }
      agentes.set(agent.id, w)
      return w
    },
  }
  return { lectura, escritura, llamadas }
}

test('migración: el plan en seco no escribe nada', async () => {
  const { store } = await escenario()
  const antes = JSON.stringify(await store.listTenants())
  const { lectura } = privyFalsa()
  const plan = await planear(store, lectura, new Set(['clima-andino']))
  assert.equal(JSON.stringify(await store.listTenants()), antes)
  assert.equal(plan.negocios.filter((p) => p.estado === 'migrar').length, 3)
  assert.equal(plan.usuarios.length, 2)
  assert.equal(plan.negocios.find((p) => p.tenant.slug === 'clima-andino')!.estado, 'excluido')
  assert.equal(plan.agentes[0]!.estado, 'recrear')
})

test('migración: aplica y es idempotente', async () => {
  const { store, clima, agente } = await escenario()
  const climaAntes = JSON.stringify(await store.getTenantById(clima.id))
  const privy = privyFalsa()
  const excluidos = new Set(['clima-andino'])

  await aplicar(store, await planear(store, privy.lectura, excluidos), privy.escritura)

  const portafolio = (await store.getTenantBySlug('sandra-portafolio'))!
  const peaje = (await store.getTenantBySlug('peaje'))!
  const inv = (await store.getTenantBySlug('invitara'))!
  assert.equal(portafolio.privyUserId, 'did:privy:nuevo-san@example.com')
  assert.equal(portafolio.privyUserIdLegacy, 'did:privy:viejo-san')
  // Una wallet por persona: sus dos negocios cobran en la misma.
  assert.equal(portafolio.ownerWallet, peaje.ownerWallet)
  assert.equal(portafolio.payoutWallet, portafolio.ownerWallet)
  assert.equal(portafolio.custodialWalletId, null)
  assert.equal(portafolio.custodialWalletLegacy, W(1))
  assert.equal(inv.payoutWallet, W(99))
  assert.ok(inv.ownerWallet)
  assert.equal(JSON.stringify(await store.getTenantById(clima.id)), climaAntes)

  const ag = (await store.getAgent(agente.id))!
  assert.equal(ag.walletAddressLegacy, W(7))
  assert.equal(ag.privyWalletIdLegacy, 'w-agente-viejo')
  assert.notEqual(ag.walletAddress, W(7))

  // Segunda corrida: nada por hacer.
  const despues = JSON.stringify(await store.listTenants())
  const plan2 = await planear(store, privy.lectura, excluidos)
  assert.equal(plan2.negocios.filter((p) => p.estado === 'migrar').length, 0)
  assert.equal(plan2.usuarios.length, 0)
  assert.equal(plan2.agentes[0]!.estado, 'listo')
  await aplicar(store, plan2, privy.escritura)
  assert.equal(JSON.stringify(await store.listTenants()), despues)
  assert.equal(privy.llamadas.importar, 2)
  assert.equal(privy.llamadas.crearAgente, 1)
})

test('migración: corte a mitad (usuarios importados, base sin tocar) termina sin duplicar', async () => {
  const { store } = await escenario()
  const privy = privyFalsa()
  const excluidos = new Set(['clima-andino'])
  // Primera corrida se cae después de importar.
  await privy.escritura.importarUsuarios(['san@example.com', 'inv@example.com'])
  const plan = await planear(store, privy.lectura, excluidos)
  assert.equal(plan.usuarios.filter((u) => !u.didNuevo).length, 0)
  await aplicar(store, plan, privy.escritura)
  assert.equal(privy.llamadas.importar, 2)
  assert.equal((await store.getTenantBySlug('peaje'))!.privyUserIdLegacy, 'did:privy:viejo-san')
})
