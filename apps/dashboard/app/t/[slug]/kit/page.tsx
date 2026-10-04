import Link from 'next/link'
import { gatewayUrl } from '@/lib/config'
import { PageHeader } from '@/components/chrome'
import { getDict } from '@/lib/i18n'
import { cachedScore, checkStatus, scannableDomain } from '@/lib/ora'
import { tenantIfMine } from '@/lib/session'
import { store } from '@/lib/store'
import {
  construirBloques,
  primeraRutaPaga,
  rutasDelProxy,
  type Oferta,
} from './bloques'
import { MotoresDeRespuesta } from './motores'
import { ImplementarPeaje, ToggleBlock, VerificacionProvider, type Pieza } from './partes'
import { BloqueProxy } from './proxy'
import { UltimaVerificacion } from './ultima-verificacion'
import { Copiable, Pestanas, PromptAgente } from './comando'
import { generarProxy, secretoOrigen, type Entidad } from '@peaje/shared'

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
  const secreto = await secretoOrigen(tenant.embedSecret)
  const dashboardUrl = process.env.DASHBOARD_PUBLIC_URL ?? 'https://usepeaje.com'
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

  const configProxy = generarProxy('next', base, {
    titulo: d.proxyComentarioTitulo,
    sub: d.proxyComentarioSub,
    rutaPaga: d.proxyComentarioRutaPaga,
  })

  // Lo que el negocio cargó en "Motores de respuesta": alimenta el
  // Organization del head y el toggle del robots, en el kit y en el prompt.
  const entidad: Entidad = {
    logoUrl: tenant.entityLogoUrl,
    telefono: tenant.entityPhone,
    direccion: tenant.entityAddress,
    sameAs: tenant.entitySameAs,
    descripcion: tenant.entityDescription,
  }

  const bloques = construirBloques({
    d,
    tenant: { name: tenant.name, slug: tenant.slug },
    originHost,
    ofertas,
    tieneJsonLd,
    entidad,
    sinEntrenamiento: tenant.robotsBlockTraining,
  })

  return (
    <VerificacionProvider slug={tenant.slug}>
      <div className="max-w-3xl space-y-8">
        <PageHeader
          eyebrow={`KIT / ${originHost}`}
          titulo={d.titulo}
          sub={
            <>
              {d.subtituloInicio}
              <strong className="text-text">{originHost}</strong>
              {d.subtituloFin}
            </>
          }
        />

        <Pestanas
          agente={
            <section className="space-y-4 border border-accent/40 bg-panel p-5">
              <div>
                <h2 className="font-medium">{d.agenteTitulo}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{d.agenteIntro}</p>
              </div>
              <PromptAgente texto={d.promptAgente(originHost, base, tenant.slug, secreto, `${dashboardUrl}/t/${tenant.slug}/kit`)} />
              <p className="text-sm text-muted">{d.agentePermisos}</p>
              <p className="text-sm text-muted">{d.agenteDespues}</p>
            </section>
          }
          manual={
            <section className="space-y-4 border border-accent/40 bg-panel p-5">
              <div>
                <h2 className="font-medium">{d.unComandoTitulo}</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{d.unComandoIntro}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm">1. {d.unComandoPaso1}</p>
                <Copiable texto={`npx @peaje/cli@1 init ${tenant.slug}`} />
              </div>
              <div className="space-y-2">
                <p className="text-sm">2. {d.unComandoPaso2}</p>
                <Copiable texto={`PEAJE_ORIGIN_SECRET=${secreto}`} />
                <p className="text-xs text-muted">{d.unComandoPaso2Nota}</p>
              </div>
              <p className="text-sm">3. {d.unComandoPaso3}</p>
            </section>
          }
        />

        <UltimaVerificacion tenantId={tenant.id} />

        <ImplementarPeaje
          piezas={[
            {
              id: 'proxy',
              titulo: d.promptProxyTitulo,
              detalle: d.promptProxyDetalle,
              contenido: configProxy,
            },
            ...bloques.map((b): Pieza => ({
              id: b.id,
              titulo: b.titulo,
              detalle: b.detalle,
              contenido: b.contenido,
              contenidoAeo: b.contenidoAeo,
            })),
          ]}
          marco={{
            originHost,
            base,
            slug: tenant.slug,
            intro: d.promptIntro(originHost, base),
            introAeo: d.promptIntroAeo(originHost),
            noCrearTitulo: d.promptNoCrearTitulo,
            noCrearDetalle: d.promptNoCrearDetalle,
            noCrearCierre: d.promptNoCrearCierre,
            rutas: rutasDelProxy(),
            verifica: d.promptVerifica(originHost, primeraRutaPaga(ofertas, tenant.slug)),
            audit: domain ? d.promptAuditConDominio(domain) : d.promptAuditSinDominio,
            referencia: d.promptReferencia,
          }}
        />

        <details className="border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted hover:text-text">{d.avanzado}</summary>
          <div className="space-y-8 border-t border-border p-4">
        <MotoresDeRespuesta
          slug={tenant.slug}
          nombre={tenant.name}
          entidad={entidad}
          bloquearEntrenamiento={tenant.robotsBlockTraining}
        />

        <BloqueProxy base={base} />

        <div className="space-y-1">
          <h2 className="font-medium">{d.proxyManual}</h2>
          <p className="text-sm text-muted">{d.proxyManualDetalle}</p>
        </div>


        <div className="space-y-3">
          {bloques.map((b) => (
            <ToggleBlock key={b.titulo} titulo={b.titulo} detalle={b.detalle} contenido={b.contenido} />
          ))}
        </div>

        <section className="rounded-lg border border-border bg-panel p-4">
          <h2 className="font-medium">{d.yaActivoTitulo}</h2>
          <p className="mt-1 text-xs text-muted">{d.yaActivoNota}</p>
          <ul className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <li className="rounded-lg border border-border bg-bg p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{d.yaActivoDiscovery}</p>
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
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">llms.txt</p>
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
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">MCP</p>
              <span className="mt-1 block truncate font-mono text-xs text-accent">/mcp</span>
            </li>
          </ul>
        </section>

          </div>
        </details>

        <div className="rounded-lg border border-accent/40 bg-panel p-4 text-sm">
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
    </VerificacionProvider>
  )
}
