/**
 * El kit ensamblado por tenant: los archivos listos y las instrucciones
 * cortas. Lo sirve el gateway en `/:slug/kit.json` y lo consume el CLI
 * `npx peaje` y cualquier coding agent con curl.
 *
 * Los bytes de las reglas, el JSON-LD y el robots salen de acá y no de la
 * transcripción de un LLM. Lo que sigue en manos del agente (fusionar la
 * config, elegir dónde va el head, el link del footer) va escrito en
 * INSTALL.md, una vez, por nosotros.
 */
import {
  jsonLdOrganization,
  jsonLdWebApi,
  linksHtml,
  primeraRutaPaga,
  robotsTxt,
  scriptJsonLd,
  scriptJsonLdGraph,
  tieneDatosEntidad,
  type Entidad,
  type Oferta,
} from './bloques'
import { esHost, generarProxy, HOSTS, rutasABorrar, type Host } from './rutas'
import type { Chequeo } from './verificar'

export const KIT_VERSION = '2026-09-21'

/**
 * `create`: archivo nuevo, no pisar si existe.
 * `snippet`: pieza para fusionar en un archivo que ya existe (config del host).
 * `include`: drop-in que se referencia desde la config existente (nginx, Caddy).
 */
export type ModoArchivo = 'create' | 'snippet' | 'include'

export type ArchivoKit = { path: string; mode: ModoArchivo; content: string; nota: string }

export type Kit = {
  version: string
  slug: string
  host: Host | 'unknown'
  originHost: string
  gateway: string
  files: ArchivoKit[]
  /** Copias estáticas que hay que borrar si existen. */
  remove: string[]
  /** Lo que el agente tiene que hacer a mano, en orden. */
  manual: string[]
  /** Un link con precio para probar el 402 real, o null si no hay ofertas pagas. */
  paidPath: string | null
  verifyUrl: string
  installUrl: string
}

export type EntradaKit = {
  slug: string
  nombre: string
  originHost: string
  /** `${gatewayPublicUrl}/${slug}` */
  base: string
  ofertas: Oferta[]
  host?: string | null
  /** Resultado del verificador, para incluir solo lo que falta. */
  chequeos?: Chequeo[] | null
  /** Datos de entidad del dashboard: con alguno cargado, el head lleva Organization + WebAPI en un @graph. */
  entidad?: Entidad | null
  /** Bloquear bots de entrenamiento en robots.txt (no afecta la citación). */
  sinEntrenamiento?: boolean
}

export function construirKit(e: EntradaKit): Kit {
  const host: Host | 'unknown' = esHost(e.host) ? e.host : 'unknown'
  const falta = (id: Chequeo['id']) => !e.chequeos || e.chequeos.some((c) => c.id === id && !c.ok)
  const rutasPagas = e.ofertas.filter((o) => o.priceUsd > 0).map((o) => rutaSinSlug(o.url, e.slug))
  const files: ArchivoKit[] = []
  const manual: string[] = []

  if (falta('proxy')) {
    if (host === 'unknown') {
      // Sin host conocido, mandamos todos: el agente elige por lo que ve en el repo.
      for (const h of HOSTS) files.push(archivoProxy(h.id, h.archivo, e.base))
      manual.push('Pick the ONE proxy file that matches the host (see INSTALL.md) and ignore the others.')
    } else {
      const h = HOSTS.find((x) => x.id === host)!
      files.push(archivoProxy(h.id, h.archivo, e.base))
    }
    if (host === 'next' || host === 'unknown') {
      manual.push(
        'If middleware.ts or proxy.ts has a `matcher`, exclude mcp, r/, discovery/, checkout_sessions, agentic_commerce/ and docs from it: it runs before rewrites.',
      )
    }
  }

  if (falta('json-ld') || falta('links')) {
    const partes: string[] = []
    if (falta('json-ld')) partes.push(headJsonLd(e))
    if (falta('links')) partes.push(linksHtml())
    files.push({
      path: 'peaje/head.html',
      mode: 'snippet',
      content: partes.join('\n\n'),
      nota: 'Goes in the <head> of the homepage (the root layout in Next.js). The <a> goes in the footer or nav, visible.',
    })
    if (falta('links')) manual.push('Add the visible <a href="/developers"> link to the footer or nav component.')
  }

  if (falta('robots')) {
    files.push({
      path: 'public/robots.txt',
      mode: 'create',
      content: robotsTxt({ originHost: e.originHost, rutasPagas, sinEntrenamiento: e.sinEntrenamiento ?? false }),
      nota: 'Only if there is no robots.txt yet. If app/robots.ts exists, edit that one instead; Next fails the build with both.',
    })
  }

  const tapadas = e.chequeos?.find((c) => c.id === 'frescura')?.faltantes ?? []
  const remove = tapadas.length > 0 ? tapadas : falta('proxy') ? rutasABorrar() : []
  if (remove.length > 0) {
    manual.push(
      tapadas.length > 0
        ? `Measured right now: ${tapadas.join(', ')} are served by the site, not the gateway. Delete that static copy or route handler.`
        : 'If any path in `remove` exists as a static file (public/, static/) or route handler, delete it: the copy wins over the proxy and freezes.',
    )
  }
  manual.push('Deploy. Only after the deploy is live, run the verification (see INSTALL.md). Before that everything answers 404 and there is nothing to fix.')

  return {
    version: KIT_VERSION,
    slug: e.slug,
    host,
    originHost: e.originHost,
    gateway: e.base,
    files,
    remove,
    manual,
    paidPath: primeraRutaPaga(e.ofertas, e.slug),
    verifyUrl: `${e.base}/kit/verify`,
    installUrl: `${e.base}/kit/INSTALL.md`,
  }
}

/**
 * El JSON-LD de la home. Con datos de entidad va el grafo Organization +
 * WebAPI (el `provider` del WebAPI ya apuntaba a `#organization`); sin datos,
 * solo WebAPI, como antes: no inventamos una organización vacía.
 */
export function headJsonLd(e: Pick<EntradaKit, 'nombre' | 'slug' | 'originHost' | 'ofertas' | 'entidad'>): string {
  const webApi = jsonLdWebApi({ nombre: e.nombre, slug: e.slug, originHost: e.originHost, ofertas: e.ofertas })
  if (!tieneDatosEntidad(e.entidad)) return scriptJsonLd(webApi)
  const org = jsonLdOrganization({ nombre: e.nombre, originHost: e.originHost, ...e.entidad })
  return scriptJsonLdGraph([org, webApi])
}

function archivoProxy(host: Host, archivo: string, base: string): ArchivoKit {
  const notas: Record<Host, string> = {
    next: 'Merge into the existing next.config.*: spread these rules into `rewrites().beforeFiles`. If rewrites() returns an array today, convert it to { beforeFiles: [...these], afterFiles: [...existing] }. Or use `withPeaje()` from @peaje/next and skip the merge.',
    vercel: 'Merge into vercel.json: append to the "rewrites" array. Ignored on Next.js projects (use next.config instead).',
    cloudflare: 'Deploy as a Worker routed on the domain (wrangler). Only applies if the zone is on Cloudflare with the record proxied.',
    nginx: 'Drop the location blocks inside your existing server {} and reload.',
    caddy: 'Drop the matchers and reverse_proxy lines inside your existing site block and reload.',
  }
  const mode: ModoArchivo = host === 'nginx' || host === 'caddy' ? 'include' : 'snippet'
  return { path: `peaje/${archivo}`, mode, content: generarProxy(host, base), nota: notas[host] }
}

function rutaSinSlug(url: string, slug: string): string {
  try {
    const path = new URL(url).pathname
    return path.startsWith(`/${slug}/`) ? path.slice(slug.length + 1) : path
  } catch {
    return url
  }
}

/**
 * Las instrucciones para el coding agent. Cortas a propósito: unas 300
 * tokens. Lo que puede ser código está en kit.json; acá solo van las
 * decisiones de integración que hoy el agente improvisaba.
 */
export function installMd(k: Kit): string {
  const verify = k.paidPath
    ? `curl -s ${k.verifyUrl}   # JSON: every check with ok:true. Also: curl -sIL https://${k.originHost}${k.paidPath} must return 402.`
    : `curl -s ${k.verifyUrl}   # JSON: every check with ok:true.`
  return `# Install Peaje on ${k.originHost}

Gateway for this business: ${k.gateway}
Files and data: ${k.gateway}/kit.json${k.host === 'unknown' ? '?host=next|vercel|cloudflare|nginx|caddy' : `?host=${k.host}`}

Fastest path (Next.js): \`npx peaje@1 init ${k.slug} --yes --json\` does steps 1 to 4 and prints what is left for you.

## Rules
- Do NOT rewrite the contents of the files in kit.json. Write them as given; only merge where the file already exists.
- Do NOT create static copies of anything the proxy serves (openapi.json, .well-known/*, pricing.md...). A copy wins over the proxy and freezes. Your own llms.txt is fine: the gateway merges it.
- Do NOT run the verification before the deploy is live. 404s before deploy are not bugs.

## Steps
1. Proxy (the only step that moves the score). Merge the proxy file for your host into the existing config. Next.js: spread the rules into \`rewrites().beforeFiles\`; if \`rewrites()\` returns an array today, convert it to \`{ beforeFiles: [...peaje], afterFiles: [...existing] }\`. Keep wrappers like withSentryConfig/withNextIntl around the object. If a middleware/proxy \`matcher\` exists, exclude mcp, r/, discovery/, checkout_sessions, agentic_commerce/ and docs.
2. Head. Put peaje/head.html inside the <head> of the homepage: in Next.js app router that is the root layout, as JSX (\`<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />\` and plain \`<link>\` tags). If JSON-LD already exists, add this block next to it, do not replace it. The Organization node (logo, phone, address, profiles) comes from the data the owner filled in the Peaje dashboard: do not edit it here, change it there.
3. Footer. Add the visible \`<a href="/developers">API for agents</a>\` to the footer or nav.
4. robots.txt. Create public/robots.txt only if none exists. If app/robots.ts exists, edit it (allow the bots, keep the Sitemap line) and do not create the static file.
5. Remove the paths listed in \`remove\` if they exist as static files or route handlers.
6. Build, commit, deploy. Ask the owner to deploy if you cannot.
7. After the deploy is live:
   ${verify}
   Every check is measured from the business domain, not the gateway. If proxy shows missing paths, a rule is missing or the matcher swallows it. If frescura lists paths, a static copy is still winning: delete it.
`
}
