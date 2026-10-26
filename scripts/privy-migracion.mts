/**
 * Migración de Peaje a la app de Privy nueva (de San). Ver docs/privy-migracion.md.
 *
 * Por defecto es --dry: solo lee (base + las dos apps de Privy) e imprime el
 * plan. Con --apply hace, en orden:
 *
 * 1. Importa a la app nueva, por email, a cada dueño de negocio (batch import,
 *    POST https://auth.privy.io/api/v1/users/batch, hasta 20 por request), con
 *    su wallet de Ethereum creada en el mismo paso (owner = el usuario, no
 *    custodial). Si ya existe en la app nueva, lo reusa.
 * 2. Pasa cada negocio al DID nuevo (el viejo queda en privy_user_id_legacy).
 * 3. Le da la wallet del dueño: ownerWallet, y payoutWallet salvo que el dueño
 *    tenga una address externa. La custodiada vieja pasa a *_legacy y se limpia.
 * 4. Recrea en la app nueva la wallet de cada agente comprador (sigue siendo
 *    de la app) y guarda la vieja en *_legacy para barrerla.
 *
 * Idempotente: cada paso mira el estado antes y se salta lo que ya está.
 * Re-correrlo después de un corte a mitad termina lo que faltó.
 *
 * Credenciales: PRIVY_VIEJA_APP_ID / PRIVY_VIEJA_APP_SECRET (app vieja, solo
 * lectura) y PRIVY_NUEVA_APP_ID / PRIVY_NUEVA_APP_SECRET. Base: SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY (sin ellas usa el store en memoria, vacío).
 *
 * Correr desde la raíz:
 *   pnpm exec tsx --env-file=.env scripts/privy-migracion.mts            # plan
 *   pnpm exec tsx --env-file=.env scripts/privy-migracion.mts --apply    # aplica
 *   --excluir=slug1,slug2 suma negocios a no tocar (clima-andino siempre).
 */
import {
  cobroEsExterno,
  emailDe,
  getStore,
  patchWalletDueno,
  walletEmbebidaDe,
  type Agent,
  type Store,
  type Tenant,
  type TenantWalletPatch,
  type WalletPrivy,
} from '@peaje/db'
import { PrivyClient } from '@privy-io/node'
import { pathToFileURL } from 'node:url'

// ---- puertos (inyectables para el test con el store en memoria) ----

export type UsuarioNuevo = { did: string; wallet: WalletPrivy | null }

/** Lecturas. Nada acá escribe. */
export type PrivyLectura = {
  /** Email del usuario en la app vieja, o null si no existe o no tiene. */
  emailViejo(did: string): Promise<string | null>
  /** Usuario de la app nueva con ese email, o null. */
  usuarioNuevoPorEmail(email: string): Promise<UsuarioNuevo | null>
  /** Wallet ya creada en la app nueva para ese agente (external_id), o null. */
  walletAgenteNueva(agentId: string): Promise<WalletPrivy | null>
}

export type PrivyEscritura = {
  /** Crea los usuarios (con su wallet). Devuelve email (minúsculas) → DID; los que chocan traen el DID existente. */
  importarUsuarios(emails: string[]): Promise<Map<string, string>>
  /** Wallet del usuario (owner = su DID). La crea si no tiene. */
  walletDelUsuario(did: string): Promise<WalletPrivy>
  /** Wallet de la app para el agente, con external_id fijo para no duplicar. */
  crearWalletAgente(agent: Agent): Promise<WalletPrivy>
}

// ---- plan ----

export type PlanNegocio = {
  tenant: Tenant
  /** Email con el que se importa (el de la app vieja si existe, si no el del negocio). */
  email: string | null
  estado: 'migrar' | 'listo' | 'sin-dueno' | 'sin-email' | 'excluido'
  /** DID nuevo si el usuario ya existe en la app nueva. */
  didNuevo: string | null
  /** true si el dueño cobra en una address externa: se respeta. */
  cobroExterno: boolean
  avisos: string[]
}

export type PlanAgente = {
  agent: Agent
  slug: string
  estado: 'recrear' | 'listo' | 'sin-wallet' | 'excluido'
  /** Wallet ya creada en la app nueva (corrida anterior cortada a mitad). */
  walletNueva: WalletPrivy | null
}

export type PlanUsuario = { email: string; didNuevo: string | null; wallet: WalletPrivy | null; negocios: string[] }

export type Plan = { negocios: PlanNegocio[]; usuarios: PlanUsuario[]; agentes: PlanAgente[] }

export const EXCLUIDOS_SIEMPRE = ['clima-andino']

const lower = (s: string) => s.trim().toLowerCase()

export async function planear(store: Store, privy: PrivyLectura, excluidos: Set<string>): Promise<Plan> {
  const tenants = await store.listTenants()
  const negocios: PlanNegocio[] = []

  for (const tenant of tenants) {
    const avisos: string[] = []
    const cobroExterno = cobroEsExterno(tenant)
    const base = { tenant, cobroExterno, avisos, didNuevo: null as string | null }

    if (excluidos.has(tenant.slug)) {
      negocios.push({ ...base, email: tenant.email, estado: 'excluido' })
      continue
    }
    const yaMigrado = tenant.privyUserIdLegacy !== null && !!tenant.ownerWalletId && !tenant.custodialWalletId
    if (yaMigrado) {
      negocios.push({ ...base, email: tenant.email, estado: 'listo', didNuevo: tenant.privyUserId })
      continue
    }
    if (!tenant.privyUserId) {
      negocios.push({ ...base, email: tenant.email, estado: 'sin-dueno' })
      continue
    }

    // Ya re-vinculado (por login o corrida anterior): el DID actual es de la app nueva.
    let email: string | null = tenant.email
    if (tenant.privyUserIdLegacy === null) {
      const viejo = await privy.emailViejo(tenant.privyUserId)
      if (viejo && tenant.email && lower(viejo) !== lower(tenant.email)) {
        avisos.push('el email del negocio no coincide con el de Privy: se usa el de Privy')
      }
      if (!viejo) avisos.push('el DID no está en la app vieja: se usa el email del negocio')
      email = viejo ?? tenant.email
    }
    if (!email) {
      negocios.push({ ...base, email: null, estado: 'sin-email' })
      continue
    }
    const existente = await privy.usuarioNuevoPorEmail(email)
    negocios.push({ ...base, email: lower(email), estado: 'migrar', didNuevo: existente?.did ?? null })
  }

  // Un usuario por email: varios negocios comparten dueño (y wallet).
  const usuarios = new Map<string, PlanUsuario>()
  for (const n of negocios) {
    if (n.estado !== 'migrar' || !n.email) continue
    const u = usuarios.get(n.email) ?? { email: n.email, didNuevo: n.didNuevo, wallet: null, negocios: [] }
    u.negocios.push(n.tenant.slug)
    usuarios.set(n.email, u)
  }
  for (const u of usuarios.values()) {
    if (u.didNuevo) u.wallet = (await privy.usuarioNuevoPorEmail(u.email))?.wallet ?? null
  }

  const agentes: PlanAgente[] = []
  for (const tenant of tenants) {
    for (const agent of await store.listAgents(tenant.id)) {
      const base = { agent, slug: tenant.slug, walletNueva: null }
      if (excluidos.has(tenant.slug)) agentes.push({ ...base, estado: 'excluido' })
      else if (agent.walletAddressLegacy) agentes.push({ ...base, estado: 'listo' })
      else if (!agent.privyWalletId) agentes.push({ ...base, estado: 'sin-wallet' })
      else agentes.push({ ...base, estado: 'recrear', walletNueva: await privy.walletAgenteNueva(agent.id) })
    }
  }

  return { negocios, usuarios: [...usuarios.values()], agentes }
}

// ---- aplicar ----

export type Resultado = { negocios: { slug: string; cambios: TenantWalletPatch | null; revinculado: boolean }[]; agentes: { id: string; nueva: string }[] }

export async function aplicar(store: Store, plan: Plan, privy: PrivyEscritura): Promise<Resultado> {
  // 1. usuarios
  const porImportar = plan.usuarios.filter((u) => !u.didNuevo).map((u) => u.email)
  const importados = porImportar.length > 0 ? await privy.importarUsuarios(porImportar) : new Map<string, string>()
  const didPorEmail = new Map<string, string>()
  for (const u of plan.usuarios) {
    const did = u.didNuevo ?? importados.get(u.email)
    if (!did) throw new Error(`No se pudo importar ${enmascarar(u.email)}: se corta antes de tocar sus negocios`)
    didPorEmail.set(u.email, did)
  }
  const walletPorDid = new Map<string, WalletPrivy>()
  for (const did of new Set(didPorEmail.values())) walletPorDid.set(did, await privy.walletDelUsuario(did))

  // 2 y 3. negocios
  const negocios: Resultado['negocios'] = []
  for (const n of plan.negocios) {
    if (n.estado !== 'migrar' || !n.email) continue
    const did = didPorEmail.get(n.email)!
    let revinculado = false
    if (n.tenant.privyUserIdLegacy === null && n.tenant.privyUserId !== did) {
      revinculado = await store.rebindTenantOwner(n.tenant.id, did, n.tenant.privyUserId)
    }
    const fresco = (await store.getTenantById(n.tenant.id))!
    const cambios = patchWalletDueno(fresco, walletPorDid.get(did)!)
    if (cambios) await store.setTenantWallets(fresco.id, cambios)
    negocios.push({ slug: n.tenant.slug, cambios, revinculado })
  }

  // 4. agentes
  const agentes: Resultado['agentes'] = []
  for (const a of plan.agentes) {
    if (a.estado !== 'recrear') continue
    const actual = (await store.getAgent(a.agent.id))!
    if (actual.walletAddressLegacy) continue
    const nueva = a.walletNueva ?? (await privy.crearWalletAgente(actual))
    await store.updateAgent(actual.id, {
      walletAddressLegacy: actual.walletAddress,
      privyWalletIdLegacy: actual.privyWalletId,
      walletAddress: nueva.address,
      privyWalletId: nueva.id,
    })
    agentes.push({ id: actual.id, nueva: nueva.address })
  }
  return { negocios, agentes }
}

// ---- salida ----

export function enmascarar(email: string): string {
  const [u, dom] = email.split('@')
  return `${(u ?? '').slice(0, 2)}…@${dom ?? ''}`
}
const corta = (s: string | null | undefined) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '-')
const did = (s: string | null | undefined) => (s ? `${s.slice(0, 16)}…` : '-')

export function imprimirPlan(plan: Plan, log: (s: string) => void = console.log) {
  log('\nNegocios')
  for (const n of plan.negocios) {
    const t = n.tenant
    const email = n.email ? enmascarar(n.email) : '-'
    if (n.estado !== 'migrar') {
      log(`  · ${t.slug}: ${n.estado}${n.estado === 'excluido' ? ' (no se toca)' : ''}`)
      continue
    }
    log(`  → ${t.slug} (${email})`)
    log(`      dueño: ${did(t.privyUserId)} → ${n.didNuevo ? did(n.didNuevo) : 'DID nuevo al importar'}`)
    log(`      cobro: ${corta(t.payoutWallet)} → ${n.cobroExterno ? 'se queda (address externa del dueño)' : 'wallet del dueño'}`)
    if (t.custodialWallet) log(`      custodiada vieja ${corta(t.custodialWallet)} → legacy (para barrer)`)
    for (const a of n.avisos) log(`      ! ${a}`)
  }
  log('\nUsuarios en la app nueva')
  for (const u of plan.usuarios) {
    const accion = u.didNuevo ? `ya existe (${did(u.didNuevo)})` : 'importar con wallet'
    const wallet = u.wallet ? `wallet ${corta(u.wallet.address)}` : 'wallet: se crea'
    log(`  → ${enmascarar(u.email)}: ${accion}, ${wallet}, negocios: ${u.negocios.join(', ')}`)
  }
  log('\nAgentes compradores')
  for (const a of plan.agentes) {
    const extra = a.estado === 'recrear' ? (a.walletNueva ? ` (reusa ${corta(a.walletNueva.address)})` : ' (wallet nueva en la app nueva)') : ''
    log(`  ${a.estado === 'recrear' ? '→' : '·'} ${a.slug}/${a.agent.name}: ${a.estado} ${corta(a.agent.walletAddress)}${extra}`)
  }
  const migrar = plan.negocios.filter((n) => n.estado === 'migrar').length
  const importar = plan.usuarios.filter((u) => !u.didNuevo).length
  const recrear = plan.agentes.filter((a) => a.estado === 'recrear').length
  log(`\nResumen: ${migrar} negocios a migrar, ${importar} usuarios a importar, ${recrear} wallets de agente a recrear.`)
}

// ---- Privy real ----

function cliente(prefijo: 'PRIVY_VIEJA' | 'PRIVY_NUEVA') {
  const appId = process.env[`${prefijo}_APP_ID`]
  const appSecret = process.env[`${prefijo}_APP_SECRET`]
  if (!appId || !appSecret) throw new Error(`Faltan ${prefijo}_APP_ID / ${prefijo}_APP_SECRET`)
  return { appId, appSecret, privy: new PrivyClient({ appId, appSecret }) }
}

// Un DID que no es de esa app vuelve como 404 (o 400 si el formato no le sirve).
const es404 = (e: unknown) => [400, 404].includes((e as { status?: number })?.status ?? 0)

export function privyReal() {
  const vieja = cliente('PRIVY_VIEJA')
  const nueva = cliente('PRIVY_NUEVA')
  if (vieja.appId === nueva.appId) throw new Error('PRIVY_VIEJA_APP_ID y PRIVY_NUEVA_APP_ID son la misma app')

  const usuarioNuevoPorEmail = async (email: string): Promise<UsuarioNuevo | null> => {
    try {
      const u = await nueva.privy.users().getByEmailAddress({ address: email })
      return { did: u.id, wallet: walletEmbebidaDe(u.linked_accounts) }
    } catch (e) {
      if (es404(e)) return null
      throw e
    }
  }
  const externalIdAgente = (id: string) => `peaje-agente-${id}`.slice(0, 64)

  const lectura: PrivyLectura = {
    async emailViejo(did) {
      try {
        return emailDe((await vieja.privy.users()._get(did)).linked_accounts)
      } catch (e) {
        if (es404(e)) return null
        throw e
      }
    },
    usuarioNuevoPorEmail,
    async walletAgenteNueva(agentId) {
      for await (const w of nueva.privy.wallets().list({ external_id: externalIdAgente(agentId) })) {
        return { id: w.id, address: w.address }
      }
      return null
    },
  }

  const escritura: PrivyEscritura = {
    async importarUsuarios(emails) {
      const auth = `Basic ${Buffer.from(`${nueva.appId}:${nueva.appSecret}`).toString('base64')}`
      const salida = new Map<string, string>()
      for (let i = 0; i < emails.length; i += 20) {
        const lote = emails.slice(i, i + 20)
        const body = JSON.stringify({
          users: lote.map((address) => ({
            linked_accounts: [{ type: 'email', address }],
            wallets: [{ chain_type: 'ethereum' }],
          })),
        })
        // 240 usuarios por minuto: con 429 se reintenta con backoff desde 1 s.
        let res: Response | null = null
        for (let intento = 0, espera = 1000; intento < 6; intento++, espera *= 2) {
          res = await fetch('https://auth.privy.io/api/v1/users/batch', {
            method: 'POST',
            headers: { authorization: auth, 'privy-app-id': nueva.appId, 'content-type': 'application/json' },
            body,
          })
          if (res.status !== 429) break
          await new Promise((r) => setTimeout(r, espera))
        }
        if (!res || !res.ok) throw new Error(`Batch import falló: HTTP ${res?.status}`)
        const { results } = (await res.json()) as {
          results: { index: number; success: boolean; id?: string; code?: number; error?: string; cause?: string }[]
        }
        for (const r of results) {
          const email = lote[r.index]!
          const id = r.success ? r.id : r.cause // conflicto: el usuario ya existía con ese email
          if (id) salida.set(email, id)
          else console.warn(`  ! ${enmascarar(email)}: ${r.error ?? 'sin detalle'}`)
        }
      }
      return salida
    },
    async walletDelUsuario(did) {
      const u = await nueva.privy.users()._get(did)
      const ya = walletEmbebidaDe(u.linked_accounts)
      if (ya) return ya
      const conWallet = await nueva.privy.users().pregenerateWallets(did, { wallets: [{ chain_type: 'ethereum' }] })
      const creada = walletEmbebidaDe(conWallet.linked_accounts)
      if (!creada) throw new Error(`Privy no devolvió la wallet de ${did}`)
      return creada
    },
    async crearWalletAgente(agent) {
      const w = await nueva.privy.wallets().create({
        chain_type: 'ethereum',
        display_name: `peaje-agente-${agent.name}`.slice(0, 60),
        external_id: externalIdAgente(agent.id),
        idempotency_key: externalIdAgente(agent.id),
      })
      return { id: w.id, address: w.address }
    },
  }
  return { lectura, escritura }
}

// ---- main ----

async function main() {
  const aplicarCambios = process.argv.includes('--apply')
  const flag = process.argv.find((a) => a.startsWith('--excluir='))
  const excluidos = new Set([...EXCLUIDOS_SIEMPRE, ...(flag ? flag.slice('--excluir='.length).split(',') : [])].filter(Boolean))

  const store = getStore()
  const { lectura, escritura } = privyReal()
  console.log(aplicarCambios ? 'Modo --apply: escribe en Privy nueva y en la base.' : 'Modo --dry: solo lee, no escribe nada.')
  console.log(`Excluidos: ${[...excluidos].join(', ')}`)

  const plan = await planear(store, lectura, excluidos)
  imprimirPlan(plan)
  if (!aplicarCambios) {
    console.log('\nNada se escribió. Revisa el plan y corre con --apply.')
    return
  }
  const r = await aplicar(store, plan, escritura)
  console.log('\nAplicado')
  for (const n of r.negocios) console.log(`  ✓ ${n.slug}: ${n.revinculado ? 'DID nuevo, ' : ''}${n.cambios ? Object.keys(n.cambios).join(', ') : 'sin cambios de wallet'}`)
  for (const a of r.agentes) console.log(`  ✓ agente ${a.id}: wallet ${corta(a.nueva)}`)
  console.log('\nRe-correr el script ahora debería mostrar todo como "listo".')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
