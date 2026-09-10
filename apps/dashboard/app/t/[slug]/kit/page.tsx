import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { getDict, type Dict } from '@/lib/i18n'
import { cachedScore, checkStatus, scannableDomain } from '@/lib/ora'
import { tenantIfMine } from '@/lib/session'
import { store } from '@/lib/store'
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

  const routes = await store.listRoutes(tenant.id)
  const base = `${gatewayUrl}/${tenant.slug}`
  const domain = scannableDomain(tenant.originUrl)
  // El kit se aplica en el WEBSITE del negocio (dominio raíz), no en el host de la API.
  const originHost = domain ?? new URL(tenant.originUrl).hostname
  const score = domain ? await cachedScore(domain) : null

  const tieneLlms = checkStatus(score, 'llms-txt-exists') === 'pass'
  const tieneJsonLd = checkStatus(score, 'json-ld') === 'pass'

  const desdeGateway = await Promise.all(
    ['auth.md', 'agents.md', '.well-known/ai-catalog.json', '.well-known/agent-card.json', '.well-known/api-catalog'].map(
      async (path) => {
        const res = await fetch(`${base}/${path}`, { cache: 'no-store' })
        return { path, contenido: res.ok ? await res.text() : null }
      },
    ),
  )

  const bloques = construirBloques({
    d,
    tenant: { name: tenant.name, slug: tenant.slug },
    base,
    routes,
    tieneLlms,
    tieneJsonLd,
    desdeGateway: desdeGateway.filter(
      (g): g is { path: string; contenido: string } => g.contenido !== null,
    ),
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

      <PromptTodoDeUna d={d} bloques={bloques} base={base} originHost={originHost} domain={domain} />

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

type Bloque = { titulo: string; detalle: string; contenido: string }

function construirBloques({
  d,
  tenant,
  base,
  routes,
  tieneLlms,
  tieneJsonLd,
  desdeGateway,
}: {
  d: Kit
  tenant: { name: string; slug: string }
  base: string
  routes: { method: string; pathPattern: string; priceUsd: string; description: string | null }[]
  tieneLlms: boolean
  tieneJsonLd: boolean
  desdeGateway: { path: string; contenido: string }[]
}): Bloque[] {
  const llmsBloque = `## Pagos para agentes (MPP)

- API paga por request: ${base}
- Discovery (OpenAPI + precios): ${base}/openapi.json
- MCP (tools pagas): ${base}/mcp
- Precios: ${base}/llms.txt`

  const llmsCompleto = `# ${tenant.name}

> API con pagos por request para agentes (MPP sobre HTTP 402). Sin API keys ni registro.

${llmsBloque}`

  const jsonLd = `<script type="application/ld+json">
${JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'WebAPI',
      name: tenant.name,
      documentation: `${base}/openapi.json`,
      offers: routes.map((r) => ({
        '@type': 'Offer',
        price: Number(r.priceUsd),
        priceCurrency: 'USD',
        description: r.description ?? `${r.method} ${r.pathPattern}`,
      })),
    },
    null,
    2,
  )}
</script>`

  const pricingMd = `# Precios de la API de ${tenant.name}

Pago por request vía MPP (HTTP 402). Sin suscripción, sin API key: el agente paga y consume.

| Endpoint | Precio |
|---|---|
${routes.map((r) => `| ${r.method} ${r.pathPattern} | $${Number(r.priceUsd)} USD |`).join('\n')}

Gateway: ${base} · Discovery: ${base}/openapi.json`

  const wellKnownMcp = `{
  "servers": [
    {
      "name": "${tenant.slug}",
      "url": "${base}/mcp",
      "transport": "streamable-http",
      "description": "Tools pagas de ${tenant.name} (MPP por JSON-RPC)"
    }
  ]
}`

  const robots = `# Agentes bienvenidos: la API cobra por request vía MPP (HTTP 402)
User-agent: *
Allow: /
# Payment discovery: ${base}/openapi.json`

  return [
    {
      titulo: d.bloqueLlms,
      detalle: tieneLlms ? d.bloqueLlmsExiste : d.bloqueLlmsFalta,
      contenido: tieneLlms ? llmsBloque : llmsCompleto,
    },
    {
      titulo: d.bloqueLink,
      detalle: d.bloqueLinkDetalle,
      contenido: `<link rel="payment-discovery" href="${base}/openapi.json">`,
    },
    {
      titulo: d.bloqueJsonLd,
      detalle: tieneJsonLd ? d.bloqueJsonLdExiste : d.bloqueJsonLdFalta,
      contenido: jsonLd,
    },
    {
      titulo: d.bloquePricing,
      detalle: d.bloquePricingDetalle,
      contenido: pricingMd,
    },
    {
      titulo: d.bloqueMcp,
      detalle: d.bloqueMcpDetalle,
      contenido: wellKnownMcp,
    },
    {
      titulo: d.bloqueRobots,
      detalle: d.bloqueRobotsDetalle,
      contenido: robots,
    },
    ...desdeGateway.map((g, i) => ({
      titulo: `${7 + i} · ${g.path}`,
      detalle: d.bloqueGatewayDetalle(g.path),
      contenido: g.contenido,
    })),
  ]
}

function PromptTodoDeUna({
  d,
  bloques,
  base,
  originHost,
  domain,
}: {
  d: Kit
  bloques: Bloque[]
  base: string
  originHost: string
  domain: string | null
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

${bloques.map((b) => `## ${b.titulo}\n${b.detalle}\n\n\`\`\`\n${b.contenido}\n\`\`\``).join('\n\n')}

${d.promptVerifica(base)}
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
