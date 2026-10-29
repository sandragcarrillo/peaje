import { accesoPro } from '@peaje/db'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
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
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  if (!accesoPro(tenant).activo) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.chatTitulo} />
        <Bloqueado que="chat" plan={`/t/${tenant.slug}/agente#plan`} />
      </div>
    )
  }
  const mensajes = await store.listMessages(tenant.id, 50).catch(() => [])
  return <Chat slug={tenant.slug} inicial={mensajes} primerMensaje={typeof primerMensaje === 'string' ? primerMensaje.slice(0, 500) : null} />
}
