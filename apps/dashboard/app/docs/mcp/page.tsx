import type { Metadata } from 'next'
import { COSTOS_CREDITOS, REGALO } from '@peaje/db'
import { Logo, type Marca } from '@/components/logos'
import { gatewayUrl } from '@/lib/config'
import { getDict, getLocale } from '@/lib/i18n'
import { FRASE_ONBOARD, FRASE_ONBOARD_EN } from '@/lib/onboard'
import { ENLACE } from '../../components/legal'
import { CtaInicio } from '../../components/cta-inicio'
import { Copiar } from './copiar'

/**
 * /docs/mcp: la página humana del servidor MCP del dueño. El endpoint vive en
 * el gateway (`/_owner/mcp`, tareas/mcp.ts) y en usepeaje.com/mcp responde el
 * otro MCP, el del catálogo del sitio: por eso esta página va aparte. Una sola
 * URL; el idioma sale de la cookie como en el resto del sitio.
 */

const MCP_URL = `${gatewayUrl}/_owner/mcp`
const CANONICAL = '/docs/mcp'

const MARCA: Record<string, Marca> = { claude: 'claude', 'claude-code': 'claude', chatgpt: 'chatgpt', cursor: 'cursor' }

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDict()).docsMcp
  return {
    title: t.metaTitulo,
    description: t.metaDescripcion,
    alternates: { canonical: CANONICAL },
    openGraph: { type: 'article', siteName: 'Peaje', url: CANONICAL, title: t.metaTitulo, description: t.metaDescripcion },
  }
}

/** Bloque de código con su botón de copiar. Rompe línea en vez de desbordar a 375 px. */
function Codigo({ texto, copiar, copiado, prosa }: { texto: string; copiar: string; copiado: string; prosa?: boolean }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-lg border border-border bg-panel p-3">
      {prosa ? (
        <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">{texto}</p>
      ) : (
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all">
          <code>{texto}</code>
        </pre>
      )}
      <Copiar texto={texto} etiqueta={copiar} listo={copiado} />
    </div>
  )
}

export default async function DocsMcp() {
  const [d, locale] = await Promise.all([getDict(), getLocale()])
  const t = d.docsMcp
  const frase = locale === 'es' ? FRASE_ONBOARD : FRASE_ONBOARD_EN
  const faq = t.faq({ ...REGALO, consulta: COSTOS_CREDITOS.consulta })
  const herramientas = t.herramientas({ consulta: COSTOS_CREDITOS.consulta, informe: COSTOS_CREDITOS.informe })

  const codigos: Record<string, string> = {
    'claude-code': `claude mcp add --transport http --scope user peaje ${MCP_URL}`,
    cursor: JSON.stringify({ mcpServers: { peaje: { url: MCP_URL } } }, null, 2),
  }
  // El mismo link prellenado que usa onboard.md (lib/onboard.ts).
  const formularioClaude = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Peaje&connectorUrl=${encodeURIComponent(MCP_URL)}`

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.p,
      acceptedAnswer: { '@type': 'Answer', text: f.r },
    })),
  }

  const columnas = [
    { titulo: t.solaTitulo, items: t.sola },
    { titulo: t.conSiTitulo, items: t.conSi },
    { titulo: t.nuncaTitulo, items: t.nunca },
  ]

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.titulo}</h1>
      <p className="mt-4 max-w-[65ch] text-[15px] text-muted">{t.intro}</p>

      <section className="mt-10" aria-labelledby="url">
        <h2 id="url" className="text-xl font-semibold">
          {t.urlTitulo}
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">{t.urlTexto}</p>
        <Codigo texto={MCP_URL} copiar={t.copiar} copiado={t.copiado} />
      </section>

      <section className="mt-10" aria-labelledby="corto">
        <h2 id="corto" className="text-xl font-semibold">
          {t.cortoTitulo}
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">{t.cortoTexto}</p>
        <Codigo texto={frase} copiar={t.copiar} copiado={t.copiado} prosa />
      </section>

      <section className="mt-14 border-t border-border pt-8" aria-labelledby="conectar">
        <h2 id="conectar" className="text-2xl font-semibold">
          {t.conectarTitulo}
        </h2>
        <p className="mt-2 text-sm text-muted">{t.conectarRevisado}</p>

        <div className="mt-6 grid gap-4">
          {t.clientes.map((c) => (
            <section key={c.id} id={c.id} className="rounded-lg border border-border p-5 sm:p-6" aria-labelledby={`${c.id}-titulo`}>
              <h3 id={`${c.id}-titulo`} className="flex items-center gap-3 text-lg font-semibold">
                <Logo marca={MARCA[c.id]} className="h-5 w-5 shrink-0" />
                <span className="min-w-0">{c.nombre}</span>
              </h3>
              <ol className="mt-4 flex flex-col gap-2.5 text-sm">
                {c.pasos.map((p, i) => (
                  <li key={p} className="flex gap-3">
                    <span aria-hidden className="mt-px w-4 shrink-0 text-right tabular-nums text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ol>
              {codigos[c.id] ? <Codigo texto={codigos[c.id]} copiar={t.copiar} copiado={t.copiado} /> : null}
              <p className="mt-4 text-sm text-muted">{c.nota}</p>
              {c.id === 'claude' ? (
                <a href={formularioClaude} target="_blank" rel="noopener noreferrer" className="btn btn-secundario mt-4 whitespace-normal">
                  {t.abrirClaude}
                </a>
              ) : null}
            </section>
          ))}
        </div>
        <p className="mt-5 max-w-[65ch] text-sm text-muted">{t.otras}</p>
      </section>

      <section className="mt-14 border-t border-border pt-8" aria-labelledby="herramientas">
        <h2 id="herramientas" className="text-2xl font-semibold">
          {t.herramientasTitulo}
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">{t.herramientasIntro}</p>
        <dl className="mt-5 divide-y divide-border border-y border-border">
          {herramientas.map((h) => (
            <div key={h.nombre} className="grid gap-1.5 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <dt className="min-w-0">
                <code className="font-mono text-[13px] break-all">{h.nombre}</code>
                <span className="mt-1 block text-xs text-muted">{t.tipos[h.tipo]}</span>
              </dt>
              <dd className="min-w-0 text-sm">{h.que}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 border-t border-border pt-8" aria-labelledby="permisos">
        <h2 id="permisos" className="text-2xl font-semibold">
          {t.permisosTitulo}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {columnas.map((col) => (
            <div key={col.titulo} className="min-w-0 rounded-lg border border-border bg-panel p-5">
              <h3 className="text-base font-semibold">{col.titulo}</h3>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
                {col.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-8" aria-labelledby="auth">
        <h2 id="auth" className="text-2xl font-semibold">
          {t.authTitulo}
        </h2>
        <div className="mt-4 flex max-w-[65ch] flex-col gap-3 text-[15px]">
          {t.auth.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-8" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-semibold">
          {t.faqTitulo}
        </h2>
        <dl className="mt-2 divide-y divide-border">
          {faq.map((f) => (
            <div key={f.p} className="py-4">
              <dt className="text-base font-semibold">{f.p}</dt>
              <dd className="mt-1.5 max-w-[65ch] text-sm text-muted">{f.r}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="fuentes">
        <h2 id="fuentes" className="text-base font-semibold">
          {t.fuentesTitulo}
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {t.fuentes.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                {f.texto}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <aside className="mt-14 rounded-lg border border-border bg-panel p-6 sm:p-8">
        <p className="text-xl font-semibold tracking-tight">{t.cierreTitulo}</p>
        <p className="mt-2 max-w-md text-sm text-muted">{t.cierreTexto}</p>
        {/* El cierre de las páginas públicas (cta-inicio.tsx). */}
        <CtaInicio alinear="inicio" className="mt-6" />
      </aside>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD de la FAQ, textos fijos del sitio
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }}
      />
    </article>
  )
}
