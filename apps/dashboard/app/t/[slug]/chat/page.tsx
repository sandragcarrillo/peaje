import { accesoPro } from '@peaje/db'
import { PageHeader } from '@/components/chrome'
import { getDict, getLocale } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { Chat } from '../agente/chat'
import { Bloqueado } from '../agente/suscripcion'

/**
 * El chat con el agente, en su propia página: antes vivía en medio de Mi
 * agente. El endpoint sigue en /t/[slug]/agente/chat (route handler), por eso
 * la página va acá. `?m=` manda un primer mensaje (Contenido, /pago/listo).
 */
export default async function ChatPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ slug }, { m: primerMensaje }] = await Promise.all([params, searchParams])
  const [tenant, d, locale] = await Promise.all([requireTenant(slug), getDict(), getLocale()])
  const t = d.miAgente
  if (!accesoPro(tenant).activo) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.chatTitulo} />
        <Bloqueado que="chat" plan={`/t/${tenant.slug}/agente#plan`} />
      </div>
    )
  }
  const [mensajes, abiertas] = await Promise.all([store.listMessages(tenant.id, 50).catch(() => []), store.listTasks(tenant.id, { statuses: ['open'] }).catch(() => [])])
  // El chat habla primero: abre con lo que el agente propone hacer esta semana (las tareas
  // con más prioridad y lo que midió para proponerlas), en vez de esperar una pregunta.
  const es = locale === 'es'
  const propuestas = abiertas
    .filter((x) => x.priority)
    .sort((a, b) => (b.priority?.score ?? 0) - (a.priority?.score ?? 0))
    .slice(0, 3)
    .map((x) => ({
      id: x.id,
      titulo: x.priority!.label[es ? 'es' : 'en'],
      porQue: x.priority!.why[es ? 'es' : 'en'],
      impacto: x.priority!.impact,
      esfuerzo: x.priority!.effort,
      url: x.kind === 'content' ? `/t/${tenant.slug}/agente/contenido?id=${encodeURIComponent(x.id)}` : `/t/${tenant.slug}/agente/tareas/${encodeURIComponent(x.id)}`,
    }))
  return <Chat slug={tenant.slug} inicial={mensajes} propuestas={propuestas} primerMensaje={typeof primerMensaje === 'string' ? primerMensaje.slice(0, 500) : null} />
}
