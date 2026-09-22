'use server'

import { revalidatePath } from 'next/cache'
import { getDict } from '@/lib/i18n'
import { freshScan, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { verificarIntegracion as verificar, type Chequeo, type ChequeoId } from '@peaje/shared'

export type { ChequeoId }

/** Corre (o re-corre) el scan de Ora sobre el dominio del tenant. ~30 s. */
export async function correrScore(slug: string): Promise<{ ok: boolean; error?: string }> {
  const { kit: d } = await getDict()
  const tenant = await requireTenant(slug)
  const domain = scannableDomain(tenant.originUrl)
  if (!domain) {
    return { ok: false, error: d.errorOriginLocal }
  }
  const result = await freshScan(domain)
  if (!result) return { ok: false, error: d.errorScan }
  revalidatePath(`/t/${slug}/kit`)
  return { ok: true }
}

export type ChequeoIntegracion = {
  id: ChequeoId
  label: string
  ok: boolean
  detalle: string
  /** Para el proxy: las rutas que todavía no responden desde el dominio. */
  faltantes?: string[]
}

/**
 * Qué del kit está realmente publicado en el dominio del negocio. La medición
 * vive en `@peaje/shared` (la misma que expone el gateway en /kit/verify);
 * acá solo se le ponen los textos de la UI.
 */
export async function verificarIntegracion(slug: string): Promise<ChequeoIntegracion[]> {
  const { kit: d } = await getDict()
  const tenant = await requireTenant(slug)
  const chequeos = await verificar(tenant.originUrl)
  return chequeos.map((c) => conTexto(c, d))
}

function conTexto(c: Chequeo, d: Awaited<ReturnType<typeof getDict>>['kit']): ChequeoIntegracion {
  const faltantes = c.faltantes
  switch (c.id) {
    case 'dominio':
      return { id: c.id, label: d.chequeoDominio, ok: false, detalle: d.chequeoDominioDetalle }
    case 'proxy':
      return {
        id: c.id,
        label: d.chequeoProxy,
        ok: c.ok,
        detalle:
          c.motivo === 'ok'
            ? d.chequeoProxyOk
            : c.motivo === 'proxy-nada'
              ? d.chequeoProxyFalta
              : d.chequeoProxyParcial(faltantes?.length ?? 0, c.total ?? 0),
        faltantes,
      }
    case 'frescura':
      return {
        id: c.id,
        label: d.chequeoFrescura,
        ok: c.ok,
        detalle: c.ok ? d.chequeoFrescuraOk : d.chequeoFrescuraVieja((faltantes ?? []).join(', ')),
        faltantes,
      }
    case 'json-ld':
      return { id: c.id, label: d.chequeoJsonLd, ok: c.ok, detalle: c.ok ? d.chequeoJsonLdOk : d.chequeoJsonLdFalta }
    case 'links':
      return {
        id: c.id,
        label: d.chequeoLink,
        ok: c.ok,
        detalle: c.ok ? d.chequeoLinkOk : c.motivo === 'links-sin-home' ? d.chequeoLinkSinHome : d.chequeoLinkFalta,
      }
    case 'robots':
      return {
        id: c.id,
        label: d.chequeoRobots,
        ok: c.ok,
        detalle:
          c.motivo === 'ok' ? d.chequeoRobotsOk : c.motivo === 'robots-bloquea' ? d.chequeoRobotsBloquea : d.chequeoRobotsFalta,
      }
    case 'bots': {
      const casos = (faltantes ?? []).join(', ')
      return {
        id: c.id,
        label: d.chequeoBots,
        ok: c.ok,
        detalle:
          c.motivo === 'ok'
            ? d.chequeoBotsOk
            : c.motivo === 'bots-bloqueados'
              ? d.chequeoBotsBloqueados(casos)
              : c.motivo === 'bots-challenge'
                ? d.chequeoBotsChallenge(casos)
                : d.chequeoBotsSinHtml,
        faltantes,
      }
    }
  }
}

const DESCRIPCION_MAX = 300

/**
 * Guarda los datos de entidad del negocio (Organization del JSON-LD y toggle
 * de robots). Campos vacíos se guardan como null: el builder no emite lo que
 * no hay. Devuelve el error como valor, no como excepción, para mostrarlo al
 * lado del formulario.
 */
export async function guardarEntidad(slug: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const [tenant, { kit: d }] = await Promise.all([requireTenant(slug), getDict()])
  const texto = (k: string) => String(formData.get(k) ?? '').trim()
  const oNull = (v: string) => (v ? v : null)

  const logo = texto('logoUrl')
  const sameAs = texto('sameAs')
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean)
  for (const url of [logo, ...sameAs].filter(Boolean)) {
    if (!esHttps(url)) return { ok: false, error: d.errorEntidadUrl(url) }
  }
  const descripcion = texto('descripcion')
  if (descripcion.length > DESCRIPCION_MAX) return { ok: false, error: d.errorEntidadDescripcionLarga }

  await store.updateTenantEntity(tenant.id, {
    entityLogoUrl: oNull(logo),
    entityPhone: oNull(texto('telefono')),
    entityAddress: oNull(texto('direccion').replace(/\s+/g, ' ')),
    entitySameAs: sameAs,
    entityDescription: oNull(descripcion),
    robotsBlockTraining: formData.get('bloquearEntrenamiento') === 'on',
  })
  revalidatePath(`/t/${slug}/kit`)
  return { ok: true }
}

function esHttps(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
