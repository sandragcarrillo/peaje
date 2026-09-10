import { NETWORK_IDS, NETWORKS } from '@peaje/shared'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listAgents, type AgenteConSaldo } from '@/lib/gateway'
import { getDict } from '@/lib/i18n'
import { listMyTenants } from '@/lib/session'
import { store } from '@/lib/store'
import { AgentesPanel } from './panel'

/**
 * Mis agentes: los agentes son de la PERSONA, no de un negocio. Un mismo
 * usuario puede tener varios negocios y sus agentes compran para él; el
 * negocio solo aporta el saldo del que salen los fondos.
 */
export default async function Agentes() {
  const [tenants, d] = await Promise.all([listMyTenants(), getDict()])
  if (tenants.length === 0) redirect('/acceder')

  const porNegocio = await Promise.all(
    tenants.map(async (t) => {
      const [{ agents }, balances] = await Promise.all([
        listAgents(t.slug).catch(() => ({ agents: [] as AgenteConSaldo[] })),
        store.balanceByNetwork(t.id),
      ])
      return {
        slug: t.slug,
        nombre: t.name,
        agentes: agents,
        disponible: Object.fromEntries(
          NETWORK_IDS.map((n) => [n, balances.find((b) => b.network === n)?.available ?? '0']),
        ) as Record<string, string>,
      }
    }),
  )

  const total = porNegocio.reduce((n, g) => n + g.agentes.length, 0)

  return (
    <div className="space-y-8 py-2">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-medium">{d.agentes.titulo}</h1>
        <p className="mt-2 text-sm text-muted">{d.agentes.intro}</p>
        {tenants.length > 1 ? (
          <p className="mt-2 text-xs text-muted">{d.agentes.variosNegocios}</p>
        ) : null}
      </header>

      <AgentesPanel
        negocios={porNegocio}
        redes={NETWORK_IDS.map((id) => ({
          id,
          label: NETWORKS[id].label,
          symbol: NETWORKS[id].tokenSymbol,
        }))}
      />

      {total === 0 ? (
        <p className="text-sm text-muted">
          {d.agentes.sinVentasPre}{' '}
          <Link href={`/t/${tenants[0]!.slug}`} className="text-accent underline">
            {d.agentes.sinVentasLink}
          </Link>{' '}
          {d.agentes.sinVentasPost}
        </p>
      ) : null}
    </div>
  )
}
