'use server'

import { revalidatePath } from 'next/cache'
import { getDict } from '@/lib/i18n'
import { freshScan, scannableDomain } from '@/lib/ora'
import { requireTenant } from '@/lib/session'

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
  id: string
  label: string
  ok: boolean
  detalle: string
}

async function fetchCorto(url: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'peaje-verificador/1.0' },
    })
    if (!res.ok) return { ok: false, text: '' }
    return { ok: true, text: await res.text() }
  } catch {
    return { ok: false, text: '' }
  }
}

/**
 * "Ya lo integré": verifica desde nuestro lado qué bloques del kit están
 * realmente publicados en el dominio del tenant. Cada chequeo hace un fetch
 * real; verde solo si el archivo existe Y referencia al gateway de Peaje.
 */
export async function verificarIntegracion(slug: string): Promise<ChequeoIntegracion[]> {
  const { kit: d } = await getDict()
  const tenant = await requireTenant(slug)
  const { scannableDomain } = await import('@/lib/ora')
  const domain = scannableDomain(tenant.originUrl)
  if (!domain) {
    return [
      {
        id: 'dominio',
        label: d.chequeoDominio,
        ok: false,
        detalle: d.chequeoDominioDetalle,
      },
    ]
  }

  const site = `https://${domain}`
  const gatewayMark = `/${tenant.slug}`

  const [home, llms, pricing, aiCatalog, agentCard, apiCatalog, authMd, agentsMd, mcpJson, robots] =
    await Promise.all([
      fetchCorto(site),
      fetchCorto(`${site}/llms.txt`),
      fetchCorto(`${site}/pricing.md`),
      fetchCorto(`${site}/.well-known/ai-catalog.json`),
      fetchCorto(`${site}/.well-known/agent-card.json`),
      fetchCorto(`${site}/.well-known/api-catalog`),
      fetchCorto(`${site}/auth.md`),
      fetchCorto(`${site}/agents.md`),
      fetchCorto(`${site}/.well-known/mcp.json`),
      fetchCorto(`${site}/robots.txt`),
    ])

  const refiere = (r: { ok: boolean; text: string }) => r.ok && r.text.includes(gatewayMark)

  return [
    {
      id: 'llms',
      label: d.chequeoLlms,
      ok: refiere(llms),
      detalle: llms.ok
        ? refiere(llms)
          ? d.chequeoLlmsOk
          : d.chequeoLlmsSinGateway
        : d.chequeoLlmsFalta,
    },
    {
      id: 'link-discovery',
      label: d.chequeoLink,
      ok: home.ok && home.text.includes('payment-discovery'),
      detalle: home.ok
        ? home.text.includes('payment-discovery')
          ? d.chequeoLinkOk
          : d.chequeoLinkFalta
        : d.chequeoLinkSinHome,
    },
    {
      id: 'json-ld',
      label: d.chequeoJsonLd,
      ok: home.ok && home.text.includes('application/ld+json'),
      detalle:
        home.ok && home.text.includes('application/ld+json')
          ? d.chequeoJsonLdOk
          : d.chequeoJsonLdFalta,
    },
    {
      id: 'pricing',
      label: d.chequeoPricing,
      ok: refiere(pricing),
      detalle: pricing.ok
        ? refiere(pricing)
          ? d.chequeoPricingOk
          : d.chequeoPricingOtro
        : d.chequeoPricingFalta,
    },
    {
      id: 'mcp-json',
      label: d.chequeoMcp,
      ok: refiere(mcpJson),
      detalle: refiere(mcpJson) ? d.chequeoMcpOk : d.chequeoMcpFalta,
    },
    {
      id: 'ai-catalog',
      label: d.chequeoAiCatalog,
      ok: refiere(aiCatalog),
      detalle: refiere(aiCatalog) ? d.chequeoAiCatalogOk : d.chequeoAiCatalogFalta,
    },
    {
      id: 'agent-card',
      label: d.chequeoAgentCard,
      ok: refiere(agentCard),
      detalle: refiere(agentCard) ? d.chequeoAgentCardOk : d.chequeoAgentCardFalta,
    },
    {
      id: 'api-catalog',
      label: d.chequeoApiCatalog,
      ok: refiere(apiCatalog),
      detalle: refiere(apiCatalog) ? d.chequeoApiCatalogOk : d.chequeoApiCatalogFalta,
    },
    {
      id: 'auth-md',
      label: d.chequeoAuthMd,
      ok: refiere(authMd),
      detalle: refiere(authMd) ? d.chequeoAuthMdOk : d.chequeoAuthMdFalta,
    },
    {
      id: 'agents-md',
      label: d.chequeoAgentsMd,
      ok: refiere(agentsMd),
      detalle: refiere(agentsMd) ? d.chequeoAgentsMdOk : d.chequeoAgentsMdFalta,
    },
    {
      id: 'robots',
      label: d.chequeoRobots,
      ok: robots.ok,
      detalle: robots.ok ? d.chequeoRobotsOk : d.chequeoRobotsFalta,
    },
  ]
}
