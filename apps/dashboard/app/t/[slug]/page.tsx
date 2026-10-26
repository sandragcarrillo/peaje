import { accesoPro } from '@peaje/db'
import Link from 'next/link'
import { barras, leer, type Barra } from '@/app/radar/datos'
import { textoDe } from '@/app/radar/textos'
import { ScoreColumnas } from '@/components/score-columnas'
import { money } from '@/lib/config'
import { getDict, getLocale } from '@/lib/i18n'
import { cachedScore, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { BotonScore } from './kit/partes'

/**
 * Inicio del negocio: cómo lo ve la IA y el siguiente paso. Junta lo que antes
 * eran Dashboard y Score. El puntaje, las tres preguntas (te encuentran, te
 * usan, te compran) y las tres fallas que más pesan; el detalle va plegado.
 * Debajo, el siguiente paso (kit, agente, Telegram) y lo que pasó esta semana:
 * cada dato aparece solo si existe, para no llenar la pantalla de ceros. Los
 * cobros son opcionales y la lista completa vive en Ingresos.
 */
export default async function Inicio({ params }: PageProps<'/t/[slug]'>) {
  const { slug } = await params
  const [tenant, d, locale] = await Promise.all([requireTenant(slug), getDict(), getLocale()])
  const t = d.acceso
  const domain = scannableDomain(tenant.originUrl)
  const [score, balance, verificacion, telegram, visitas, citas] = await Promise.all([
    domain ? cachedScore(domain) : Promise.resolve(null),
    store.balance(tenant.id),
    store.lastVerification(tenant.id).catch(() => null),
    store.listTelegramLinks(tenant.id).catch(() => []),
    store.visitStats(tenant.id, { days: 7 }).catch(() => null),
    store.listCitationRuns(tenant.id, 1).catch(() => []),
  ])
  const pro = accesoPro(tenant).activo
  const base = `/t/${tenant.slug}`

  // El kit está puesto cuando Peaje lo vio en el dominio: la última verificación
  // (del Kit o del monitor) con todo lo propio en verde. `bots` es el firewall
  // del hosting, no parte del kit, igual que en la página del Kit.
  const propios = ((verificacion?.checks ?? []) as { id: string; ok: boolean }[]).filter((c) => c.id !== 'bots')
  const kitListo = propios.length > 0 && propios.every((c) => c.ok)
  const pasos: Paso[] = [
    { hecho: kitListo, titulo: t.pasoKit, texto: t.pasoKitTexto, href: `${base}/kit`, boton: t.pasoKitBoton },
    { hecho: pro, titulo: t.pasoAgente, texto: t.pasoAgenteTexto, href: `${base}/agente#plan`, boton: t.pasoAgenteBoton },
    { hecho: pro && telegram.length > 0, titulo: t.pasoTelegram, texto: t.pasoTelegramTexto, href: `${base}/agente#telegram`, boton: t.pasoTelegramBoton },
  ]

  // Citas de la última medición: una pregunta cuenta como citada si algún asistente citó el sitio.
  const preguntas = new Map<string, boolean>()
  for (const c of citas) if (!c.error) preguntas.set(c.promptText, (preguntas.get(c.promptText) ?? false) || c.cited)
  const semana: Dato[] = [
    ...(visitas && visitas.totals.visits > 0
      ? [{ valor: String(visitas.totals.visits), texto: t.semanaVisitas(visitas.totals.visits), href: `${base}/agentes-visitas`, link: t.semanaVerVisitas }]
      : []),
    ...(preguntas.size > 0
      ? [{ valor: `${[...preguntas.values()].filter(Boolean).length}/${preguntas.size}`, texto: t.semanaCitas, href: `${base}/agente#citacion`, link: t.semanaVerCitas }]
      : []),
    ...(Number(balance.revenue) > 0
      ? [{ valor: money(balance.revenue), texto: t.semanaCobros(balance.requestCount), href: `${base}/ingresos`, link: t.inicioVerIngresos }]
      : []),
  ]

  // El primer score que vemos queda como el "antes" del negocio.
  if (score && tenant.baselineScore === null) {
    await store.setBaselineScore(tenant.id, score.score).catch(() => {})
  }

  // El checklist va primero: es lo que el dueño tiene que hacer. Cuando está todo hecho, desaparece.
  const checklist = <SiguientePaso pasos={pasos} titulo={t.pasosTitulo} hecho={t.pasoHecho} />
  const despues = <EstaSemana datos={semana} titulo={t.semanaTitulo} />

  if (!domain) {
    return (
      <section className="space-y-6">
        {checklist}
        <p className="border border-border bg-panel p-4 text-sm text-muted">{d.panel.scoreOriginLocal}</p>
        {despues}
      </section>
    )
  }

  if (!score) {
    return (
      <section className="space-y-6">
        {checklist}
        <h1 className="text-3xl font-bold tracking-tight">{t.listoTitulo(domain)}</h1>
        <div className="flex flex-col justify-between gap-4 border border-border bg-panel p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-muted">{t.listoSinPuntaje(domain)}</p>
          <BotonScore slug={tenant.slug} label={t.medirAhora} />
        </div>
        {despues}
      </section>
    )
  }

  const l = leer(score)
  const frenos = [...l.arreglables, ...l.otras].slice(0, 3)
  const antes = tenant.baselineScore
  const mejoro = antes !== null && score.score > antes

  return (
    <section className="space-y-6">
      {checklist}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.listoTitulo(domain)}</h1>
        <p className="text-sm text-muted">{mejoro ? d.panel.scoreMejora(antes, score.score) : t.listoSub}</p>
      </div>

      <div className="space-y-8 border border-border bg-panel p-6 lg:p-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <div className="shrink-0 space-y-3">
            <p className="text-6xl font-bold tracking-tight lg:text-[72px] lg:leading-[72px]">
              {l.actual}
              <span className="text-2xl font-semibold text-muted">/{l.max}</span>
            </p>
            <BotonScore slug={tenant.slug} label={d.panel.volverACorrerScore} secundario />
          </div>
          <ul className="w-full space-y-3">
            {barras(score).map((b) => (
              <FilaBarra key={b.clave} barra={b} etiqueta={t.barras[b.clave]} sinMedir={t.sinMedirBarra} />
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <h2 className="text-sm font-semibold">{t.loQueFrena}</h2>
          {frenos.length > 0 ? (
            <ul className="divide-y divide-border/60 text-sm">
              {frenos.map((f) => (
                <li key={f.check.id} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                    <span>{textoDe(f.check, locale).titulo}</span>
                  </span>
                  {f.puntos > 0 ? (
                    <span className="shrink-0 font-mono text-xs font-bold text-accent">{d.radar.puntos(f.puntos)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.nadaGrave}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/t/${tenant.slug}/kit`} className="btn btn-primario">
            {t.verComoArreglarlo}
          </Link>
          <Link href={`/t/${tenant.slug}/agente`} className="text-sm text-muted underline underline-offset-4 hover:text-text">
            {t.irAMiAgente}
          </Link>
        </div>
      </div>

      {despues}

      <details className="border border-border bg-bg">
        <summary className="cursor-pointer p-4 text-sm text-muted hover:text-text">{t.verDetalle}</summary>
        <ScoreColumnas score={score} />
      </details>
    </section>
  )
}

function FilaBarra({ barra, etiqueta, sinMedir }: { barra: Barra; etiqueta: string; sinMedir: string }) {
  const pct = barra.max > 0 ? Math.round((barra.puntos / barra.max) * 100) : null
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{etiqueta}</span>
        <span className="font-mono text-xs text-muted">{pct === null ? sinMedir : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-border">
        {pct !== null ? <div className="h-full bg-accent" style={{ width: `${pct}%` }} /> : null}
      </div>
    </li>
  )
}

type Paso = { hecho: boolean; titulo: string; texto: string; href: string; boton: string }

/** Los tres pasos del dueño; el primero pendiente lleva el botón. */
function SiguientePaso({ pasos, titulo, hecho }: { pasos: Paso[]; titulo: string; hecho: string }) {
  const actual = pasos.findIndex((p) => !p.hecho)
  if (actual === -1) return null
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {/* En escritorio, los tres pasos en fila; en el celular, uno debajo del otro. */}
      <ol className="grid divide-y divide-border border border-border bg-panel md:grid-cols-3 md:divide-x md:divide-y-0">
        {pasos.map((p, i) => (
          <li key={p.titulo} className={`flex flex-col justify-between gap-4 p-5 ${i > actual ? 'opacity-60' : ''}`}>
            <div className="space-y-1.5">
              <p className="flex items-baseline gap-2.5">
                <span className={`font-mono text-xs ${p.hecho ? 'text-accent' : 'text-muted'}`}>{p.hecho ? '✓' : String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm font-semibold">{p.titulo}</span>
              </p>
              <p className="text-sm text-muted">{p.hecho ? hecho : p.texto}</p>
            </div>
            {i === actual ? (
              <Link href={p.href} className="btn btn-primario btn-chico self-start">
                {p.boton}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

type Dato = { valor: string; texto: string; href: string; link: string }

/** Lo que pasó en los últimos 7 días. Sin datos, no se muestra nada. */
function EstaSemana({ datos, titulo }: { datos: Dato[]; titulo: string }) {
  if (datos.length === 0) return null
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {datos.map((x) => (
          <div key={x.href} className="flex flex-col justify-between gap-3 border border-border bg-panel p-5">
            <div>
              <p className="text-2xl font-bold tabular-nums">{x.valor}</p>
              <p className="mt-1 text-sm text-muted">{x.texto}</p>
            </div>
            <Link href={x.href} className="text-xs text-muted underline underline-offset-4 hover:text-text">
              {x.link}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
