import type { AgentTask } from '@peaje/db'
import { gatewayUrl } from '@/lib/config'
import { PageHeader, SectionBar } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { Buscar, Clave, ListaTareas } from './partes'

/**
 * Mi agente: el agente Pro de este negocio. Propone tareas; el coding agent
 * del dueño las aplica por MCP o CLI; Peaje las verifica en vivo. Reemplaza
 * al "Mis agentes" global (compradores), que queda solo para uso interno.
 */
export default async function MiAgente({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  const tareas: AgentTask[] = await store.listTasks(tenant.id).catch(() => [])
  const mcpUrl = `${gatewayUrl}/_owner/mcp`

  const abiertas = tareas.filter((x) => x.status === 'open' || x.status === 'in_progress')
  const esperando = tareas.filter((x) => x.status === 'done')
  const cerradas = tareas.filter((x) => x.status === 'verified' || x.status === 'dismissed').slice(0, 20)

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.descripcion} />

      <section className="space-y-3">
        <SectionBar label={t.conectar} />
        <p className="text-sm text-muted">{t.conectarIntro}</p>
        <Clave slug={tenant.slug} prefijo={tenant.apiKeyPrefix} mcpUrl={mcpUrl} gateway={gatewayUrl} />
      </section>

      <section className="space-y-3">
        <SectionBar label={t.tareas} meta={String(abiertas.length)} />
        <Buscar slug={tenant.slug} />
        {tareas.length === 0 ? <p className="text-sm text-muted">{t.vacio}</p> : null}
        <ListaTareas slug={tenant.slug} titulo={t.grupoAbiertas} tareas={abiertas} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoEsperando} tareas={esperando} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoCerradas} tareas={cerradas} cerradas />
      </section>
    </div>
  )
}
