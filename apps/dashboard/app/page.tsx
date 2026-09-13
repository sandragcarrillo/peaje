import Link from 'next/link'
import { getDict } from '@/lib/i18n'
import { currentTenant } from '@/lib/session'

/**
 * Landing según design/direccion-visual.md §10: hero split crema/tinta con
 * status bar de datos reales, ticker, comparativa antes/después, pasos
 * numerados y CTA final a dos tonos. Un solo momento animado (el ticker).
 */

/** Sección a sangre completa: se escapa del max-w-5xl del layout. */
function Sangre({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-[calc(50%-50vw)] w-screen ${className}`}>{children}</div>
}

async function TickerRow() {
  const d = await getDict()
  const items = [d.landing.tickerMpp, d.landing.tickerPagos, d.landing.tickerSinApiKey]
  return (
    <div className="flex shrink-0 items-center">
      {items.map((item) => (
        <span key={item} className="mx-4 flex items-center gap-4">
          {item}
          <span aria-hidden className="text-border">·</span>
        </span>
      ))}
    </div>
  )
}

export default async function Landing() {
  const [tenant, d] = await Promise.all([currentTenant(), getDict()])
  const L = d.landing

  return (
    <div className="pb-4">
      {/* ── Hero split crema/tinta ─────────────────────────────── */}
      <Sangre>
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="bg-crema px-6 py-16 text-tinta sm:px-10 lg:py-24 lg:pl-[max(2.5rem,calc(50vw-40rem))]">
            <p className="font-mono text-[11px] tracking-[0.14em] text-tinta/60">{L.eyebrow}</p>
            <h1 className="mt-6 max-w-xl text-4xl leading-[1.05] font-semibold sm:text-5xl">
              {L.hero1}
              <br />
              {L.hero2}
              <br />
              <span className="text-tinta/45">{L.hero3}</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-tinta/70">{L.heroTexto}</p>

            {/* Botones pastilla conectados (§5.4) */}
            <div className="mt-9 inline-flex font-mono text-xs tracking-[0.08em]">
              {tenant ? (
                <Link
                  href={`/t/${tenant.slug}`}
                  className="rounded-l-full border border-tinta bg-tinta px-6 py-3 text-crema"
                >
                  {L.ctaDashboard}
                </Link>
              ) : (
                <Link
                  href="/nuevo"
                  className="rounded-l-full border border-tinta bg-tinta px-6 py-3 text-crema"
                >
                  {L.ctaRegistrar}
                </Link>
              )}
              <Link
                href="/mercado"
                className="flex items-center gap-2 rounded-r-full border border-l-0 border-tinta px-6 py-3 text-tinta hover:bg-tinta/5"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                {L.ctaMercado}
              </Link>
            </div>
          </div>

          {/* Tinta: arte concéntrico sobre retícula con coordenadas (§6) */}
          <div className="isla-tinta relative hidden overflow-hidden bg-bg lg:block">
            <div className="dot-grid absolute inset-0 text-border opacity-50" />
            <span className="absolute top-3 left-4 font-mono text-[10px] text-muted/60">0.0</span>
            <span className="absolute right-4 bottom-3 font-mono text-[10px] text-muted/60">
              402.2026
            </span>
            <ArteConcentrico frase={L.arte} />
          </div>
        </div>
      </Sangre>

      {/* Status bar (§5.1): el sitio reportando su propio estado */}
      <Sangre className="isla-tinta border-y border-border bg-bg">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-10 gap-y-2 px-6 py-3 font-mono text-[11px] tracking-[0.1em]">
          {L.status.map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              <span className="text-muted">{k}:</span>
              <span className="text-text">{v}</span>
              {k === 'MPP' || k === 'MPP ' ? (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </span>
          ))}
        </div>
      </Sangre>

      {/* Ticker: el único elemento en movimiento de la página */}
      <div className="overflow-hidden border-b border-border py-2.5">
        <div className="flex animate-marquee font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
          <TickerRow />
          <div aria-hidden>
            <TickerRow />
          </div>
        </div>
      </div>

      {/* ── Comparativa antes/después (§5.5) ───────────────────── */}
      <Sangre className="bg-crema">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-semibold text-tinta sm:text-3xl">{L.compTitulo}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <PanelComparativa
              badge={L.compSinBadge}
              nota={L.compSinNota}
              activo={false}
              estadoSin={L.compSinEstado}
            />
            <PanelComparativa
              badge={L.compConBadge}
              nota={L.compConNota}
              activo
              hace={L.compConHace}
            />
          </div>
        </div>
      </Sangre>

      {/* ── Pasos numerados sobre tinta con ruido (§5.3, §6) ───── */}
      <Sangre className="isla-tinta bg-bg">
        <section className="relative mx-auto max-w-5xl px-6 py-20">
          <RuidoTipografico />
        <h2 className="relative text-2xl font-semibold sm:text-3xl">{L.featuresTitulo}</h2>
        <div className="relative mt-10 grid gap-10 sm:grid-cols-3">
          <Paso n="001" titulo={L.paso1Titulo} texto={L.paso1Texto} />
          <Paso n="002" titulo={L.paso2Titulo} texto={L.paso2Texto} />
          <Paso n="003" titulo={L.paso3Titulo} texto={L.paso3Texto} />
          </div>
        </section>
      </Sangre>

    </div>
  )
}

/**
 * La gota: un pulso desde el centro y los anillos de texto apareciendo hacia
 * afuera. La frase se repite las veces que caben en cada circunferencia y se
 * estira con `textLength`, así nunca se corta a mitad de palabra.
 */
function ArteConcentrico({ frase }: { frase: string }) {
  const texto = `${frase} · `
  // Ancho aproximado por carácter: mono 11px + letter-spacing 3.
  const charW = 11 * 0.6 + 3
  const anillos = [
    { r: 70, op: 0.55 },
    { r: 110, op: 0.38 },
    { r: 150, op: 0.24 },
    { r: 190, op: 0.14 },
  ]
  return (
    <svg
      viewBox="0 0 440 440"
      className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <title>Peaje</title>
      {/* la onda: dos círculos que se expanden una vez al cargar */}
      <circle className="gota-onda" cx="220" cy="220" fill="none" stroke="var(--accent)" strokeWidth="1" />
      <circle className="gota-onda gota-onda-2" cx="220" cy="220" fill="none" stroke="var(--accent)" strokeWidth="1" />

      {anillos.map((a, i) => {
        const c = 2 * Math.PI * a.r
        const reps = Math.max(1, Math.floor(c / (texto.length * charW)))
        return (
          <g key={a.r} className="gota-anillo" style={{ animationDelay: `${0.25 + i * 0.3}s` }}>
            <path
              id={`anillo-${a.r}`}
              fill="none"
              d={`M 220,220 m -${a.r},0 a ${a.r},${a.r} 0 1,1 ${a.r * 2},0 a ${a.r},${a.r} 0 1,1 -${a.r * 2},0`}
            />
            <text
              fontSize="11"
              letterSpacing="3"
              fill="var(--crema)"
              opacity={a.op}
              style={{ fontFamily: 'var(--font-chrome), monospace' }}
            >
              <textPath href={`#anillo-${a.r}`} textLength={c} lengthAdjust="spacing">
                {Array.from({ length: reps }, () => texto).join('')}
              </textPath>
            </text>
          </g>
        )
      })}
      <circle className="gota-centro" cx="220" cy="220" r="5" fill="var(--accent)" />
    </svg>
  )
}

function PanelComparativa({
  badge,
  nota,
  activo,
  estadoSin,
  hace,
}: {
  badge: string
  nota: string
  activo: boolean
  estadoSin?: string
  hace?: (s: number) => string
}) {
  const rutas = [
    { path: '/llms.txt', monto: null },
    { path: '/openapi.json', monto: null },
    { path: '/mcp', monto: '$0.01', s: 2 },
    { path: '/r/informe-2026', monto: '$0.05', s: 9 },
  ]
  return (
    <div
      className={
        activo
          ? 'isla-tinta rounded-lg border border-tinta bg-bg p-6'
          : 'rounded-lg border border-linea-clara p-6'
      }
    >
      <p
        className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] ${
          activo ? 'text-crema' : 'text-tinta/50'
        }`}
      >
        {activo ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
        {badge}
      </p>
      <ul className="mt-5 space-y-2.5">
        {rutas.map((r) => (
          <li
            key={r.path}
            className={`flex items-center justify-between rounded-md border px-3.5 py-2.5 font-mono text-xs ${
              activo ? 'border-border bg-tinta-suave text-crema' : 'border-linea-clara text-tinta/45'
            }`}
          >
            <span>{r.path}</span>
            {activo ? (
              <span className="flex items-center gap-3">
                {r.monto ? <span className="text-accent">+{r.monto}</span> : null}
                <span className="text-muted">{r.s !== undefined && hace ? hace(r.s) : 'OK'}</span>
              </span>
            ) : (
              <span>{estadoSin}</span>
            )}
          </li>
        ))}
      </ul>
      <p className={`mt-5 text-sm ${activo ? 'text-muted' : 'text-tinta/60'}`}>{nota}</p>
    </div>
  )
}

function Paso({ n, titulo, texto }: { n: string; titulo: string; texto: string }) {
  return (
    <div className="border-t border-border pt-5">
      <p className="font-mono text-[11px] tracking-[0.14em] text-muted">
        {n} <span className="mx-1 text-border">/</span>{' '}
        <span className="text-accent">{titulo.toUpperCase()}</span>
      </p>
      <p className="mt-3 text-sm text-muted">{texto}</p>
    </div>
  )
}

/** Ruido tipográfico (§6): texto real del dominio, apenas legible. */
function RuidoTipografico() {
  const linea =
    'GET /r/informe-2026 → 402 → PAGO CONFIRMADO 0x3715…e253 → 200 OK · AGENT: VERIFIED · '
  return (
    <div aria-hidden className="ruido">
      {linea.repeat(40)}
    </div>
  )
}
