'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getDict } from '@/lib/i18n'
import { escanear } from '@/lib/ora'
import { dominioDeRadar } from './dominio'

/** Mediciones por IP por hora: el radar es público y cada una le pega a Ora. */
const TOPE = 6
const ventana = new Map<string, number[]>()

function dentroDelLimite(ip: string): boolean {
  const ahora = Date.now()
  const lista = (ventana.get(ip) ?? []).filter((t) => ahora - t < 3_600_000)
  if (lista.length >= TOPE) return false
  lista.push(ahora)
  ventana.set(ip, lista)
  return true
}

/** Mide (o vuelve a medir) un dominio cualquiera con Ora. Tarda unos 30 segundos. */
export async function medirDominio(entrada: string): Promise<{ ok: boolean; error?: string }> {
  const { radar: d } = await getDict()
  const dominio = dominioDeRadar(entrada)
  if (!dominio) return { ok: false, error: d.invalido }
  const h = await headers()
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
  if (!dentroDelLimite(ip)) return { ok: false, error: d.limite }
  const resultado = await escanear(dominio)
  if ('error' in resultado) return { ok: false, error: resultado.error === 'inalcanzable' ? d.inalcanzable(dominio) : d.fallo }
  revalidatePath('/radar')
  return { ok: true }
}
