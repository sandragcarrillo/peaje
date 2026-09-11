export const kit = {
  es: {
    // Página
    necesitasSesion: 'Necesitás iniciar sesión.',
    entrar: 'Entrar',
    titulo: 'Haz que los agentes puedan encontrarte',
    subtituloInicio: 'Los bloques exactos para ',
    subtituloFin: ', en el orden que más score suma. Aplícalos por partes, o todo de una con el prompt.',

    yaActivoTitulo: 'Ya activo, sin que hagas nada',
    yaActivoNota: 'La capa Payments para Agentes (checks de MPP y x402) ya está cubierta.',
    yaActivoDiscovery: 'Discovery',

    verificaInicio: '¿Ya aplicaste el kit en tu web? Usa "',
    verificaFin: '" arriba, y después ',
    verificaLink: 'vuelve a correr el score →',

    // Bloques del kit (solo el texto explicativo: el contenido copiable no se traduce)
    bloqueJsonLd: '1 · JSON-LD con tu oferta',
    bloqueJsonLdExiste: 'Ya tienes JSON-LD: suma este bloque WebAPI junto al que existe.',
    bloqueJsonLdFalta: 'No tienes datos estructurados. Pega esto en el <head> de tu home.',

    bloqueLink: '2 · Links de discovery en tu HTML',
    bloqueLinkDetalle:
      'En el <head> de tu página principal. Apuntan a rutas de tu propio dominio: las sirve el proxy del paso 1.',

    bloqueRobots: '3 · robots.txt que no espanta agentes',
    bloqueRobotsDetalle:
      'Si tu robots.txt bloquea bots, los agentes no llegan ni a ver el 402.',

    // Prompt "todo de una"
    promptTitulo: 'Todo de una · prompt para tu coding agent',
    promptDetalle:
      'Pégalo en Claude Code, Cursor o el agente que uses sobre el repo de tu sitio: aplica todos los bloques, valida el flujo de pago y re-corre el score.',
    promptIntro: (originHost: string, base: string) =>
      `Haz mi sitio (${originHost}) agent-ready. Mi API ya cobra por request a agentes vía MPP con Peaje; el gateway es ${base}.

Aplica estos cambios en el repo del sitio:`,
    promptNoCrearTitulo: 'No crees estos archivos a mano',
    promptNoCrearDetalle:
      'El paso 1 ya los sirve desde tu dominio. Si además dejas una copia estática, la copia gana sobre el proxy, se congela el día que la copiaste y el auditor termina leyendo una versión vieja. Si alguno ya existe en tu repo (public/, static/, o como ruta), bórralo:',
    promptNoCrearCierre:
      'Tampoco toques tu llms.txt: el gateway lee el tuyo y le agrega la sección de pagos solo.',

    promptVerifica: (originHost: string, rutaPaga: string | null) =>
      `Al terminar, verifica contra TU dominio (no contra el gateway: el auditor mide tu origen). Cada línea tiene que dar el código que dice al lado:

\`\`\`bash
curl -sL -o /dev/null -w "%{http_code} ard\\n" https://${originHost}/.well-known/ard.json          # 200
curl -sL -o /dev/null -w "%{http_code} openapi\\n" https://${originHost}/openapi.json              # 200
curl -sL -o /dev/null -w "%{http_code} bazaar\\n" https://${originHost}/discovery/resources        # 200
curl -sL -o /dev/null -w "%{http_code} mcp-get\\n" https://${originHost}/mcp                       # 405
curl -sL -o /dev/null -w "%{http_code} mcp-post\\n" -X POST https://${originHost}/mcp \\
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'                                        # 200${
        rutaPaga
          ? `
curl -sL -o /dev/null -w "%{http_code} pago\\n" https://${originHost}${rutaPaga}                   # 402`
          : ''
      }
\`\`\`

El \`-L\` importa: si tu apex redirige a www (o al revés), sin él curl te muestra el 308 del redirect y parece que todo está roto.

Si alguna da 404, falta esa regla en la config del paso 1. Si alguna da 200 pero con contenido viejo, quedó una copia estática tapándola: bórrala.`,
    promptAuditConDominio: (domain: string) =>
      `Después corre el score y compáralo con el anterior:

\`\`\`bash
npx @ora-ai/ax@latest audit ${domain}
\`\`\``,
    promptAuditSinDominio:
      'Cuando el sitio tenga dominio público, corre el score: `npx @ora-ai/ax@latest audit <dominio>`.',
    promptReferencia:
      'Referencia completa del estándar de auditoría: https://ora.ai/skill.md',

    // partes.tsx
    copiar: 'copiar',
    copiado: 'copiado ✓',
    escaneando: 'Escaneando (~30 s)…',
    scanFallo: 'Falló el scan',
    verificadorTitulo: '¿Ya lo integraste?',
    verificadorNota:
      'Verificamos tu dominio bloque por bloque: qué está publicado y qué falta.',
    verificando: 'Verificando…',
    verificar: 'Verificar integración',
    publicados: (ok: number, total: number) => `${ok} de ${total} bloques publicados`,

    // actions.ts
    errorOriginLocal: 'Ora solo escanea dominios públicos; tu origin es local.',
    errorScan: 'El scan de Ora falló. Reintenta en un rato.',

    chequeoDominio: 'Dominio público',
    chequeoDominioDetalle: 'Tu origin es local: no hay dominio público que verificar.',

    chequeoLlms: 'llms.txt',
    chequeoLlmsOk: 'Existe y apunta a tu gateway.',
    chequeoLlmsSinGateway: 'Existe pero no menciona tu gateway: falta el bloque de Peaje.',
    chequeoLlmsFalta: 'No hay /llms.txt en tu dominio.',

    chequeoLink: 'Link de discovery en el HTML',
    chequeoLinkOk: 'La home tiene el <link rel="payment-discovery">.',
    chequeoLinkFalta: 'La home carga pero no tiene el link de discovery.',
    chequeoLinkSinHome: 'No pude leer tu home.',

    chequeoJsonLd: 'JSON-LD',
    chequeoJsonLdOk: 'La home tiene datos estructurados.',
    chequeoJsonLdFalta: 'La home no tiene el bloque JSON-LD.',

    chequeoPricing: 'pricing.md',
    chequeoPricingOk: 'Existe con tus precios.',
    chequeoPricingOtro: 'Existe pero no es el de Peaje.',
    chequeoPricingFalta: 'No hay /pricing.md.',

    chequeoMcp: '.well-known/mcp.json',
    chequeoMcpOk: 'Anuncia tu MCP pago.',
    chequeoMcpFalta: 'Falta o no apunta a tu MCP.',

    chequeoAiCatalog: '.well-known/ai-catalog.json',
    chequeoAiCatalogOk: 'Catálogo ARD publicado.',
    chequeoAiCatalogFalta: 'Falta el catálogo ARD.',

    chequeoAgentCard: '.well-known/agent-card.json',
    chequeoAgentCardOk: 'Agent card A2A publicada.',
    chequeoAgentCardFalta: 'Falta la agent card.',

    chequeoApiCatalog: '.well-known/api-catalog',
    chequeoApiCatalogOk: 'Catálogo RFC 9727 publicado.',
    chequeoApiCatalogFalta: 'Falta el api-catalog.',

    chequeoAuthMd: 'auth.md',
    chequeoAuthMdOk: 'Walkthrough de pago publicado.',
    chequeoAuthMdFalta: 'Falta /auth.md.',

    chequeoAgentsMd: 'agents.md',
    chequeoAgentsMdOk: 'Guía para agentes publicada.',
    chequeoAgentsMdFalta: 'Falta /agents.md.',

    chequeoRobots: 'robots.txt',
    chequeoRobotsOk: 'Existe (revisa que no bloquee bots).',
    chequeoRobotsFalta: 'No hay /robots.txt.',
    proxyTitulo: 'Conecta Peaje a tu dominio (una sola vez)',
    proxyIntro:
      'Los auditores de agent-readiness miden TU dominio. Un catálogo que apunta a otro host no cuenta: para ellos tu sitio no habla MCP ni devuelve 402. Con esta configuración esas rutas se sirven desde tu dominio, sin que toques tu código.',
    proxyRecomendado: 'Recomendado',
    proxyQueHace: '¿Qué rutas reenvía?',
    proxyRutaPaga: 'tus links con precio: acá es donde tu dominio devuelve el 402',
    proxyManual: 'O pégalos a mano',
    proxyManualDetalle:
      'Si no puedes tocar la configuración de tu host, copia estos bloques uno por uno. Cubren menos que el proxy: los checks de MCP y de pagos necesitan estar en tu origen.',
    hostNext: 'Next.js',
    hostVercel: 'Vercel (estático)',
    hostCloudflare: 'Cloudflare',
    hostNginx: 'nginx',
    hostCaddy: 'Caddy',
    proxyPaso1: '1 · ¿Dónde está tu sitio?',
    proxyPaso2: '2 · Pega esto y despliega',
    proxyPaso2Detalle: (archivo: string) => `Va en ${archivo}, en la raíz de tu repo. Si ya tienes ese archivo, agrega el bloque \`rewrites\` a lo que ya tengas.`,
    proxyCopiarConfig: 'Copiar configuración',
    proxyConfigCopiada: 'Copiada',
    proxyVerConfig: 'Ver la configuración',
    proxyPaso3: '3 · Listo. Vuelve a medir tu score.',
    proxyPaso3Detalle:
      'Desde el despliegue, tu dominio responde MCP, OpenAPI y 402 por su cuenta. Vuelve a la pestaña Score y vuelve a escanear.',
    proxyAvisoLocalhost:
      'Tu gateway apunta a localhost, así que esta configuración solo sirve para probar en local. Para producción, define GATEWAY_PUBLIC_URL con la URL pública de tu gateway.',
    proxyComentarioTitulo: 'Peaje: tu sitio pasa a hablar MPP, MCP y OpenAPI en tu propio dominio.',
    proxyComentarioSub: 'Estas rutas se sirven desde tu gateway sin que muevas tu código.',
    proxyComentarioRutaPaga: 'Links con precio: acá es donde tu dominio devuelve el 402.',
    promptProxyTitulo: 'Paso 1 (el que más importa): conectar el dominio',
    promptProxyDetalle:
      'Agrega estas reglas de reenvío en la configuración del host. Es lo único que hace que el sitio sirva MCP, OpenAPI y 402 desde su propio dominio, que es donde los auditores miden. El ejemplo es para Next.js; si el proyecto usa otro host, traduce las mismas rutas a su sintaxis (vercel.json, Cloudflare Worker, nginx o Caddy). Si ya existe una configuración, fusiona el bloque en vez de reemplazar el archivo.',
    promptProxyNota:
      'Los bloques que siguen son el respaldo para cuando no se puede tocar la configuración del host: cubren menos, porque los checks de MCP y de pagos exigen estar en el origen.',
  },
  en: {
    // Página
    necesitasSesion: 'You need to sign in.',
    entrar: 'Sign in',
    titulo: 'Make your site findable by agents',
    subtituloInicio: 'The exact blocks for ',
    subtituloFin:
      ', in the order that adds the most score. Apply them one by one, or all at once with the prompt.',

    yaActivoTitulo: 'Already live, nothing for you to do',
    yaActivoNota: 'The Payments for Agents layer (MPP and x402 checks) is already covered.',
    yaActivoDiscovery: 'Discovery',

    verificaInicio: 'Already applied the kit on your site? Use "',
    verificaFin: '" above, then ',
    verificaLink: 'run the score again →',

    // Bloques del kit (solo el texto explicativo: el contenido copiable no se traduce)
    bloqueJsonLd: '1 · JSON-LD with your offer',
    bloqueJsonLdExiste: 'You already have JSON-LD: add this WebAPI block alongside it.',
    bloqueJsonLdFalta: 'You have no structured data. Paste this into the <head> of your home page.',

    bloqueLink: '2 · Discovery links in your HTML',
    bloqueLinkDetalle:
      'In the <head> of your home page. They point at paths on your own domain: step 1 is what serves them.',

    bloqueRobots: '3 · A robots.txt that does not scare agents away',
    bloqueRobotsDetalle:
      'If your robots.txt blocks bots, agents never even get to see the 402.',

    // Prompt "todo de una"
    promptTitulo: 'All at once · prompt for your coding agent',
    promptDetalle:
      'Paste it into Claude Code, Cursor or whichever agent you run on your site repo: it applies every block, validates the payment flow and re-runs the score.',
    promptIntro: (originHost: string, base: string) =>
      `Make my site (${originHost}) agent-ready. My API already charges agents per request via MPP with Peaje; the gateway is ${base}.

Apply these changes in the site repo:`,
    promptNoCrearTitulo: 'Do not create these files by hand',
    promptNoCrearDetalle:
      'Step 1 already serves them from your domain. A static copy alongside it wins over the proxy, freezes on the day you copied it, and the auditor ends up reading a stale version. If any of these already exist in your repo (public/, static/, or as a route), delete them:',
    promptNoCrearCierre:
      'Leave your llms.txt alone too: the gateway reads yours and appends the payments section by itself.',

    promptVerifica: (originHost: string, rutaPaga: string | null) =>
      `When you are done, verify against YOUR domain (not the gateway: the auditor measures your origin). Each line must return the code next to it:

\`\`\`bash
curl -sL -o /dev/null -w "%{http_code} ard\\n" https://${originHost}/.well-known/ard.json          # 200
curl -sL -o /dev/null -w "%{http_code} openapi\\n" https://${originHost}/openapi.json              # 200
curl -sL -o /dev/null -w "%{http_code} bazaar\\n" https://${originHost}/discovery/resources        # 200
curl -sL -o /dev/null -w "%{http_code} mcp-get\\n" https://${originHost}/mcp                       # 405
curl -sL -o /dev/null -w "%{http_code} mcp-post\\n" -X POST https://${originHost}/mcp \\
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'                                        # 200${
        rutaPaga
          ? `
curl -sL -o /dev/null -w "%{http_code} paid\\n" https://${originHost}${rutaPaga}                   # 402`
          : ''
      }
\`\`\`

The \`-L\` matters: if your apex redirects to www (or the other way around), without it curl shows you the 308 from the redirect and everything looks broken.

A 404 means that rule is missing from the step 1 config. A 200 with stale content means a static copy is shadowing the proxy: delete it.`,
    promptAuditConDominio: (domain: string) =>
      `Then run the score and compare it against the previous one:

\`\`\`bash
npx @ora-ai/ax@latest audit ${domain}
\`\`\``,
    promptAuditSinDominio:
      'Once the site has a public domain, run the score: `npx @ora-ai/ax@latest audit <domain>`.',
    promptReferencia: 'Full reference for the audit standard: https://ora.ai/skill.md',

    // partes.tsx
    copiar: 'copy',
    copiado: 'copied ✓',
    escaneando: 'Scanning (~30 s)…',
    scanFallo: 'The scan failed',
    verificadorTitulo: 'Already integrated?',
    verificadorNota: 'We check your domain block by block: what is published and what is missing.',
    verificando: 'Checking…',
    verificar: 'Verify integration',
    publicados: (ok: number, total: number) => `${ok} of ${total} blocks published`,

    // actions.ts
    errorOriginLocal: 'Ora only scans public domains; your origin is local.',
    errorScan: 'The Ora scan failed. Try again in a bit.',

    chequeoDominio: 'Public domain',
    chequeoDominioDetalle: 'Your origin is local: there is no public domain to check.',

    chequeoLlms: 'llms.txt',
    chequeoLlmsOk: 'Present and pointing at your gateway.',
    chequeoLlmsSinGateway: 'Present but it does not mention your gateway: the Peaje block is missing.',
    chequeoLlmsFalta: 'There is no /llms.txt on your domain.',

    chequeoLink: 'Discovery link in the HTML',
    chequeoLinkOk: 'Your home page has the <link rel="payment-discovery">.',
    chequeoLinkFalta: 'Your home page loads but has no discovery link.',
    chequeoLinkSinHome: 'Could not read your home page.',

    chequeoJsonLd: 'JSON-LD',
    chequeoJsonLdOk: 'Your home page has structured data.',
    chequeoJsonLdFalta: 'Your home page has no JSON-LD block.',

    chequeoPricing: 'pricing.md',
    chequeoPricingOk: 'Present, with your prices.',
    chequeoPricingOtro: 'Present, but not the Peaje one.',
    chequeoPricingFalta: 'There is no /pricing.md.',

    chequeoMcp: '.well-known/mcp.json',
    chequeoMcpOk: 'Announces your paid MCP.',
    chequeoMcpFalta: 'Missing, or not pointing at your MCP.',

    chequeoAiCatalog: '.well-known/ai-catalog.json',
    chequeoAiCatalogOk: 'ARD catalog published.',
    chequeoAiCatalogFalta: 'ARD catalog missing.',

    chequeoAgentCard: '.well-known/agent-card.json',
    chequeoAgentCardOk: 'A2A agent card published.',
    chequeoAgentCardFalta: 'Agent card missing.',

    chequeoApiCatalog: '.well-known/api-catalog',
    chequeoApiCatalogOk: 'RFC 9727 catalog published.',
    chequeoApiCatalogFalta: 'api-catalog missing.',

    chequeoAuthMd: 'auth.md',
    chequeoAuthMdOk: 'Payment walkthrough published.',
    chequeoAuthMdFalta: '/auth.md missing.',

    chequeoAgentsMd: 'agents.md',
    chequeoAgentsMdOk: 'Agent guide published.',
    chequeoAgentsMdFalta: '/agents.md missing.',

    chequeoRobots: 'robots.txt',
    chequeoRobotsOk: 'Present (check that it does not block bots).',
    chequeoRobotsFalta: 'There is no /robots.txt.',
    proxyTitulo: 'Connect Peaje to your domain (once)',
    proxyIntro:
      'Agent-readiness auditors measure YOUR domain. A catalog pointing at another host does not count: as far as they can tell, your site speaks no MCP and returns no 402. With this config those routes are served from your domain, without touching your code.',
    proxyRecomendado: 'Recommended',
    proxyQueHace: 'Which routes does it forward?',
    proxyRutaPaga: 'your priced links: this is where your domain returns the 402',
    proxyManual: 'Or paste them by hand',
    proxyManualDetalle:
      'If you cannot touch your host config, copy these blocks one by one. They cover less than the proxy: the MCP and payment checks need to live on your origin.',
    hostNext: 'Next.js',
    hostVercel: 'Vercel (static)',
    hostCloudflare: 'Cloudflare',
    hostNginx: 'nginx',
    hostCaddy: 'Caddy',
    proxyPaso1: '1 · Where does your site run?',
    proxyPaso2: '2 · Paste this and deploy',
    proxyPaso2Detalle: (archivo: string) => `It goes in ${archivo}, at the root of your repo. If you already have that file, add the \`rewrites\` block to what is there.`,
    proxyCopiarConfig: 'Copy config',
    proxyConfigCopiada: 'Copied',
    proxyVerConfig: 'View the config',
    proxyPaso3: '3 · Done. Measure your score again.',
    proxyPaso3Detalle:
      'From the deploy on, your domain answers MCP, OpenAPI and 402 on its own. Go back to the Score tab and rescan.',
    proxyAvisoLocalhost:
      'Your gateway points at localhost, so this config only works for local testing. For production, set GATEWAY_PUBLIC_URL to your gateway public URL.',
    proxyComentarioTitulo: 'Peaje: your site now speaks MPP, MCP and OpenAPI on your own domain.',
    proxyComentarioSub: 'These routes are served from your gateway without touching your code.',
    proxyComentarioRutaPaga: 'Priced links: this is where your domain returns the 402.',
    promptProxyTitulo: 'Step 1 (the one that matters most): connect the domain',
    promptProxyDetalle:
      'Add these forwarding rules to the host config. It is the only thing that makes the site serve MCP, OpenAPI and 402 from its own domain, which is where auditors measure. The example is for Next.js; if the project uses another host, translate the same routes to its syntax (vercel.json, Cloudflare Worker, nginx or Caddy). If a config already exists, merge the block instead of replacing the file.',
    promptProxyNota:
      'If the host config truly cannot be touched, the site cannot pass the MCP or payment checks at all: those require answering from the origin. The blocks below are not a substitute for step 1, they are the parts no proxy can inject for you.',
  },
}
