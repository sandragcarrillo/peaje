import type { Tenant } from '@peaje/db'
import { dominioVerificable } from '@peaje/shared'
import { store } from '../store.js'
import { correrTenant } from '../monitor/correr.js'
import { motoresDisponibles } from '../citacion/motores.js'
import { correrRonda, maxPreguntas, sugerirPrompts } from '../citacion/medir.js'
import { esActivo } from '../billing/acceso.js'
import { generarTareas } from './generar.js'
import { generarPlan, type EntradaPlan } from './plan.js'

/**
 * El arranque sin preguntas. Antes un negocio nuevo esperaba hasta 24 horas la
 * primera revisión, y con Pro no pasaba nada hasta que el dueño respondía tres
 * preguntas para armar su plan. Ahora Peaje hace solo lo que ya sabe hacer:
 *
 *   al registrarse   revisa el sitio y deja las primeras tareas (gratis)
 *   al empezar Pro   además elige las preguntas a medir (las del radar gratis,
 *                    si el dueño lo corrió, y las que sugiere el modelo), arma
 *                    un plan con el objetivo más común y busca qué publicar
 *
 * El dueño puede cambiar el objetivo, las preguntas o la cadencia después; lo
 * que no tiene que hacer es decidir antes de ver algo. Todo es idempotente: lo
 * que ya existe no se pisa ni se repite.
 */

type Idioma = 'es' | 'en'

/** El plan de quien no dijo nada: que la IA lo recomiende, con todo lo que Peaje puede proponer, una vez por semana. */
export const planPorDefecto = (idioma: Idioma): EntradaPlan => ({ goal: 'recommendations', goalDetail: '', capacity: ['content', 'code', 'config'], cadence: 'weekly', language: idioma })

/** Hasta cuándo valen las preguntas del radar para sembrar las del negocio. */
const RADAR_DIAS = 30

/** Negocios con un arranque en curso: registrarse y pagar seguido no lo corre dos veces a la vez. */
const enCurso = new Set<string>()

const aviso = (paso: string, tenant: Tenant, e: unknown) => console.warn(`[arranque] ${paso}`, tenant.slug, e instanceof Error ? e.message : e)

/** Las preguntas que el dueño ya vio en el radar gratis para este dominio, en cualquiera de los dos idiomas. */
export async function preguntasDelRadar(tenant: Tenant, ahora = new Date()): Promise<string[]> {
  const dominio = dominioVerificable(tenant.originUrl)
  if (!dominio) return []
  const raiz = dominio.replace(/^www\./, '')
  const desde = new Date(ahora.getTime() - RADAR_DIAS * 86_400_000).toISOString()
  const vistas: string[] = []
  for (const d of new Set([raiz, dominio])) {
    for (const locale of ['es', 'en']) {
      const run = await store.getRadarCitas(d, locale, desde).catch(() => null)
      for (const q of run?.result?.questions ?? []) if (q.text && !vistas.includes(q.text)) vistas.push(q.text)
    }
  }
  return vistas
}

/** Primera revisión y primeras tareas, si el negocio todavía no tiene ninguna revisión. */
export async function arranqueGratis(tenant: Tenant): Promise<{ reviso: boolean }> {
  if (!dominioVerificable(tenant.originUrl)) return { reviso: false }
  if (await store.lastVerification(tenant.id)) return { reviso: false }
  const corrida = await correrTenant(tenant).catch((e) => (aviso('primera revisión', tenant, e), null))
  if (!corrida) return { reviso: false }
  // Arreglos, bots bloqueados, páginas viejas y Search Console si ya está conectado. Sin llamadas a modelos.
  await generarTareas(tenant).catch((e) => aviso('primeras tareas', tenant, e))
  return { reviso: true }
}

/** Las preguntas a medir, si no tiene ninguna: primero las del radar, después las que sugiere el modelo. */
export async function sembrarPreguntas(tenant: Tenant): Promise<number> {
  if ((await store.listCitationPrompts(tenant.id)).length > 0) return 0
  const tope = maxPreguntas(tenant)
  if (tope <= 0) return 0
  const delRadar = (await preguntasDelRadar(tenant)).slice(0, tope)
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const sugeridas = delRadar.length < tope ? await sugerirPrompts(tenant, Math.min(10, tope)).catch((e) => (aviso('preguntas sugeridas', tenant, e), [] as string[])) : []
  const todas = [...delRadar, ...sugeridas.filter((s) => !delRadar.some((r) => igual(r, s)))].slice(0, Math.min(10, tope))
  if (todas.length === 0) return 0
  await store.addCitationPrompts(tenant.id, todas, 'agent')
  return todas.length
}

/**
 * Lo que pasa solo cuando empieza Pro. No cobra créditos: es el arranque del
 * plan, no un pedido del dueño. Cada paso sigue aunque el anterior falle.
 */
export async function arranquePro(tenant: Tenant, idioma: Idioma): Promise<{ preguntas: number; plan: boolean; tareas: number } | { omitido: string }> {
  if (!esActivo(tenant)) return { omitido: 'sin Pro' }
  if (enCurso.has(tenant.id)) return { omitido: 'en curso' }
  enCurso.add(tenant.id)
  try {
    await arranqueGratis(tenant).catch((e) => aviso('revisión', tenant, e))
    const preguntas = await sembrarPreguntas(tenant).catch((e) => (aviso('preguntas', tenant, e), 0))
    let plan = false
    if (!(await store.getPlan(tenant.id).catch(() => null))) {
      // generarPlan lanza la primera medición con las preguntas que ya quedaron sembradas.
      plan = await generarPlan(tenant, planPorDefecto(idioma)).then(
        () => true,
        (e) => (aviso('plan por defecto', tenant, e), false),
      )
    }
    // Sin plan (falló el modelo) igual se mide: las preguntas ya están.
    if (!plan && preguntas > 0 && motoresDisponibles().length > 0 && (await store.listCitationRuns(tenant.id, 1)).length === 0) {
      await correrRonda(tenant).catch((e) => aviso('primera medición', tenant, e))
    }
    const r = await generarTareas(tenant, { conContenido: true }).catch((e) => (aviso('tareas', tenant, e), null))
    return { preguntas, plan, tareas: r?.creadas ?? 0 }
  } finally {
    enCurso.delete(tenant.id)
  }
}
