import type { AgentTask } from '@peaje/db'
import { gatewayUrl } from '@/lib/config'
import { PageHeader, SectionBar } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { Buscar, Clave, ListaTareas } from './partes'
import { Plan } from './plan'
import { Chat } from './chat'
import { TelegramPanel } from './telegram'
import { leerCitacion, leerPlan, leerTelegram } from '@/lib/gateway'
import { CitacionPanel } from './citacion'
// ---- M7 ----
import { CompradorPanel } from './comprador'

/**
 * Mi agente: el agente Pro de este negocio. Propone tareas; el coding agent
 * del dueño las aplica por MCP o CLI; Peaje las verifica en vivo. Reemplaza
 * al "Mis agentes" global (compradores), que queda solo para uso interno.
 */
export default async function MiAgente({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  const [tareas, plan, mensajes] = await Promise.all([
    store.listTasks(tenant.id).catch((): AgentTask[] => []),
    leerPlan(tenant.slug).catch(() => null),
    store.listMessages(tenant.id, 50).catch(() => []),
  ])
  const [citacion, telegram] = await Promise.all([leerCitacion(tenant.slug).catch(() => null), leerTelegram(tenant.slug).catch(() => null)])
  // ---- M6: resultado a 2 y 6 semanas de cada tarea verificada ----
  const seguimientos = await store.listFollowups(tenant.id, 200).catch(() => [])
  // ---- M7: última corrida del comprador misterioso ----
  const comprador = await store.lastMysteryRun(tenant.id).catch(() => null)
  const mcpUrl = `${gatewayUrl}/_owner/mcp`

  const abiertas = tareas.filter((x) => x.status === 'open' || x.status === 'in_progress')
  const esperando = tareas.filter((x) => x.status === 'done')
  const cerradas = tareas.filter((x) => x.status === 'verified' || x.status === 'dismissed').slice(0, 20)

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.descripcion} />

      <section className="space-y-3">
        <SectionBar label={t.chatTitulo} />
        <Chat slug={tenant.slug} inicial={mensajes} />
      </section>

      <section className="space-y-3">
        <SectionBar label={t.tgTitulo} />
        <TelegramPanel slug={tenant.slug} estado={telegram} />
      </section>

      <section className="space-y-3">
        <SectionBar label={t.citTitulo} />
        <CitacionPanel slug={tenant.slug} datos={citacion} />
      </section>

      {/* ---- M7: comprador misterioso ---- */}
      <section className="space-y-3">
        <SectionBar label={t.compTitulo} />
        <CompradorPanel slug={tenant.slug} run={comprador} />
      </section>

      <section className="space-y-3">
        <SectionBar label={t.planTitulo} />
        <Plan plan={plan} />
      </section>


      <section className="space-y-3">
        <SectionBar label={t.tareas} meta={String(abiertas.length)} />
        <Buscar slug={tenant.slug} />
        {tareas.length === 0 ? <p className="text-sm text-muted">{t.vacio}</p> : null}
        <ListaTareas slug={tenant.slug} titulo={t.grupoAbiertas} tareas={abiertas} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoEsperando} tareas={esperando} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoCerradas} tareas={cerradas} cerradas seguimientos={seguimientos} />
      </section>

      <details className="border border-border p-4">
        <summary className="cursor-pointer text-sm">{t.avanzado}</summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">{t.conectarIntro}</p>
          <Clave slug={tenant.slug} prefijo={tenant.apiKeyPrefix} mcpUrl={mcpUrl} gateway={gatewayUrl} />
        </div>
      </details>
    </div>
  )
}
