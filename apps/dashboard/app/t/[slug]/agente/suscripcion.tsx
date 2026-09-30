'use client'

import type { AccesoPro } from '@peaje/db'
import { useState, useTransition } from 'react'
import type { EstadoBilling } from '@/lib/gateway'
import { useDict, useLocale } from '@/lib/i18n/client'
import { pagarConSaldo } from './actions'

type Plan = 'founder' | 'pro'

/**
 * M9: el plan del agente Pro. Arriba y completo cuando no hay Pro; si lo hay,
 * una línea con el vencimiento y las opciones de pago plegadas.
 */
export function Suscripcion({ slug, acceso, billing }: { slug: string; acceso: AccesoPro; billing: EstadoBilling | null }) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

  const estado =
    acceso.plan === 'trial'
      ? t.planPrueba(fecha(acceso.hasta))
      : acceso.activo
        ? t.planActivo(t.planNombres[acceso.plan] ?? acceso.plan, fecha(acceso.hasta))
        : t.planGratis

  const opciones = billing ? <Opciones slug={slug} billing={billing} fecha={fecha} /> : <p className="text-sm text-muted">{t.planSinDatos}</p>

  if (acceso.activo) {
    return (
      <div id="plan" className="space-y-2 border border-border p-4">
        <p className="text-sm">{estado}</p>
        <details>
          <summary className="cursor-pointer text-xs text-muted underline hover:text-text">{t.planVerOpciones}</summary>
          <div className="mt-4">{opciones}</div>
        </details>
      </div>
    )
  }
  return (
    <div id="plan" className="space-y-4 border border-border p-4">
      <div className="space-y-1">
        <p className="text-lg font-semibold">{estado}</p>
        <p className="text-sm text-muted">{t.planGratisNota}</p>
      </div>
      {opciones}
    </div>
  )
}

function Opciones({ slug, billing, fecha }: { slug: string; billing: EstadoBilling; fecha: (iso: string | null) => string }) {
  const { miAgente: t } = useDict()
  const [msj, setMsj] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const pagar = (plan: Plan) =>
    start(async () => {
      setMsj(null)
      setError(null)
      const r = await pagarConSaldo(slug, plan)
      if (r.error) setError(r.error)
      else setMsj(t.planPagado(fecha(r.planUntil)))
    })

  const planes: Plan[] = billing.founder.available ? ['founder', 'pro'] : ['pro']

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(['founder', 'pro'] as Plan[]).map((plan) => {
          const p = billing.prices[plan]
          const cerrado = plan === 'founder' && !billing.founder.available
          return (
            <div key={plan} className={`space-y-2 border border-border p-4 ${cerrado ? 'opacity-60' : ''}`}>
              <p className="font-mono text-[11px] uppercase text-muted">{t.planNombres[plan]}</p>
              <p className="text-lg font-semibold">{t.planPrecio(p.usd)}</p>
              <p className="text-sm">{t.planLimites(p.limits.preguntas, p.limits.mensajes)}</p>
              {plan === 'founder' ? (
                <p className="text-xs text-muted">
                  {billing.founder.alreadyFounder ? t.planYaFounder : cerrado ? t.planFounderAgotado : t.planFounderCupos(billing.founder.slotsLeft)}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted">{t.planCadaPago}</p>

      <div className="space-y-2">
        <p className="text-sm text-muted">{t.planSaldo(Number(billing.balanceAvailable).toFixed(2))}</p>
        <div className="flex flex-wrap gap-3">
          {planes.map((plan) => (
            <button
              key={plan}
              disabled={pending}
              onClick={() => pagar(plan)}
              className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
            >
              {pending ? t.planPagando : `${t.planPagarSaldo} · ${t.planNombres[plan]} US$${billing.prices[plan].charged}`}
            </button>
          ))}
        </div>
        {msj ? <p className="text-sm">{msj}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase text-muted">{t.planLinkTitulo}</p>
        {planes.map((plan) => {
          const url = billing.checkout[plan]
          return url ? <Enlace key={plan} etiqueta={t.planNombres[plan] ?? plan} url={url} /> : null
        })}
        <p className="text-xs text-muted">{t.planLinkNota(billing.checkout.pro)}</p>
      </div>

      {billing.payments.length ? (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase text-muted">{t.planPagos}</p>
          <ul className="divide-y divide-border border border-border">
            {billing.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  {t.planNombres[p.plan]} · US${Number(p.amountUsd).toFixed(2)} · {t.planMetodos[p.method] ?? p.method}
                </span>
                <span className="font-mono text-xs text-muted">
                  {fecha(p.periodStart)} → {fecha(p.periodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Enlace({ etiqueta, url }: { etiqueta: string; url: string }) {
  const { miAgente: t } = useDict()
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    void navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-xs text-muted">{etiqueta}</span>
      <code className="min-w-0 flex-1 break-all border border-border px-2 py-1 font-mono text-xs">{url}</code>
      <button onClick={copiar} className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-text hover:text-bg">
        {copiado ? t.planCopiado : t.planCopiar}
      </button>
    </div>
  )
}

/** Lo que ven chat, Telegram, citación y comprador misterioso sin Pro. */
export function Bloqueado() {
  const { miAgente: t } = useDict()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-border p-4">
      <p className="text-sm text-muted">{t.bloqueado}</p>
      <a href="#plan" className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg">
        {t.bloqueadoCta}
      </a>
    </div>
  )
}
