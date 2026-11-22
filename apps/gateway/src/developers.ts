import type { Route, Tenant } from '@peaje/db'
import { cadena, dominioVerificable, jsonParaScript, NETWORKS } from '@peaje/shared'
import { env } from './env.js'
import { redesDocumentadas } from './settlement.js'

/**
 * Portal de desarrolladores: la página HTML que un humano (o un juez, o el
 * chequeo `developer-portal` de Ora) abre en `/developers` del dominio del
 * negocio. Todo sale de la DB: rutas, precios, redes. El negocio no escribe
 * ni una línea, el proxy del kit la reenvía como cualquier otra ruta.
 *
 * La sección de "API keys" que pide el chequeo existe, pero dice la verdad:
 * acá no hay keys, la credencial es el pago. En testnet el sandbox es la
 * misma superficie con tokens de faucet; en mainnet la sección lo dice.
 *
 * Para los motores de respuesta (ChatGPT, Perplexity, AI Overviews) esta es
 * la página citable del negocio: HTML completo sin JS, `index,follow`
 * explícito, un WebPage con `dateModified` y la fecha visible. La frescura
 * es una de las pocas señales que estos motores documentan.
 */

type Ctx = { tenant: Tenant; routes: Route[]; base: string; actualizado?: Date }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function developersHtml({ tenant, routes, base, actualizado = new Date() }: Ctx): string {
  const nombre = esc(tenant.name)
  // Las rutas no guardan fecha de cambio, así que la fecha es la de la
  // respuesta: la página se genera en vivo y eso es literalmente cierto.
  const fechaIso = actualizado.toISOString()
  const fechaDia = fechaIso.slice(0, 10)
  const fechaLegible = actualizado.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  // El Organization del kit se ancla en el dominio raíz del negocio (sin
  // `api.`/`www.`), no en el origin de la API: el `@id` tiene que ser el
  // mismo que el que emite peaje/head.html o el grafo no cierra.
  const raiz = dominioVerificable(tenant.originUrl)
  const origen = raiz ? `https://${raiz}` : new URL(base).origin
  const vendibles = routes.filter((r) => Number(r.priceUsd) > 0)
  // Sin ninguna ruta con precio, la página no habla de pagos: título, lede,
  // quickstart y pie describen endpoints gratis. Es el caso de usepeaje.com
  // mientras los cobros a agentes estén apagados en el sitio.
  const soloGratis = vendibles.length === 0
  // El portal de usepeaje.com mismo: ahí el título nombra el Radar y se
  // enlaza la guía del MCP del dueño (/docs/mcp, una página del dashboard).
  const propio = origen === new URL(env.dashboardUrl).origin
  const guiaMcp = `${env.dashboardUrl.replace(/\/$/, '')}/docs/mcp`
  const meta = soloGratis
    ? propio
      ? {
          // Search Console, nov 2026: 24 impresiones en la posición 6.7 y 0 clics con "Developer portal".
          titulo: `${tenant.name} API and MCP: free AI-readiness score for any site`,
          descripcion:
            'Score how AI agents read any website from 0 to 100, with the top fixes. Free over HTTP or MCP, no API key. Plus Peaje’s MCP for Claude and Cursor.',
        }
      : {
          titulo: `${tenant.name} API and MCP server · Free, no API key`,
          descripcion: `The ${tenant.name} API and MCP server, free with no API key or signup: endpoints, a curl quickstart, MCP config and openapi.json.`,
        }
    : {
        titulo: `${tenant.name} · Developer portal`,
        descripcion: `Pay-per-request API from ${tenant.name}: HTTP 402, stablecoin settlement, no API keys. Quickstart, pricing, MCP and sandbox.`,
      }
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${base}/developers`,
    url: `${base}/developers`,
    name: meta.titulo,
    description: meta.descripcion,
    inLanguage: 'en',
    dateModified: fechaIso,
    isPartOf: { '@id': `${origen}/#organization` },
    about: { '@id': `${origen}/#api` },
  }
  // Sin rutas con precio, un marcador y no una URL inventada: Google rastrea
  // las URLs del texto y /r/example le daba 404 (Search Console).
  const ejemplo = vendibles[0]?.pathPattern ?? '/<priced-route>'
  const precioEjemplo = vendibles[0] ? `$${Number(vendibles[0].priceUsd)}` : '$0.01'
  // La ruta gratis del quickstart, con sus parámetros como marcadores (`/api/radar/<dominio>`).
  const gratisEjemplo = routes[0] ? routes[0].pathPattern.replace(/:(\w+)/g, '<$1>') : null

  const filas = routes
    .map(
      (r) => `<tr>
  <td><code>${esc(r.method)} ${esc(r.pathPattern)}</code></td>
  <td>${esc(r.description ?? '')}</td>
  <td class="num">${Number(r.priceUsd) > 0 ? `$${Number(r.priceUsd)} USD` : 'Free'}</td>
</tr>`,
    )
    .join('\n')

  const redes = redesDocumentadas().map((id) => {
    const n = NETWORKS[id]
    const red = cadena(id, env.testnet)!
    return `<tr>
  <td>${esc(n.label)}</td>
  <td>${esc(n.tokenSymbol)}</td>
  <td class="num">${red.chainId}</td>
  <td><code>${esc(red.token)}</code></td>
</tr>`
  }).join('\n')

  // Con rutas con precio: el portal de siempre (402, rieles, sandbox con redes).
  const cuerpoPago = () => `  <header>
    <h1><small>Developer portal</small>${nombre} API</h1>
    <p class="lede">Pay per request over MPP (HTTP 402). No API keys, no signup, no plan: the request returns the price, you settle it in stablecoin, you get the resource plus a signed receipt.</p>
    <nav aria-label="Sections">
      <a href="#quickstart">Quickstart</a>
      <a href="#pricing">Pricing</a>
      <a href="#auth">Authentication</a>
      <a href="#mcp">MCP</a>
      <a href="#sandbox">Sandbox</a>
      <a href="#machine">Machine-readable</a>
    </nav>
  </header>

  <section id="quickstart">
    <h2>Quickstart</h2>
    <p>Three requests, no account. The whole flow is standard HTTP.</p>
    <div class="paso"><b>1</b><div><p>Ask for the resource. The 402 is not an error: it is the price, with one offer per network in <code>WWW-Authenticate</code>.</p>
<pre><code>curl -i ${base}${esc(ejemplo)}
# HTTP/2 402 · one offer per rail: ${precioEjemplo} in ${redesDocumentadas().map((id) => `${NETWORKS[id].tokenSymbol} (${(NETWORKS[id].label.split(' · ')[0] ?? NETWORKS[id].label)})`).join(', ')}</code></pre></div></div>
    <div class="paso"><b>2</b><div><p>Pay the challenge and retry. The reference client does both${env.testnet ? ', testnet wallet included' : ''}:</p>
<pre><code>npx mppx@latest ${base}${esc(ejemplo)}</code></pre></div></div>
    <div class="paso"><b>3</b><div><p>Read the resource. The response carries <code>Payment-Receipt</code> as proof. If the origin ever fails after you paid, the refund is automatic and on-chain.</p></div></div>
  </section>

  <section id="pricing">
    <h2>Pricing</h2>
    <p>Per call, in USD, settled in stablecoin. No minimums and no subscription.</p>
    <table>
      <thead><tr><th scope="col">Endpoint</th><th scope="col">What it is</th><th scope="col">Price</th></tr></thead>
      <tbody>
${filas}
      </tbody>
    </table>
  </section>

  <section id="auth">
    <h2>Authentication and API keys</h2>
    <p>There are none, by design. The payment is the credential: each request is authorized by the signed payment that travels with it, single-use and scoped to that call. Nothing to provision, rotate or leak.</p>
    <p>The full walkthrough, structured for agents and humans, lives at <a href="${base}/auth.md">/auth.md</a>.</p>
  </section>

  <section id="mcp">
    <h2>MCP server</h2>
    <p>The same catalog as paid tools over Streamable HTTP, for Claude, ChatGPT and any MCP client:</p>
<pre><code>{
  "mcpServers": {
    "${esc(tenant.slug)}": { "url": "${base}/mcp" }
  }
}</code></pre>
    <p>Each tool advertises its price in its description and returns a receipt in <code>_meta</code>. Discovery: <a href="${base}/.well-known/mcp">/.well-known/mcp</a>.</p>
  </section>

  <section id="sandbox">
    <h2>Sandbox</h2>
    <p class="nota">${
      env.testnet
        ? 'Everything above runs on testnets today, so the production surface IS the sandbox: same endpoints, same 402s, free faucet tokens. Nothing to break and no real money at risk while you integrate.'
        : 'There is no separate sandbox: payments here are real and settle on mainnet in the stablecoins below. Most routes cost cents, so the cheapest one is the test.'
    }</p>
    <table>
      <thead><tr><th scope="col">Network</th><th scope="col">Token</th><th scope="col">Chain id</th><th scope="col">Asset</th></tr></thead>
      <tbody>
${redes}
      </tbody>
    </table>
  </section>

  <section id="machine">
    <h2>Machine-readable</h2>
    <ul class="docs">
      <li><a href="${base}/openapi.json">openapi.json</a> <span>— typed spec with prices, error model and versioning</span></li>
      <li><a href="${base}/llms.txt">llms.txt</a> <span>— the agent-facing guide</span></li>
      <li><a href="${base}/discovery/resources">discovery/resources</a> <span>— x402 Bazaar: what answers 402, on what terms</span></li>
      <li><a href="${base}/.well-known/ard.json">.well-known/ard.json</a> <span>— ARD catalog</span></li>
      <li><a href="${base}/.well-known/ucp">.well-known/ucp</a> <span>— UCP commerce profile (ACP checkout, AP2 mandates)</span></li>
      <li><a href="${base}/pricing.md">pricing.md</a> · <a href="${base}/agents.md">agents.md</a> · <a href="${base}/auth.md">auth.md</a></li>
    </ul>
  </section>

  <footer>Charged per request via <a href="https://mpp.dev">MPP</a>. Gateway by Peaje. Last updated: <time datetime="${fechaDia}">${fechaLegible}</time>.</footer>`

  // Todo gratis: sin pagos, redes ni recibos. En usepeaje.com, además, el link a /docs/mcp.
  const lineaGuia = propio
    ? `<p>Want to connect Peaje to Claude, ChatGPT or Cursor for your own business (tasks, plan, your agent)? Use the owner server: <a href="${esc(guiaMcp)}">Peaje MCP server guide</a>.</p>`
    : ''
  const cuerpoGratis = () => `  <header>
    <h1><small>Developer portal</small>${nombre} API</h1>
    <p class="lede">${
      propio
        ? `Free API and MCP server from ${nombre}. Ask for any domain and get how AI agents read that site, scored 0 to 100, with the top fixes and the points each one adds. No API key, no signup.`
        : `Free endpoints from ${nombre} over plain HTTP and MCP. No API key and no signup: call the endpoint and read the response.`
    }</p>
    <nav aria-label="Sections">
      <a href="#quickstart">Quickstart</a>
      <a href="#pricing">Endpoints</a>
      <a href="#auth">Authentication</a>
      <a href="#mcp">MCP</a>
      <a href="#sandbox">Sandbox</a>
      <a href="#machine">Machine-readable</a>
    </nav>
  </header>

  <section id="quickstart">
    <h2>Quickstart</h2>
    <p>One request, no account. Plain HTTP:</p>
<pre><code>${gratisEjemplo ? `curl ${base}${esc(gratisEjemplo)}` : `curl ${base}/openapi.json`}</code></pre>
    <p>Or add the MCP server below to your AI tool and call the same endpoints as tools.</p>
  </section>

  <section id="pricing">
    <h2>Endpoints</h2>
    <p>All free. No minimums and no subscription.</p>
    <table>
      <thead><tr><th scope="col">Endpoint</th><th scope="col">What it is</th><th scope="col">Price</th></tr></thead>
      <tbody>
${filas}
      </tbody>
    </table>
  </section>

  <section id="auth">
    <h2>Authentication and API keys</h2>
    <p>There are none. These endpoints are public and free: nothing to provision, rotate or leak.</p>
  </section>

  <section id="mcp">
    <h2>MCP server</h2>
    <p>The same endpoints as tools over Streamable HTTP, for Claude, ChatGPT and any MCP client:</p>
<pre><code>{
  "mcpServers": {
    "${esc(tenant.slug)}": { "url": "${base}/mcp" }
  }
}</code></pre>
    <p>Discovery: <a href="${base}/.well-known/mcp">/.well-known/mcp</a>.</p>
    ${lineaGuia}
  </section>

  <section id="sandbox">
    <h2>Sandbox</h2>
    <p class="nota">There is no separate sandbox and none is needed: every endpoint here is free, so you can test against production.</p>
  </section>

  <section id="machine">
    <h2>Machine-readable</h2>
    <ul class="docs">
      <li><a href="${base}/openapi.json">openapi.json</a> <span>: typed spec with the error model and versioning</span></li>
      <li><a href="${base}/llms.txt">llms.txt</a> <span>: the agent-facing guide</span></li>
      <li><a href="${base}/.well-known/ard.json">.well-known/ard.json</a> <span>: ARD catalog</span></li>
      <li><a href="${base}/agents.md">agents.md</a></li>
    </ul>
  </section>

  <footer>Served by Peaje. Last updated: <time datetime="${fechaDia}">${fechaLegible}</time>.</footer>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.titulo)}</title>
<meta name="description" content="${esc(meta.descripcion)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${base}/developers">
<link rel="service-desc" type="application/openapi+json" href="${base}/openapi.json">
<script type="application/ld+json">
${jsonParaScript(webPage)}
</script>
<style>
  /* Paleta de design/direccion-visual.md: tinta/crema/naranja. */
  :root { --bg:#1a1917; --panel:#2a2825; --border:#3a3833; --text:#efebe2; --muted:#8c8880; --accent:#a2dae2; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif; }
  main { max-width:820px; margin:0 auto; padding:56px 20px 80px; }
  h1 { font-size:30px; font-weight:600; letter-spacing:-.02em; margin:0; }
  h1 small { display:block; font-size:13px; font-weight:400; color:var(--accent); letter-spacing:.14em; text-transform:uppercase; margin-bottom:10px; }
  .lede { color:var(--muted); max-width:56ch; margin:14px 0 0; }
  nav { display:flex; flex-wrap:wrap; gap:8px; margin:28px 0 44px; }
  nav a { color:var(--muted); text-decoration:none; font-size:13px; border:1px solid var(--border); border-radius:999px; padding:5px 12px; }
  nav a:hover { color:var(--text); border-color:var(--accent); }
  h2 { font-size:19px; font-weight:600; margin:52px 0 6px; letter-spacing:-.01em; }
  h2 + p { margin-top:6px; color:var(--muted); }
  section > p { max-width:64ch; }
  pre { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:14px 16px; overflow-x:auto; font:12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace; }
  code { font:.92em ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--accent); }
  td code { word-break:break-all; }
  pre code { color:var(--text); word-break:normal; }
  .paso { display:grid; grid-template-columns:26px 1fr; gap:12px; margin:18px 0; }
  .paso b { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border:1px solid var(--accent); border-radius:999px; color:var(--accent); font-size:12px; }
  .paso p { margin:2px 0 8px; }
  table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
  th { text-align:left; color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
  th,td { padding:9px 12px 9px 0; border-bottom:1px solid var(--border); vertical-align:top; }
  td.num { white-space:nowrap; }
  a { color:var(--accent); }
  ul.docs { list-style:none; padding:0; display:grid; gap:8px; }
  ul.docs li { border:1px solid var(--border); border-radius:10px; padding:10px 14px; background:var(--panel); }
  ul.docs span { color:var(--muted); font-size:13px; }
  .nota { border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:8px; background:var(--panel); padding:12px 16px; color:var(--muted); font-size:14px; }
  footer { margin-top:64px; padding-top:20px; border-top:1px solid var(--border); color:var(--muted); font-size:13px; }
  @media (max-width:560px){ th,td { padding-right:8px; } }
</style>
</head>
<body>
<main>
${soloGratis ? cuerpoGratis() : cuerpoPago()}
</main>
</body>
</html>`
}
