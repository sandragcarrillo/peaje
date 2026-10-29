'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useDict, useLocale } from '@/lib/i18n/client'
import { CONTACTO } from '@/lib/legal'
import type { DestinoAgente, EstadoPagoListo, Simulacion } from '@/lib/pago-listo'
import { useConectarTelegram } from '../../t/[slug]/agente/telegram'

const CADA_MS = 3000
const LIMITE_MS = 60_000

/**
 * La pantalla de "pago listo". Mientras el webhook de Paddle no activó el
 * plan ('activando') pregunta el estado cada 3 s; a los 60 s sin novedad pasa
 * a 'lento' (el pago está hecho, la activación tarda) sin dejar de mostrar el
 * camino al agente.
 */
export function EstadoPago({ inicial, txn, slug, simular }: { inicial: EstadoPagoListo; txn: string | null; slug: string | null; simular: Simulacion | null }) {
  const { pago, miAgente } = useDict()
  const t = pago.exito
  const locale = useLocale()
  const [estado, setEstado] = useState(inicial)
  const [lento, setLento] = useState(simular === 'lento')

  const esperando = estado.estado === 'activando' && !lento

  useEffect(() => {
    if (!esperando) return
    const desde = Date.now()
    const q = new URLSearchParams()
    if (txn) q.set('txn', txn)
    if (slug) q.set('slug', slug)
    if (simular) {
      q.set('simular', simular)
      q.set('desde', String(desde))
    }
    let vivo = true
    const reloj = setInterval(async () => {
      if (Date.now() - desde >= LIMITE_MS) {
        clearInterval(reloj)
        if (vivo) setLento(true)
        return
      }
      try {
        const res = await fetch(`/api/pago/estado?${q}`, { cache: 'no-store' })
        if (!res.ok) return
        const nuevo = (await res.json()) as EstadoPagoListo
        if (vivo && nuevo.estado !== 'activando') {
          clearInterval(reloj)
          setEstado(nuevo)
        }
      } catch {
        // Red caída un momento: el próximo intento vuelve a preguntar.
      }
    }, CADA_MS)
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [esperando, txn, slug, simular])

  const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const destino = estado.estado === 'sin_sesion' ? null : estado.destino
  const agente = destino ? `/t/${destino.slug}/agente` : null

  const [titulo, nota] =
    estado.estado === 'activo'
      ? [t.activo, t.activoNota]
      : estado.estado === 'sin_sesion'
        ? [t.sinSesion, t.sinSesionNota]
        : estado.estado === 'desconocido'
          ? [t.desconocido, t.desconocidoNota(CONTACTO)]
          : lento
            ? [t.lento, t.lentoNota(CONTACTO)]
            : [t.activando, t.activandoNota]

  const mostrarPasos = estado.estado === 'activo' || estado.estado === 'activando'

  return (
    <div className="mx-auto max-w-xl space-y-8 py-12">
      <header>
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${estado.estado === 'activo' ? 'bg-accent' : 'bg-muted'} ${esperando ? 'animate-pulse' : ''}`} />
          {t.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{titulo}</h1>
        <p className="mt-3 text-[15px] text-muted" role="status" aria-live="polite">
          {nota}
        </p>
      </header>

      {estado.estado === 'activo' ? (
        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <Dato etiqueta={t.etiquetaPlan} valor={miAgente.planNombres[estado.plan] ?? estado.plan} />
          <Dato etiqueta={t.etiquetaMonto} valor={t.montoUsd(estado.montoUsd)} />
          <Dato etiqueta={t.etiquetaHasta} valor={fecha(estado.hasta)} />
        </dl>
      ) : null}

      {estado.estado === 'activo' || estado.estado === 'activando' ? <p className="text-sm">{t.recibo}</p> : null}

      {mostrarPasos && destino ? <Pasos destino={destino} activo={estado.estado === 'activo'} /> : null}

      <div className="flex flex-wrap gap-3">
        {estado.estado === 'sin_sesion' ? (
          <Link href="/acceder" className="btn btn-primario">
            {t.entrar}
          </Link>
        ) : agente ? (
          <Link href={agente} className="btn btn-primario">
            {t.irAgente}
          </Link>
        ) : (
          <Link href="/negocios" className="btn btn-primario">
            {t.irNegocios}
          </Link>
        )}
      </div>

      {txn && (lento || estado.estado === 'desconocido') ? (
        <p className="font-mono text-xs text-muted">
          {t.etiquetaCodigo}: <span className="select-all text-text">{txn}</span>
        </p>
      ) : null}

      <p className="text-xs text-muted">{pago.pie(CONTACTO)}</p>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="bg-bg p-4">
      <dt className="font-mono text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-2 text-lg font-medium tabular-nums">{valor}</dd>
    </div>
  )
}

/**
 * Qué sigue, cada paso con su acción. Telegram usa el mismo flujo que el
 * panel de Mi agente (enlace de un solo uso del gateway); "Armar mi plan"
 * abre el chat con el mensaje ya mandado (?m=). Telegram y el plan necesitan
 * el plan activo: mientras se activa, esos botones esperan.
 */
function Pasos({ destino, activo }: { destino: DestinoAgente; activo: boolean }) {
  const { pago } = useDict()
  const t = pago.exito
  const telegram = useConectarTelegram(destino.slug)
  const agente = `/t/${destino.slug}/agente`
  const radar = destino.dominio ? `/radar?d=${encodeURIComponent(destino.dominio)}` : '/radar'
  const plan = `/t/${destino.slug}/chat?m=${encodeURIComponent(t.pasoPlan.mensaje)}`

  const pasos = [
    {
      ...t.pasoTelegram,
      accion: telegram.enlace ? (
        <a href={telegram.enlace} target="_blank" rel="noreferrer" className="btn btn-secundario btn-chico">
          {t.pasoTelegram.boton}
        </a>
      ) : (
        <button type="button" disabled={!activo || telegram.pending} onClick={telegram.conectar} className="btn btn-secundario btn-chico">
          {t.pasoTelegram.boton}
        </button>
      ),
      error: telegram.error,
      espera: !activo && !telegram.enlace,
    },
    {
      ...t.pasoPlan,
      accion: activo ? (
        <Link href={plan} className="btn btn-secundario btn-chico">
          {t.pasoPlan.boton}
        </Link>
      ) : (
        <button type="button" disabled className="btn btn-secundario btn-chico">
          {t.pasoPlan.boton}
        </button>
      ),
      error: null,
      espera: !activo,
    },
    {
      ...t.pasoRadar,
      accion: (
        <Link href={radar} className="btn btn-secundario btn-chico">
          {t.pasoRadar.boton}
        </Link>
      ),
      error: null,
      espera: false,
    },
  ]

  return (
    <section className="space-y-3">
      <p className="font-mono text-xs text-muted">{t.pasosTitulo}</p>
      <ol className="divide-y divide-border rounded-lg border border-border">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-4 px-4 py-4">
            <span className="font-mono text-xs text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium">{p.titulo}</p>
              <p className="text-sm text-muted">{p.texto}</p>
              <div className="pt-1">{p.accion}</div>
              {p.espera ? <p className="text-xs text-muted">{t.esperaActivacion}</p> : null}
              {p.error ? <p className="text-sm text-red-600">{p.error}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
