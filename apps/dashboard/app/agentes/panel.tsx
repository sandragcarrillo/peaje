'use client'

import type { AgentRun } from '@peaje/db'
import { AGENT_FREQUENCIES, frequencyLabel, isNetworkId, NETWORKS } from '@peaje/shared'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { money, shortWallet } from '@/lib/config'
import type { AgenteConSaldo } from '@/lib/gateway'
import { useDict, useLocale } from '@/lib/i18n/client'
import {
  barrerAgente,
  borrarAgente,
  correrAgente,
  corridasDeAgente,
  crearAgente,
  fondearAgente,
  pausarAgente,
} from './actions'
import { CuerpoMarkdown, separarFuente } from './tu-agente'

type Red = { id: string; label: string; symbol: string }
type Negocio = {
  slug: string
  nombre: string
  agentes: AgenteConSaldo[]
  disponible: Record<string, string>
}

export function AgentesPanel({ negocios, redes }: { negocios: Negocio[]; redes: Red[] }) {
  const d = useDict()
  const todos = negocios.flatMap((n) => n.agentes.map((a) => ({ agente: a, negocio: n })))
  const [creando, setCreando] = useState(todos.length === 0)

  return (
    <div className="space-y-6">
      {creando ? (
        <FormNuevo negocios={negocios} redes={redes} onCerrar={() => setCreando(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 border border-text bg-negro px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta"
        >
          {d.agentes.crear}
        </button>
      )}

      {todos.length > 0 ? (
        <ul className="space-y-3">
          {todos.map(({ agente, negocio }) => (
            <li key={agente.id}>
              <TarjetaAgente agente={agente} negocio={negocio} varios={negocios.length > 1} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FormNuevo({
  negocios,
  redes,
  onCerrar,
}: {
  negocios: Negocio[]
  redes: Red[]
  onCerrar: () => void
}) {
  const d = useDict()
  const locale = useLocale()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState(negocios[0]?.slug ?? '')
  const [entrega, setEntrega] = useState('dashboard')

  const negocio = negocios.find((n) => n.slug === slug)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const r = await crearAgente(slug, new FormData(e.currentTarget))
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 border border-border bg-panel p-5">
      <p className="text-sm font-medium">{d.agentes.nuevoAgente}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label={d.agentes.nombre}>
          <input
            name="name"
            required
            placeholder={d.agentes.nombrePlaceholder}
            className={input}
          />
        </Campo>
        <Campo label={d.agentes.cadaCuanto}>
          <select name="frequency" defaultValue="daily" className={input}>
            {AGENT_FREQUENCIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.labels[locale]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label={d.agentes.mision}>
        <textarea
          name="mission"
          required
          rows={2}
          placeholder={d.agentes.misionPlaceholder}
          className={input}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        {negocios.length > 1 ? (
          <Campo label={d.agentes.fondosDe}>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={input}>
              {negocios.map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo label={d.agentes.pagaEn}>
          <select name="network" defaultValue={redes[0]?.id} className={input}>
            {redes.map((r) => (
              <option key={r.id} value={r.id}>
                {d.agentes.opcionRed(r.label, r.symbol, money(negocio?.disponible[r.id] ?? '0'))}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label={d.agentes.topePorCompra}>
          <input name="maxPerRun" defaultValue="0.05" inputMode="decimal" className={`${input} font-mono`} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label={d.agentes.ademasDeGuardar}>
          <select
            name="deliveryKind"
            value={entrega}
            onChange={(e) => setEntrega(e.target.value)}
            className={input}
          >
            <option value="dashboard">{d.agentes.entregaDashboard}</option>
            <option value="email">{d.agentes.entregaEmail}</option>
            <option value="webhook">{d.agentes.entregaWebhook}</option>
          </select>
        </Campo>
        {entrega !== 'dashboard' ? (
          <Campo label={entrega === 'email' ? d.agentes.correo : d.agentes.urlWebhook}>
            <input
              name="deliveryTarget"
              required
              placeholder={
                entrega === 'email' ? d.agentes.correoPlaceholder : d.agentes.webhookPlaceholder
              }
              className={input}
            />
          </Campo>
        ) : null}
      </div>

      <p className="text-xs text-muted">{d.agentes.notaEntrega}</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 border border-text bg-negro px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta disabled:opacity-50"
        >
          {pending ? d.agentes.creandoWallet : d.agentes.crearAgente}
        </button>
        <button type="button" onClick={onCerrar} className="text-sm text-muted hover:text-text">
          {d.agentes.cancelar}
        </button>
        <span className="ml-auto text-xs text-muted">{d.agentes.notaWallet}</span>
      </div>
    </form>
  )
}

function TarjetaAgente({
  agente,
  negocio,
  varios,
}: {
  agente: AgenteConSaldo
  negocio: Negocio
  varios: boolean
}) {
  const d = useDict()
  const router = useRouter()
  const locale = useLocale()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null)
  const [monto, setMonto] = useState('0.10')
  const [corridas, setCorridas] = useState<AgentRun[] | null>(null)

  const slug = negocio.slug
  const red = isNetworkId(agente.network) ? NETWORKS[agente.network] : null
  const saldo = Number(agente.balance ?? 0)
  const disponible = Number(negocio.disponible[agente.network] ?? 0)

  async function accion(
    nombre: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    exito?: string,
  ) {
    setOcupado(nombre)
    setAviso(null)
    try {
      const r = await fn()
      if (r.ok) {
        // Confirmar también cuando sale bien: un botón mudo parece roto.
        if (exito) setAviso({ texto: exito, ok: true })
        router.refresh()
      } else {
        setAviso({ texto: r.error ?? d.agentes.fallo, ok: false })
      }
    } finally {
      setOcupado(null)
    }
  }

  async function verCorridas() {
    if (corridas) return setCorridas(null)
    setOcupado('corridas')
    try {
      setCorridas(await corridasDeAgente(slug, agente.id))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <article className="border border-border bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {agente.name}
            <EstadoBadge status={agente.status} />
            {agente.erc8004AgentId ? (
              <span
                className="ml-2 rounded border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase text-accent"
                title={d.agentes.registradoErc(agente.erc8004AgentId)}
              >
                ERC-8004 #{agente.erc8004AgentId}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-muted">{agente.mission}</p>
          <p className="mt-2 font-mono text-xs text-muted">
            {shortWallet(agente.walletAddress)} · {red?.label ?? agente.network} ·{' '}
            {frequencyLabel(agente.frequency, locale)} · {d.agentes.corridas(agente.runsCount)}
            {varios ? ` · ${d.agentes.fondosDeNegocio(negocio.nombre)}` : ''}
            {agente.deliveryKind !== 'dashboard' && agente.deliveryTarget
              ? ` · ${d.agentes.avisaA(agente.deliveryTarget)}`
              : ''}
            {agente.nextRunAt
              ? ` · ${d.agentes.proxima(
                  new Date(agente.nextRunAt).toLocaleDateString(d.agentes.fechaLocale, {
                    day: '2-digit',
                    month: 'short',
                  }),
                )}`
              : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl tabular-nums">{money(saldo)}</p>
          <p className="text-xs text-muted">{d.agentes.presupuesto(red?.tokenSymbol ?? '')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
        />
        <Boton
          onClick={() =>
            accion('fondear', () => fondearAgente(slug, agente.id, monto), d.agentes.fondeoOk(`$${monto}`))
          }
          disabled={ocupado !== null || disponible <= 0}
          cargando={ocupado === 'fondear'}
          titulo={
            disponible <= 0 ? d.agentes.sinSaldoEn(red?.label ?? agente.network) : undefined
          }
        >
          {d.agentes.fondear}
        </Boton>
        <Boton
          onClick={() => accion('correr', () => correrAgente(slug, agente.id))}
          disabled={ocupado !== null || saldo <= 0}
          cargando={ocupado === 'correr'}
          principal
        >
          {d.agentes.correrAhora}
        </Boton>
        <Boton
          onClick={() => accion('pausar', () => pausarAgente(slug, agente.id))}
          disabled={ocupado !== null}
          cargando={ocupado === 'pausar'}
        >
          {agente.status === 'paused' ? d.agentes.reanudar : d.agentes.pausar}
        </Boton>
        <Boton
          onClick={() => accion('barrer', () => barrerAgente(slug, agente.id))}
          disabled={ocupado !== null || saldo <= 0}
          cargando={ocupado === 'barrer'}
          titulo={d.agentes.devolverSaldoTitulo}
        >
          {d.agentes.devolverSaldo}
        </Boton>
        <Boton onClick={verCorridas} disabled={ocupado !== null} cargando={ocupado === 'corridas'}>
          {corridas ? d.agentes.ocultar : d.agentes.verResultados}
        </Boton>
        <Boton
          onClick={() => accion('borrar', () => borrarAgente(slug, agente.id))}
          disabled={ocupado !== null}
          cargando={ocupado === 'borrar'}
          titulo={saldo > 0 ? d.agentes.borrarTitulo : undefined}
        >
          {d.agentes.borrar}
        </Boton>
      </div>

      {aviso ? (
        <p className={`mt-3 flex items-center gap-2 text-sm ${aviso.ok ? 'text-accent' : 'text-amber-500'}`}>
          {aviso.ok ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          {aviso.texto}
        </p>
      ) : null}
      {corridas ? <Resultados runs={corridas} /> : null}
    </article>
  )
}

/** El historial del agente: acá es donde la persona lee lo que compró. */
export function Resultados({ runs }: { runs: AgentRun[] }) {
  const d = useDict()
  if (runs.length === 0) {
    return <p className="mt-4 text-sm text-muted">{d.agentes.sinCompras}</p>
  }
  return (
    <ul className="mt-4 space-y-4 border-t border-border pt-4">
      {runs.map((r) => (
        <Resultado key={r.id} run={r} />
      ))}
    </ul>
  )
}

function Resultado({ run }: { run: AgentRun }) {
  const d = useDict()
  const [abierto, setAbierto] = useState(false)
  const decision = (run.decision ?? {}) as {
    mercado?: { consultados?: number; conReputacionOnchain?: number }
    justificacion?: string | null
    elegido?: { nombre?: string } | null
    codigo?: string | null
  }
  const crudo = run.result ?? run.resultExcerpt
  // Una corrida vieja puede traer HTML comprado tal cual: no se vomita en la
  // tarjeta. Se muestra una nota y el HTML queda plegado como texto.
  const esHtml = crudo !== null && /^\s*<!doctype|^\s*<html/i.test(crudo)
  const cuerpo = crudo

  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span
          className={
            run.status === 'success'
              ? 'text-accent'
              : run.status === 'failed'
                ? 'text-red-600'
                : 'text-amber-700'
          }
        >
          ●
        </span>
        <span className="text-muted">
          {new Date(run.createdAt).toLocaleString(d.agentes.fechaLocale, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {decision.elegido?.nombre ? (
          <span className="text-text">{decision.elegido.nombre}</span>
        ) : null}
        {run.amount ? <span>{money(run.amount)}</span> : null}
        {run.deliveredAt ? <span className="text-muted">· {d.agentes.avisado}</span> : null}
        {run.deliveryError ? (
          <span className="text-amber-700" title={run.deliveryError}>
            · {d.agentes.noSePudoAvisar}
          </span>
        ) : null}
        {decision.mercado?.consultados ? (
          <span className="text-muted">
            ·{' '}
            {d.agentes.evaluo(
              decision.mercado.consultados,
              decision.mercado.conReputacionOnchain ?? 0,
            )}
          </span>
        ) : null}
      </div>

      {run.error ? (
        <p className="mt-1 text-xs text-amber-500">{traducirErrorDeCorrida(run.error, decision.codigo, d)}</p>
      ) : null}

      {cuerpo ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className="text-xs text-accent hover:underline"
          >
            {abierto
              ? d.agentes.ocultarResultado
              : esHtml
                ? d.agentes.verHtml(Math.max(1, Math.round((cuerpo?.length ?? 0) / 1024)))
                : d.agentes.leerResultado}
          </button>
          {abierto ? (
            esHtml ? (
              <pre className="mt-2 max-h-80 overflow-auto border border-border bg-bg p-3 text-[11px] whitespace-pre-wrap text-muted">
                {cuerpo}
              </pre>
            ) : (
              <div className="mt-2 max-h-96 overflow-auto border border-border bg-bg p-4">
                <CuerpoMarkdown texto={separarFuente(cuerpo ?? '').cuerpo} />
                {separarFuente(cuerpo ?? '').fuente ? (
                  <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] break-all text-muted">
                    {d.agentes.fuenteComprada}: {separarFuente(cuerpo ?? '').fuente}
                  </p>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Los errores de corridas se guardan en español (los escribe el gateway).
 * Acá se mapean a la copy del idioma del UI: por código cuando existe, y por
 * prefijo para las corridas viejas que no lo traen.
 */
export function traducirErrorDeCorrida(
  error: string,
  codigo: string | null | undefined,
  d: ReturnType<typeof useDict>,
): string {
  if (codigo === 'fondos') return d.agentes.faltaSaldoCompra
  if (codigo === 'sin-match') return d.agentes.sinPlan
  if (error.startsWith('Sin presupuesto') || error.startsWith('Falta saldo')) {
    return d.agentes.faltaSaldoCompra
  }
  if (error.startsWith('Ningún servicio') || error.startsWith('No compré nada')) {
    return d.agentes.sinPlan
  }
  return error
}

function EstadoBadge({ status }: { status: string }) {
  const d = useDict()
  const estilos: Record<string, string> = {
    idle: 'text-accent border-accent/40',
    running: 'text-amber-700 border-amber-600/50',
    paused: 'text-muted border-border',
    done: 'text-muted border-border',
  }
  const labels: Record<string, string> = {
    idle: d.agentes.estadoActivo,
    running: d.agentes.estadoCorriendo,
    paused: d.agentes.estadoPausado,
    done: d.agentes.estadoTerminado,
  }
  return (
    <span
      className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase ${estilos[status] ?? 'text-muted border-border'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

function Boton({
  children,
  onClick,
  disabled,
  cargando,
  principal,
  titulo,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  cargando?: boolean
  principal?: boolean
  titulo?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className={`rounded-lg px-3 py-1.5 text-xs disabled:opacity-40 ${
        principal
          ? 'bg-text font-medium text-bg'
          : 'border border-border text-muted hover:border-accent hover:text-text'
      }`}
    >
      {cargando ? '…' : children}
    </button>
  )
}

const input =
  'w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
