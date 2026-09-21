'use client'

import type { AgentRun } from '@peaje/db'
import { isNetworkId, NETWORKS } from '@peaje/shared'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { microMoney, money, shortWallet } from '@/lib/config'
import type { AgenteConSaldo, Capacidad, PlanDeCompra, ServicioDelPlan } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { barrerAgente, crearAgente, fondearAgente, fondearDesdeWallet, planearParaAgente, confirmarCompra } from './actions'
import { Resultados } from './panel'

/**
 * La vista de agente único: una persona le PIDE cosas a su agente y este
 * muestra qué compraría (servicio, precio, por qué) antes de gastar. La
 * cripto queda debajo del capó: saldos en dólares, wallet copiable, y listo.
 */

type Negocio = { slug: string; nombre: string; disponible: Record<string, string> }

export function TuAgente({
  agente,
  negocio,
  negocios,
  walletSaldos,
  corridas,
  capacidades,
}: {
  agente: AgenteConSaldo
  negocio: Negocio
  negocios: Negocio[]
  walletSaldos: Record<string, string>
  corridas: AgentRun[]
  capacidades: Capacidad[]
}) {
  const d = useDict()
  const [abierto, setAbierto] = useState(false)
  const sinSaldo =
    Number(agente.balanceTempo ?? 0) +
      Number(agente.balanceArc ?? 0) +
      Number(agente.balanceArbitrum ?? 0) +
      Number(agente.balanceBase ?? 0) <=
    0

  return (
    <div className="space-y-6">
      <CabeceraAgente agente={agente} negocio={negocio} negocios={negocios} walletSaldos={walletSaldos} />
      {sinSaldo ? <PasoAPaso /> : null}
      <Ask agente={agente} negocio={negocio} capacidades={capacidades} />
      {corridas.length > 0 ? (
        <section className="border border-border bg-panel p-5">
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-text"
          >
            <span>{d.agentes.resultadosPasados}</span>
            <span aria-hidden>{abierto ? '−' : '+'}</span>
          </button>
          {abierto ? <Resultados runs={corridas} /> : null}
        </section>
      ) : null}
    </div>
  )
}

/** Wallet y saldos del agente, con fondeo. Sin jerga: dólares y una dirección. */
function CabeceraAgente({
  agente,
  negocio,
  negocios,
  walletSaldos,
}: {
  agente: AgenteConSaldo
  negocio: Negocio
  negocios: Negocio[]
  walletSaldos: Record<string, string>
}) {
  const d = useDict()
  const router = useRouter()
  const [monto, setMonto] = useState('0.10')
  const [redFondeo, setRedFondeo] = useState(isNetworkId(agente.network) ? agente.network : 'tempo')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null)

  // La plata puede salir de cualquiera de tus negocios con saldo en esa red,
  // o directo de tu wallet personal.
  const WALLET = '__wallet__'
  const saldoWallet = Number(walletSaldos[redFondeo] ?? 0)
  const conSaldoEnRed = negocios.filter((n) => Number(n.disponible[redFondeo] ?? 0) > 0)
  const opciones = [
    ...conSaldoEnRed.map((n) => ({ id: n.slug, saldo: Number(n.disponible[redFondeo] ?? 0) })),
    ...(saldoWallet > 0 ? [{ id: WALLET, saldo: saldoWallet }] : []),
  ]
  const [origen, setOrigen] = useState(negocio.slug)
  const origenValido = opciones.some((o) => o.id === origen)
    ? origen
    : (opciones[0]?.id ?? negocio.slug)

  const red = isNetworkId(agente.network) ? NETWORKS[agente.network] : null
  const saldo = Number(agente.balance ?? 0)
  const disponible = opciones.find((o) => o.id === origenValido)?.saldo ?? 0

  async function accion(nombre: string, fn: () => Promise<{ ok: boolean; error?: string }>, exito?: string) {
    setOcupado(nombre)
    setAviso(null)
    try {
      const r = await fn()
      if (r.ok) {
        if (exito) setAviso({ texto: exito, ok: true })
        router.refresh()
      } else {
        setAviso({ texto: r.error ?? d.agentes.fallo, ok: false })
      }
    } finally {
      setOcupado(null)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(agente.walletAddress)
      setAviso({ texto: d.agentes.walletCopiada, ok: true })
    } catch {}
  }

  return (
    <section className="border border-border bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {d.agentes.tuAgente}
            {agente.erc8004AgentId ? (
              <span
                className="ml-2 rounded border border-accent/40 px-1.5 py-0.5 align-middle text-[10px] uppercase text-accent"
                title={d.agentes.registradoErc(agente.erc8004AgentId)}
              >
                ERC-8004 #{agente.erc8004AgentId}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={copiar}
            title={d.agentes.copiarWallet}
            className="mt-1 font-mono text-xs text-muted hover:text-text"
          >
            {shortWallet(agente.walletAddress)} ⧉
          </button>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xl tabular-nums">{money(Number(agente.balanceTempo ?? 0))}</p>
            <p className="text-xs text-muted">{d.agentes.saldoTempo}</p>
          </div>
          <div>
            <p className="text-xl tabular-nums">{money(Number(agente.balanceArc ?? 0))}</p>
            <p className="text-xs text-muted">{d.agentes.saldoArc}</p>
          </div>
          <div>
            <p className="text-xl tabular-nums">{money(Number(agente.balanceArbitrum ?? 0))}</p>
            <p className="text-xs text-muted">{d.agentes.saldoArbitrum}</p>
          </div>
          <div>
            <p className="text-xl tabular-nums">{money(Number(agente.balanceBase ?? 0))}</p>
            <p className="text-xs text-muted">{d.agentes.saldoReal}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          className="w-20 rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
        />
        <select
          value={redFondeo}
          onChange={(e) => setRedFondeo(e.target.value as typeof redFondeo)}
          className="rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
          title={d.agentes.fondearRed}
        >
          <option value="tempo">Tempo</option>
          <option value="arc">Arc</option>
          <option value="arbitrum">Arbitrum</option>
        </select>
        {opciones.length > 1 ? (
          <select
            value={origenValido}
            onChange={(e) => setOrigen(e.target.value)}
            className="max-w-44 rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs outline-none focus:border-accent"
            title={d.agentes.fondearDesde}
          >
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id === WALLET
                  ? d.agentes.origenWallet(money(o.saldo))
                  : `${negocios.find((n) => n.slug === o.id)?.nombre ?? o.id} · ${money(o.saldo)}`}
              </option>
            ))}
          </select>
        ) : null}
        <BotonChico
          onClick={() =>
            accion(
              'fondear',
              () =>
                origenValido === WALLET
                  ? fondearDesdeWallet(negocio.slug, agente.id, monto, redFondeo)
                  : fondearAgente(negocio.slug, agente.id, monto, redFondeo, origenValido),
              d.agentes.fondeoOk(`$${monto}`),
            )
          }
          disabled={ocupado !== null || disponible <= 0}
          cargando={ocupado === 'fondear'}
          titulo={disponible <= 0 ? d.agentes.sinSaldoEn(redFondeo) : undefined}
        >
          {d.agentes.fondear}
        </BotonChico>
        <BotonChico
          onClick={() => accion('barrer', () => barrerAgente(negocio.slug, agente.id))}
          disabled={ocupado !== null || saldo <= 0}
          cargando={ocupado === 'barrer'}
          titulo={d.agentes.devolverSaldoTitulo}
        >
          {d.agentes.devolverSaldo}
        </BotonChico>
        <span className="ml-auto max-w-md text-xs text-muted">{d.agentes.enviaUsdcNota}</span>
      </div>

      {disponible <= 0 ? (
        <p className="mt-3 text-sm text-amber-500">{d.agentes.faltaSaldoNegocio}</p>
      ) : null}

      {aviso ? (
        <p className={`mt-3 flex items-center gap-2 text-sm ${aviso.ok ? 'text-accent' : 'text-amber-500'}`}>
          {aviso.ok ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          {aviso.texto}
        </p>
      ) : null}
    </section>
  )
}

/** El corazón del flujo: pedir, ver el plan, confirmar. */
function Ask({
  agente,
  negocio,
  capacidades,
}: {
  agente: AgenteConSaldo
  negocio: Negocio
  capacidades: Capacidad[]
}) {
  const d = useDict()
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [plan, setPlan] = useState<PlanDeCompra | null>(null)
  const [seleccion, setSeleccion] = useState<ServicioDelPlan | null>(null)
  const [estado, setEstado] = useState<'idle' | 'buscando' | 'comprando'>('idle')
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null)
  const [respuesta, setRespuesta] = useState<string | null>(null)

  async function buscar() {
    if (texto.trim().length < 5) return
    setEstado('buscando')
    setAviso(null)
    setPlan(null)
    setRespuesta(null)
    try {
      const r = await planearParaAgente(negocio.slug, agente.id, texto)
      if (!r.ok) return setAviso({ texto: r.error, ok: false })
      setPlan(r.data)
      setSeleccion(r.data.elegido)
    } finally {
      setEstado('idle')
    }
  }

  async function comprar() {
    if (!seleccion?.url) return
    setEstado('comprando')
    setAviso(null)
    try {
      const r = await confirmarCompra(negocio.slug, agente.id, { mission: texto, url: seleccion.url })
      if (!r.ok) return setAviso({ texto: r.error, ok: false })
      if (r.data.respuesta) {
        setRespuesta(r.data.respuesta)
      } else if (r.data.error) {
        setAviso({ texto: r.data.error, ok: false })
      } else {
        setAviso({ texto: d.agentes.compraLista, ok: true })
      }
      setPlan(null)
      setTexto('')
      router.refresh()
    } finally {
      setEstado('idle')
    }
  }

  return (
    <section className="border border-border bg-panel p-5">
      <p className="text-sm font-medium">{d.agentes.askTitulo}</p>
      <p className="mt-1 text-sm text-muted">{d.agentes.askIntro}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder={d.agentes.askPlaceholder}
          className="w-full rounded-none border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-text"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={estado !== 'idle' || texto.trim().length < 5}
          className="shrink-0 self-start border border-text bg-negro px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta disabled:opacity-50"
        >
          {estado === 'buscando' ? d.agentes.buscando : d.agentes.buscar}
        </button>
      </div>

      {capacidades.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {d.agentes.capacidadesTitulo}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {capacidades.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTexto(d.agentes.capPedido[c.id] ?? '')}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-text"
              >
                {d.agentes.capNombre[c.id] ?? c.id}
                {c.precioDesde !== null ? (
                  <span className="ml-1.5 font-mono text-[10px] text-accent">
                    {d.agentes.capDesde(microMoney(c.precioDesde))}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {estado !== 'idle' ? (
        <Progreso pasos={estado === 'buscando' ? d.agentes.buscandoPasos : d.agentes.comprandoPasos} />
      ) : null}

      {plan && estado === 'idle' ? (
        <PlanCard
          plan={plan}
          seleccion={seleccion}
          onSeleccion={setSeleccion}
          onComprar={comprar}
          comprando={false}
        />
      ) : null}

      {respuesta ? <Respuesta texto={respuesta} /> : null}

      {aviso ? (
        <p className={`mt-3 flex items-center gap-2 text-sm ${aviso.ok ? 'text-accent' : 'text-amber-500'}`}>
          {aviso.ok ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          {aviso.texto}
        </p>
      ) : null}
    </section>
  )
}

function PlanCard({
  plan,
  seleccion,
  onSeleccion,
  onComprar,
  comprando,
}: {
  plan: PlanDeCompra
  seleccion: ServicioDelPlan | null
  onSeleccion: (s: ServicioDelPlan) => void
  onComprar: () => void
  comprando: boolean
}) {
  const d = useDict()

  if (!plan.elegido) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm">{d.agentes.sinPlan}</p>
        {plan.vetados.filter((v) => v.motivo).slice(0, 3).map((v) => (
          <p key={v.nombre} className="mt-1 text-xs text-muted">
            {d.agentes.descarto(v.nombre, v.motivo)}
          </p>
        ))}
        <p className="mt-2 font-mono text-xs text-muted">{d.agentes.consultadosNota(plan.consultados)}</p>
      </div>
    )
  }

  const elegido = seleccion ?? plan.elegido
  const opciones = [plan.elegido, ...plan.alternativas].filter(
    (s, i, arr) => s.url && arr.findIndex((x) => x.url === s.url) === i,
  )

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {d.agentes.planTitulo}
      </p>

      <div className="mt-3 space-y-2">
        {opciones.map((s) => {
          const activo = elegido.url === s.url
          return (
            <button
              key={s.url}
              type="button"
              onClick={() => onSeleccion(s)}
              className={`block w-full border px-4 py-3 text-left transition-colors ${
                activo ? 'border-accent bg-bg' : 'border-border hover:border-accent/50'
              }`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.nombre}</span>
                <span className="font-mono text-xs text-accent">
                  {s.precio !== null ? d.agentes.planPrecio(microMoney(s.precio)) : ''}
                </span>
                <RedChip red={s.red} />
              </span>
              {s.descripcion ? (
                <span className="mt-1 block truncate text-xs text-muted">{s.descripcion}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {plan.veredicto ? (
        <p className="mt-3 border-l-2 border-accent/50 pl-3 text-xs text-muted">
          <span className="font-mono uppercase tracking-[0.1em]">{d.agentes.veredictoTitulo}:</span>{' '}
          {plan.veredicto}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onComprar}
          disabled={comprando || !elegido.url}
          className="border border-text bg-negro px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta disabled:opacity-50"
        >
          {comprando
            ? d.agentes.comprando
            : d.agentes.comprarPor(elegido.precio !== null ? microMoney(elegido.precio) : '')}
        </button>
        <span className="font-mono text-xs text-muted">{d.agentes.consultadosNota(plan.consultados)}</span>
      </div>

      {plan.faltaFondeo && elegido.url === plan.elegido.url ? (
        <p className="mt-3 text-sm text-amber-700">
          {d.agentes.faltaFondeoAviso(plan.elegido.precio !== null ? microMoney(plan.elegido.precio) : '')}
        </p>
      ) : null}
    </div>
  )
}

function RedChip({ red }: { red: string }) {
  const d = useDict()
  const real = red === 'base'
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
        real ? 'border-accent/40 text-accent' : 'border-border text-muted'
      }`}
    >
      {real ? `Base · ${d.agentes.redReal}` : `${isNetworkId(red) ? NETWORKS[red].label : red} · ${d.agentes.redDemo}`}
    </span>
  )
}

function BotonChico({
  children,
  onClick,
  disabled,
  cargando,
  titulo,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  cargando?: boolean
  titulo?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-text disabled:opacity-40"
    >
      {cargando ? '…' : children}
    </button>
  )
}

/** Sin agente todavía: un botón lo crea con su wallet, sin formulario. */
export function ActivarAgente({ negocio }: { negocio: Negocio }) {
  const d = useDict()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function activar() {
    setPending(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('name', d.agentes.tuAgente)
      fd.set('mission', d.agentes.askPlaceholder)
      fd.set('network', 'tempo')
      fd.set('frequency', 'once')
      fd.set('maxPerRun', '0.05')
      fd.set('deliveryKind', 'dashboard')
      const r = await crearAgente(negocio.slug, fd)
      if (!r.ok) return setError(r.error)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="border border-border bg-panel p-8 text-center">
      <p className="text-lg font-semibold">{d.agentes.activarTitulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{d.agentes.activarIntro}</p>
      <button
        type="button"
        onClick={activar}
        disabled={pending}
        className="mt-5 border border-text bg-negro px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-tinta disabled:opacity-50"
      >
        {pending ? d.agentes.activando : d.agentes.activar}
      </button>
      <p className="mt-3 text-xs text-muted">{d.agentes.notaWallet}</p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}

/**
 * La respuesta de una compra, todo dentro del mismo recuadro: cuerpo, fuente
 * comprada (con la etiqueta en el idioma del UI) y la nota de que quedó en
 * el historial.
 */
function Respuesta({ texto }: { texto: string }) {
  const d = useDict()
  const { cuerpo, fuente } = separarFuente(texto)
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        {d.agentes.respuestaTitulo}
      </p>
      <div className="mt-2 border border-accent/40 bg-bg p-4">
        <CuerpoMarkdown texto={cuerpo} />
        {fuente ? (
          <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] break-all text-muted">
            {d.agentes.fuenteComprada}: {fuente}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">{d.agentes.respuestaNota}</p>
      </div>
    </div>
  )
}

/**
 * La síntesis llega en markdown (negritas, tablas): se renderiza, no se
 * muestra cruda. Estilos mínimos acordes al resto del panel.
 */
export function CuerpoMarkdown({ texto }: { texto: string }) {
  return (
    <div className="texto-markdown text-sm leading-relaxed [&_strong]:font-semibold [&_p]:mt-2 [&_p:first-child]:mt-0 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_a]:text-accent [&_a]:underline [&_code]:font-mono [&_code]:text-xs">
      <div className="overflow-x-auto">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: (props) => (
              <table className="mt-2 w-full border-collapse text-left" {...props} />
            ),
            th: (props) => (
              <th className="border-b border-border py-1.5 pr-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted" {...props} />
            ),
            td: (props) => <td className="border-b border-border/50 py-1.5 pr-4" {...props} />,
          }}
        >
          {texto}
        </Markdown>
      </div>
    </div>
  )
}

/** El gateway guarda la fuente como última línea "— nombre · url". */
export function separarFuente(texto: string): { cuerpo: string; fuente: string | null } {
  const lineas = texto.trimEnd().split('\n')
  const ultima = lineas[lineas.length - 1] ?? ''
  // Cubre el formato nuevo ("— nombre · url") y el viejo en español.
  if (/^—\s/.test(ultima)) {
    return {
      cuerpo: lineas.slice(0, -1).join('\n').trimEnd(),
      fuente: ultima.replace(/^—\s*(Fuente comprada:\s*)?/, ''),
    }
  }
  return { cuerpo: texto, fuente: null }
}

/** Barra viva mientras el agente trabaja: etapas que avanzan, no un spinner mudo. */
function Progreso({ pasos }: { pasos: string[] }) {
  const [paso, setPaso] = useState(0)
  useEffect(() => {
    setPaso(0)
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, pasos.length - 1)), 5000)
    return () => clearInterval(t)
  }, [pasos])
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-mono text-xs text-muted">{pasos[paso]}</p>
      <div className="mt-2 h-1 w-full overflow-hidden bg-border">
        <div className="h-full w-1/3 animate-[progreso_1.4s_ease-in-out_infinite] bg-accent" />
      </div>
      <style jsx>{`
        @keyframes progreso {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}

/** Paso a paso para el primer uso: se muestra mientras el agente está en cero. */
function PasoAPaso() {
  const d = useDict()
  return (
    <section className="border border-border bg-panel p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {d.agentes.pasosTitulo}
      </p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-4">
        {d.agentes.pasos.map((p, i) => (
          <li key={p.titulo} className="border-t-2 border-accent pt-3">
            <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
            <p className="mt-1 text-sm font-medium">{p.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{p.detalle}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
