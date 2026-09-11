import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { getDict, type Dict } from '@/lib/i18n'
import { cachedScore, checkStatus, scannableDomain } from '@/lib/ora'
import { tenantIfMine } from '@/lib/session'
import { store } from '@/lib/store'
import {
  construirBloques,
  primeraRutaPaga,
  rutasDelProxy,
  type Bloque,
  type Oferta,
} from './bloques'
import { ToggleBlock, VerificadorIntegracion } from './partes'
import { BloqueProxy } from './proxy'
import { generarProxy } from '@/lib/proxy-kit'

type Kit = Dict['kit']

export default async function Kit({ params }: PageProps<'/t/[slug]/kit'>) {
  const { slug } = await params
  const { kit: d } = await getDict()
  const tenant = await tenantIfMine(slug)
  if (!tenant) {
    return (
      <p className="text-sm text-muted">
        {d.necesitasSesion}{' '}
        <Link href="/acceder" className="text-accent underline">
          {d.entrar}
        </Link>
      </p>
    )
  }

  const base = `${gatewayUrl}/${tenant.slug}`
  const domain = scannableDomain(tenant.originUrl)
  // El kit se aplica en el WEBSITE del negocio (dominio raíz), no en el host de la API.
  const originHost = domain ?? new URL(tenant.originUrl).hostname
  const score = domain ? await cachedScore(domain) : null

  const tieneJsonLd = checkStatus(score, 'json-ld') === 'pass'

  // Las ofertas salen del catálogo canónico del gateway, no de un armado
  // paralelo: así el JSON-LD dice lo mismo que el 402 cobra.
  const ofertas: Oferta[] = await fetch(`${base}/discovery/resources`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((b: { items?: { resource: string; extensions?: { bazaar?: { info?: { title?: string; priceUsd?: number } } } }[] }) =>
      (b.items ?? []).map((i) => ({
        titulo: i.extensions?.bazaar?.info?.title ?? i.resource,
        priceUsd: i.extensions?.bazaar?.info?.priceUsd ?? 0,
        url: i.resource,
      })),
    )
    .catch(() => [])

  const bloques = construirBloques({
    d,
    tenant: { name: tenant.name, slug: tenant.slug },
    base,
    originHost,
    ofertas,
    tieneJsonLd,
  })

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-medium">{d.titulo}</h1>
        <p className="mt-2 text-sm text-muted">
          {d.subtituloInicio}
          <strong>{originHost}</strong>
          {d.subtituloFin}
        </p>
      </header>

      <VerificadorIntegracion slug={tenant.slug} />

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="font-medium">{d.yaActivoTitulo}</h2>
        <p className="mt-1 text-xs text-muted">{d.yaActivoNota}</p>
        <ul className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <li className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{d.yaActivoDiscovery}</p>
            <a
              href={`${base}/openapi.json`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-xs text-accent hover:underline"
            >
              /openapi.json
            </a>
          </li>
          <li className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs uppercase tracking-wide text-muted">llms.txt</p>
            <a
              href={`${base}/llms.txt`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-xs text-accent hover:underline"
            >
              /llms.txt
            </a>
          </li>
          <li className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs uppercase tracking-wide text-muted">MCP</p>
            <span className="mt-1 block truncate font-mono text-xs text-accent">/mcp</span>
          </li>
        </ul>
      </section>

      <BloqueProxy base={base} />

      <div className="space-y-1">
        <h2 className="font-medium">{d.proxyManual}</h2>
        <p className="text-sm text-muted">{d.proxyManualDetalle}</p>
      </div>

      <PromptTodoDeUna
        d={d}
        bloques={bloques}
        base={base}
        originHost={originHost}
        domain={domain}
        rutaPaga={primeraRutaPaga(ofertas)}
      />

      <div className="space-y-3">
        {bloques.map((b) => (
          <ToggleBlock key={b.titulo} titulo={b.titulo} detalle={b.detalle} contenido={b.contenido} />
        ))}
      </div>

      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
        <p>
          {d.verificaInicio}
          {d.verificar}
          {d.verificaFin}
          <Link href={`/t/${tenant.slug}/score`} className="text-accent underline">
            {d.verificaLink}
          </Link>
        </p>
      </div>


    </div>
  )
}

function PromptTodoDeUna({
  d,
  bloques,
  base,
  originHost,
  domain,
  rutaPaga,
}: {
  d: Kit
  bloques: Bloque[]
  base: string
  originHost: string
  domain: string | null
  rutaPaga: string | null
}) {
  // El prompt sigue el idioma de la UI: sus secciones son los títulos y
  // detalles traducidos de los bloques, así que dejar el marco en otro idioma
  // lo dejaría a medias.
  const proxy = generarProxy('next', base, {
    titulo: d.proxyComentarioTitulo,
    sub: d.proxyComentarioSub,
    rutaPaga: d.proxyComentarioRutaPaga,
  })

  const prompt = `${d.promptIntro(originHost, base)}

## ${d.promptProxyTitulo}
${d.promptProxyDetalle}

\`\`\`ts
${proxy}
\`\`\`

${d.promptProxyNota}

## ${d.promptNoCrearTitulo}
${d.promptNoCrearDetalle}

${rutasDelProxy()
  .map((r) => `- ${r}`)
  .join('\n')}

${d.promptNoCrearCierre}

${bloques.map((b) => `## ${b.titulo}\n${b.detalle}\n\n\`\`\`\n${b.contenido}\n\`\`\``).join('\n\n')}

${d.promptVerifica(originHost, rutaPaga)}
${domain ? d.promptAuditConDominio(domain) : d.promptAuditSinDominio}

${d.promptReferencia}`

  return (
    <ToggleBlock
      titulo={d.promptTitulo}
      detalle={d.promptDetalle}
      contenido={prompt}
    />
  )
}
