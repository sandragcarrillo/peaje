import type { AgentRun } from '@peaje/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  listAgents,
  listAgentRuns,
  marketCapacidades,
  type AgenteConSaldo,
  type Capacidad,
} from '@/lib/gateway'
import { Eyebrow } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { listMyTenants } from '@/lib/session'
import { ActivarAgente, TuAgente } from './tu-agente'

/**
 * Tu agente: un agente comprador por cuenta. La persona le pide cosas en
 * lenguaje natural, ve qué compraría y a qué precio, y confirma. Los agentes
 * son de la PERSONA. Se fondean mandando fondos a la dirección del agente.
 */
export default async function Agentes() {
  const [tenants, d] = await Promise.all([listMyTenants(), getDict()])
  if (tenants.length === 0) redirect('/acceder')

  const porNegocio = await Promise.all(
    tenants.map(async (t) => {
      const { agents } = await listAgents(t.slug).catch(() => ({ agents: [] as AgenteConSaldo[] }))
      return { slug: t.slug, nombre: t.name, agentes: agents }
    }),
  )

  // El principal es el más reciente; el resto queda en una lista compacta.
  const todos = porNegocio
    .flatMap((n) => n.agentes.map((a) => ({ agente: a, negocio: n })))
    .toSorted((a, b) => b.agente.createdAt.localeCompare(a.agente.createdAt))
  const principal = todos[0] ?? null

  const [corridas, capacidades] = await Promise.all([
    principal
      ? listAgentRuns(principal.negocio.slug, principal.agente.id)
          .then((r) => r.runs as AgentRun[])
          .catch(() => [] as AgentRun[])
      : Promise.resolve([] as AgentRun[]),
    marketCapacidades()
      .then((r) => r.capacidades)
      .catch(() => [] as Capacidad[]),
  ])

  return (
    <div className="space-y-8 py-2">
      <header className="max-w-2xl">
        <Eyebrow>{d.agentes.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-2xl font-semibold">
          {principal ? d.agentes.tuAgente : d.agentes.titulo}
        </h1>
        <p className="mt-2 text-sm text-muted">{d.agentes.intro}</p>
      </header>

      {principal ? (
        <TuAgente
          agente={principal.agente}
          negocio={principal.negocio}
          corridas={corridas}
          capacidades={capacidades}
        />
      ) : (
        <ActivarAgente negocio={porNegocio[0]!} />
      )}

      {!principal ? (
        <p className="text-sm text-muted">
          {d.agentes.sinVentasPre}{' '}
          <Link href={`/t/${tenants[0]!.slug}`} className="text-accent underline">
            {d.agentes.sinVentasLink}
          </Link>{' '}
          {d.agentes.sinVentasPost}
        </p>
      ) : null}
    </div>
  )
}
