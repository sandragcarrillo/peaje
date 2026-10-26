'use client'

import type { AccesoPro, BillingPayment } from '@peaje/db'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import type { EstadoBilling } from '@/lib/gateway'
import { useDict, useLocale } from '@/lib/i18n/client'
import { CONTACTO } from '@/lib/legal'
import { suscripcionViva, type PaddleCliente } from '@/lib/paddle'
import { cargarPaddle, escucharPaddle, irAPagoListo, temaActual } from '@/lib/paddle-js'
import { abrirPortal } from './actions'

type Plan = 'founder' | 'pro'
type Fecha = (iso: string | null) => string

/**
 * Los números de este sitio para "lo que hace tu agente apenas te suscribes".
 * Salen del score de Ora en el server (leer() de app/radar/datos). Sin score,
 * llega null y los pasos se muestran sin números. `estimado` es null cuando
 * los arreglos no suben el puntaje.
 */
export type Arranque = { actual: number; max: number; arreglos: number; estimado: number | null }

/**
 * El plan del agente Pro. Pro se paga con tarjeta por Paddle (Merchant of
 * Record): checkout overlay de Paddle.js y, ya suscrito, "Gestionar
 * suscripción" abre el portal de Paddle. El webhook del gateway activa el plan.
 *
 * Arriba y completo cuando no hay Pro; con Pro, una línea de estado y el resto
 * plegado. El cobro en USDC solo aparece si el gateway lo tiene prendido
 * (BILLING_CRYPTO_ENABLED, apagado por defecto).
 */
/**
 * `creditos` llega del server (CREDITOS_MENSUALES de planes.ts): este es un
 * componente cliente y no importa valores de @peaje/db.
 */
export function Suscripcion({
  slug,
  acceso,
  billing,
  paddle,
  creditos,
  arranque,
}: {
  slug: string
  acceso: AccesoPro
  billing: EstadoBilling | null
  paddle: PaddleCliente
  creditos: number
  arranque: Arranque | null
}) {
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

  const opciones = billing ? <Opciones slug={slug} billing={billing} paddle={paddle} fecha={fecha} creditos={creditos} /> : <p className="text-sm text-muted">{t.planSinDatos}</p>

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
      <LoQueHace arranque={arranque} preguntas={billing?.prices.pro.limits.preguntas ?? null} />
      {avisos}
      {opciones}
      {gestionar}
      {pagos}
    </div>
  )
}

/** Los pasos del primer trabajo del agente, con los números de este sitio cuando hay score. Nunca inventa números. */
function LoQueHace({ arranque, preguntas }: { arranque: Arranque | null; preguntas: number | null }) {
  const { miAgente: t } = useDict()
  const pasos = [
    arranque ? t.arranquePuntaje(arranque.actual, arranque.max) : t.arranquePuntajeSin,
    !arranque
      ? t.arranqueArreglosSin
      : arranque.arreglos > 0
        ? t.arranqueArreglos(arranque.arreglos, arranque.estimado, arranque.max)
        : t.arranqueArreglosNinguno,
    preguntas ? t.arranquePreguntas(preguntas) : t.arranquePreguntasSin,
    t.arranqueTelegram,
  ]
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t.arranqueTitulo}</p>
      <ol className="divide-y divide-border border border-border">
        {pasos.map((p, i) => (
          <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
            <span className="pt-0.5 font-mono text-xs text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Opciones({ slug, billing, paddle, fecha, creditos }: { slug: string; billing: EstadoBilling; paddle: PaddleCliente; fecha: Fecha; creditos: number }) {
  const { miAgente: t } = useDict()
  // Una sola oferta a la vez: founder mientras queden cupos; Pro recién cuando se acaban.
  const planes: Plan[] = billing.founder.available ? ['founder'] : ['pro']
  const { estado, abrir, disponible } = useCheckout(slug, paddle)
  const hayAlguno = planes.some(disponible)
  // Sin respuesta del gateway no se muestra founder: no se sabe si quedan cupos.
  const tarjetas: Plan[] = billing.respaldo ? ['pro'] : planes

  return (
    <div className="space-y-4">
      {/* Tarjetas con su botón y, al lado, lo que hay que saber antes de pagar. */}
      <div className={`grid gap-3 md:grid-cols-2 ${tarjetas.length > 1 ? 'lg:grid-cols-3' : ''}`}>
        {tarjetas.map((plan, i) => {
          const p = billing.prices[plan]
          const puede = planes.includes(plan) && disponible(plan)
          return (
            <div key={plan} className={`flex flex-col justify-between gap-4 border border-border p-4 `}>
              <div className="space-y-2">
                <p className="font-mono text-[11px] text-muted">{t.planNombres[plan]}</p>
                <p className="text-lg font-semibold">{t.planPrecio(p.usd)}</p>
                <p className="text-sm">{t.planLimites(p.limits.preguntas, creditos)}</p>
                {plan === 'founder' ? (
                  <p className="text-xs text-muted">
                    {/* Cuántos quedan solo cuando son pocos: con muchos libres se lee como que nadie lo usa. */}
                    {billing.founder.alreadyFounder
                      ? t.planYaFounder
                      : billing.founder.slotsLeft <= 10
                        ? t.planFounderCupos(billing.founder.slotsLeft)
                        : t.planFounderNota(billing.founder.total)}
                  </p>
                ) : null}
              </div>
              {puede ? (
                <button
                  type="button"
                  disabled={estado === 'abriendo'}
                  onClick={() => void abrir(plan)}
                  className={`btn btn-ancho ${planes.filter(disponible)[0] === plan ? 'btn-primario' : 'btn-secundario'}`}
                >
                  {estado === 'abriendo' ? t.planAbriendo : t.planSuscribirmeCorto(t.planNombres[plan] ?? plan)}
                </button>
              ) : null}
            </div>
          )
        })}

        <div className={`space-y-3 self-center ${tarjetas.length > 1 ? 'md:col-span-2 lg:col-span-1' : ''}`}>
          {hayAlguno ? <p className="text-sm">{t.planCancelas}</p> : <p className="text-sm text-muted">{t.planTarjetaNoDisponible(CONTACTO)}</p>}
          <p className="text-xs text-muted">{t.planCobroTarjeta}</p>
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
      </div>

      {billing.crypto ? <PagoCripto billing={billing} planes={planes} /> : null}
    </div>
  )
}

type EstadoCheckout = 'inactivo' | 'abriendo' | 'abierto' | 'completado' | 'error'

/** El checkout overlay de Paddle: abre con el negocio en customData y sigue sus eventos. */
function useCheckout(slug: string, paddle: PaddleCliente) {
  const locale = useLocale()
  const [estado, setEstado] = useState<EstadoCheckout>('inactivo')
  useEffect(() => {
    escucharPaddle((ev) => {
      switch (ev.name) {
        case 'checkout.loaded':
          setEstado('abierto')
          break
        case 'checkout.completed':
          setEstado('completado')
          // El plan lo activa el webhook (transaction.completed), unos segundos
          // después: /pago/listo muestra el pago y espera esa activación.
          irAPagoListo(ev, slug)
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
    return () => {
      escucharPaddle(null)
    }
  }, [slug])

  const disponible = (plan: Plan) => !!paddle.clientToken && !!paddle.prices[plan]

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
        // locale: el idioma del correo de bienvenida que manda el gateway.
        customData: { tenantId: paddle.tenantId, slug, plan, locale },
        settings: { displayMode: 'overlay', variant: 'one-page', theme: temaActual(), locale },
      })
    } catch (e) {
      console.warn('Paddle checkout:', e)
      setEstado('error')
    }
  }

  return { estado, abrir, disponible }
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
      <p className="font-mono text-[11px] text-muted">{t.planPagos}</p>
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

/** Pago con el link del 402 (cripto). Solo con BILLING_CRYPTO_ENABLED en el gateway. Pagar con saldo ya no existe: Peaje no guarda saldos. */
function PagoCripto({ billing, planes }: { billing: EstadoBilling; planes: Plan[] }) {
  const { miAgente: t } = useDict()
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t.planCadaPago}</p>
      <div className="space-y-2">
        <p className="font-mono text-[11px] text-muted">{t.planLinkTitulo}</p>
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

export type SeccionPro = 'chat' | 'telegram' | 'slack' | 'citacion' | 'comprador' | 'plan'

/** Lo que ven las secciones Pro sin Pro: qué hay ahí y cómo se activa, con el botón al plan. */
export function Bloqueado({ que }: { que: SeccionPro }) {
  const { miAgente: t } = useDict()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-border p-4">
      <p className="max-w-xl text-sm text-muted">
        {t.bloqueadoQue[que]} {t.bloqueado}
      </p>
      <a href="#plan" className="btn btn-primario">
        {t.bloqueadoCta}
      </a>
    </div>
  )
}
