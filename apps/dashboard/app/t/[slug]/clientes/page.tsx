import { explorerTxUrl, isNetworkId, NETWORKS } from '@peaje/shared'
import { lookupAgentIdentities, skillLabel, type AgentIdentity } from '@/lib/agent0'
import { money, shortWallet } from '@/lib/config'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'

/**
 * Tus clientes agente: quiénes son las wallets que te pagan. El gasto sale
 * del ledger propio; la identidad (nombre, skills, reputación) sale del
 * registro ERC-8004 vía los Subgraphs de Agent0 en The Graph.
 */

type Cliente = {
  wallet: string
  total: number
  requests: number
  redes: Set<string>
  rutas: Map<string, number>
  ultimaVez: string
  identidad: AgentIdentity | null
}

export default async function Clientes({ params }: PageProps<'/t/[slug]/clientes'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const payments = await store.listPayments(tenant.id, 500)

  const porWallet = new Map<string, Cliente>()
  for (const p of payments) {
    if (!p.agentWallet || p.refundTx) continue
    const w = p.agentWallet.toLowerCase()
    const c = porWallet.get(w) ?? {
      wallet: w,
      total: 0,
      requests: 0,
      redes: new Set<string>(),
      rutas: new Map<string, number>(),
      ultimaVez: p.createdAt,
      identidad: null,
    }
    c.total += Number(p.amount)
    c.requests += 1
    c.redes.add(p.network)
    c.rutas.set(p.path, (c.rutas.get(p.path) ?? 0) + 1)
    if (p.createdAt > c.ultimaVez) c.ultimaVez = p.createdAt
    porWallet.set(w, c)
  }

  const identidades = await lookupAgentIdentities([...porWallet.keys()])
  for (const c of porWallet.values()) c.identidad = identidades.get(c.wallet) ?? null

  const clientes = [...porWallet.values()].sort((a, b) => b.total - a.total)
  const revenueTotal = clientes.reduce((s, c) => s + c.total, 0)
  const verificados = clientes.filter((c) => c.identidad)
  const revenueVerificado = verificados.reduce((s, c) => s + c.total, 0)

  const skillCount = new Map<string, number>()
  for (const c of verificados)
    for (const s of c.identidad!.skills) {
      const label = skillLabel(s)
      skillCount.set(label, (skillCount.get(label) ?? 0) + 1)
    }
  const skillsTop = [...skillCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-medium">Tus clientes agente</h1>
        <p className="mt-2 text-sm text-muted">
          Quiénes son los agentes que pagan por tu contenido. Identidad y reputación del registro
          ERC-8004, vía The Graph.
        </p>
      </header>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay pagos con wallet identificada.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Metric label="Agentes únicos" value={String(clientes.length)} />
            <Metric
              label="Con identidad on-chain"
              value={`${verificados.length} (${revenueTotal > 0 ? Math.round((revenueVerificado / revenueTotal) * 100) : 0}% del revenue)`}
              destacado
            />
            <Metric
              label="Enfoque dominante"
              value={skillsTop.length ? skillsTop.map(([s]) => s).join(' · ') : 'sin datos'}
            />
          </div>

          <section className="space-y-3">
            {clientes.map((c) => (
              <article key={c.wallet} className="rounded-lg border border-border bg-panel p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    {c.identidad ? (
                      <p className="truncate font-medium">
                        {c.identidad.name}
                        <span className="ml-2 rounded border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase text-accent">
                          ERC-8004 · {c.identidad.chain}
                        </span>
                        {c.identidad.feedbackAvg !== null ? (
                          <span className="ml-2 text-xs text-muted">
                            reputación {c.identidad.feedbackAvg}/100 ({c.identidad.feedbackCount})
                          </span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="font-mono text-sm text-muted">
                        {shortWallet(c.wallet)}
                        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">
                          sin identidad
                        </span>
                      </p>
                    )}
                    {c.identidad?.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{c.identidad.description}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg tabular-nums">{money(c.total)}</p>
                    <p className="text-xs text-muted">
                      {c.requests} request{c.requests === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {c.identidad?.skills.slice(0, 4).map((s) => (
                    <span key={s} className="rounded bg-black/20 px-1.5 py-0.5">
                      {skillLabel(s)}
                    </span>
                  ))}
                  <span className="ml-auto font-mono">
                    paga por{' '}
                    {[...c.redes]
                      .map((r) => (isNetworkId(r) ? NETWORKS[r].label : r))
                      .join(' y ')}{' '}
                    · {shortWallet(c.wallet)} · visto{' '}
                    {new Date(c.ultimaVez).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 truncate text-lg ${destacado ? 'text-accent' : ''}`}>{value}</p>
    </div>
  )
}
