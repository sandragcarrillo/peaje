import 'server-only'

/** Cliente mínimo del API público de Ora (ora.ai). Reads sin key. */

export type OraCheck = {
  id: string
  name: string
  description?: string
  status: 'pass' | 'fail' | 'warning' | 'na' | 'not_applicable' | string
  score: number
  maxScore: number
  recommendation?: string
  estScoreGain?: number | null
}

export type OraLayer = { id: string; name: string; checks: OraCheck[] }

export type OraScore = {
  domain: string
  score: number
  maxScore: number
  grade: string
  analysisStatus: string
  scannedAt?: string
  layers: OraLayer[]
}

const BASE = 'https://ora.ai/api'

/**
 * Dominio a escanear: Ora audita el WEBSITE del negocio, no el host de la API.
 * `api.open-meteo.com` → `open-meteo.com`. Solo dominios públicos.
 */
export function scannableDomain(originUrl: string): string | null {
  try {
    let host = new URL(originUrl).hostname
    if (host === 'localhost' || host.endsWith('.local') || /^[0-9.]+$/.test(host)) return null
    // Subdominios típicos de API: el sitio del negocio vive en el raíz.
    host = host.replace(/^(api|gw|gateway|developers?|docs|data)\./, '')
    return host
  } catch {
    return null
  }
}

export async function cachedScore(domain: string): Promise<OraScore | null> {
  const res = await fetch(`${BASE}/score/${domain}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as OraScore & { code?: string }
  if (data.code === 'DOMAIN_NOT_SCANNED') return null
  return data
}

/** Scan fresco. Tarda ~30 s; llamar desde una server action, no en render. */
export async function freshScan(domain: string): Promise<OraScore | null> {
  const res = await fetch(`${BASE}/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: domain }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as OraScore
}

/**
 * Checks de Ora que el kit de Peaje ataca, con el bloque que los arregla.
 * `viaGateway` = lo aporta el gateway solo, sin tocar la web del tenant.
 */
export const PEAJE_FIXABLE: Record<string, { bloque: string; viaGateway?: boolean }> = {
  'llms-txt-exists': { bloque: 'llms.txt' },
  'llms-txt-formatting': { bloque: 'llms.txt' },
  'json-ld': { bloque: 'JSON-LD' },
  'json-ld-entity-linking': { bloque: 'JSON-LD' },
  'openapi-spec': { bloque: 'discovery link' },
  'mcp-well-known-discovery': { bloque: '.well-known/mcp.json' },
  'pricing-md': { bloque: 'pricing.md' },
  'pricing-info': { bloque: 'pricing.md' },
  'agent-instruction': { bloque: 'llms.txt' },
  // Archivos que el kit copia del gateway al dominio del tenant
  'ard-catalog': { bloque: '.well-known/ai-catalog.json' },
  'ard-entries-valid': { bloque: '.well-known/ai-catalog.json' },
  'a2a-agent-card': { bloque: '.well-known/agent-card.json' },
  'api-catalog-rfc9727': { bloque: '.well-known/api-catalog' },
  'auth-md-exists': { bloque: 'auth.md' },
  'auth-md-structure': { bloque: 'auth.md' },
  'agent-discovery-file': { bloque: 'agents.md' },
  // Lo aporta el gateway solo, una vez que el sitio linkea el MCP
  'mpp-support': { bloque: 'gateway MPP', viaGateway: true },
  'x402-support': { bloque: 'gateway MPP', viaGateway: true },
  'mcp-server-card': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-tool-annotations': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-tool-descriptions': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-param-schemas': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-server-identity': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-resource-listing': { bloque: 'gateway MCP', viaGateway: true },
  'mcp-transport-modern': { bloque: 'gateway MCP', viaGateway: true },
}

export type Prevision = {
  actual: number
  estimado: number
  arreglables: { check: OraCheck; bloque: string; viaGateway: boolean }[]
}

/**
 * Previsión de score con Peaje: suma el `estScoreGain` que reporta Ora para
 * cada check arreglable que hoy no pasa. Si Ora no estima ganancia (checks
 * `na`, típicamente la capa de payments), usa el maxScore del check como
 * aproximación. Es una estimación, no una promesa.
 */
export function prevision(score: OraScore): Prevision {
  const arreglables: Prevision['arreglables'] = []
  let ganancia = 0
  for (const layer of score.layers) {
    for (const check of layer.checks) {
      if (check.status === 'pass') continue
      const fix = PEAJE_FIXABLE[check.id]
      if (!fix) continue
      arreglables.push({ check, bloque: fix.bloque, viaGateway: fix.viaGateway ?? false })
      ganancia += check.estScoreGain ?? check.maxScore ?? 0
    }
  }
  return {
    actual: score.score,
    estimado: Math.min(Math.round(score.score + ganancia), score.maxScore || 100),
    arreglables,
  }
}

/** Estado de un check puntual en el scan (para condicionar el kit). */
export function checkStatus(score: OraScore | null, id: string): OraCheck['status'] | null {
  if (!score) return null
  for (const layer of score.layers) {
    const check = layer.checks.find((c) => c.id === id)
    if (check) return check.status
  }
  return null
}

/** Escala oficial de Ora (ora.ai/methodology). */
export function gradeDe(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 86) return 'A'
  if (score >= 70) return 'B'
  if (score >= 48) return 'C'
  if (score >= 28) return 'D'
  return 'F'
}
