import type { AgentKind, NewVisit, VisitStats } from './types'

/** Una visita ya persistida más, si pagó, la wallet que sale del ledger. */
export type VisitRow = NewVisit & { agentWallet?: string | null }

/**
 * Agrega visitas en memoria. Lo comparten MemoryStore y SupabaseStore: los
 * dos traen las filas de la ventana y las resumen acá, así el panel ve lo
 * mismo con o sin Supabase. Volúmenes de miles de filas por mes: alcanza.
 */
export function aggregateVisits(rows: VisitRow[], days: number): VisitStats {
  const since = Date.now() - days * 86_400_000
  const byKind = new Map<AgentKind, { visits: number; paid: number }>()
  const byPath = new Map<string, { visits: number; served402: number; attempted: number; paid: number; revenue: number; priceUsd: string | null; agentes: Set<string> }>()
  const byDay = new Map<string, { visits: number; paid: number }>()
  const notFound = new Map<string, number>()
  const wallets = new Set<string>()
  let visits = 0
  let paid = 0
  let revenue = 0
  let served402 = 0
  let attempted = 0

  for (const r of rows) {
    if (new Date(r.at).getTime() < since) continue
    visits += 1
    const monto = r.paid && r.amount ? Number(r.amount) : 0
    if (r.paid) paid += 1
    revenue += monto

    const k = byKind.get(r.agentKind) ?? { visits: 0, paid: 0 }
    k.visits += 1
    if (r.paid) k.paid += 1
    byKind.set(r.agentKind, k)

    const es402 = r.status === 402
    if (es402) served402 += 1
    if (r.attempted) attempted += 1

    const p = byPath.get(r.path) ?? { visits: 0, served402: 0, attempted: 0, paid: 0, revenue: 0, priceUsd: null, agentes: new Set<string>() }
    p.visits += 1
    if (es402) {
      p.served402 += 1
      // Un agente distinto por user-agent: sin wallet en el 402 es la mejor aproximación.
      p.agentes.add(r.userAgent ?? 'sin-ua')
    }
    if (r.attempted) p.attempted += 1
    if (r.paid) p.paid += 1
    p.revenue += monto
    if (r.priceUsd) p.priceUsd = r.priceUsd
    byPath.set(r.path, p)

    // Paths pedidos que el origen no tiene: los clientes de pago y los bots
    // que buscan algo concreto. Los archivos típicos de escáner no cuentan.
    if (r.status === 404 && !/\.(php|env|git|xml|ico|png|jpg|js|css|map|txt)$/i.test(r.path) && !r.path.startsWith('/.well-known')) {
      notFound.set(r.path, (notFound.get(r.path) ?? 0) + 1)
    }

    const date = r.at.slice(0, 10)
    const d = byDay.get(date) ?? { visits: 0, paid: 0 }
    d.visits += 1
    if (r.paid) d.paid += 1
    byDay.set(date, d)

    if (r.agentWallet) wallets.add(r.agentWallet.toLowerCase())
  }

  return {
    days,
    totals: { visits, paid, unpaid: visits - paid, revenue: revenue.toFixed(6) },
    byKind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.visits - a.visits),
    topPaths: [...byPath.entries()]
      .map(([path, v]) => ({ path, visits: v.visits, served402: v.served402, attempted: v.attempted, paid: v.paid, revenue: v.revenue.toFixed(6) }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20),
    funnel: { served402, attempted, paid },
    unpaidDemand: [...byPath.entries()]
      .filter(([, v]) => v.served402 > 0 && v.paid === 0)
      .map(([path, v]) => ({ path, served402: v.served402, agents: v.agentes.size, priceUsd: v.priceUsd }))
      .sort((a, b) => b.served402 - a.served402)
      .slice(0, 10),
    notFound: [...notFound.entries()]
      .map(([path, visits]) => ({ path, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10),
    daily: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    agentWallets: [...wallets].sort(),
  }
}
