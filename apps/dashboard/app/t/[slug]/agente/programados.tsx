'use client'

import { useEffect, useState, useTransition } from 'react'
import type { EstadoReportes, ReporteProgramado } from '@/lib/gateway'
import { useDict, useLocale } from '@/lib/i18n/client'
import { programarReporte, quitarReporte } from './actions'

/**
 * Reportes programados de cada chat conectado: el resumen de visitas de
 * agentes (cada cuánto, a qué hora) y la lista de pedidos que el dueño
 * programó hablando con el agente. Va dentro de la sección Telegram.
 */

const select = 'mt-1 block border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-text'
type Frecuencia = 'off' | 'daily' | 'weekly' | 'monthly'

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

function zonaDelNavegador(defecto: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || defecto
  } catch {
    return defecto
  }
}

function fechaEn(iso: string, zona: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}

export function ReportesChats({ slug, datos }: { slug: string; datos: EstadoReportes | null }) {
  if (!datos) return null
  const chats = datos.destinations.filter((d) => d.channel === 'telegram')
  if (!chats.length) return null
  return (
    <div className="space-y-4">
      {chats.map((d) => (
        <ChatReportes key={d.target} slug={slug} destino={d} defecto={datos.defaultTimezone} programas={datos.schedules.filter((s) => s.channel === d.channel && s.target === d.target)} varios={chats.length > 1} />
      ))}
    </div>
  )
}

function ChatReportes({
  slug,
  destino,
  programas,
  defecto,
  varios,
}: {
  slug: string
  destino: EstadoReportes['destinations'][number]
  programas: ReporteProgramado[]
  defecto: string
  varios: boolean
}) {
  const { miAgente: t } = useDict()
  const locale = useLocale()
  const visitas = programas.find((s) => s.kind === 'agent_visits') ?? null
  const pedidos = programas.filter((s) => s.kind === 'custom')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(visitas?.frequency ?? 'off')
  const [hora, setHora] = useState(visitas?.hour ?? 8)
  const [dia, setDia] = useState(visitas?.weekday ?? 1)
  const [diaMes, setDiaMes] = useState(visitas?.dayOfMonth ?? 1)
  const [zona, setZona] = useState(visitas?.timezone ?? defecto)
  // Sin reporte guardado, la hora es la del navegador del dueño (después de hidratar, para no chocar con el server).
  const tieneZona = !!visitas
  useEffect(() => {
    if (!tieneZona) setZona(zonaDelNavegador(defecto))
  }, [tieneZona, defecto])
  const [proximo, setProximo] = useState<string | null>(visitas?.nextRunAt ?? null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const guardar = () =>
    start(async () => {
      setError(null)
      setAviso(null)
      try {
        if (frecuencia === 'off') {
          if (visitas) await quitarReporte(slug, { channel: destino.channel, target: destino.target, kind: 'agent_visits' })
          setProximo(null)
        } else {
          const s = await programarReporte(slug, {
            channel: destino.channel,
            target: destino.target,
            kind: 'agent_visits',
            frequency: frecuencia,
            hour: hora,
            weekday: frecuencia === 'weekly' ? dia : null,
            dayOfMonth: frecuencia === 'monthly' ? diaMes : null,
            timezone: zona,
          })
          setProximo(s.nextRunAt)
        }
        setAviso(t.repGuardado)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

  const quitarPedido = (id: string) =>
    start(async () => {
      setError(null)
      try {
        await quitarReporte(slug, { id })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

  const cuando = (s: ReporteProgramado) =>
    s.frequency === 'daily' ? t.repCuando.daily(hh(s.hour)) : s.frequency === 'weekly' ? t.repCuando.weekly(hh(s.hour), t.repDias[s.weekday ?? 1] ?? '') : t.repCuando.monthly(hh(s.hour), s.dayOfMonth ?? 1)

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div>
        <p className="text-sm font-medium">
          {t.repTitulo}
          {varios ? <span className="font-normal text-muted"> · {destino.name}</span> : null}
        </p>
        <p className="text-xs text-muted">{t.repIntro}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          {t.repFrecuencia}
          <select className={select} value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)} disabled={pending}>
            {(['off', 'daily', 'weekly', 'monthly'] as const).map((f) => (
              <option key={f} value={f}>
                {t.repFrecuencias[f]}
              </option>
            ))}
          </select>
        </label>
        {frecuencia === 'weekly' ? (
          <label className="text-xs text-muted">
            {t.repDia}
            <select className={select} value={dia} onChange={(e) => setDia(Number(e.target.value))} disabled={pending}>
              {/* Lunes primero: es como lo piensa la gente. */}
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {t.repDias[d]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {frecuencia === 'monthly' ? (
          <label className="text-xs text-muted">
            {t.repDiaMes}
            <select className={select} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} disabled={pending}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {frecuencia !== 'off' ? (
          <label className="text-xs text-muted">
            {t.repHora}
            <select className={select} value={hora} onChange={(e) => setHora(Number(e.target.value))} disabled={pending}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button disabled={pending} onClick={guardar} className="btn btn-primario btn-chico">
          {t.repGuardar}
        </button>
      </div>
      {frecuencia !== 'off' ? <p className="text-xs text-muted">{t.repZona(zona)}</p> : null}
      {proximo && frecuencia !== 'off' ? <p className="text-xs text-muted">{t.repProximo(fechaEn(proximo, zona, locale))}</p> : null}
      {aviso ? <p className="text-xs text-muted">{aviso}</p> : null}

      <div className="space-y-1">
        <p className="text-xs font-medium">{t.repPedidos}</p>
        {pedidos.length ? (
          <ul className="space-y-1">
            {pedidos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span>
                  “{s.prompt}” <span className="text-muted">· {cuando(s)}</span>
                </span>
                <button disabled={pending} onClick={() => quitarPedido(s.id)} className="btn btn-secundario btn-chico hover:text-red-600">
                  {t.repQuitar}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-muted">{t.repPedidosIntro}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
