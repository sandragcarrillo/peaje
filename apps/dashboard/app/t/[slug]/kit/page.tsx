import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { cachedScore, checkStatus, scannableDomain } from '@/lib/ora'
import { tenantIfMine } from '@/lib/session'
import { store } from '@/lib/store'
import { ToggleBlock, VerificadorIntegracion } from './partes'

export default async function Kit({ params }: PageProps<'/t/[slug]/kit'>) {
  const { slug } = await params
  const tenant = await tenantIfMine(slug)
  if (!tenant) {
    return (
      <p className="text-sm text-muted">
        Necesitás iniciar sesión.{' '}
        <Link href="/acceder" className="text-accent underline">
          Entrar
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
    tenant: { name: tenant.name, slug: tenant.slug },
    base,
    routes,
    tieneLlms,
    tieneJsonLd,
    desdeGateway: desdeGateway.filter((d): d is { path: string; contenido: string } => d.contenido !== null),
  })

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-medium">Haz que los agentes puedan encontrarte</h1>
        <p className="mt-2 text-sm text-muted">
          Los bloques exactos para <strong>{originHost}</strong>, en el orden que más score suma.
          Aplícalos por partes, o todo de una con el prompt.
        </p>
      </header>

      <VerificadorIntegracion slug={tenant.slug} />

      <section className="rounded-lg border border-border bg-panel p-4">
        <h2 className="font-medium">Ya activo, sin que hagas nada</h2>
        <p className="mt-1 text-xs text-muted">
          La capa Payments para Agentes (checks de MPP y x402) ya está cubierta.
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <li className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs uppercase tracking-wide text-muted">Discovery</p>
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

      <PromptTodoDeUna bloques={bloques} base={base} originHost={originHost} domain={domain} />

      <div className="space-y-3">
        {bloques.map((b) => (
          <ToggleBlock key={b.titulo} titulo={b.titulo} detalle={b.detalle} contenido={b.contenido} />
        ))}
      </div>

      <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
        <p>
          ¿Ya aplicaste el kit en tu web? Usa "Verificar integración" arriba, y después{' '}
          <Link href={`/t/${tenant.slug}/score`} className="text-accent underline">
            vuelve a correr el score →
          </Link>
        </p>
      </div>


    </div>
  )
}

type Bloque = { titulo: string; detalle: string; contenido: string }

function construirBloques({
  tenant,
  base,
  routes,
  tieneLlms,
  tieneJsonLd,
  desdeGateway,
}: {
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
      titulo: '1 · llms.txt',
      detalle: tieneLlms
        ? 'Ya tienes llms.txt: agrega este bloque al final del que existe.'
        : 'No tienes llms.txt. Crea el archivo /llms.txt en la raíz de tu dominio con esto.',
      contenido: tieneLlms ? llmsBloque : llmsCompleto,
    },
    {
      titulo: '2 · Link de discovery en tu HTML',
      detalle: 'En el <head> de tu página principal.',
      contenido: `<link rel="payment-discovery" href="${base}/openapi.json">`,
    },
    {
      titulo: '3 · JSON-LD con tu oferta',
      detalle: tieneJsonLd
        ? 'Ya tienes JSON-LD: suma este bloque WebAPI junto al que existe.'
        : 'No tienes datos estructurados. Pega esto en el <head> de tu home.',
      contenido: jsonLd,
    },
    {
      titulo: '4 · pricing.md',
      detalle: 'Precios en un archivo que los agentes leen directo. Sirve /pricing.md en tu dominio.',
      contenido: pricingMd,
    },
    {
      titulo: '5 · .well-known/mcp.json',
      detalle: 'Anuncia tu MCP pago donde los clientes MCP lo buscan.',
      contenido: wellKnownMcp,
    },
    {
      titulo: '6 · robots.txt que no espanta agentes',
      detalle: 'Si tu robots.txt bloquea bots, los agentes no llegan ni a ver el 402.',
      contenido: robots,
    },
    ...desdeGateway.map((d, i) => ({
      titulo: `${7 + i} · ${d.path}`,
      detalle: `Sube este archivo a tu dominio en /${d.path}. Se genera solo desde tus rutas; cuando cambies precios, vuelve al kit y copia la versión nueva.`,
      contenido: d.contenido,
    })),
  ]
}

function PromptTodoDeUna({
  bloques,
  base,
  originHost,
  domain,
}: {
  bloques: Bloque[]
  base: string
  originHost: string
  domain: string | null
}) {
  const prompt = `Haz mi sitio (${originHost}) agent-ready. Mi API ya cobra por request a agentes vía MPP con Peaje; el gateway es ${base}.

Aplica estos cambios en el repo del sitio:

${bloques.map((b) => `## ${b.titulo}\n${b.detalle}\n\n\`\`\`\n${b.contenido}\n\`\`\``).join('\n\n')}

Al terminar, verifica:
1. npx mppx@latest validate ${base}  (el flujo de pago, debe pasar todo)
2. ${domain ? `npx @ora-ai/ax@0.4 audit ${domain}  (el score de agent-readiness, compara contra el anterior)` : 'cuando el sitio tenga dominio público: npx @ora-ai/ax@0.4 audit <dominio>'}

Referencia completa del estándar de auditoría: https://ora.ai/skill.md`

  return (
    <ToggleBlock
      titulo="Todo de una · prompt para tu coding agent"
      detalle="Pégalo en Claude Code, Cursor o el agente que uses sobre el repo de tu sitio: aplica todos los bloques, valida el flujo de pago y re-corre el score."
      contenido={prompt}
      abierto
    />
  )
}
