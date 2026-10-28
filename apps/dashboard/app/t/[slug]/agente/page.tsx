import type { AgentTask } from '@peaje/db'
import Link from 'next/link'
import { COBROS_VISIBLES } from '@/lib/config'
import { PageHeader, SectionBar } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { requireTenant } from '@/lib/session'
import { store } from '@/lib/store'
import { Buscar, ListaTareas } from './partes'
import { Plan } from './plan'
import { Chat } from './chat'
import { leerCitacion, leerPlan } from '@/lib/gateway'
import { CitacionPanel } from './citacion'
// ---- M7 ----
import { CompradorPanel } from './comprador'
// ---- M9: plan y cobro del agente Pro ----
import { accesoPro, CREDITOS_MENSUALES } from '@peaje/db'
import { billingDeRespaldo, leerBilling } from '@/lib/gateway'
import { Bloqueado, Suscripcion, type Arranque } from './suscripcion'
import { paddleDelNegocio } from '@/lib/paddle'
import { cachedScore, scannableDomain } from '@/lib/ora'
import { leer } from '@/app/radar/datos'

/**
 * Mi agente: el agente Pro de este negocio. Propone tareas; el coding agent
 * del dueño las aplica por MCP o CLI; Peaje las verifica en vivo. Reemplaza
 * al "Mis agentes" global (compradores), que queda solo para uso interno.
 */
export default async function MiAgente({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string }> }) {
  const [{ slug }, { m: primerMensaje }] = await Promise.all([params, searchParams])
  const [tenant, d] = await Promise.all([requireTenant(slug), getDict()])
  const t = d.miAgente
  const [tareas, plan, mensajes] = await Promise.all([
    store.listTasks(tenant.id).catch((): AgentTask[] => []),
    leerPlan(tenant.slug).catch(() => null),
    store.listMessages(tenant.id, 50).catch(() => []),
  ])
  const citacion = await leerCitacion(tenant.slug).catch(() => null)
  // ---- M6: resultado a 2 y 6 semanas de cada tarea verificada ----
  const seguimientos = await store.listFollowups(tenant.id, 200).catch(() => [])
  // ---- M7: última corrida del comprador misterioso ----
  const comprador = await store.lastMysteryRun(tenant.id).catch(() => null)
  // ---- M9: qué tiene Pro (se calcula acá; el gateway da precios, cupos y pagos) ----
  const acceso = accesoPro(tenant)
  const billing = await leerBilling(tenant.slug).catch(() => billingDeRespaldo(tenant.slug, acceso))
  const pro = acceso.activo
  // Sin Pro, la pantalla de pago muestra lo que hace el agente con los números
  // reales de este sitio (los mismos que /t/[slug]/listo). Sin score, sin números.
  const arranque = pro ? null : await arranqueDe(tenant.originUrl)

  const abiertas = tareas.filter((x) => x.status === 'open' || x.status === 'in_progress')
  const esperando = tareas.filter((x) => x.status === 'done')
  const cerradas = tareas.filter((x) => x.status === 'verified' || x.status === 'dismissed').slice(0, 20)

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${d.panel.eyebrowNegocio} / ${tenant.slug}`} titulo={t.titulo} sub={t.descripcion} />

      {/* ---- M9: plan ---- */}
      <section className="space-y-3">
        <SectionBar label={t.planSeccion} />
        <Suscripcion slug={tenant.slug} acceso={acceso} billing={billing} paddle={paddleDelNegocio(tenant)} creditos={CREDITOS_MENSUALES} arranque={arranque} />
      </section>

      <section id="chat" className="scroll-mt-28 space-y-3">
        <SectionBar label={t.chatTitulo} />
        {pro ? <Chat slug={tenant.slug} inicial={mensajes} primerMensaje={typeof primerMensaje === 'string' ? primerMensaje.slice(0, 500) : null} /> : <Bloqueado que="chat" />}
      </section>

      {/* Telegram, Slack y la herramienta del dueño viven en Conexiones. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border px-4 py-3 text-sm text-muted">
        {t.conexionesAviso}
        <Link href={`/t/${tenant.slug}/conexiones`} className="font-mono text-xs text-text underline underline-offset-4">
          {t.conexionesIr} →
        </Link>
      </p>

      <section className="space-y-3">
        <SectionBar label={t.citTitulo} />
        {pro ? <CitacionPanel slug={tenant.slug} datos={citacion} /> : <Bloqueado que="citacion" />}
      </section>

      {/* ---- M7: comprador misterioso, oculto hasta mainnet (busca en mercados de agentes y prueba el pago) ---- */}
      {COBROS_VISIBLES ? (
        <section className="space-y-3">
          <SectionBar label={t.compTitulo} />
          {pro ? <CompradorPanel slug={tenant.slug} run={comprador} /> : <Bloqueado que="comprador" />}
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionBar label={t.planTitulo} />
        {/* El plan lo arma el chat (Pro). Sin Pro y sin plan guardado, "pídeselo en el chat" mandaba a un chat bloqueado. */}
        {pro || plan ? <Plan plan={plan} /> : <Bloqueado que="plan" />}
      </section>


      <section className="space-y-3">
        <SectionBar label={t.tareas} meta={String(abiertas.length)} />
        <Buscar slug={tenant.slug} />
        {tareas.length === 0 ? <p className="text-sm text-muted">{t.vacio}</p> : null}
        <ListaTareas slug={tenant.slug} titulo={t.grupoAbiertas} tareas={abiertas} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoEsperando} tareas={esperando} />
        <ListaTareas slug={tenant.slug} titulo={t.grupoCerradas} tareas={cerradas} cerradas seguimientos={seguimientos} />
      </section>
    </div>
  )
}

/** Puntaje de hoy, arreglos que cubre Peaje y puntaje estimado con ellos. Null sin dominio público o sin score. */
async function arranqueDe(originUrl: string): Promise<Arranque | null> {
  const domain = scannableDomain(originUrl)
  const score = domain ? await cachedScore(domain).catch(() => null) : null
  if (!score) return null
  const l = leer(score)
  const actual = Math.round(l.actual)
  return { actual, max: l.max, arreglos: l.arreglables.length, estimado: l.estimado > actual ? l.estimado : null }
}
