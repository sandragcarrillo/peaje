'use client'

import type { AccesoPro, BillingPayment } from '@peaje/db'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { EstadoBilling } from '@/lib/gateway'
import { useDict, useLocale } from '@/lib/i18n/client'
import { CONTACTO } from '@/lib/legal'
import { suscripcionViva, type PaddleCliente } from '@/lib/paddle'
import { cargarPaddle, escucharPaddle, temaActual } from '@/lib/paddle-js'
import { abrirPortal, pagarConSaldo } from './actions'

type Plan = 'founder' | 'pro'
type Fecha = (iso: string | null) => string

/**
 * El plan del agente Pro. Pro se paga con tarjeta por Paddle (Merchant of
 * Record): checkout overlay de Paddle.js y, ya suscrito, "Gestionar
 * suscripción" abre el portal de Paddle. El webhook del gateway activa el plan.
 *
 * Arriba y completo cuando no hay Pro; con Pro, una línea de estado y el resto
 * plegado. El cobro en USDC solo aparece si el gateway lo tiene prendido
 * (BILLING_CRYPTO_ENABLED, apagado por defecto).
 */
export function Suscripcion({ slug, acceso, billing, paddle }: { slug: string; acceso: AccesoPro; billing: EstadoBilling | null; paddle: PaddleCliente }) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const fecha: Fecha = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '')
  const viva = suscripcionViva(paddle.status)
  const nombre = t.planNombres[acceso.plan] ?? acceso.plan

  const estado =
    acceso.plan === 'trial'
      ? t.planPrueba(fecha(acceso.hasta))
      : acceso.activo
        ? viva && !paddle.cancelAt
          ? t.planActivoRenueva(nombre, fecha(acceso.hasta))
          : t.planActivo(nombre, fecha(acceso.hasta))
        : t.planGratis

  const avisos = (
    <>
      {paddle.cancelAt ? <p className="text-sm text-muted">{t.planTermina(fecha(paddle.cancelAt))}</p> : null}
      {paddle.status === 'past_due' ? <p className="text-sm text-red-600">{t.planPagoPendiente}</p> : null}
    </>
  )
  const gestionar = paddle.canManage ? <Gestionar slug={slug} /> : null
  const pagos = billing?.payments.length ? <Pagos pagos={billing.payments} fecha={fecha} /> : null

  // Suscrito con tarjeta: no se ofrece otro checkout (pagaría dos veces).
  if (viva) {
    return (
      <div id="plan" className="space-y-3 border border-border p-4">
        <p className="text-sm">{estado}</p>
        {avisos}
        {gestionar}
        {pagos ? (
          <details>
            <summary className="cursor-pointer text-xs text-muted underline hover:text-text">{t.planVerPagos}</summary>
            <div className="mt-4">{pagos}</div>
          </details>
        ) : null}
      </div>
    )
  }

  const opciones = billing ? <Opciones slug={slug} billing={billing} paddle={paddle} fecha={fecha} /> : <p className="text-sm text-muted">{t.planSinDatos}</p>

  if (acceso.activo) {
    return (
      <div id="plan" className="space-y-3 border border-border p-4">
        <p className="text-sm">{estado}</p>
        {avisos}
        {gestionar}
        <details>
          <summary className="cursor-pointer text-xs text-muted underline hover:text-text">{t.planVerOpciones}</summary>
          <div className="mt-4 space-y-4">
            {opciones}
            {pagos}
          </div>
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
      {avisos}
      {opciones}
      {gestionar}
      {pagos}
    </div>
  )
}

function Opciones({ slug, billing, paddle, fecha }: { slug: string; billing: EstadoBilling; paddle: PaddleCliente; fecha: Fecha }) {
  const { miAgente: t } = useDict()
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

      <Checkout slug={slug} billing={billing} paddle={paddle} planes={planes} />

      {billing.crypto ? <PagoCripto slug={slug} billing={billing} planes={planes} fecha={fecha} /> : null}
    </div>
  )
}

type EstadoCheckout = 'inactivo' | 'abriendo' | 'abierto' | 'completado' | 'error'

/** Botones de suscripción: abren el checkout overlay de Paddle con el negocio en customData. */
function Checkout({ slug, billing, paddle, planes }: { slug: string; billing: EstadoBilling; paddle: PaddleCliente; planes: Plan[] }) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoCheckout>('inactivo')
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    escucharPaddle((ev) => {
      switch (ev.name) {
        case 'checkout.loaded':
          setEstado('abierto')
          break
        case 'checkout.completed':
          setEstado('completado')
          // El plan lo activa el webhook (transaction.completed), unos segundos después.
          relojes.current.push(setTimeout(() => router.refresh(), 4000), setTimeout(() => router.refresh(), 12000))
          break
        case 'checkout.closed':
          setEstado((e) => (e === 'completado' ? e : 'inactivo'))
          break
        case 'checkout.error':
          console.warn('Paddle checkout:', ev.detail ?? ev.name)
          setEstado('error')
          break
        default:
          break
      }
    })
    const r = relojes.current
    return () => {
      escucharPaddle(null)
      r.forEach(clearTimeout)
    }
  }, [router])

  const disponible = (plan: Plan) => !!paddle.clientToken && !!paddle.prices[plan]
  const hayAlguno = planes.some(disponible)

  const abrir = async (plan: Plan) => {
    const priceId = paddle.prices[plan]
    if (!paddle.clientToken || !priceId) return
    setEstado('abriendo')
    try {
      const p = await cargarPaddle(paddle.clientToken, paddle.environment)
      if (!p) throw new Error('Paddle.js did not load')
      p.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(paddle.email ? { customer: { email: paddle.email } } : {}),
        // El gateway mapea el pago a este negocio con esto; el plan lo decide el precio cobrado.
        customData: { tenantId: paddle.tenantId, slug, plan },
        settings: { displayMode: 'overlay', variant: 'one-page', theme: temaActual(), locale },
      })
    } catch (e) {
      console.warn('Paddle checkout:', e)
      setEstado('error')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t.planCobroTarjeta}</p>
      {hayAlguno ? (
        <div className="flex flex-wrap gap-3">
          {planes.filter(disponible).map((plan, i) => (
            <button key={plan} type="button" disabled={estado === 'abriendo'} onClick={() => void abrir(plan)} className={`btn ${i === 0 ? 'btn-primario' : 'btn-secundario'}`}>
              {estado === 'abriendo' ? t.planAbriendo : t.planSuscribirme(t.planNombres[plan] ?? plan, billing.prices[plan].usd)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.planTarjetaNoDisponible(CONTACTO)}</p>
      )}
      {estado === 'completado' ? <p className="text-sm">{t.planCheckoutListo}</p> : null}
      {estado === 'error' ? <p className="text-sm text-red-600">{t.planCheckoutError}</p> : null}
      <p className="text-xs text-muted">
        {t.planLegal.antes}
        <Link href="/terms" className="underline hover:text-text">
          {t.planLegal.terminos}
        </Link>
        {t.planLegal.medio}
        <Link href="/reembolsos" className="underline hover:text-text">
          {t.planLegal.reembolsos}
        </Link>
        {t.planLegal.despues}
      </p>
    </div>
  )
}

/** "Gestionar suscripción": una sesión nueva del portal de Paddle por clic (no se guarda ni se abre en iframe). */
function Gestionar({ slug }: { slug: string }) {
  const { miAgente: t } = useDict()
  const [pending, start] = useTransition()
  const [error, setError] = useState(false)
  const abrir = () =>
    start(async () => {
      setError(false)
      const r = await abrirPortal(slug)
      if (r.url) window.location.assign(r.url)
      else setError(true)
    })
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={abrir} className="btn btn-secundario btn-chico">
          {pending ? t.planAbriendoPortal : t.planGestionar}
        </button>
        <span className="text-xs text-muted">{t.planGestionarNota}</span>
      </div>
      {error ? <p className="text-sm text-red-600">{t.planPortalError}</p> : null}
    </div>
  )
}

function Pagos({ pagos, fecha }: { pagos: BillingPayment[]; fecha: Fecha }) {
  const { miAgente: t } = useDict()
  return (
    <div className="space-y-2">
      <p className="font-mono text-[11px] uppercase text-muted">{t.planPagos}</p>
      <ul className="divide-y divide-border border border-border">
        {pagos.map((p) => (
          <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
            <span>
              {t.planNombres[p.plan]} · US${Number(p.amountUsd).toFixed(2)} · {t.planMetodos[p.method] ?? p.method}
              {p.refundedAt ? ` · ${t.planReembolsado}` : ''}
            </span>
            <span className="font-mono text-xs text-muted">
              {fecha(p.periodStart)} → {fecha(p.periodEnd)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Pago en USDC (saldo de Peaje o el 402). Solo con BILLING_CRYPTO_ENABLED en el gateway. */
function PagoCripto({ slug, billing, planes, fecha }: { slug: string; billing: EstadoBilling; planes: Plan[]; fecha: Fecha }) {
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

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t.planCadaPago}</p>
      <div className="space-y-2">
        <p className="text-sm text-muted">{t.planSaldo(Number(billing.balanceAvailable).toFixed(2))}</p>
        <div className="flex flex-wrap gap-3">
          {planes.map((plan) => (
            <button key={plan} disabled={pending} onClick={() => pagar(plan)} className="btn btn-secundario">
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
        {billing.checkout.pro ? <p className="text-xs text-muted">{t.planLinkNota(billing.checkout.pro)}</p> : null}
      </div>
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
      <button onClick={copiar} className="btn btn-secundario btn-chico">
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
      <a href="#plan" className="btn btn-primario">
        {t.bloqueadoCta}
      </a>
    </div>
  )
}
