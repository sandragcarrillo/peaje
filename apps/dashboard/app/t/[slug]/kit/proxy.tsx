'use client'

import { useState } from 'react'
import { useDict } from '@/lib/i18n/client'
import { generarProxy, HOSTS, RUTAS_PROXY, type Host } from '@/lib/proxy-kit'

/**
 * El bloque recomendado del kit: una sola pieza de configuración que hace que
 * el sitio del negocio sirva MPP, MCP y OpenAPI desde SU dominio.
 *
 * Es lo único que mueve el score de verdad (los auditores miden tu origen, y
 * un catálogo que apunta a otro host no cuenta), así que va primero. Pero la
 * acción principal es copiar, no leer: el código va escondido detrás de un
 * click para que el paso uno no sea un muro de configuración.
 */
export function BloqueProxy({ base }: { base: string }) {
  const { kit: d } = useDict()
  const [host, setHost] = useState<Host>('next')
  const [copiado, setCopiado] = useState(false)

  const etiquetas: Record<Host, string> = {
    next: d.hostNext,
    vercel: d.hostVercel,
    cloudflare: d.hostCloudflare,
    nginx: d.hostNginx,
    caddy: d.hostCaddy,
  }

  const archivo = HOSTS.find((h) => h.id === host)?.archivo ?? ''
  const contenido = generarProxy(host, base, {
    titulo: d.proxyComentarioTitulo,
    sub: d.proxyComentarioSub,
    rutaPaga: d.proxyComentarioRutaPaga,
  })
  const esLocal = base.includes('localhost')

  async function copiar() {
    await navigator.clipboard.writeText(contenido)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <section className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{d.proxyTitulo}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{d.proxyIntro}</p>
        </div>
        <span className="rounded-full border border-accent/40 px-2.5 py-1 text-[10px] uppercase text-accent">
          {d.proxyRecomendado}
        </span>
      </div>

      <Paso titulo={d.proxyPaso1}>
        <div className="flex flex-wrap gap-2">
          {HOSTS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHost(h.id)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                h.id === host
                  ? 'border-accent bg-accent text-black'
                  : 'border-border text-muted hover:border-muted hover:text-text'
              }`}
            >
              {etiquetas[h.id]}
            </button>
          ))}
        </div>
      </Paso>

      <Paso titulo={d.proxyPaso2}>
        <p className="text-sm text-muted">{d.proxyPaso2Detalle(archivo)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copiar}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            {copiado ? d.proxyConfigCopiada : d.proxyCopiarConfig}
          </button>
          <details className="min-w-full sm:min-w-0">
            <summary className="cursor-pointer text-xs text-muted hover:text-text">
              {d.proxyVerConfig}
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-border bg-bg p-3 text-[11px] whitespace-pre-wrap text-muted">
              {contenido}
            </pre>
          </details>
        </div>
        {esLocal ? (
          <p className="mt-3 rounded-lg border border-yellow-400/40 bg-panel p-3 text-xs text-yellow-400">
            {d.proxyAvisoLocalhost}
          </p>
        ) : null}
      </Paso>

      <Paso titulo={d.proxyPaso3} ultimo>
        <p className="text-sm text-muted">{d.proxyPaso3Detalle}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-text">
            {d.proxyQueHace}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {RUTAS_PROXY.map((r) => (
              <li key={r.path} className="flex flex-wrap gap-2">
                <code className="font-mono text-accent">{r.path}</code>
                <span>{r.nota}</span>
              </li>
            ))}
            <li className="flex flex-wrap gap-2">
              <code className="font-mono text-accent">/r/:slug</code>
              <span>{d.proxyRutaPaga}</span>
            </li>
          </ul>
        </details>
      </Paso>
    </section>
  )
}

function Paso({
  titulo,
  children,
  ultimo,
}: {
  titulo: string
  children: React.ReactNode
  ultimo?: boolean
}) {
  return (
    <div className={`mt-5 ${ultimo ? '' : 'border-b border-border pb-5'}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{titulo}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}
