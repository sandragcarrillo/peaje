import Link from 'next/link'
import { getDict } from '@/lib/i18n'
import { currentTenant } from '@/lib/session'

async function TickerRow() {
  const d = await getDict()
  const items = [d.landing.tickerMpp, d.landing.tickerPagos, d.landing.tickerSinApiKey]

  return (
    <div className="flex shrink-0 items-center">
      {items.map((item) => (
        <span key={item} className="mx-4 flex items-center gap-4">
          {item}
          <span aria-hidden className="text-border">
            ·
          </span>
        </span>
      ))}
    </div>
  )
}

export default async function Landing() {
  const [tenant, d] = await Promise.all([currentTenant(), getDict()])

  return (
    <div className="space-y-20 py-8">
      <section className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="max-w-xl">
          <h1 className="text-4xl leading-tight font-medium lg:text-5xl">
            {d.landing.heroTitulo}{' '}
            <span className="text-muted">{d.landing.heroTituloTenue}</span>
          </h1>
          <p className="mt-5 text-lg text-muted">{d.landing.heroTexto}</p>
          <div className="mt-8 flex items-center gap-6">
            {tenant ? (
              <Link
                href={`/t/${tenant.slug}`}
                className="rounded-full bg-text px-5 py-3 text-sm font-medium text-bg"
              >
                {d.landing.ctaDashboard} →
              </Link>
            ) : (
              <>
                <Link
                  href="/nuevo"
                  className="rounded-full bg-text px-5 py-3 text-sm font-medium text-bg"
                >
                  {d.landing.ctaRegistrar}
                </Link>
                <Link
                  href="/mercado"
                  className="inline-flex items-center gap-1.5 border-b border-current pb-0.5 text-sm font-medium text-muted hover:text-text"
                >
                  {d.landing.ctaMercado} <span aria-hidden>→</span>
                </Link>
              </>
            )}
          </div>
        </div>

        <RequestFlow />
      </section>

      <div className="overflow-hidden border-y border-border py-2.5">
        <div className="flex animate-marquee font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
          <TickerRow />
          <div aria-hidden>
            <TickerRow />
          </div>
        </div>
      </div>

      <section className="relative grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div
          aria-hidden
          className="absolute top-[7px] right-0 left-0 hidden h-px bg-border sm:block"
        />
        <SequenceStep titulo={d.landing.paso1Titulo} texto={d.landing.paso1Texto} />
        <SequenceStep titulo={d.landing.paso2Titulo} texto={d.landing.paso2Texto} />
        <SequenceStep titulo={d.landing.paso3Titulo} texto={d.landing.paso3Texto} last />
      </section>
    </div>
  )
}

function SequenceStep({
  titulo,
  texto,
  last,
}: {
  titulo: string
  texto: string
  last?: boolean
}) {
  return (
    <div className="relative pt-7">
      <span
        aria-hidden
        className="absolute top-0 left-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-accent bg-bg"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${last ? 'bg-accent' : 'bg-border'}`} />
      </span>
      <h3 className="font-medium">{titulo}</h3>
      <p className="mt-1.5 text-sm text-muted">{texto}</p>
    </div>
  )
}

const WALLET_DEMO = '0x71…4f2'
const MONTO_DEMO = '$0.002'

async function RequestFlow() {
  const d = await getDict()

  const flowSteps = [
    { label: 'GET /precio', tone: 'text' as const },
    { label: '402 Payment Required', tone: 'muted' as const },
    { label: d.landing.flujoPagaConWallet, tone: 'muted' as const },
    { label: '200 OK', tone: 'accent' as const },
  ]

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-panel p-8">
      <div className="dot-grid pointer-events-none absolute inset-0 text-border opacity-60" />

      <div className="relative flex flex-col font-mono text-xs">
        {flowSteps.map((step, i) => (
          <div key={step.label}>
            {i > 0 && <div aria-hidden className="ml-[5px] h-5 w-px bg-border" />}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  step.tone === 'accent' ? 'bg-accent' : 'border border-border bg-bg'
                }`}
              />
              <span
                className={
                  step.tone === 'accent'
                    ? 'text-accent'
                    : step.tone === 'text'
                      ? 'text-text'
                      : 'text-muted'
                }
              >
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="chip relative mt-8 flex max-w-[260px] items-center gap-3 rounded-2xl bg-bg p-4">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-text"
        >
          $
        </span>
        <div className="font-mono text-xs leading-tight">
          <p className="text-text">{d.landing.flujoPago(WALLET_DEMO, MONTO_DEMO)}</p>
          <p className="mt-0.5 text-muted">{d.landing.flujoTxConfirmada}</p>
        </div>
      </div>
    </div>
  )
}
