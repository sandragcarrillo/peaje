'use client'

import type { Resource } from '@peaje/db'
import { useState, useTransition } from 'react'
import { money } from '@/lib/config'
import { SectionBar } from '@/components/chrome'
import { useDict } from '@/lib/i18n/client'
import { borrarLink, crearLink, importarLinks, leerSitemap, type UrlImportable } from './actions'

export function LinksPanel({
  slug,
  resources,
  base,
}: {
  slug: string
  resources: Resource[]
  base: string
}) {
  const { panel: d } = useDict()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div>
      <SectionBar n={1} label={d.linksTitulo} meta={String(resources.length)} />
      <p className="mt-2 text-sm text-muted">{d.linksIntro}</p>

      {resources.length > 0 ? (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="pb-2 font-normal" />
              <th className="pb-2 font-normal">{d.colRuta}</th>
              <th className="pb-2 font-normal" />
              <th className="pb-2 text-right font-normal">{d.colMonto}</th>
              <th className="pb-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="w-14 py-2.5 pr-2">
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-muted">
                    GET
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="font-mono text-sm" title={r.url}>/r/{r.slug}</span>
                </td>
                <td className="max-w-48 truncate py-2.5 pr-4 text-xs text-muted">
                  {r.title ?? r.url}
                </td>
                <td className="py-2.5 text-right font-mono text-sm text-accent">
                  {Number(r.priceUsd) > 0 ? `+${money(r.priceUsd)}` : d.linksGratis}
                </td>
                <td className="w-24 py-2.5 text-right">
                  <span aria-hidden className="mr-3 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <button
                    disabled={pending}
                    onClick={() => startTransition(async () => borrarLink(slug, r.id))}
                    className="font-mono text-[11px] uppercase text-muted hover:text-red-600 disabled:opacity-50"
                  >
                    {d.linksQuitar}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          {d.linksVacio}
        </p>
      )}

      <form
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            try {
              await crearLink(slug, formData)
            } catch (e) {
              setError(e instanceof Error ? e.message : d.linksErrorCrear)
            }
          })
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-64 flex-1">
          <span className="text-xs text-muted">URL</span>
          <input
            name="url"
            required
            placeholder={d.linksUrlPlaceholder}
            className="mt-1 w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
          />
        </label>
        <label className="w-40">
          <span className="text-xs text-muted">{d.linksCampoTitulo}</span>
          <input
            name="title"
            placeholder={d.linksTituloPlaceholder}
            className="mt-1 w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
          />
        </label>
        <label className="w-28">
          <span className="text-xs text-muted">{d.linksPrecio}</span>
          <input
            name="priceUsd"
            type="number"
            step="0.001"
            min="0"
            placeholder={d.linksPrecioPlaceholder}
            className="mt-1 w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
        >
          {d.linksAgregar}
        </button>
      </form>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <ImportarSitemap slug={slug} />

      <p className="mt-3 text-xs text-muted">
        {d.linksNotaPre} <code className="font-mono">{base}/r/&lt;slug&gt;</code> {d.linksNotaPost}{' '}
        <a
          href={`${base}/openapi.json`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-accent hover:underline"
        >
          {base}/openapi.json
        </a>
      </p>
    </div>
  )
}

function ImportarSitemap({ slug }: { slug: string }) {
  const { panel: d } = useDict()
  const [urlSitemap, setUrlSitemap] = useState('')
  const [items, setItems] = useState<UrlImportable[] | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [precio, setPrecio] = useState('0.05')
  const [filtro, setFiltro] = useState('')
  const [estado, setEstado] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-6 rounded-lg border border-border bg-panel p-4">
      <h4 className="text-sm font-medium">{d.sitemapTitulo}</h4>
      <p className="mt-1 text-xs text-muted">{d.sitemapIntro}</p>

      <div className="mt-3 flex gap-3">
        <input
          value={urlSitemap}
          onChange={(e) => setUrlSitemap(e.target.value)}
          placeholder={d.sitemapPlaceholder}
          className="min-w-72 flex-1 rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
        />
        <button
          disabled={pending || !urlSitemap.trim()}
          onClick={() => {
            setEstado(null)
            startTransition(async () => {
              try {
                const encontrados = await leerSitemap(slug, urlSitemap.trim())
                setItems(encontrados)
                setSeleccion(new Set(encontrados.map((i) => i.slug)))
              } catch (e) {
                setEstado(e instanceof Error ? e.message : d.sitemapErrorLeer)
              }
            })
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending && !items ? d.sitemapLeyendo : d.sitemapLeer}
        </button>
      </div>

      {items ? (
        <div className="mt-4">
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={d.sitemapBuscar}
            className="mb-2 w-full rounded-none border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-text"
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-2">
              {d.sitemapSeleccionadas(seleccion.size, items.length)}
              <button
                type="button"
                onClick={() =>
                  setSeleccion(
                    new Set(
                      items
                        .filter((i) => !filtro || i.url.toLowerCase().includes(filtro.toLowerCase()))
                        .map((i) => i.slug),
                    ),
                  )
                }
                className="text-accent hover:underline"
              >
                {d.sitemapTodas}
              </button>
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="text-accent hover:underline"
              >
                {d.sitemapNinguna}
              </button>
            </span>
            <div className="flex items-center gap-2">
              <span>{d.sitemapPrecioTodas}</span>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                type="number"
                step="0.001"
                min="0.001"
                className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-accent"
              />
            </div>
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {items
              .filter((i) => !filtro || i.url.toLowerCase().includes(filtro.toLowerCase()))
              .map((i) => (
              <li key={i.slug}>
                <label className="flex items-center gap-2 font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={seleccion.has(i.slug)}
                    onChange={(e) => {
                      const next = new Set(seleccion)
                      if (e.target.checked) next.add(i.slug)
                      else next.delete(i.slug)
                      setSeleccion(next)
                    }}
                  />
                  <span className="truncate text-muted" title={i.url}>
                    {i.url}
                  </span>
                </label>
              </li>
              ))}
          </ul>
          <button
            disabled={pending || seleccion.size === 0}
            onClick={() => {
              setEstado(null)
              startTransition(async () => {
                try {
                  const n = await importarLinks(
                    slug,
                    items.filter((i) => seleccion.has(i.slug)),
                    Number(precio.replace(',', '.')),
                  )
                  setEstado(d.sitemapImportados(n, Number(precio.replace(',', '.'))))
                  setItems(null)
                } catch (e) {
                  setEstado(e instanceof Error ? e.message : d.sitemapErrorImportar)
                }
              })
            }}
            className="mt-3 rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {d.sitemapImportar(seleccion.size)}
          </button>
        </div>
      ) : null}

      {estado ? <p className="mt-2 text-xs text-accent">{estado}</p> : null}
    </div>
  )
}
