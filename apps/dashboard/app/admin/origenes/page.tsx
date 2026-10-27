import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, StatTile } from '@/components/chrome'
import { requireAdmin } from '@/lib/admin-server'
import { armarOrigenes, desdeParaVentana, VENTANAS, type Cuenta, type Ventana } from '@/lib/origenes'
import { store } from '@/lib/store'

export const metadata: Metadata = { title: 'Orígenes · Peaje', robots: { index: false, follow: false } }

const VERCEL_ANALYTICS = 'https://vercel.com/sandragcarrillos-projects/peaje-dashboard/analytics'

const dia = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

function Celdas({ c }: { c: Cuenta }) {
  return (
    <>
      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{c.leads}</td>
      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{c.altas}</td>
      <td className="whitespace-nowrap px-5 py-3 text-right font-bold tabular-nums">{c.pro}</td>
    </>
  )
}

function Encabezado({ primera }: { primera: string }) {
  return (
    <thead>
      <tr className="etiqueta border-b border-border bg-panel text-muted">
        <th className="px-5 py-3 font-bold">{primera}</th>
        <th className="px-5 py-3 text-right font-bold">Leads del radar</th>
        <th className="px-5 py-3 text-right font-bold">Altas</th>
        <th className="px-5 py-3 text-right font-bold">Pro</th>
      </tr>
    </thead>
  )
}

/**
 * Panel interno: de dónde llegan los leads del radar, las altas y el Pro,
 * por origen de primer contacto (cookie peaje_origen, lib/origen.ts). Solo
 * para los correos de ADMIN_EMAILS; a los demás les responde 404. Las visitas
 * y los referrers de todo el tráfico están en Vercel Analytics.
 */
export default async function Origenes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin()
  const { dias: pedido } = await searchParams
  const dias: Ventana = pedido === '30' ? 30 : 7
  const ahora = new Date()
  const desde = desdeParaVentana(dias, ahora)
  const [leads, tenants] = await Promise.all([store.listRadarLeadsSince(desde), store.listTenantsSince(desde)])
  const { filas, totales, porDia } = armarOrigenes({ leads, tenants, dias, ahora })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Interno"
        dot
        titulo="Orígenes"
        sub="Con qué enlace llegaron los que dejaron su correo en el radar, los que dieron de alta un negocio y los que pagan Pro. Cuenta el primer contacto: ref, utm o el sitio que los mandó."
      />

      <div className="flex flex-wrap items-center gap-3">
        {VENTANAS.map((v) => (
          <Link
            key={v}
            href={`/admin/origenes?dias=${v}`}
            aria-current={v === dias ? 'page' : undefined}
            className={`btn btn-chico ${v === dias ? 'btn-primario' : 'btn-secundario'}`}
          >
            Últimos {v} días
          </Link>
        ))}
        <a href={VERCEL_ANALYTICS} target="_blank" rel="noreferrer" className="btn btn-secundario btn-chico sm:ml-auto">
          Visitas en Vercel Analytics
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Leads del radar" value={totales.leads} />
        <StatTile label="Altas" value={totales.altas} />
        <StatTile label="Pro pagado" value={totales.pro} tono="acento" />
      </div>

      <section className="border border-border bg-bg">
        <h2 className="border-b border-border p-5 text-lg font-semibold">Por origen</h2>
        {filas.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nada en estos {dias} días.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <Encabezado primera="Origen" />
              <tbody className="divide-y divide-border font-mono text-xs">
                {filas.map((f) => (
                  <tr key={f.origen ?? ''} className="hover:bg-panel-2">
                    <td className="px-5 py-3 break-all">{f.origen ?? <span className="text-muted">sin origen</span>}</td>
                    <Celdas c={f} />
                  </tr>
                ))}
                <tr className="border-t border-text bg-panel">
                  <td className="px-5 py-3 font-bold">Total</td>
                  <Celdas c={totales} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-border bg-bg">
        <h2 className="border-b border-border p-5 text-lg font-semibold">Por día</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <Encabezado primera="Día" />
            <tbody className="divide-y divide-border font-mono text-xs">
              {porDia.map((d) => (
                <tr key={d.dia} className={d.leads + d.altas + d.pro === 0 ? 'text-muted' : 'hover:bg-panel-2'}>
                  <td className="whitespace-nowrap px-5 py-3">{dia(d.dia)}</td>
                  <Celdas c={d} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-2 border-l-2 border-accent pl-4 text-sm text-muted">
        <p>
          Para atribuir un enlace, súmale <span className="font-mono text-text">?ref=nombre</span>, por ejemplo{' '}
          <span className="font-mono text-text">https://usepeaje.com/?ref=comunidad</span>. También cuentan{' '}
          <span className="font-mono">utm_source</span>, <span className="font-mono">utm_medium</span> y{' '}
          <span className="font-mono">utm_campaign</span>; sin nada de eso, el sitio que los mandó.
        </p>
        <p>
          Pro: de las altas de estos días, las que hoy tienen founder o pro vigente (la prueba no cuenta). Los días son
          de Bogotá. Sin origen: entró directo, el navegador no mandó de dónde venía o llegó antes de este panel.
        </p>
      </div>
    </div>
  )
}
