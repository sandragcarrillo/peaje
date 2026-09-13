import { isNetworkId, NETWORKS } from '@peaje/shared'
import { lookupAgentIdentities, skillLabel, type AgentIdentity } from '@/lib/agent0'
import { money, shortWallet } from '@/lib/config'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
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

/** "hace 2 d", "hace 5 h": tiempo relativo corto para el ledger. */
function relativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return '<1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

export default async function Clientes({ params }: PageProps<'/t/[slug]/clientes'>) {
  const { slug } = await params
  const tenant = await requireTenant(slug)
  const [payments, d] = await Promise.all([store.listPayments(tenant.id, 500), getDict()])

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
      <PageHeader
        eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`}
        titulo={d.panel.clientesTitulo}
        sub={d.panel.clientesDescripcion}
      />

      {clientes.length === 0 ? (
        <p className="text-sm text-muted">{d.panel.clientesVacio}</p>
      ) : (
        <>
          {/* Tres celdas unidas en una sola caja hairline (mock de Stitch) */}
          <div className="grid grid-cols-1 border border-border bg-bg md:grid-cols-3">
            <div className="border-b border-border p-6 md:border-r md:border-b-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {d.panel.metricaAgentesUnicos}
                </span>
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
              </div>
              <div className="mt-4 text-4xl font-bold">{clientes.length}</div>
            </div>
            <div className="border-b border-border p-6 md:border-r md:border-b-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {d.panel.metricaConIdentidad}
              </span>
              <div className="mt-4 text-4xl font-bold text-accent">
                {verificados.length}
                <span className="ml-2 text-base font-normal text-muted">
                  {revenueTotal > 0 ? `${Math.round((revenueVerificado / revenueTotal) * 100)}%` : ''}
                </span>
              </div>
            </div>
            <div className="p-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {d.panel.metricaEnfoque}
              </span>
              <div className="mt-4 text-lg font-bold">
                {skillsTop.length ? skillsTop.map(([sk]) => sk).join(' · ') : d.panel.sinDatos}
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-text/70 pt-2 pb-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 bg-text" />
                <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
                  {d.panel.clientesTitulo}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted">{d.panel.ordenGasto}</span>
            </div>

            {/* Cabecera del ledger */}
            <div className="hidden grid-cols-12 gap-4 border border-border bg-panel-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint lg:grid">
              <div className="col-span-5">{d.panel.colAgente}</div>
              <div className="col-span-2">{d.panel.colRed}</div>
              <div className="col-span-3">{d.panel.colUltimaVez}</div>
              <div className="col-span-2 text-right">{d.panel.colGasto}</div>
            </div>

            {clientes.map((c) => (
              <article
                key={c.wallet}
                className="flex flex-col items-start gap-4 border border-border bg-bg p-4 transition-colors hover:bg-panel lg:grid lg:grid-cols-12 lg:items-center"
              >
                <div className="col-span-5 min-w-0">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="truncate font-mono text-sm font-bold">
                      {c.identidad ? c.identidad.name : shortWallet(c.wallet)}
                    </span>
                    <span
                      className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] ${
                        c.identidad
                          ? 'border-accent/50 text-accent'
                          : 'border-border text-muted'
                      }`}
                    >
                      {c.identidad ? `[ERC-8004 · ${c.identidad.chain}]` : `[${d.panel.sinIdentidad}]`}
                    </span>
                  </div>
                  {c.identidad ? (
                    <p className="mt-1 truncate pl-4.5 text-xs text-muted">
                      {c.identidad.skills.slice(0, 3).map(skillLabel).join(' · ')}
                      {c.identidad.feedbackAvg !== null
                        ? ` · ${d.panel.reputacion(c.identidad.feedbackAvg, c.identidad.feedbackCount)}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <div className="col-span-2 font-mono text-xs">
                  {[...c.redes].map((r) => (
                    <span key={r} className="mr-1 border border-border bg-bg px-2 py-0.5 font-bold uppercase">
                      {isNetworkId(r) ? NETWORKS[r].label : r}
                    </span>
                  ))}
                </div>
                <div className="col-span-3 font-mono text-xs text-muted">
                  {d.panel.hace(relativo(c.ultimaVez))}
                </div>
                <div className="col-span-2 w-full text-left font-mono text-lg font-bold lg:w-auto lg:text-right">
                  {money(c.total)}
                  <span className="ml-2 text-xs font-normal text-muted lg:hidden">
                    {d.panel.conteoRequests(c.requests)}
                  </span>
                </div>
              </article>
            ))}

            <footer className="border border-border bg-panel-2 p-4 font-mono text-[10px] tracking-[0.06em] text-muted">
              {d.panel.finLedger(clientes.length)}
            </footer>
          </section>
        </>
      )}
    </div>
  )
}
