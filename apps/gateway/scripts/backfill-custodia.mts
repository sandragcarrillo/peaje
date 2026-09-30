/**
 * Asigna a los negocios que ya existían su wallet custodiada (migración
 * 20261006000000). Antes solo se guardaba la address de cobro, que el dueño
 * puede editar, así que no alcanza con buscar esa address en Privy: se acepta
 * solo si esa wallet de Privy se creó en el alta del negocio (unos minutos
 * antes de la fila del tenant) y ningún otro negocio la usa. El resto queda
 * sin wallet custodiada y se revisa a mano.
 *
 * Sin --apply solo muestra lo que haría.
 * Correr desde apps/gateway: pnpm exec tsx --env-file=../../.env scripts/backfill-custodia.mts [--apply]
 */
import { PrivyClient } from '@privy-io/node'
import { getStore } from '@peaje/db'

const aplicar = process.argv.includes('--apply')
const store = getStore()
const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID
if (!appId || !process.env.PRIVY_APP_SECRET) throw new Error('Faltan PRIVY_APP_ID / PRIVY_APP_SECRET')
const privy = new PrivyClient({ appId, appSecret: process.env.PRIVY_APP_SECRET })

const tenants = await store.listTenants()
const usos = new Map<string, number>()
for (const t of tenants) if (t.payoutWallet) usos.set(t.payoutWallet.toLowerCase(), (usos.get(t.payoutWallet.toLowerCase()) ?? 0) + 1)

let asignados = 0
for (const t of tenants) {
  if (t.custodialWalletId) continue
  if (!t.payoutWallet) {
    console.log(`· ${t.slug}: sin wallet de cobro`)
    continue
  }
  if ((usos.get(t.payoutWallet.toLowerCase()) ?? 0) > 1) {
    console.log(`! ${t.slug}: ${t.payoutWallet} la usan varios negocios, revisar a mano`)
    continue
  }
  const w = await privy.wallets().getWalletByAddress({ address: t.payoutWallet }).catch(() => null)
  if (!w) {
    console.log(`· ${t.slug}: ${t.payoutWallet} es externa (no la custodia Peaje)`)
    continue
  }
  const creadaWallet = w.created_at < 1e12 ? w.created_at * 1000 : w.created_at
  const creadoTenant = new Date(t.createdAt).getTime()
  const diferencia = (creadoTenant - creadaWallet) / 1000
  // En el alta la wallet se crea justo antes de insertar el negocio.
  if (diferencia < -5 || diferencia > 300) {
    console.log(`! ${t.slug}: la wallet ${t.payoutWallet} no se creó en su alta (diferencia ${Math.round(diferencia)} s), revisar a mano`)
    continue
  }
  console.log(`${aplicar ? '✓' : '→'} ${t.slug}: ${t.payoutWallet} (${w.id}, creada ${Math.round(diferencia)} s antes del negocio)`)
  if (aplicar) await store.setCustodialWallet(t.id, t.payoutWallet, w.id)
  asignados++
}
console.log(`\n${asignados} negocio(s) ${aplicar ? 'actualizados' : 'se actualizarían (correr con --apply)'}`)
