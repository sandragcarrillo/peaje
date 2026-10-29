import Link from 'next/link'
import { CUPOS_FOUNDER, LIMITES, PAQUETE_MENSUAL, PRECIOS_USD } from '@peaje/db'
import { getDict, type Dict } from '@/lib/i18n'
import { COBROS_VISIBLES } from '@/lib/config'
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
  const P = d.precios
  const agenteHref = tenant ? `/t/${tenant.slug}/agente` : '/nuevo'
  const agenteTexto = tenant ? t.ctaDashboard : t.ctaAgente
  const paquete = { ...PAQUETE_MENSUAL, preguntas: LIMITES.pro.preguntas, creditos: LIMITES.pro.creditos }

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
          {/*
            Como la tarjeta de precio de boringmarketing.com (referencia de San, 26 oct
            2026): una sola tarjeta de Pro que cuenta qué hace el agente en palabras
            de negocio. Lo gratis va al lado en una línea;
            el detalle (créditos, cobro, reembolso) queda en /precios.
          */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.35fr] md:items-start">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">{t.precioTitulo}</h2>
              <p className="mt-4 max-w-sm text-base text-muted">{t.precioGratis}</p>
              {COBROS_VISIBLES ? <p className="mt-3 max-w-sm text-sm text-muted">{P.kitComision(COMISION_PCT)}</p> : null}
              <div className="mt-6 flex flex-col items-start gap-4">
                <Link href="/radar" className="btn btn-secundario">
                  {t.ctaRadar}
                </Link>
                <Link href="/precios" className="-my-2.5 py-2.5 text-sm text-muted underline underline-offset-4 hover:text-text">
                  {t.verPrecios}
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-accent bg-panel p-5 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-4xl font-semibold tabular-nums sm:text-5xl">US${PRECIOS_USD.founder}</span>
                  <span className="text-lg text-muted line-through">US${PRECIOS_USD.pro}</span>
                  <span className="font-mono text-sm text-muted">{t.precioUnidad}</span>
                </p>
                <p className="font-mono text-sm text-muted">{t.precioCreditos(LIMITES.pro.creditos)}</p>
              </div>
              <p className="mt-4 text-base">{t.precioValor}</p>

              <p className="mt-7 text-sm font-semibold">{t.precioTodoTitulo}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {t.precioHabilidades.map((h) => (
                  <li key={h} className="etiqueta rounded-md border border-border px-2.5 py-1 text-accent">
                    {h}
                  </li>
                ))}
              </ul>

              <ul className="mt-7 space-y-3.5">
                {t.precioPuntos(paquete).map((p) => (
                  <li key={p.fuerte} className="flex gap-3 text-[15px] leading-6">
                    <svg className="mt-1 h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                    <span>
                      <strong className="font-semibold">{p.fuerte}</strong>
                      <span className="text-muted">{p.resto}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <Link href={tenant ? agenteHref : '/nuevo?plan=1'} className="btn btn-primario btn-ancho mt-8 whitespace-normal text-center">
                {agenteTexto}
              </Link>

              <p className="mt-6 font-mono text-xs leading-5 text-muted">{t.precioPie(CUPOS_FOUNDER).join(' · ')}</p>
            </div>
          </div>
        </section>
      </Sangre>

      {/* ── Preguntas ────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t.faqTitulo}</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {t.faq(COMISION_PCT, paquete).map((f) => (
              <details key={f.p} className="group rounded-none py-4">
                {/* -my-4 py-4: en el teléfono el toque abarca toda la fila, no solo la línea de texto; el diseño no se mueve. */}
                <summary className="-my-4 flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
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
            {t.devsTexto} <code className="font-mono whitespace-nowrap text-text">npx @peaje/cli@1 init &lt;slug&gt;</code>
          </span>
          <a href="/developers" className="-my-2.5 py-2.5 text-muted underline underline-offset-4 hover:text-text">
            {t.devsPortal} →
          </a>
        </div>
      </Sangre>
    </div>
  )
}

