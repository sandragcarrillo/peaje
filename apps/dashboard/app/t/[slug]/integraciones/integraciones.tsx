'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { SectionBar } from '@/components/chrome'
import { Logo, marcaDe, type Marca } from '@/components/logos'
import type { EstadoReportes, EstadoSlack, EstadoTelegram } from '@/lib/gateway'
import { useDict } from '@/lib/i18n/client'
import { Copiable } from '../kit/comando'
import { crearClaveAgente, desconectarHerramienta } from '../agente/actions'
import { SlackPanel } from '../agente/slack'
import { Bloqueado } from '../agente/suscripcion'
import { TelegramPanel } from '../agente/telegram'

const pre = 'overflow-x-auto whitespace-pre-wrap break-all bg-panel-2 px-3 py-2 font-mono text-xs'

type Id = 'telegram' | 'slack' | 'claudeapp' | 'chatgpt' | 'claude' | 'cursor' | 'codex' | 'lovable' | 'otras'
const HERRAMIENTAS: Id[] = ['claudeapp', 'chatgpt', 'claude', 'cursor', 'codex', 'lovable', 'otras']
/** Las que se conectan con inicio de sesión (OAuth): no muestran la clave. */
const CON_SESION: Id[] = ['claudeapp', 'chatgpt']

/** Cómo se llama cada marca que anota el gateway (apps/gateway/src/tareas/herramientas.ts). */
const NOMBRES: Partial<Record<Marca, string>> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex',
  lovable: 'Lovable',
  windsurf: 'Windsurf',
  copilot: 'GitHub Copilot',
  v0: 'v0',
  replit: 'Replit',
}

/**
 * Integraciones: arriba lo que ya está conectado, abajo una tarjeta por
 * integración con su logo. Tocar una abre su instalación debajo de la grilla.
 * Claude (la app) y ChatGPT entran con inicio de sesión; las demás, con la clave.
 * La clave del agente vive acá arriba (en el estado) para que siga igual al
 * cambiar de herramienta. Sale tapada, con el ojito, como el secreto del origen.
 */
export function Integraciones({
  slug,
  pro,
  telegram,
  reportes,
  slack,
  prefijo,
  herramientas,
  sesiones,
  claveGuardada,
  mcpUrl,
  gateway,
  planHref,
}: {
  slug: string
  pro: boolean
  telegram: EstadoTelegram | null
  reportes: EstadoReportes | null
  slack: EstadoSlack | null
  prefijo: string | null
  herramientas: { marca: string; nombre: string; dias: number }[]
  sesiones: { id: string; nombre: string; dias: number }[]
  claveGuardada: string | null
  mcpUrl: string
  gateway: string
  planHref: string
}) {
  const { miAgente: t } = useDict()
  const [abierta, setAbierta] = useState<Id | null>(null)
  const [clave, setClave] = useState<string | null>(claveGuardada)
  const [desconectando, startDesconectar] = useTransition()
  const router = useRouter()

  // Los enlaces con #telegram (Inicio, el correo de bienvenida) abren esa tarjeta.
  useEffect(() => {
    const id = window.location.hash.slice(1) as Id
    if (['telegram', 'slack', ...HERRAMIENTAS].includes(id)) {
      setAbierta(id)
      requestAnimationFrame(() => document.getElementById('integracion')?.scrollIntoView({ block: 'start' }))
    }
  }, [])

  const tarjetas: { id: Id; marca: Marca; nombre: string; texto: string }[] = [
    { id: 'telegram', marca: 'telegram', nombre: 'Telegram', texto: t.intTelegram },
    ...(slack?.configured ? [{ id: 'slack' as const, marca: 'slack' as const, nombre: 'Slack', texto: t.intSlack }] : []),
    { id: 'claudeapp', marca: 'claude', nombre: 'Claude', texto: t.intClaudeApp },
    { id: 'chatgpt', marca: 'chatgpt', nombre: 'ChatGPT', texto: t.intChatgpt },
    { id: 'claude', marca: 'claude', nombre: 'Claude Code', texto: t.intClaude },
    { id: 'cursor', marca: 'cursor', nombre: 'Cursor', texto: t.intCursor },
    { id: 'codex', marca: 'codex', nombre: 'Codex', texto: t.intCodex },
    { id: 'lovable', marca: 'lovable', nombre: 'Lovable', texto: t.intLovable },
    { id: 'otras', marca: 'windsurf', nombre: t.intOtrasNombre, texto: t.intOtras },
  ]

  const activas: { marca: Marca | null; texto: string; desconectar?: () => void }[] = [
    ...(telegram?.links ?? []).map((l) => ({ marca: 'telegram' as const, texto: t.activaTelegram(l.username) })),
    ...(slack?.links ?? []).map((l) => ({ marca: 'slack' as const, texto: t.activaSlack(l.teamName) })),
    // Solo las que de verdad se conectaron: una clave creada no es una herramienta activa.
    ...herramientas.map((h) => {
      const marca = h.marca in NOMBRES ? (h.marca as Marca) : null
      return { marca, texto: t.activaHerramienta(marca ? NOMBRES[marca]! : h.nombre, h.dias) }
    }),
    // Las del inicio de sesión, con el nombre con que se registraron y su botón para cortarlas.
    ...sesiones.map((s) => ({
      marca: marcaDe(s.nombre),
      texto: t.activaSesion(s.nombre, s.dias),
      desconectar: () =>
        startDesconectar(async () => {
          await desconectarHerramienta(slug, s.id)
          router.refresh()
        }),
    })),
  ]

  return (
    <div className="space-y-8">
      {activas.length > 0 ? (
        <section className="space-y-3">
          <SectionBar label={t.activasTitulo} />
          <ul className="divide-y divide-border border border-border">
            {activas.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                {a.marca ? <Logo marca={a.marca} className="h-5 w-5 shrink-0" /> : <IconoHerramienta />}
                <span className="min-w-0 truncate">{a.texto}</span>
                {a.desconectar ? (
                  <button type="button" disabled={desconectando} onClick={a.desconectar} className="btn btn-secundario btn-chico ml-auto shrink-0">
                    {t.desconectar}
                  </button>
                ) : (
                  <span aria-hidden className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionBar label={t.agregarTitulo} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tarjetas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setAbierta(abierta === c.id ? null : c.id)}
              aria-expanded={abierta === c.id}
              aria-controls="integracion"
              className={`flex flex-col gap-3 rounded-lg border bg-panel p-4 text-left transition-colors ${abierta === c.id ? 'border-accent' : 'border-border hover:border-text/40'}`}
            >
              <span className="flex items-center gap-3">
                {c.id === 'otras' ? (
                  <span className="flex gap-1">
                    {(['windsurf', 'copilot', 'v0', 'replit'] as const).map((m) => (
                      <Logo key={m} marca={m} className="h-5 w-5" />
                    ))}
                  </span>
                ) : (
                  <Logo marca={c.marca} className="h-7 w-7" />
                )}
                <span className="font-medium">{c.nombre}</span>
              </span>
              <span className="text-sm text-muted">{c.texto}</span>
              <span className="mt-auto font-mono text-xs text-accent">{abierta === c.id ? t.intCerrar : t.intConectar} →</span>
            </button>
          ))}
        </div>

        {abierta ? (
          <div id="integracion" className="space-y-4 rounded-lg border border-border p-4">
            {abierta === 'telegram' ? (
              pro ? <TelegramPanel slug={slug} estado={telegram} reportes={reportes} /> : <Bloqueado que="telegram" plan={planHref} />
            ) : null}
            {abierta === 'slack' ? pro ? <SlackPanel slug={slug} estado={slack} /> : <Bloqueado que="slack" plan={planHref} /> : null}
            {HERRAMIENTAS.includes(abierta) ? (
              <Herramienta id={abierta} slug={slug} pro={pro} prefijo={prefijo} clave={clave} setClave={setClave} mcpUrl={mcpUrl} gateway={gateway} />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

/** Clave del agente + los pasos de una herramienta + qué pedirle después. */
function Herramienta({
  id,
  slug,
  pro,
  prefijo,
  clave,
  setClave,
  mcpUrl,
  gateway,
}: {
  id: Id
  slug: string
  pro: boolean
  prefijo: string | null
  clave: string | null
  setClave: (c: string) => void
  mcpUrl: string
  gateway: string
}) {
  const { miAgente: t } = useDict()
  const [pending, start] = useTransition()
  const k = clave ?? t.placeholderClave

  const claude = `claude mcp add --transport http peaje ${mcpUrl} --header "Authorization: Bearer ${k}"`
  const cursorJson = { url: mcpUrl, headers: { Authorization: `Bearer ${k}` } }
  // Link oficial de Cursor: name + config (el mismo formato que mcp.json) en base64.
  // Solo la URL: sin clave, el MCP le responde 401 y Cursor inicia sesión (oauth.ts del gateway).
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=peaje&config=${btoa(JSON.stringify({ url: mcpUrl }))}`
  // Codex lee el token de una variable de entorno: la clave no queda en su config.
  const codex = `codex mcp add peaje --url ${mcpUrl} --bearer-token-env-var PEAJE_AGENT_KEY`
  const variable = `export PEAJE_AGENT_KEY=${k}`
  // Sin la clave en el comando: el CLI la lee de PEAJE_AGENT_KEY.
  const terminal = `npx @peaje/cli@1 tasks${gateway.includes('localhost') ? ` --gateway ${gateway}` : ''}`

  if (CON_SESION.includes(id)) {
    const chatgpt = id === 'chatgpt'
    return (
      <div className="space-y-5">
        <p className="max-w-2xl text-sm text-muted">{t.sesionIntro}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {(chatgpt ? t.pasosChatgpt : t.pasosClaudeApp).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <div>
          <span className="text-xs text-muted">{t.urlConector}</span>
          <div className="mt-1">
            <Copiable texto={mcpUrl} />
          </div>
        </div>
        <p className="text-xs text-muted">{chatgpt ? t.notaChatgpt : t.notaClaudeApp}</p>
        <Ejemplos pro={pro} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-muted">{t.herramientaIntro}</p>

      {id === 'cursor' ? (
        <div className="space-y-2">
          <a href={cursorLink} className="btn btn-primario btn-chico">
            <Logo marca="cursor" className="h-4 w-4" />
            {t.cursorBoton}
          </a>
          <p className="text-xs text-muted">{t.cursorSesion}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.claveTitulo}</span>
          {clave ? null : <p className="mt-1 text-sm">{prefijo ? t.claveVieja(prefijo) : t.claveNinguna}</p>}
        </div>
        <button disabled={pending} className="btn btn-secundario btn-chico" onClick={() => start(async () => setClave(await crearClaveAgente(slug)))}>
          {prefijo || clave ? t.claveRotar : t.claveGenerar}
        </button>
      </div>
      {clave ? <Copiable texto={clave} secreto={clave} /> : null}

      {id === 'claude' ? <Bloque paso={t.pasoClaude} texto={claude} secreto={clave} nota={t.notaClaude} /> : null}
      {id === 'cursor' ? <Bloque paso={t.pasoCursor} texto={JSON.stringify({ mcpServers: { peaje: cursorJson } }, null, 2)} secreto={clave} /> : null}
      {id === 'codex' ? (
        <>
          <Bloque paso={t.pasoCodexClave} texto={variable} secreto={clave} />
          <Bloque paso={t.pasoCodex} texto={codex} />
        </>
      ) : null}
      {id === 'lovable' ? (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {t.pasosLovable.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <Bloque paso="Server URL" texto={mcpUrl} />
          <Bloque paso="Bearer token" texto={k} secreto={clave} />
          <p className="text-xs text-muted">{t.notaLovable}</p>
        </>
      ) : null}
      {id === 'otras' ? (
        <>
          <Bloque paso={t.pasoOtra} texto={`${mcpUrl}\nAuthorization: Bearer ${k}`} secreto={clave} />
          <Bloque paso={t.terminal} texto={terminal} nota={t.terminalNota} />
        </>
      ) : null}

      <Ejemplos pro={pro} />
    </div>
  )
}

/** Qué pedirle después de conectarla. */
function Ejemplos({ pro }: { pro: boolean }) {
  const { miAgente: t } = useDict()
  return (
    <div className="border-t border-border pt-4">
      <p className="text-sm">{t.herramientaDecirle}</p>
      <ul className="mt-2 space-y-1">
        {t.herramientaEjemplos.map((e) => (
          <li key={e} className="font-mono text-xs text-muted">
            <span className="text-accent">›</span> {e}
          </li>
        ))}
      </ul>
      {pro ? null : <p className="mt-3 text-xs text-faint">{t.herramientaProNota}</p>}
    </div>
  )
}

function Bloque({ paso, texto, secreto, nota }: { paso: string; texto: string; secreto?: string | null; nota?: string }) {
  return (
    <div>
      <span className="text-xs text-muted">{paso}</span>
      <div className="mt-1">{secreto ? <Copiable texto={texto} secreto={secreto} /> : <pre className={pre}>{texto}</pre>}</div>
      {nota ? <p className="mt-1 text-xs text-muted">{nota}</p> : null}
    </div>
  )
}

/** Para una herramienta que no reconocemos: una terminal genérica. */
function IconoHerramienta() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M13 15h4" />
    </svg>
  )
}
