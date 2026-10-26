import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { cache } from 'react'
import { getDict, getLocale, type Dict, type Locale } from '@/lib/i18n'
import { PRECIOS_USD } from '@peaje/db'
import { cachedScore, gradeDe } from '@/lib/ora'
import { Copiar } from './compartir'
import { leer, masTiempo, principales, type Lectura, type Paso } from './datos'
import { COOKIE_FRESCO, dominioDeRadar, dominiosFrescos } from './dominio'
import { Formulario, MandarInforme, Medir } from './partes'
import { textoLlanoDe, textoOk } from './textos'

/**
 * Radar público: cualquier dominio. Ver un resultado ya medido es abierto
 * (el enlace se comparte); medir uno nuevo pide antes el correo, que deja la
 * cookie `peaje_radar_email`. El score es el de Ora, el mismo del dashboard.
 */

const BASE = process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'
const COOKIE_CORREO = 'peaje_radar_email'

type Props = { searchParams: Promise<{ d?: string; medir?: string }> }
type T = Dict['radar']

/**
 * Una sola consulta a Ora por request: la comparten la metadata y la página.
 * Si el visitante acaba de medir este dominio, se lee saltando el CDN de Ora.
 */
const puntaje = cache((dominio: string, fresco: boolean) => cachedScore(dominio, { fresco }))

const recienMedido = (jar: Awaited<ReturnType<typeof cookies>>, dominio: string) =>
  dominiosFrescos(jar.get(COOKIE_FRESCO)?.value).includes(dominio)

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [{ d: entrada }, { radar: t }, locale, jar] = await Promise.all([searchParams, getDict(), getLocale(), cookies()])
  const dominio = dominioDeRadar(entrada)
  if (!dominio) return { title: t.metaTituloGeneral, description: t.metaDescripcionGeneral }
  const score = await puntaje(dominio, recienMedido(jar, dominio))
  let linea = ''
  if (score) {
    const l = leer(score)
    linea = `${t.hoyFrase(l.actual, l.max, gradeDe(l.actual))}${
      l.estimado > l.actual ? ` ${t.conPeajeFrase(l.estimado, gradeDe(l.estimado))}` : ''
    }`
  }
  const title = t.metaTitulo(dominio)
  const description = t.metaDescripcion(dominio, linea).trim()
  const imagen = `${BASE}/api/og/radar?d=${encodeURIComponent(dominio)}&lang=${locale}`
  const url = `${BASE}/radar?d=${encodeURIComponent(dominio)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: [{ url: imagen, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [imagen] },
  }
}

export default async function Radar({ searchParams }: Props) {
  const [{ d: entrada, medir }, dict, locale, jar] = await Promise.all([searchParams, getDict(), getLocale(), cookies()])
  const t = dict.radar
  const correo = jar.get(COOKIE_CORREO)?.value ?? ''
  const conCorreo = correo !== ''
  const dominio = dominioDeRadar(entrada)
  const score = dominio ? await puntaje(dominio, recienMedido(jar, dominio)) : null
  const pideMedir = medir === '1'

  // Medir necesita correo; ver un resultado ya medido, no.
  const midiendo = dominio !== null && conCorreo && (!score || pideMedir)
  const resultado = dominio !== null && score !== null && !pideMedir

  if (midiendo) {
    return (
      <div className="space-y-6 py-6">
        <Cabecera t={t} />
        <Medir key={dominio} dominio={dominio} auto conCorreo />
      </div>
    )
  }

  if (resultado) {
    return <Resultado t={t} locale={locale} dominio={dominio} lectura={leer(score)} conCorreo={conCorreo} />
  }

  return (
    <Hero
      t={t}
      dominio={dominio ?? entrada ?? ''}
      correo={correo.includes('@') ? correo : ''}
      invalido={Boolean(entrada) && !dominio}
      pideCorreo={dominio}
      medir={pideMedir && score !== null}
    />
  )
}

function Hero({
  t,
  dominio,
  correo,
  invalido,
  pideCorreo,
  medir,
}: {
  t: T
  dominio: string
  correo: string
  invalido: boolean
  pideCorreo: string | null
  medir: boolean
}) {
  return (
    <div className="grid items-center gap-10 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
      <div className="space-y-6">
        <p className="inline-block border border-border px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-muted">
          {t.eyebrow}
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl sm:leading-[1.05]">
          {t.tituloA} <span className="text-accent">{t.tituloB}</span>
        </h1>
        <p className="max-w-xl text-base text-muted">{t.texto}</p>
        {invalido ? <p className="text-sm text-red-600">{t.invalido}</p> : null}
        {pideCorreo ? <p className="max-w-xl border-l-2 border-accent pl-3 text-sm">{t.pideCorreo(pideCorreo)}</p> : null}
        <Formulario dominioInicial={dominio} correoInicial={correo} medir={medir} />
      </div>
      <Ejemplo t={t} />
    </div>
  )
}

/** Tarjeta de muestra, solo en desktop. Números fijos y marcados como ejemplo. */
function Ejemplo({ t }: { t: T }) {
  return (
    <aside aria-label={t.ejemplo} className="hidden border border-border bg-bg md:block">
      <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-2.5 font-mono text-[10px] tracking-[0.08em] text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
          {t.ejemploDominio}
        </span>
        <span className="border border-border px-1.5 py-0.5">{t.ejemplo}</span>
      </div>
      <div className="space-y-5 p-5">
        <p className="text-lg font-semibold leading-snug">{t.ejemploFrase}</p>
        <div className="flex items-end gap-5">
          <div>
            <p className="font-mono text-[10px] tracking-[0.08em] text-muted">{t.hoy}</p>
            <p className="text-4xl font-bold tracking-tight">46</p>
            <p className="font-mono text-xs text-muted">D</p>
          </div>
          <span aria-hidden className="pb-5 text-2xl text-border">→</span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.08em] text-accent">{t.conPeaje}</p>
            <p className="text-4xl font-bold tracking-tight text-accent">~74</p>
            <p className="font-mono text-xs text-muted">B</p>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-border pt-4 text-sm">
          <span>{t.ejemploPrimero}</span>
          <span className="shrink-0 font-mono text-xs font-bold text-accent">{t.ejemploPuntos}</span>
        </div>
      </div>
    </aside>
  )
}

function Cabecera({ t }: { t: T }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="inline-block border border-border px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-muted">
        {t.eyebrow}
      </p>
      <Link href="/radar" className="text-sm text-muted underline underline-offset-4 hover:text-text">
        {t.otroSitio}
      </Link>
    </div>
  )
}

function Seccion({ n, titulo, children, tono = 'bg-bg' }: { n: string; titulo: string; children: React.ReactNode; tono?: string }) {
  return (
    <section className={`border border-border ${tono}`}>
      <header className="flex items-baseline gap-3 border-b border-border px-6 py-4">
        <span className="font-mono text-xs font-bold text-accent">{n}</span>
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </header>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  )
}

/** Más de esto y la medición ya no cuenta como "de hoy": se avisa al lado de la fecha. */
const DIAS_VIEJA = 7

/** Fecha de la medición de Ora en el idioma del visitante, y cuántos días tiene. */
function fechaDe(iso: string | null, locale: Locale): { fecha: string; dias: number } | null {
  const ms = iso ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(ms)) return null
  // En UTC: es la fecha que guarda Ora, la misma para cualquiera que abra el enlace.
  const fecha = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(ms)
  return { fecha, dias: Math.max(0, Math.floor((Date.now() - ms) / 86_400_000)) }
}

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: 'accent' | 'muted' }) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-[0.04em] ${
        tono === 'accent' ? 'border-accent text-accent' : 'border-border text-muted'
      }`}
    >
      {children}
    </span>
  )
}

/** Cada arreglo en palabras del dueño: qué falta, por qué importa, cuánto trabajo pide y si lo hace su agente. */
function Pasos({ t, locale, pasos }: { t: T; locale: Locale; pasos: Paso[] }) {
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {pasos.map((p) => {
        const { titulo, detalle } = textoLlanoDe(p.check, locale)
        return (
          <li key={p.check.id} className="flex items-start justify-between gap-3 py-3">
            <span className="flex min-w-0 items-start gap-2.5">
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${p.loArreglaElKit ? 'bg-accent' : 'bg-faint'}`}
              />
              <span className="min-w-0 space-y-1">
                <span className="block">{titulo}</span>
                {detalle ? <span className="block text-xs text-muted">{detalle}</span> : null}
                <span className="flex flex-wrap gap-1.5 pt-0.5">
                  <Etiqueta tono="muted">{t.esfuerzo[p.esfuerzo]}</Etiqueta>
                  {p.loArreglaElKit ? <Etiqueta tono="accent">{t.loArreglaKit}</Etiqueta> : null}
                </span>
              </span>
            </span>
            {p.puntos > 0 ? (
              <span
                className={`shrink-0 font-mono text-xs font-bold ${p.loArreglaElKit ? 'text-accent' : 'text-muted'}`}
              >
                {t.puntos(p.puntos)}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function Resultado({
  t,
  locale,
  dominio,
  lectura: l,
  conCorreo,
}: {
  t: T
  locale: Locale
  dominio: string
  lectura: Lectura
  conCorreo: boolean
}) {
  const margen = l.estimado - l.actual
  const enlace = `${BASE}/radar?d=${encodeURIComponent(dominio)}`
  const lista = principales(l)
  const despues = masTiempo(l, lista)
  const delKit = lista.filter((p) => p.loArreglaElKit).length
  const medicion = fechaDe(l.medido, locale)

  return (
    <div className="space-y-6 py-6">
      <Cabecera t={t} />

      {/* 01 */}
      <section className="border border-border bg-bg">
        <div className="flex items-center gap-3 border-b border-border bg-panel px-6 py-2.5 font-mono text-[11px] tracking-[0.04em] text-muted">
          <span className="font-bold text-accent">01</span>
          <span className="truncate text-text">{t.s01}</span>
          <span className="hidden truncate sm:inline">· {dominio}</span>
        </div>
        <div className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col items-start gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm text-muted">
              {medicion ? <span className="text-text">{t.medido(medicion.fecha)}</span> : null}
              {medicion && medicion.dias > DIAS_VIEJA ? <span> {t.medicionVieja(medicion.dias)}</span> : null}
            </p>
            <Medir dominio={dominio} conCorreo={conCorreo} />
          </div>

          <div className="space-y-2">
            <p className="max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">
              {t.frase(l.bien.length, l.total, dominio)}
            </p>
            <p className="font-mono text-sm text-muted">
              {t.hoyFrase(l.actual, l.max, gradeDe(l.actual))}
              {margen > 0 ? <span className="text-accent"> {t.conPeajeFrase(l.estimado, gradeDe(l.estimado))}</span> : null}
            </p>
          </div>

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="font-mono text-[10px] tracking-[0.08em] text-muted">{t.hoy}</p>
                <p className="text-6xl font-bold tracking-tight lg:text-[72px] lg:leading-[72px]">{l.actual}</p>
                <p className="mt-1 font-mono text-xs text-muted">{gradeDe(l.actual)}</p>
              </div>
              {margen > 0 ? (
                <>
                  <span aria-hidden className="pb-6 text-3xl text-border">→</span>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.08em] text-accent">{t.conPeaje}</p>
                    <p className="text-6xl font-bold tracking-tight text-accent lg:text-[72px] lg:leading-[72px]">~{l.estimado}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{gradeDe(l.estimado)}</p>
                  </div>
                </>
              ) : null}
            </div>
            <p className="max-w-sm text-sm">{margen > 0 ? t.sube(margen) : t.yaAlto}</p>
          </div>

          {l.parcial ? <p className="border-l-2 border-border pl-3 text-sm text-muted">{t.parcial}</p> : null}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{t.compartirTexto}</p>
            <Copiar texto={enlace} etiqueta={t.copiarEnlace} copiado={t.enlaceCopiado} />
          </div>
          <p className="text-xs text-muted">{t.nota}</p>
        </div>
      </section>

      {/* 02 */}
      <Seccion n="02" titulo={t.s02} tono="bg-panel">
        {lista.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {t.ordenNota}
              {delKit > 0 ? ` ${t.kitCuenta(delKit, lista.length)}` : ''}
            </p>
            <Pasos t={t} locale={locale} pasos={lista} />
          </div>
        ) : (
          <p className="text-sm text-accent">{t.nadaQueArreglar}</p>
        )}
        {despues.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{t.masTiempo}</h3>
            <p className="text-xs text-muted">
              {despues.some((p) => p.esfuerzo === 'dificil') ? t.notaDificil : t.notaMedio}
            </p>
            <Pasos t={t} locale={locale} pasos={despues} />
          </div>
        ) : null}
        {l.sinMedir.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">{t.sinMedir(l.sinMedir.length)}</h3>
            <p className="text-xs text-muted">{t.sinMedirNota}</p>
            <ul className="divide-y divide-border/60 text-sm">
              {l.sinMedir.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 text-muted">
                  <span>{textoLlanoDe(c, locale).titulo}</span>
                  <span className="shrink-0 font-mono text-xs">—</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Seccion>

      {/* 03 */}
      <Seccion n="03" titulo={t.s03}>
        {l.bien.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">{t.yaBien(l.bien.length)}</summary>
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {l.bien.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 py-2.5">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-faint" />
                  <span>{textoOk(c, locale)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-sm text-muted">{t.nadaBien}</p>
        )}
      </Seccion>

      {/* 04 */}
      <Seccion n="04" titulo={t.s04}>
        {/* Dos caminos: el kit (gratis) arregla lo de arriba; el agente (Pro) es lo que hace que la IA te recomiende. */}
        <div className="space-y-3">
          <p className="max-w-2xl text-sm">{t.queIncluye}</p>
          <Link href={`/nuevo?url=${encodeURIComponent(dominio)}`} className="btn btn-secundario">
            {t.ctaKit}
          </Link>
        </div>
        <div className="space-y-3 border-t border-border pt-5">
          <p className="max-w-2xl text-2xl font-semibold leading-tight">{t.cierreTitulo}</p>
          <p className="max-w-2xl text-sm">{t.cierreTexto}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {/* plan=1: después del alta, /nuevo lleva directo a la sección del plan con el checkout de Paddle. */}
          <Link href={`/nuevo?url=${encodeURIComponent(dominio)}&plan=1`} className="btn btn-primario">
            {t.cta(PRECIOS_USD.founder)}
          </Link>
          <MandarInforme dominio={dominio} conCorreo={conCorreo} />
        </div>
        <p className="text-xs text-muted">{t.ctaNota}</p>
      </Seccion>
    </div>
  )
}
