import { accesoPro, type Tenant } from '@peaje/db'
import { claveAgente, hashApiKey, salDeClave } from '@peaje/shared'
import { gatewayUrl } from '@/lib/config'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { leerReportes, leerSlack, leerTelegram } from '@/lib/gateway'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { Integraciones } from './integraciones'

/**
 * Integraciones: dónde te habla el agente (Telegram, Slack) y las
 * herramientas desde donde le pides cambios (Claude Code, Cursor, Codex,
 * Lovable y otras con MCP). Antes se llamaba Conexiones (/conexiones redirige acá).
 */
export default async function IntegracionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  const [telegram, reportes, slack, clave] = await Promise.all([
    leerTelegram(tenant.slug).catch(() => null),
    leerReportes(tenant.slug).catch(() => null),
    leerSlack(tenant.slug).catch(() => null),
    claveVisible(tenant),
  ])
  // Antes de la migración 20261028100000 la tabla no existe: sin conexiones.
  const sesiones = await store.listOauthGrants(tenant.id, new Date().toISOString()).catch(() => [])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.integracionesTitulo} sub={t.integracionesDescripcion} />
      <Integraciones
        slug={tenant.slug}
        pro={accesoPro(tenant).activo}
        telegram={telegram}
        reportes={reportes}
        slack={slack}
        prefijo={tenant.apiKeyPrefix}
        herramientas={conectadas(tenant)}
        sesiones={sesiones.map((s) => ({ id: s.id, nombre: s.clientName || 'MCP', dias: diasDesde(s.lastUsedAt ?? s.createdAt) }))}
        claveGuardada={clave}
        mcpUrl={`${gatewayUrl}/_owner/mcp`}
        gateway={gatewayUrl}
        planHref={`/t/${tenant.slug}/agente#plan`}
      />
    </div>
  )
}

/**
 * La clave activa si se puede volver a mostrar: se deriva del secreto del
 * negocio con la sal de su prefijo y vale solo si su hash es el guardado. null
 * para las claves de antes (al azar), que no se pueden recuperar. Vive acá y no
 * en actions.ts: ahí sería una acción que el navegador puede llamar.
 */
async function claveVisible(tenant: { id: string; embedSecret: string; apiKeyPrefix?: string | null }): Promise<string | null> {
  const sal = salDeClave(tenant.apiKeyPrefix)
  if (!sal) return null
  const clave = await claveAgente(tenant.embedSecret, sal)
  const duena = await store.getTenantByApiKeyHash(await hashApiKey(clave)).catch(() => null)
  return duena?.id === tenant.id ? clave : null
}

/**
 * Las herramientas que se conectaron al MCP con la clave vigente, la más
 * reciente primero. Las de una clave anterior ya no funcionan: no salen.
 */
function conectadas(tenant: Tenant): { marca: string; nombre: string; dias: number }[] {
  return Object.entries(tenant.herramientas ?? {})
    .filter(([, h]) => h.prefijo !== null && h.prefijo === tenant.apiKeyPrefix)
    .sort(([, a], [, b]) => b.at.localeCompare(a.at))
    .map(([marca, h]) => ({ marca, nombre: h.nombre, dias: diasDesde(h.at) }))
}

const diasDesde = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
