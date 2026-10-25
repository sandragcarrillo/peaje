'use server'

import { cookies, headers } from 'next/headers'
import { after } from 'next/server'
import { mandarReporteRadar, guardarLeadRadar, type ReporteRadar } from '@/lib/gateway'
import { dictFor, getLocale, type Locale } from '@/lib/i18n'
import { cachedScore, gradeDe, prevision } from '@/lib/ora'
import { dominioDeRadar } from './dominio'
import { textoDeChequeo } from '@/lib/radar/chequeos'

/**
 * El radar pide email y dominio antes de medir. El lead se guarda en el
 * gateway (tabla radar_leads) y el reporte del dominio sale por correo cuando
 * hay puntaje. La cookie `peaje_radar_email` le dice a la página que este
 * visitante ya dejó su email y puede medir.
 */

const COOKIE = 'peaje_radar_email'
const UN_ANIO = 60 * 60 * 24 * 365

/** Registros y pedidos de reporte por IP por hora: cada uno puede mandar un correo. */
const TOPE_REGISTRO = 10
const TOPE_REPORTE = 20
const ventanas = { registro: new Map<string, number[]>(), reporte: new Map<string, number[]>() }

function dentroDelLimite(cual: keyof typeof ventanas, ip: string, tope: number): boolean {
  const ventana = ventanas[cual]
  const ahora = Date.now()
  const lista = (ventana.get(ip) ?? []).filter((t) => ahora - t < 3_600_000)
  if (lista.length >= tope) return false
  lista.push(ahora)
  ventana.set(ip, lista)
  return true
}

async function ipDe(): Promise<string> {
  const h = await headers()
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}

function emailValido(entrada: string | undefined): string | null {
  const email = (entrada ?? '').trim().toLowerCase()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  return email
}

/** Guarda email y dominio, deja la cookie y, si el dominio ya tiene puntaje, manda el reporte. */
export async function registrarLead(input: {
  email: string
  dominio: string
  consiente: boolean
  locale: 'es' | 'en'
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const locale: Locale = input.locale === 'es' ? 'es' : 'en'
  const t = dictFor(locale).radarCorreo
  const email = emailValido(input.email)
  if (!email) return { ok: false, error: t.emailInvalido }
  const dominio = dominioDeRadar(input.dominio)
  if (!dominio) return { ok: false, error: t.dominioInvalido }
  if (!dentroDelLimite('registro', await ipDe(), TOPE_REGISTRO)) return { ok: false, error: t.limite }

  try {
    await guardarLeadRadar({ email, domain: dominio, locale, marketingConsent: input.consiente === true })
  } catch (err) {
    console.error(`[radar] no se pudo guardar el lead de ${dominio}`, err)
    return { ok: false, error: t.fallo }
  }

  ;(await cookies()).set(COOKIE, email, {
    httpOnly: true,
    // En local (http) Safari descarta las cookies secure; en producción siempre van.
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: UN_ANIO,
  })

  // El correo no frena la respuesta: si el dominio todavía no tiene puntaje,
  // sale después de medir (enviarReporte).
  after(() => reportar(email, dominio, locale))
  return { ok: true }
}

/**
 * Manda el reporte del dominio al email de la cookie, si hay email y puntaje.
 * Llamarla después de una medición. Nunca lanza; el gateway no repite el mismo
 * reporte antes de 10 minutos.
 */
export async function enviarReporte(dominio: string): Promise<void> {
  try {
    const email = emailValido((await cookies()).get(COOKIE)?.value)
    const limpio = dominioDeRadar(dominio)
    if (!email || !limpio) return
    if (!dentroDelLimite('reporte', await ipDe(), TOPE_REPORTE)) return
    const locale = await getLocale()
    after(() => reportar(email, limpio, locale))
  } catch (err) {
    console.error('[radar] enviarReporte falló', err)
  }
}

/** Arma el reporte con el puntaje en cache de Ora y lo manda por el gateway. Nunca lanza. */
async function reportar(email: string, dominio: string, locale: Locale): Promise<void> {
  try {
    const score = await cachedScore(dominio)
    if (!score) return
    const p = prevision(score)
    const fixes: ReporteRadar['fixes'] = p.arreglables
      // En el idioma del visitante y en palabras de dueño; el nombre de Ora (en inglés) solo si el chequeo es desconocido.
      .map((a) => {
        const texto = textoDeChequeo(a.check.id, locale === 'en' ? 'en' : 'es')
        return {
          name: texto?.titulo ?? a.check.name,
          recommendation: texto?.detalle ?? a.check.recommendation ?? null,
          points: a.check.estScoreGain ?? a.check.maxScore ?? null,
        }
      })
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 3)
    const r = await mandarReporteRadar({
      email,
      domain: dominio,
      locale,
      score: p.actual,
      grade: gradeDe(p.actual),
      projected: p.estimado,
      projectedGrade: gradeDe(p.estimado),
      fixes,
    })
    if (!r.sent) console.warn(`[radar] reporte de ${dominio} no enviado: ${r.reason ?? 'sin motivo'}`)
  } catch (err) {
    console.error(`[radar] no se pudo mandar el reporte de ${dominio}`, err)
  }
}
