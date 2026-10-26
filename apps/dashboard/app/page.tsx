import Link from 'next/link'
import { CUPOS_FOUNDER, PRECIOS_USD } from '@peaje/db'
import { getDict, type Dict } from '@/lib/i18n'
import { currentTenant } from '@/lib/session'
import { ChatEjemplo } from './components/chat-ejemplo'

/**
 * Landing pública (copy final de San, 24 oct 2026). Crema y tinta, etiquetas
 * mono, bordes de 6px y el punto verde. Dos CTAs en todo el sitio público:
 * "Empezar con mi agente" (alta) y "Revisar mi sitio gratis" (radar).
 */

const COMISION_PCT = 2

type L = Dict['landing']

/**
 * Sección a sangre completa: se escapa del max-w-5xl del layout. 100vw incluye
 * la barra de scroll cuando el sistema la muestra; el sobrante lo corta el
 * envoltorio con `overflow-x: clip` del layout.
 */
function Sangre({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-[calc(50%-50vw)] w-screen ${className}`}>{children}</div>
}

export default async function Landing() {
  const [tenant, d] = await Promise.all([currentTenant(), getDict()])
  const t = d.landing
  const agenteHref = tenant ? `/t/${tenant.slug}/agente` : '/nuevo'
  const agenteTexto = tenant ? t.ctaDashboard : t.ctaAgente

  return (
    <div className="pb-4">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Sangre className="isla-crema bg-bg text-text">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <h1 className="max-w-xl text-4xl leading-[1.05] font-semibold sm:text-5xl">{t.h1}</h1>
            <p className="mt-6 max-w-lg text-base text-muted">{t.sub}</p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={agenteHref} className="btn btn-primario">
                {agenteTexto}
              </Link>
              <Link href="/radar" className="btn btn-secundario">
                {t.ctaRadar}
              </Link>
            </div>
          </div>

          <ChatEjemplo
            mensajes={t.chat}
            ejemplo={t.chatEjemplo}
            negocio={t.chatNegocio}
            bot={t.chatBot}
            subtitulo={t.chatSubtitulo}
            tu={t.chatTu}
          />
        </div>
      </Sangre>

      {/* ── Lo que necesitan los agentes ─────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section id="producto" className="mx-auto max-w-5xl scroll-mt-28 px-6 py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.necesitanTitulo}</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {t.necesitan.map((n) => (
              <div key={n.titulo} className="border-t border-border pt-5">
                <p className="etiqueta flex items-center gap-2 font-bold text-accent">
                  <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                  {n.titulo}
                </p>
                <p className="mt-3 text-base">{n.texto}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 max-w-2xl text-lg font-semibold leading-snug">{t.necesitanCierre}</p>
        </section>
      </Sangre>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <Sangre className="isla-tinta bg-bg text-text">
        <section id="como-funciona" className="mx-auto max-w-5xl scroll-mt-28 px-6 py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.comoTitulo}</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3">
            {t.pasos.map((p, i) => (
              <li key={p.titulo} className="border-t border-border pt-5">
                <p className="font-mono text-[14px] font-bold tracking-[0.02em] text-accent">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-lg font-semibold leading-snug">{p.titulo}</h3>
                <p className="mt-2 text-sm text-muted">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>
      </Sangre>

      {/* ── Precios ──────────────────────────────────────────── */}
      <Sangre className="isla-crema bg-bg text-text">
        <section id="precio" className="mx-auto max-w-5xl scroll-mt-28 px-6 py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.precioTitulo}</h2>
          <div className="mt-8 grid gap-8 border border-border bg-panel p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-3">
              <p className="etiqueta flex items-center gap-2 font-bold text-accent">
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {t.precioEtiqueta}
              </p>
              <p className="text-4xl font-bold tracking-tight sm:text-5xl">{t.precioMonto(PRECIOS_USD.founder)}</p>
              <p className="text-base">{t.precioCupos(CUPOS_FOUNDER)}</p>
              <p className="text-sm text-muted">
                {t.precioNormal(PRECIOS_USD.pro)} {t.precioCancelar}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <Link href={agenteHref} className="btn btn-primario">
                {agenteTexto}
              </Link>
              <Link href="/precios" className="text-sm text-muted underline underline-offset-4 hover:text-text">
                {t.verPrecios}
              </Link>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm text-muted">{t.letraChica(COMISION_PCT)}</p>
        </section>
      </Sangre>

      {/* ── Preguntas ────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.faqTitulo}</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {t.faq(COMISION_PCT).map((f) => (
              <details key={f.p} className="group rounded-none py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <span aria-hidden className="font-mono text-sm text-muted group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm text-muted">{f.r}</p>
              </details>
            ))}
          </div>
        </section>
      </Sangre>

      {/* ── Cierre ───────────────────────────────────────────── */}
      <Sangre className="isla-tinta bg-bg text-text">
        <section className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">{t.cierreTitulo}</h2>
          <p className="mt-4 max-w-xl text-base text-muted">{t.cierreTexto}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={agenteHref} className="btn btn-primario">
              {agenteTexto}
            </Link>
            <Link href="/radar" className="btn btn-secundario">
              {t.ctaRadar}
            </Link>
          </div>
        </section>
      </Sangre>

      {/* ── Para devs ────────────────────────────────────────── */}
      <Sangre className="isla-tinta border-t border-border bg-bg text-text">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-5 text-sm">
          <span className="etiqueta font-bold text-accent">{t.devsEtiqueta}</span>
          <span className="text-muted">
            {t.devsTexto} <code className="font-mono text-text">npx @peaje/cli@1 init &lt;slug&gt;</code>
          </span>
          <a href="/developers" className="text-muted underline underline-offset-4 hover:text-text">
            {t.devsPortal} →
          </a>
        </div>
      </Sangre>
    </div>
  )
}

