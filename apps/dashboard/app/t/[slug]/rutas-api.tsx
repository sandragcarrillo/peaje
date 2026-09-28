'use client'

import type { Route } from '@peaje/db'
import { useState, useTransition } from 'react'
import { money } from '@/lib/config'
import { SectionBar } from '@/components/chrome'
import { useDict } from '@/lib/i18n/client'
import { borrarRuta, crearRuta, editarRuta } from './actions'

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const input = 'mt-1 w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text'

/**
 * Rutas de API con precio: las que ya existen en el servidor del negocio y
 * Peaje cobra en su dominio. Crear, editar precio y descripción, quitar. Es
 * lo mismo que el agente Pro hace por comando; acá a mano.
 */
export function RutasApiPanel({ slug, routes, dominio }: { slug: string; routes: Route[]; dominio: string }) {
  const { panel: d } = useDict()
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const correr = (fn: () => Promise<void>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        setEditando(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div>
      <SectionBar n={2} label={d.rutasApiTitulo} meta={String(routes.length)} />
      <p className="mt-2 text-sm text-muted">{d.rutasApiIntro}</p>

      {routes.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="pb-2 font-normal" />
              <th className="pb-2 font-normal">{d.rutasApiPath}</th>
              <th className="pb-2 font-normal">{d.rutasApiDescripcion}</th>
              <th className="pb-2 text-right font-normal">{d.colMonto}</th>
              <th className="pb-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {routes.map((r) =>
              editando === r.id ? (
                <tr key={r.id} className="border-t border-border">
                  <td colSpan={5} className="py-3">
                    <form
                      action={(fd) => correr(() => editarRuta(slug, r.id, fd))}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <span className="font-mono text-sm">
                        {r.method} {r.pathPattern}
                      </span>
                      <label className="min-w-64 flex-1">
                        <span className="text-xs text-muted">{d.rutasApiDescripcion}</span>
                        <input name="description" defaultValue={r.description ?? ''} maxLength={300} className={input} />
                      </label>
                      <label className="w-28">
                        <span className="text-xs text-muted">{d.rutasApiPrecio}</span>
                        <input name="priceUsd" type="number" step="0.001" min="0.001" required defaultValue={Number(r.priceUsd)} className={input} />
                      </label>
                      <button disabled={pending} className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
                        {d.rutasApiGuardar}
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="font-mono text-[11px] uppercase text-muted hover:text-text">
                        {d.rutasApiCancelar}
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t border-border">
                  <td className="w-16 py-2.5 pr-2">
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-muted">{r.method}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-sm" title={`${dominio}${r.pathPattern}`}>{r.pathPattern}</span>
                  </td>
                  <td className="max-w-64 truncate py-2.5 pr-4 text-xs text-muted">{r.description ?? ''}</td>
                  <td className="py-2.5 text-right font-mono text-sm text-accent">+{money(r.priceUsd)}</td>
                  <td className="w-32 py-2.5 text-right">
                    <button onClick={() => setEditando(r.id)} className="mr-3 font-mono text-[11px] uppercase text-muted hover:text-text">
                      {d.rutasApiEditar}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => correr(() => borrarRuta(slug, r.id))}
                      className="font-mono text-[11px] uppercase text-muted hover:text-red-600 disabled:opacity-50"
                    >
                      {d.rutasApiQuitar}
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted">{d.rutasApiVacio}</p>
      )}

      <form action={(fd) => correr(() => crearRuta(slug, fd))} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="w-28">
          <span className="text-xs text-muted">{d.rutasApiMetodo}</span>
          <select name="method" defaultValue="GET" className={input}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="min-w-56 flex-1">
          <span className="text-xs text-muted">{d.rutasApiPath}</span>
          <input name="pathPattern" required placeholder={d.rutasApiPathPlaceholder} className={input} />
        </label>
        <label className="min-w-56 flex-1">
          <span className="text-xs text-muted">{d.rutasApiDescripcion}</span>
          <input name="description" maxLength={300} placeholder={d.rutasApiDescripcionPlaceholder} className={input} />
        </label>
        <label className="w-28">
          <span className="text-xs text-muted">{d.rutasApiPrecio}</span>
          <input name="priceUsd" type="number" step="0.001" min="0.001" required placeholder="0.01" className={input} />
        </label>
        <button disabled={pending} className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
          {d.rutasApiAgregar}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <p className="mt-3 text-xs text-muted">{d.rutasApiNota}</p>
    </div>
  )
}
