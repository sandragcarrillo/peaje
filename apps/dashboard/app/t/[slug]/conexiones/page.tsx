import { accesoPro } from '@peaje/db'
import { gatewayUrl } from '@/lib/config'
import { PageHeader, SectionBar } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { leerReportes, leerSlack, leerTelegram } from '@/lib/gateway'
import { requireTenant } from '@/lib/session'
import { SlackPanel } from '../agente/slack'
import { Bloqueado } from '../agente/suscripcion'
import { TelegramPanel } from '../agente/telegram'
import { Herramientas } from './herramientas'

/**
 * Conexiones: dónde te habla el agente (Telegram, Slack) y desde dónde le
 * pides cambios (tu herramienta de código o de diseño, por el MCP del dueño).
 * Antes vivían en Mi agente; la herramienta, escondida en "avanzado".
 */
export default async function Conexiones({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  const [telegram, reportes, slack] = await Promise.all([
    leerTelegram(tenant.slug).catch(() => null),
    leerReportes(tenant.slug).catch(() => null),
    leerSlack(tenant.slug).catch(() => null),
  ])
  const pro = accesoPro(tenant).activo

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.conexionesTitulo} sub={t.conexionesDescripcion} />

      <section id="telegram" className="scroll-mt-28 space-y-3">
        <SectionBar label={t.tgTitulo} />
        {pro ? <TelegramPanel slug={tenant.slug} estado={telegram} reportes={reportes} /> : <Bloqueado que="telegram" />}
      </section>

      {/* Solo cuando el gateway tiene la app de Slack configurada. */}
      {slack?.configured ? (
        <section id="slack" className="scroll-mt-28 space-y-3">
          <SectionBar label={t.slTitulo} />
          {pro ? <SlackPanel slug={tenant.slug} estado={slack} /> : <Bloqueado que="slack" />}
        </section>
      ) : null}

      <section id="herramienta" className="scroll-mt-28 space-y-3">
        <SectionBar label={t.herramientaTitulo} />
        <Herramientas slug={tenant.slug} prefijo={tenant.apiKeyPrefix} mcpUrl={`${gatewayUrl}/_owner/mcp`} gateway={gatewayUrl} />
      </section>
    </div>
  )
}
