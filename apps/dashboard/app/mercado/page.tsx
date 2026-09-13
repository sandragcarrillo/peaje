import Link from 'next/link'
import { Eyebrow, SectionBar, StatTile } from '@/components/chrome'
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
        <Eyebrow dot>{d.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-3xl font-semibold">{d.titulo}</h1>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MarketStat
              tag="ERC-8004"
              label={d.statAgentes}
              value={String(agentes.length)}
              pie={`+${crecimientoMensual(todos)}% ${d.porMesNota}`}
              vivo
            />
            <MarketStat
              tag="x402"
              label={d.statPago}
              value={`${Math.round((conPago / agentes.length) * 100)}%`}
              pie={`${conPago} / ${agentes.length}`}
              acento
            />
            <MarketStat
              tag="MCP"
              label={d.statMcp}
              value={`${Math.round((conMcp / agentes.length) * 100)}%`}
              pie={`${conMcp} / ${agentes.length}`}
            />
            <MarketStat
              tag="ERC-8004"
              label={d.statFeedback}
              value={String(feedbackTotal)}
              pie="on-chain"
            />
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

        </>
      )}

      {todos.length > 0 ? (
        <Calculadora
          sharePagoReady={todos.filter((a) => a.x402).length / todos.length}
          crecimientoMensual={crecimientoMensual(todos)}
        />
      ) : null}

      <section className="border border-border bg-panel p-6">
        <h2 className="text-lg font-semibold">{d.ctaTitulo}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">{d.ctaCuerpo}</p>
        <Link
          href="/nuevo"
          className="mt-4 inline-flex items-center gap-2 border border-text bg-negro px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta"
        >
          <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
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
      className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs transition-colors ${
        activo
          ? 'border-text bg-negro font-bold text-white'
          : 'border-border bg-bg text-muted hover:border-text hover:text-text'
      }`}
    >
      {activo ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
      [{label}]
    </Link>
  )
}

/** Card de métrica del mercado, calcada del mock: label arriba, pie con delta. */
function MarketStat({
  tag,
  label,
  value,
  pie,
  vivo,
  acento,
}: {
  tag: string
  label: string
  value: string
  pie: string
  vivo?: boolean
  acento?: boolean
}) {
  return (
    <div className="flex flex-col justify-between space-y-4 border border-border bg-panel p-5">
      <div className="flex items-center justify-between font-mono text-[10px] text-muted">
        <span className="uppercase tracking-[0.12em]">{label}</span>
        {vivo ? <span aria-hidden className="h-2 w-2 bg-accent" /> : <span>{tag}</span>}
      </div>
      <div className={`text-4xl font-bold tracking-tight ${acento ? 'text-accent' : ''}`}>
        {value}
      </div>
      <div className="flex items-center gap-1.5 border-t border-border pt-2 font-mono text-[11px] font-bold text-muted">
        {vivo ? <span aria-hidden className="h-1.5 w-1.5 bg-accent" /> : null}
        <span>{pie}</span>
      </div>
    </div>
  )
}

function Stat({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
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

  return (
    <section className="space-y-6 border border-border bg-panel p-6">
      <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-center">
        <h2 className="text-lg font-semibold">{d.porMesTitulo}</h2>
        <span className="border border-border bg-bg px-3 py-1 font-mono text-[10px] font-bold text-muted">
          {d.porMesNota}
        </span>
      </div>
      <div className="pt-2 pb-1" role="img" aria-label={d.porMesAria}>
        <div className="relative flex h-44 w-full items-end justify-between gap-1 border-b border-border sm:gap-3">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between opacity-40">
            <div className="w-full border-b border-dashed border-faint" />
            <div className="w-full border-b border-dashed border-faint" />
            <div className="w-full border-b border-dashed border-faint" />
            <div />
          </div>
          {meses.map((m, i) => {
            const esUltimo = i === meses.length - 1
            const alto = m.n === 0 ? 2 : Math.max((m.n / max) * 100, 4)
            return (
              <div key={m.clave} className="group flex h-full flex-1 flex-col items-center justify-end">
                <span
                  className={`mb-1 font-mono text-[9px] transition-opacity ${
                    esUltimo ? 'font-bold text-accent' : 'text-muted opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {m.n}
                </span>
                <div
                  className={`w-full border ${
                    esUltimo ? 'border-accent bg-accent' : 'border-border bg-panel-2 group-hover:bg-border'
                  }`}
                  style={{ height: `${alto}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between gap-1 pt-2 sm:gap-3">
          {meses.map((m, i) => (
            <span
              key={m.clave}
              className={`flex-1 text-center font-mono text-[10px] uppercase ${
                i === meses.length - 1 ? 'font-bold text-text' : 'text-muted'
              }`}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

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
    <section className="border border-border bg-panel p-6">
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">{titulo}</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{nota}</p>
      </div>
      <div className="mt-4 space-y-4">
        {datos.map((d) => (
          <div key={d.label} title={`${d.label}: ${d.valor}`}>
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="truncate uppercase">{d.label}</span>
              <span className="shrink-0 pl-3 font-bold tabular-nums">{d.valor}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full bg-panel-2">
              <div
                className="h-full bg-text"
                style={{ width: `${Math.max((d.valor / max) * 100, 1)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

