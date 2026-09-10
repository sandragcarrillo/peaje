import Link from 'next/link'
import { domainLabel, fetchMarketAgents, type MarketAgent } from '@/lib/agent0-market'
import { getDict, type Dict } from '@/lib/i18n'
import { Calculadora } from './calculadora'

type Mercado = Dict['mercado']

export async function generateMetadata() {
  const d = await getDict()
  return { title: d.mercado.metaTitulo, description: d.mercado.metaDescripcion }
}

/**
 * Observatorio público del comercio agéntico. Sin login: es la vitrina para
 * que un negocio vea el mercado que ya existe y se anime a ponerle un peaje.
 * Datos live de los Subgraphs de Agent0 (ERC-8004) en The Graph.
 */
export default async function Mercado({ searchParams }: PageProps<'/mercado'>) {
  const { dominio } = await searchParams
  const filtro = typeof dominio === 'string' && dominio ? dominio : null

  const { mercado: d } = await getDict()
  const todos = await fetchMarketAgents()
  const agentes = filtro
    ? todos.filter((a) => a.domains.some((dom) => domainLabel(dom) === filtro))
    : todos

  // Top dominios ("tipos de herramienta") calculados sobre TODOS, para que los
  // chips de filtro no desaparezcan al filtrar.
  const porDominio = new Map<string, number>()
  for (const a of todos) {
    for (const dom of new Set(a.domains.map(domainLabel))) {
      porDominio.set(dom, (porDominio.get(dom) ?? 0) + 1)
    }
  }
  const topDominios = [...porDominio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  const conPago = agentes.filter((a) => a.x402).length
  const conMcp = agentes.filter((a) => a.mcp).length
  const conA2a = agentes.filter((a) => a.a2a).length
  const feedbackTotal = agentes.reduce((s, a) => s + a.feedback, 0)

  const porChain = new Map<string, number>()
  for (const a of agentes) porChain.set(a.chain, (porChain.get(a.chain) ?? 0) + 1)
  const chains = [...porChain.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-10 py-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-medium">{d.titulo}</h1>
        <p className="mt-3 text-muted">{d.intro(chains.length)}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip href="/mercado" activo={filtro === null} label={d.chipTodos(todos.length)} />
        {topDominios.map(([dom, n]) => (
          <Chip
            key={dom}
            href={`/mercado?dominio=${encodeURIComponent(dom)}`}
            activo={filtro === dom}
            label={`${dom} (${n})`}
          />
        ))}
      </div>

      {agentes.length === 0 ? (
        <p className="text-sm text-muted">{d.sinDatos}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={d.statAgentes} value={String(agentes.length)} />
            <Stat
              label={d.statPago}
              value={`${Math.round((conPago / agentes.length) * 100)}%`}
              destacado
            />
            <Stat label={d.statMcp} value={`${Math.round((conMcp / agentes.length) * 100)}%`} />
            <Stat label={d.statFeedback} value={String(feedbackTotal)} />
          </div>

          <RegistrosPorMes agentes={agentes} d={d} />

          <div className="grid gap-8 lg:grid-cols-2">
            <BarrasH
              titulo={d.porHerramientaTitulo}
              nota={d.porHerramientaNota}
              datos={topDominios.map(([dom, n]) => ({
                label: dom,
                valor: filtro
                  ? agentes.filter((a) => a.domains.some((x) => domainLabel(x) === dom)).length
                  : n,
              }))}
            />
            <BarrasH
              titulo={d.porRedTitulo}
              nota={d.porRedNota}
              datos={chains.map(([c, n]) => ({ label: c, valor: n }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Stat label={d.statInterfazMcp} value={String(conMcp)} />
            <Stat label={d.statInterfazA2a} value={String(conA2a)} />
            <Stat label={d.statPaganX402} value={String(conPago)} />
          </div>
        </>
      )}

      {todos.length > 0 ? (
        <Calculadora
          sharePagoReady={todos.filter((a) => a.x402).length / todos.length}
          crecimientoMensual={crecimientoMensual(todos)}
        />
      ) : null}

      <section className="rounded-2xl border border-accent/40 bg-accent/5 p-6">
        <h2 className="text-lg font-medium">{d.ctaTitulo}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">{d.ctaCuerpo}</p>
        <Link
          href="/nuevo"
          className="mt-4 inline-block rounded-full bg-text px-5 py-2.5 text-sm font-medium text-bg"
        >
          {d.ctaBoton}
        </Link>
      </section>

      <p className="text-xs text-muted">
        {d.fuenteInicio}
        <a
          href="https://thegraph.com/docs/en/subgraphs/existing-subgraphs/agent0/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {d.fuenteLink}
        </a>
        {d.fuenteFin}
      </p>
    </div>
  )
}

/**
 * Crecimiento mensual del registro de agentes: media geométrica de los ratios
 * mes-a-mes de los últimos meses COMPLETOS (el mes en curso subestima).
 * Cap a 100%/mes para que el escenario compuesto no dé números ridículos.
 */
function crecimientoMensual(agentes: MarketAgent[]): number | null {
  const porMes = new Map<string, number>()
  for (const a of agentes) {
    const d = new Date(a.createdAt * 1000)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    porMes.set(clave, (porMes.get(clave) ?? 0) + 1)
  }
  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const completos = [...porMes.entries()]
    .filter(([clave]) => clave < mesActual)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
  const ratios: number[] = []
  for (let i = 1; i < completos.length; i++) {
    const prev = completos[i - 1]![1]
    const cur = completos[i]![1]
    if (prev >= 20) ratios.push(cur / prev)
  }
  if (ratios.length === 0) return null
  const media = ratios.reduce((s, r) => s * r, 1) ** (1 / ratios.length)
  return Math.min(media - 1, 1)
}

function Chip({ href, activo, label }: { href: string; activo: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        activo
          ? 'border-accent bg-accent text-black'
          : 'border-border text-muted hover:border-muted hover:text-text'
      }`}
    >
      {label}
    </Link>
  )
}

function Stat({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl tabular-nums ${destacado ? 'text-accent' : ''}`}>{value}</p>
    </div>
  )
}

/** Registros de agentes por mes, últimos 12. SVG server-rendered, una serie. */
function RegistrosPorMes({ agentes, d }: { agentes: MarketAgent[]; d: Mercado }) {
  const hoy = new Date()
  const meses: { clave: string; label: string; n: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    meses.push({
      clave: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`,
      label: fecha.toLocaleDateString(d.intl, { month: 'short' }),
      n: 0,
    })
  }
  const idx = new Map(meses.map((m, i) => [m.clave, i]))
  for (const a of agentes) {
    const fecha = new Date(a.createdAt * 1000)
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    const i = idx.get(clave)
    if (i !== undefined) meses[i]!.n += 1
  }

  const max = Math.max(...meses.map((m) => m.n), 1)
  const W = 720
  const H = 140
  const gap = 6
  const barW = (W - gap * (meses.length - 1)) / meses.length

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{d.porMesTitulo}</h2>
        <p className="text-xs text-muted">{d.porMesNota}</p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="mt-3 w-full rounded-lg border border-border bg-panel p-2"
        role="img"
        aria-label={d.porMesAria}
      >
        {meses.map((m, i) => {
          const h = m.n === 0 ? 2 : Math.max((m.n / max) * H, 3)
          const x = i * (barW + gap)
          // El área de hover es la columna completa (no solo la barra): meses
          // chicos también son apuntables. El valor aparece sobre la barra.
          return (
            <g key={m.clave} className="group">
              <rect x={x} y={0} width={barW} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                rx={4}
                fill={m.n === 0 ? 'var(--border)' : 'var(--accent)'}
                className="transition-opacity group-hover:opacity-80"
              />
              <text
                x={x + barW / 2}
                y={Math.min(H - h - 6, H - 10)}
                textAnchor="middle"
                fill="var(--text)"
                fontSize={11}
                fontFamily="var(--font-mono)"
                className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
              >
                {m.n}
              </text>
              <text
                x={x + barW / 2}
                y={H + 13}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize={9}
                fontFamily="var(--font-mono)"
              >
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

/** Barras horizontales de una serie, con label y valor directos. */
function BarrasH({
  titulo,
  nota,
  datos,
}: {
  titulo: string
  nota: string
  datos: { label: string; valor: number }[]
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{titulo}</h2>
        <p className="text-xs text-muted">{nota}</p>
      </div>
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-panel p-4">
        {datos.map((d) => (
          <div key={d.label} className="flex items-center gap-3" title={`${d.label}: ${d.valor}`}>
            <span className="w-40 shrink-0 truncate text-xs text-muted">{d.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm">
              <div
                className="h-full rounded-sm bg-accent"
                style={{ width: `${Math.max((d.valor / max) * 100, 1)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-xs">{d.valor}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
