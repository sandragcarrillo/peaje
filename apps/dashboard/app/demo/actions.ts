'use server'

import { cookies, headers } from 'next/headers'
import { guardarLeadRadar } from '@/lib/gateway'
import { COOKIE_ORIGEN, origenValido } from '@/lib/origen'
import { dominioDeRadar } from '../radar/dominio'

/**
 * Guarda el pedido de demo como lead (tabla radar_leads, source 'demo'), como
 * hace revnu.com/book antes de mostrar el calendario. No manda correos: San
 * escribe el siguiente paso a mano. La nota de "qué quieres ver" viaja solo en
 * la reserva de Cal.com; la tabla de leads no tiene dónde guardarla.
 */

const TOPE_POR_HORA = 5
const ventana = new Map<string, number[]>()

function dentroDelLimite(ip: string): boolean {
  const ahora = Date.now()
  const lista = (ventana.get(ip) ?? []).filter((t) => ahora - t < 3_600_000)
  if (lista.length >= TOPE_POR_HORA) return false
  lista.push(ahora)
  ventana.set(ip, lista)
  return true
}

export async function pedirDemo(input: { sitio: string; correo: string; locale: 'es' | 'en' }): Promise<{ ok: boolean }> {
  const correo = (input.correo ?? '').trim().toLowerCase()
  if (!correo || correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return { ok: false }
  const dominio = dominioDeRadar(input.sitio)
  if (!dominio) return { ok: false }
  const h = await headers()
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
  if (!dentroDelLimite(ip)) return { ok: false }
  const acquisitionSource = origenValido((await cookies()).get(COOKIE_ORIGEN)?.value)
  try {
    await guardarLeadRadar({
      email: correo,
      domain: dominio,
      locale: input.locale === 'es' ? 'es' : 'en',
      marketingConsent: false,
      acquisitionSource,
      source: 'demo',
    })
    return { ok: true }
  } catch (err) {
    console.error(`[demo] no se pudo guardar el pedido de ${dominio}`, err)
    return { ok: false }
  }
}
