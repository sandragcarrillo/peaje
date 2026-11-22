import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ciudadLimpia, mercadoDe } from '@peaje/shared/mercados'
import Link from 'next/link'
import { cache } from 'react'
import { getDict, getLocale, type Dict, type Locale } from '@/lib/i18n'
import { PRECIOS_USD } from '@peaje/db'
import { cachedScore, gradeDe } from '@/lib/ora'
import { SeccionCitas } from './citas-vista'
import { Copiar } from './compartir'
import { leer, principales, type Lectura, type Paso } from './datos'
import { COOKIE_FRESCO, dominioDeRadar, dominiosFrescos } from './dominio'
import { CitasConEspera, Formulario, MandarInforme, Medir } from './partes'
import { Cuenta, Fase, Revelado } from './revelado'
import { Tope } from '@/components/tope'
import { Seccion, SeccionPlegable } from './seccion'
import { textoLlanoDe, textoOk } from './textos'
import { TuPanel } from './tu-panel'

/**
 * Radar público: cualquier dominio. Ver un resultado ya medido es abierto
 * (el enlace se comparte); medir uno nuevo pide antes el correo, que deja la
 * cookie `peaje_radar_email`. El score es el de Ora, el mismo del dashboard.
 */

const BASE = process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'
const COOKIE_CORREO = 'peaje_radar_email'
/** La misma que escribe el formulario (partes.tsx). */
const COOKIE_PAIS = 'peaje_radar_pais'
const COOKIE_CIUDAD = 'peaje_radar_ciudad'

type Props = { searchParams: Promise<{ d?: string; medir?: string; p?: string; c?: string }> }
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
  if (!dominio) return { title: t.metaTituloGeneral, description: t.metaDescripcionGeneral, alternates: { canonical: `${BASE}/radar` } }
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
  const [{ d: entrada, medir, p, c }, dict, locale, jar] = await Promise.all([searchParams, getDict(), getLocale(), cookies()])
  const t = dict.radar
  // El país de sus clientes: el del enlace, si no el que eligió en el formulario. Uno que no está en la lista no cuenta.
  const elegido = p ?? jar.get(COOKIE_PAIS)?.value
  const pais = mercadoDe(elegido)?.codigo ?? ''
  // La ciudad viaja con el país: la del enlace si el enlace trae país, si no la del formulario.
  const ciudad = pais ? (ciudadLimpia(p !== undefined ? c : decodeURIComponent(jar.get(COOKIE_CIUDAD)?.value ?? '')) ?? '') : ''
  // Para el formulario: lo que ya eligió ("varios" si eligió varios países). La primera vez llega vacío: "Selecciona un país".
  const paisFormulario = elegido === undefined ? '' : pais || 'varios'
  const correo = jar.get(COOKIE_CORREO)?.value ?? ''
  const conCorreo = correo !== ''
  const dominio = dominioDeRadar(entrada)
  const score = dominio ? await puntaje(dominio, recienMedido(jar, dominio)) : null
  const pideMedir = medir === '1'

  // Medir necesita correo; ver un resultado ya medido, no.
  const midiendo = dominio !== null && conCorreo && (!score || pideMedir)
  const resultado = dominio !== null && score !== null && !pideMedir

  if (midiendo) {
    // Mismo orden que el resultado: arriba las citas (con su espera) y debajo la medición en vivo, que pasa a ser el puntaje.
    return (
      <div className="space-y-6 py-6">
        <Cabecera t={t} dominio={dominio} />
        <CitasConEspera key={`citas-${dominio}-${pais}-${ciudad}`} n="01" dominio={dominio} pais={pais} ciudad={ciudad} mientras="midiendo">
          <SeccionCitas dominio={dominio} n="01" usd={PRECIOS_USD.founder} pais={pais} ciudad={ciudad} />
        </CitasConEspera>
        <Seccion n="02" titulo={t.s01}>
          <Medir key={dominio} dominio={dominio} auto conCorreo />
        </Seccion>
      </div>
    )
  }

  if (resultado) {
    return <Resultado t={t} locale={locale} dominio={dominio} lectura={leer(score)} conCorreo={conCorreo} pais={pais} ciudad={ciudad} />
  }

  return (
    <Hero
      t={t}
      dominio={dominio ?? entrada ?? ''}
      correo={correo.includes('@') ? correo : ''}
      invalido={Boolean(entrada) && !dominio}
      pideCorreo={dominio}
      medir={pideMedir && score !== null}
      pais={paisFormulario}
      ciudad={ciudad}
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
  pais,
  ciudad,
}: {
  t: T
  dominio: string
  correo: string
  invalido: boolean
  pideCorreo: string | null
  medir: boolean
  pais: string
  ciudad: string
}) {
  return (
    // Dos columnas a la misma altura: el mensaje a la izquierda y el formulario a la derecha, en su tarjeta, entero sin bajar.
    <div className="grid items-center gap-8 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:py-10 lg:gap-16">
      <div className="space-y-5">
        <p className="inline-block border border-border px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-muted">
          {t.eyebrow}
        </p>
        <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-[2.75rem] sm:leading-[1.08]">
          {t.tituloA} <span className="text-accent">{t.tituloB}</span>
        </h1>
        <p className="max-w-lg text-base text-muted">{t.texto}</p>
        {invalido ? <p className="text-sm text-red-600">{t.invalido}</p> : null}
        {pideCorreo ? <p className="max-w-xl border-l-2 border-accent pl-3 text-sm">{t.pideCorreo(pideCorreo)}</p> : null}
      </div>
      <div className="border border-border bg-panel p-5 sm:p-6">
        <Formulario dominioInicial={dominio} correoInicial={correo} paisInicial={pais} ciudadInicial={ciudad} medir={medir} />
      </div>
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

/** Arriba del resultado: de qué sitio es, y cómo medir otro. */
function Cabecera({ t, dominio }: { t: T; dominio: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 className="min-w-0 break-all text-2xl font-semibold tracking-tight sm:text-3xl">{dominio}</h1>
      <Link href="/radar" className="-my-2.5 py-2.5 text-sm text-muted underline underline-offset-4 hover:text-text sm:my-0 sm:py-0">
        {t.otroSitio}
      </Link>
    </div>
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

/** Cada arreglo en palabras del dueño: qué falta, por qué importa y que se implementa con el kit. */
function Pasos({ t, locale, pasos }: { t: T; locale: Locale; pasos: Paso[] }) {
  return (
    // Los cinco primeros a la vista: el resto, con un botón. Que se implementan con el kit ya lo dice la línea de arriba, una vez.
    <Tope visibles={5} mas={t.verMasPasos(Math.max(0, pasos.length - 5))} menos={t.verMenosPasos} className="divide-y divide-border/60 text-sm">
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
    </Tope>
  )
}

function Resultado({
  t,
  locale,
  dominio,
  lectura: l,
  conCorreo,
  pais,
  ciudad,
}: {
  t: T
  locale: Locale
  dominio: string
  lectura: Lectura
  conCorreo: boolean
  pais: string
  ciudad: string
}) {
  const margen = l.estimado - l.actual
  const enlace = `${BASE}/radar?d=${encodeURIComponent(dominio)}${pais ? `&p=${pais}${ciudad ? `&c=${encodeURIComponent(ciudad)}` : ''}` : ''}`
  // Solo lo que se implementa con el kit; lo demás no se lista (ver principales en datos.ts).
  const lista = principales(l)
  const medicion = fechaDe(l.medido, locale)

  return (
    <div className="space-y-6 py-6">
      <Cabecera t={t} dominio={dominio} />

      {/* 01: lo primero que se ve es a quién recomienda la IA. Se carga sola desde el navegador; mientras, la espera (partes.tsx). */}
      <CitasConEspera key={`citas-${dominio}-${pais}-${ciudad}`} n="01" dominio={dominio} pais={pais} ciudad={ciudad} mientras="puntaje">
        <SeccionCitas dominio={dominio} n="01" usd={PRECIOS_USD.founder} pais={pais} ciudad={ciudad} />
      </CitasConEspera>

      {/* 02: el puntaje de Ora, en resumen. */}
      <Seccion n="02" titulo={t.s01}>
        <div className="flex flex-col items-start gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted">
            {medicion ? <span className="text-text">{t.medido(medicion.fecha)}</span> : null}
            {medicion && medicion.dias > DIAS_VIEJA ? <span> {t.medicionVieja(medicion.dias)}</span> : null}
          </p>
          <Medir dominio={dominio} conCorreo={conCorreo} />
        </div>

        {/* Recién medido: el número cuenta desde 0, aparece la nota y al final lo que puede llegar a ser (revelado.tsx). */}
        <Revelado dominio={dominio}>
          <div className="space-y-2">
            <p className="max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">
              {t.frase(l.bien.length, l.total, dominio)}
            </p>
            <Fase desde={2} como="p" className="text-sm tabular-nums text-muted">
              {t.hoyFrase(l.actual, l.max, gradeDe(l.actual))}
              {margen > 0 ? <span className="text-accent"> {t.conPeajeFrase(l.estimado, gradeDe(l.estimado))}</span> : null}
            </Fase>
          </div>

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="flex flex-wrap items-end gap-3 sm:gap-8">
              <div>
                <p className="text-xs text-muted">{t.hoy}</p>
                <p className="text-5xl font-bold tabular-nums tracking-tight sm:text-6xl lg:text-[72px] lg:leading-[72px]">
                  <Cuenta valor={l.actual} />
                </p>
                <Fase desde={1} como="p" className="mt-1 text-xs font-medium text-muted">
                  {gradeDe(l.actual)}
                </Fase>
              </div>
              {margen > 0 ? (
                <Fase desde={2} className="flex items-end gap-3 sm:gap-8">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mb-8 shrink-0 text-faint">
                    <path d="M4 12h15M13 6l6 6-6 6" />
                  </svg>
                  <div>
                    <p className="text-xs text-accent">{t.conPeaje}</p>
                    <p className="text-5xl font-bold tabular-nums tracking-tight text-accent sm:text-6xl lg:text-[72px] lg:leading-[72px]">~{l.estimado}</p>
                    <p className="mt-1 text-xs font-medium text-muted">{gradeDe(l.estimado)}</p>
                  </div>
                </Fase>
              ) : null}
            </div>
            <Fase desde={2} como="p" className="max-w-sm text-sm">
              {margen > 0 ? t.puedeLlegar(l.estimado, margen) : t.yaAlto}
            </Fase>
          </div>
        </Revelado>

        {l.parcial ? <p className="text-sm text-muted">{t.parcial}</p> : null}

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t.compartirTexto}</p>
          <Copiar texto={enlace} etiqueta={t.copiarEnlace} copiado={t.enlaceCopiado} />
        </div>
        <p className="text-xs text-muted">{t.nota}</p>
      </Seccion>

      {/* 03 */}
      <Seccion n="03" titulo={t.s02} tono="bg-panel">
        {lista.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              {t.ordenNota} {t.kitCuenta(lista.length, lista.length)}
            </p>
            <Pasos t={t} locale={locale} pasos={lista} />
          </div>
        ) : l.pasos.length > 0 ? (
          // Falta algo, pero nada que el kit implemente: no decir "no falta nada".
          <p className="text-sm text-accent">{t.nadaDelKit}</p>
        ) : (
          <p className="text-sm text-accent">{t.nadaQueArreglar}</p>
        )}
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

      {/* 04 */}
      {l.bien.length > 0 ? (
        <SeccionPlegable n="04" titulo={t.s03} cuenta={l.bien.length}>
          <ul className="grid gap-x-10 text-sm md:grid-cols-2">
            {l.bien.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 border-b border-border/60 py-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-faint" />
                <span>{textoOk(c, locale)}</span>
              </li>
            ))}
          </ul>
        </SeccionPlegable>
      ) : (
        <Seccion n="04" titulo={t.s03}>
          <p className="text-sm text-muted">{t.nadaBien}</p>
        </Seccion>
      )}

      {/* 05: así se vería su panel, con lo que el Radar ya encontró. Solo lectura; los botones llevan al registro. */}
      <TuPanel n="05" dominio={dominio} pais={pais} ciudad={ciudad} usd={PRECIOS_USD.founder} faltan={lista.map((p) => textoLlanoDe(p.check, locale).titulo)} />

      {/* 06: primero el agente (Pro); el kit solo, como enlace chico al final. */}
      <Seccion n="06" titulo={t.s04}>
        <div className="space-y-3">
          <p className="max-w-2xl text-2xl font-semibold leading-tight">{t.cierreTitulo}</p>
          <p className="max-w-2xl text-sm">{t.cierreTexto}</p>
        </div>
        <div className="max-w-2xl space-y-2">
          <p className="text-sm font-medium">{t.primerosTitulo}</p>
          <ol className="space-y-1.5 text-sm">
            {t.primeros.map((p) => (
              <li key={p.cuando} className="flex gap-3">
                <span className="w-20 shrink-0 text-muted">{p.cuando}</span>
                <span>{p.que}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {/* plan=1: después del alta, /nuevo lleva directo a la sección del plan con el checkout de Paddle. En el teléfono, a todo el ancho y en dos líneas si hace falta. */}
          <Link href={`/nuevo?url=${encodeURIComponent(dominio)}&plan=1`} className="btn btn-primario w-full whitespace-normal text-center sm:w-auto sm:whitespace-nowrap">
            {t.cta(PRECIOS_USD.founder)}
          </Link>
          <MandarInforme dominio={dominio} conCorreo={conCorreo} />
        </div>
        <p className="text-xs text-muted">{t.ctaNota}</p>
        <p className="border-t border-border pt-4 text-sm text-muted">
          {t.soloTecnico}{' '}
          <Link href={`/nuevo?url=${encodeURIComponent(dominio)}`} className="text-text underline underline-offset-4 hover:text-accent">
            {t.instalaKit}
          </Link>
        </p>
      </Seccion>
    </div>
  )
}
