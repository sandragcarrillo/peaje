import type { Metadata } from 'next'
import Link from 'next/link'
import { COSTOS_CREDITOS, CUPOS_FOUNDER, DIAS_REEMBOLSO, LIMITES, PAQUETE_MENSUAL, PRECIOS_USD, REGALO } from '@peaje/db'
import { getDict, getLocale } from '@/lib/i18n'
import type { DatosFaq } from '@/lib/i18n/sections/faq'
import { currentTenant } from '@/lib/session'
import { CtaInicio } from './components/cta-inicio'
import { Ciclo } from './components/landing/ciclo'
import { MuestraRadar } from './components/landing/muestra-radar'
import { PantallaHace, PantallaMide, PantallaTarea, PantallaVuelve } from './components/landing/pantallas-ciclo'
import { Icono, ICONOS } from './components/landing/piezas'

/**
 * Home pública (propuesta del 22 nov 2026, reports/Landing Peaje propuesta.md):
 * hero centrado con una respuesta del Radar de ejemplo, qué mide hoy, el ciclo
 * del agente, dónde vive, el precio, preguntas y el cierre. Una sola acción
 * principal en toda la página: "Empezar gratis" al Radar (bloque de CtaInicio,
 * en el hero y en el cierre). Sin números propios de usepeaje.com (San, 26 oct).
 */

// Solo acá y no en el layout: las páginas hijas heredarían el canonical de la
// portada. Sin esto Google ve usepeaje.com y www.usepeaje.com como duplicadas.
export const metadata: Metadata = { alternates: { canonical: '/' } }

const BASE = 'https://usepeaje.com'

/**
 * Las preguntas del home salen de faq.ts (la misma fuente que /preguntas y
 * /faq), por posición: qué hace, qué asistentes mide, el Radar, dónde vive el
 * agente, cuánto tarda y cancelar. Si faq.ts cambia de orden, revisar esto.
 */
const PREGUNTAS_HOME = [0, 1, 2, 8, 9, 7]

const DATOS_FAQ: DatosFaq = {
  founder: PRECIOS_USD.founder,
  pro: PRECIOS_USD.pro,
  cupos: CUPOS_FOUNDER,
  creditos: LIMITES.pro.creditos,
  dias: DIAS_REEMBOLSO,
  regaloInformes: REGALO.informes,
  regaloRespuestas: REGALO.respuestas,
  paginas: PAQUETE_MENSUAL.paginas,
  informes: PAQUETE_MENSUAL.informes,
  respuestas: PAQUETE_MENSUAL.respuestas,
  preguntas: LIMITES.pro.preguntas,
  costos: COSTOS_CREDITOS,
}

/**
 * Sección a sangre completa: se escapa del max-w-5xl del layout. 100vw incluye
 * la barra de scroll cuando el sistema la muestra; el sobrante lo corta el
 * envoltorio con `overflow-x: clip` del layout.
 */
function Sangre({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-[calc(50%-50vw)] w-screen ${className}`}>{children}</div>
}

/** Titular de sección: peso medio, tracking negativo (el `!` le gana al h2 global de globals.css). */
const H2 = 'text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.08] font-medium tracking-[-0.03em]! text-balance'

const ICONO_VIVO = { telegram: ICONOS.avion, slack: ICONOS.numeral, panel: ICONOS.panel, asistente: ICONOS.terminal } as const

export default async function Landing() {
  const [tenant, d, locale] = await Promise.all([currentTenant(), getDict(), getLocale()])
  const t = d.landing
  const precio = { founder: PRECIOS_USD.founder, pro: PRECIOS_USD.pro, cupos: CUPOS_FOUNDER, regaloInformes: REGALO.informes, regaloRespuestas: REGALO.respuestas }
  const paquete = { ...PAQUETE_MENSUAL, preguntas: LIMITES.pro.preguntas }
  const todas = d.faq.preguntas(DATOS_FAQ)
  const preguntas = PREGUNTAS_HOME.map((i) => todas[i]).filter((q): q is NonNullable<typeof q> => !!q)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    url: `${BASE}/`,
    mainEntity: preguntas.map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
  }

  return (
    <div className="pb-4">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="pt-8 text-center sm:pt-16">
        <h1 className="mx-auto max-w-[22ch] text-[clamp(2.25rem,4.8vw,4rem)] leading-[1.02] font-medium tracking-[-0.035em]! text-balance">
          {t.h1Inicio} <span className="text-accent sm:block">{t.h1Final}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[60ch] text-[17px] leading-relaxed text-pretty text-muted">{t.sub}</p>
        <CtaInicio className="mt-9" />
      </section>

      <Sangre className="relative mt-16 sm:mt-20">
        {/* El motivo de puntos de la marca, solo detrás de la pieza. */}
        <div
          aria-hidden
          className="dot-grid pointer-events-none absolute inset-x-0 -top-16 bottom-0 text-accent opacity-[0.2] [mask-image:radial-gradient(55%_60%_at_50%_42%,#000_0%,transparent_75%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <MuestraRadar d={d} />
        </div>
      </Sangre>

      {/* ── Qué hace por ti ───────────────────────────────────── */}
      <Sangre className="isla-crema mt-20 border-t border-border bg-bg text-text sm:mt-24">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <ul className="grid gap-6 sm:grid-cols-3 sm:gap-10">
            {t.mide.map((m, i) => (
              <li key={m} className="flex items-start gap-3 text-[15px] leading-6">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-accent/10 text-accent">
                  <Icono d={[ICONOS.panel, ICONOS.terminal, ICONOS.vuelta][i] ?? ICONOS.check} />
                </span>
                <span className="pt-1.5">{m}</span>
              </li>
            ))}
          </ul>
        </section>
      </Sangre>

      {/* ── El ciclo ─────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-24 sm:py-28">
          <div className="max-w-2xl">
            <h2 className={H2}>{t.cicloTitulo}</h2>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">{t.cicloSub}</p>
          </div>
          <div className="mt-14">
            <Ciclo
              pasos={t.ciclo}
              pantallas={[<PantallaMide key="mide" d={d} />, <PantallaTarea key="tarea" d={d} />, <PantallaHace key="hace" d={d} />, <PantallaVuelve key="vuelve" d={d} />]}
            />
          </div>
        </section>
      </Sangre>

      {/* ── Dónde vive tu agente ─────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section className="mx-auto grid max-w-5xl gap-12 px-6 py-24 sm:py-28 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
          <div>
            <h2 className={H2}>{t.vivoTitulo}</h2>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-muted">{t.vivoTexto}</p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {t.vivo.map((v) => (
              <li key={v.clave} className="flex items-start gap-4 py-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent/10 text-accent">
                  <Icono d={ICONO_VIVO[v.clave]} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{v.nombre}</p>
                  <p className="mt-0.5 text-[15px] leading-6 text-muted">{v.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Sangre>

      {/* ── Precio ───────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section id="precio" className="mx-auto grid max-w-5xl scroll-mt-28 gap-12 px-6 py-24 sm:py-28 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
          <div>
            <h2 className={H2}>{t.precioTitulo(precio)}</h2>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-muted">{t.precioTexto(precio)}</p>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed">{t.precioGratis(precio)}</p>
            <Link href="/precios" className="accion-texto mt-5 -ml-1 inline-block text-[15px]">
              {t.verPrecios}
            </Link>
          </div>

          <div className="rounded-[18px] border border-border bg-panel p-1.5">
            <div className="rounded-[13px] border border-border bg-bg p-5 sm:p-7">
              <p className="text-lg font-semibold tracking-tight">{t.precioPlan}</p>
              <ul className="mt-5 space-y-3.5">
                {t.precioPuntos(paquete).map((p) => (
                  <li key={p.fuerte} className="flex gap-3 text-[15px] leading-6">
                    <svg className="mt-1 h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={ICONOS.check} />
                    </svg>
                    <span>
                      <strong className="font-semibold">{p.fuerte}</strong>
                      <span className="text-muted">{p.resto}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted tabular-nums">{t.precioCosto(precio)}</p>
                <Link href={tenant ? `/t/${tenant.slug}/agente` : '/nuevo?plan=1'} className="btn btn-secundario btn-suave">
                  {tenant ? t.ctaDashboard : t.ctaAgente}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Sangre>

      {/* ── Preguntas ────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        <section className="mx-auto grid max-w-5xl gap-10 px-6 py-24 sm:py-28 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] md:gap-16">
          <div>
            <h2 className={H2}>{t.faqTitulo}</h2>
            <Link href={t.faqRuta} className="accion-texto mt-4 -ml-1 inline-block text-[15px]">
              {t.faqTodas}
            </Link>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {preguntas.map((f) => (
              <details key={f.p} className="group rounded-none">
                {/* El toque abarca toda la fila; el ícono gira al abrir. */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                </summary>
                <div className="-mt-1 pb-5">
                  <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{f.r}</p>
                  {f.enlace ? (
                    <Link href={f.enlace.href} className="accion-texto mt-2 -ml-1 inline-block">
                      {f.enlace.texto}
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      </Sangre>

      {/* ── Cierre ───────────────────────────────────────────── */}
      <Sangre className="isla-crema border-t border-border bg-bg text-text">
        {/* Sin padding abajo: el main del layout ya deja aire antes del pie. */}
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
          <section className="isla-tinta relative overflow-hidden rounded-[28px] bg-bg px-6 pt-16 pb-20 text-center text-text sm:px-12 sm:pt-20 sm:pb-24">
            <div
              aria-hidden
              className="dot-grid pointer-events-none absolute inset-0 text-accent opacity-[0.16] [mask-image:radial-gradient(60%_70%_at_50%_0%,#000_0%,transparent_80%)]"
            />
            <div className="relative">
              <h2 className={`mx-auto max-w-[22ch] ${H2}`}>{t.cierreTitulo}</h2>
              <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">{t.cierreTexto}</p>
              <CtaInicio className="mt-9" />
            </div>
          </section>
        </div>
      </Sangre>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD de las preguntas del home, sin datos de usuarios
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />
    </div>
  )
}
