'use client'

import { useState, useTransition } from 'react'
import { useDict } from '@/lib/i18n/client'
import { Copiable } from '../kit/comando'
import { crearClaveAgente } from '../agente/actions'

const pre = 'overflow-x-auto whitespace-pre-wrap break-all bg-panel-2 px-3 py-2 font-mono text-xs'

type Pestana = 'claude' | 'cursor' | 'codex' | 'lovable' | 'otra'

/**
 * Tu herramienta: la clave del agente y, por pestaña, cómo conectar el MCP
 * del dueño en cada una. La clave se ve una sola vez, recién creada; los
 * bloques la llevan tapada en pantalla y real al copiar. Sin clave recién
 * creada, los bloques muestran el lugar donde va.
 */
export function Herramientas({ slug, prefijo, mcpUrl, gateway }: { slug: string; prefijo: string | null; mcpUrl: string; gateway: string }) {
  const { miAgente: t } = useDict()
  const [clave, setClave] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('claude')
  const [pending, start] = useTransition()
  const k = clave ?? t.placeholderClave

  const claude = `claude mcp add --transport http peaje ${mcpUrl} --header "Authorization: Bearer ${k}"`
  const cursor = JSON.stringify({ mcpServers: { peaje: { url: mcpUrl, headers: { Authorization: `Bearer ${k}` } } } }, null, 2)
  // Codex lee el token de una variable de entorno: la clave no queda en el archivo.
  const codex = `[mcp_servers.peaje]\nurl = "${mcpUrl}"\nbearer_token_env_var = "PEAJE_AGENT_KEY"`
  const variable = `export PEAJE_AGENT_KEY=${k}`
  // Sin la clave en el comando: el CLI la lee de PEAJE_AGENT_KEY, así no queda
  // en el historial de la terminal ni en una captura de pantalla.
  const terminal = `npx @peaje/cli@1 tasks${gateway.includes('localhost') ? ` --gateway ${gateway}` : ''}`

  const pestanas: [Pestana, string][] = [
    ['claude', t.claudeCode],
    ['cursor', 'Cursor'],
    ['codex', 'Codex'],
    ['lovable', 'Lovable'],
    ['otra', t.herramientaOtra],
  ]

  return (
    <div className="space-y-5 border border-border p-4">
      <p className="max-w-2xl text-sm text-muted">{t.herramientaIntro}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="font-mono text-[11px] tracking-[0.02em] text-muted">{t.claveTitulo}</span>
          <p className="mt-1 text-sm">{prefijo ? t.claveActual(prefijo) : t.claveNinguna}</p>
        </div>
        <button disabled={pending} className="btn btn-secundario btn-chico" onClick={() => start(async () => setClave(await crearClaveAgente(slug)))}>
          {prefijo || clave ? t.claveRotar : t.claveGenerar}
        </button>
      </div>
      {clave ? <p className="-mt-2 text-xs text-red-600">{t.claveUnaVez}</p> : null}

      <div>
        <div role="tablist" aria-label={t.herramientaTitulo} className="flex flex-wrap gap-2">
          {pestanas.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={`btn btn-secundario btn-chico ${pestana === id ? 'border-text bg-panel' : 'text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-4 space-y-3">
          {pestana === 'claude' ? <Bloque paso={t.pasoClaude} texto={claude} secreto={clave} /> : null}
          {pestana === 'cursor' ? <Bloque paso={t.pasoCursor} texto={cursor} secreto={clave} /> : null}
          {pestana === 'codex' ? (
            <>
              <Bloque paso={t.pasoCodex} texto={codex} />
              <Bloque paso={t.pasoCodexClave} texto={variable} secreto={clave} />
            </>
          ) : null}
          {pestana === 'lovable' ? (
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
          {pestana === 'otra' ? (
            <>
              <Bloque paso={t.pasoOtra} texto={`${mcpUrl}\nAuthorization: Bearer ${k}`} secreto={clave} />
              <Bloque paso={t.terminal} texto={terminal} nota={t.terminalNota} />
            </>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm">{t.herramientaDecirle}</p>
        <ul className="mt-2 space-y-1">
          {t.herramientaEjemplos.map((e) => (
            <li key={e} className="font-mono text-xs text-muted">
              <span className="text-accent">›</span> {e}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">{t.herramientaProNota}</p>
      </div>
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
