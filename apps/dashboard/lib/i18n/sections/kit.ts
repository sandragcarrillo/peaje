export const kit = {
  es: {
    monitorUltima: 'Última verificación',
    pestanaAgente: 'Usa tu herramienta de IA',
    pestanaManual: 'Hazlo tú',
    agenteTitulo: 'Pégale este texto a tu herramienta de IA',
    agenteIntro: 'Sirve con las herramientas que editan el código de tu sitio: Claude Code, Cursor, Codex, Copilot o Windsurf, abiertas en el proyecto. En Lovable, v0 o Bolt sirve si tu sitio es Next.js, o Vite publicado en Vercel. Tu herramienta primero revisa y te muestra qué va a cambiar; no toca nada hasta que le digas que sí.',
    agenteCopiar: 'Copiar el texto',
    agenteCopiado: 'Copiado',
    agenteDespues: 'Cuando tu herramienta termine, agrega la clave en tu hosting, publica el sitio y vuelve aquí: abajo revisamos que todo quedó bien.',
    agentePermisos: 'Antes de editar, tu herramienta te muestra la lista de archivos y el cambio en cada uno. En Next.js son cuatro: next.config, proxy.ts o middleware.ts, el layout y package.json, más .env.example si tu proyecto lo tiene. Si la lista trae algo más, pregúntale por qué. Nada se publica hasta que tú publiques.',
    agenteClave: 'Después, agrega esta clave en tu hosting (Vercel, Railway, Cloudflare)',
    agenteClaveNota: 'Solo hace falta si cobras rutas de API en tu dominio. No va en el texto de arriba para que no quede en el historial de tu herramienta de IA. No la subas al repositorio.',
    promptAgente: (originHost: string, base: string, slug: string, panel: string, rutas: string[]) =>
      [
        `Quiero instalar Peaje en este proyecto. Antes de cambiar nada, revisa y muéstrame el plan.`,
        ``,
        `Qué es Peaje: un servicio (usepeaje.com) que sirve desde mi propio dominio un llms.txt, un openapi.json, un servidor MCP y archivos de descubrimiento para agentes de IA, y que cobra con HTTP 402 las rutas a las que yo les ponga precio. Se instala con paquetes de npm con licencia MIT y sin dependencias. Puedes comprobarlo antes:`,
        `- Código: https://github.com/sandragcarrillo/peaje/tree/main/packages (peaje-next y peaje-proxy)`,
        `- npm: npm view @peaje/next y npm view @peaje/proxy`,
        `- Lo que Peaje ya publica para mi negocio: ${base}/llms.txt y ${base}/openapi.json`,
        ``,
        `Mis datos: sitio ${originHost}, identificador en Peaje (slug) ${slug}, gateway ${base}.`,
        ``,
        `Qué va a cambiar`,
        `Peaje pasa a responder en mi dominio estas rutas: ${rutas.join(', ')}. Si configuro PEAJE_ORIGIN_SECRET, también las rutas de API a las que ponga precio en el panel. Las requests a esas rutas van al gateway con sus headers; las demás siguen a mi sitio sin cambios. La lista viene dentro del paquete y el middleware la actualiza cada minuto desde ${base}/kit/manifest.json, que es donde aparecen las rutas de API con precio.`,
        `- Next.js con app router:`,
        `  1. package.json: la dependencia @peaje/next.`,
        `  2. next.config: envolver el export con withPeaje(config, { slug: '${slug}' }), con import { withPeaje } from '@peaje/next'. Agrega esas rutas en rewrites().beforeFiles y conserva las que ya existan.`,
        `  3. proxy.ts (Next 16) o middleware.ts (Next 14 y 15), junto a la carpeta app/ o pages/ (en la raíz o en src/): import { peajeProxy } from '@peaje/next/proxy'; export default peajeProxy({ slug: '${slug}' }); export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }. Si ya hay un middleware, envuélvelo con peajeProxy({ slug: '${slug}' }, middlewareActual) y revisa que su matcher incluya esas rutas.`,
        `  4. app/layout: <PeajeHead slug="${slug}" originHost="${originHost}" /> dentro de <head>, con import { PeajeHead } from '@peaje/next/head'. Pone un JSON-LD con mis ofertas y cuatro <link> de descubrimiento. No carga scripts para los visitantes: lee las ofertas del gateway en el servidor, con caché de una hora.`,
        `- Next.js con pages router: los pasos 1 a 3 igual; en vez del 4, dime y lo vemos.`,
        `- Express: la dependencia @peaje/proxy y app.use(peajeExpress({ slug: '${slug}' })) antes de express.json() y de las rutas, con import { peajeExpress } from '@peaje/proxy/express'.`,
        `- Hono: la dependencia @peaje/proxy y app.use(peajeHono({ slug: '${slug}' })), con import { peajeHono } from '@peaje/proxy/hono'.`,
        `- Vite u otro sitio estático publicado en Vercel: la dependencia @peaje/proxy y middleware.ts en la raíz: import peaje from '@peaje/proxy/vercel'; export default peaje({ slug: '${slug}' }); export const config = { matcher: ['/((?!assets/|favicon.ico).*)'] }.`,
        `- Otro stack u otro hosting: no improvises. Dime cuál es y para ahí.`,
        ``,
        `Paso 1, revisar sin escribir: detecta framework, versión, router y hosting. Busca si mi sitio ya usa alguna de esas rutas (páginas, route handlers, archivos en public/). Si quieres, lee el código de los paquetes.`,
        `Paso 2, mostrarme el plan: los archivos que vas a tocar, con el diff, y cualquier ruta que choque con una mía. Espera mi confirmación antes de editar o instalar.`,
        `Paso 3, aplicar: solo esos cambios. Instala la dependencia con el gestor de paquetes del proyecto.`,
        `Paso 4, verificar: corre el build. Cuando yo publique, estas URLs deben responder desde mi dominio: https://${originHost}/llms.txt (200), https://${originHost}/openapi.json (200) y https://${originHost}/mcp (405 con GET). El chequeo completo está en ${base}/kit/verify (JSON con ok: true) y en ${panel}.`,
        ``,
        `La clave PEAJE_ORIGIN_SECRET solo hace falta para cobrar rutas de API en mi dominio. No te la paso y no la necesitas: no la pidas ni la escribas en ningún archivo. Si el proyecto tiene .env.example, agrega la línea PEAJE_ORIGIN_SECRET= sin valor, y confirma que .env y .env.local están en .gitignore. Al final, explícame en palabras simples y con los nombres de los menús cómo la agrego en mi hosting y cómo vuelvo a publicar. El valor lo copio de ${panel}.`,
        ``,
        `Para deshacerlo: revierte estos cambios con git y desinstala el paquete. Si agregué la clave en el hosting, la borro de ahí.`,
        ``,
        `No hagas: commit, push ni deploy (eso lo hago yo); cambios fuera del plan; copias propias de los archivos que sirve Peaje (openapi.json, /.well-known/*); borrar archivos. Si algo no cuadra con este texto, dime qué y pregúntame.`,
      ].join('\n'),
    unComandoTitulo: 'Instala Peaje con un comando',
    unComandoIntro: 'Córrelo en la carpeta de tu proyecto. Detecta si usas Next.js, Vite, Express o Hono y deja listo lo que los agentes leen. El código es público: github.com/sandragcarrillo/peaje.',
    unComandoPlan: 'Mira qué va a cambiar. No escribe nada',
    unComandoPaso1: 'Aplícalo. Te muestra los cambios y te pide confirmar',
    unComandoPaso2: 'Agrega esta variable en tu hosting (Vercel, Railway, Cloudflare)',
    unComandoPaso2Nota: 'Sirve para cobrar rutas de API en tu dominio. No la subas al repositorio.',
    unComandoPaso3: 'Publica tu sitio y vuelve aquí: abajo revisamos que todo quedó bien',
    unComandoCopiar: 'Copiar',
    secretoMostrar: 'Mostrar la clave',
    secretoOcultar: 'Ocultar la clave',
    secretoTapado: 'La clave está oculta. Copiar copia la clave completa.',
    unComandoCopiado: 'Copiado',
    sinTerminal: '¿Usas Lovable, v0, Cursor u otra herramienta de IA? Copia las instrucciones de abajo y pégaselas.',
    avanzado: 'Opciones avanzadas: datos de tu sitio, instalación a mano y archivos',
    secretoTitulo: 'Secreto del sitio',
    secretoIntro: 'Ponlo como variable de entorno en tu hosting (Vercel, Railway, Cloudflare). Con él, tus rutas de API con precio cobran en tu dominio: el gateway lo manda cuando el agente ya pagó y tu sitio sabe que puede responder.',
    secretoNota: 'No lo publiques en el repo. Si se filtra, cualquiera puede llamar tus rutas de API sin pagar.',
    monitorNunca: 'todavía no corrió; el monitor revisa tu dominio cada día',
    monitorOk: (ok: number, total: number) => `${ok} de ${total} chequeos ok`,
    monitorHace: (min: number) => (min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`),
    // Página
    necesitasSesion: 'Necesitás iniciar sesión.',
    entrar: 'Entrar',
    titulo: 'Haz que los agentes puedan encontrarte',
    subtituloInicio: 'Un comando deja ',
    subtituloFin: ' legible para agentes. Cobrar es opcional: lo decides ruta por ruta.',

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
      'Los <link> van en el <head> de tu página principal y el <a> visible en tu footer o nav: los auditores piden la documentación enlazada desde la home. Todo apunta a rutas de tu propio dominio, las sirve el proxy del paso 1.',

    bloqueRobots: '3 · robots.txt que no espanta agentes',
    bloqueRobotsDetalle:
      'Si tu robots.txt bloquea bots, los agentes no llegan ni a ver el 402.',

    // Prompt "todo de una"
    promptTitulo: 'Todo de una · prompt para tu coding agent',
    promptDetalle:
      'Pégalo en Claude Code, Cursor o el agente que uses sobre el repo de tu sitio: aplica todos los bloques, valida el flujo de pago y re-corre el score.',
    promptIntro: (originHost: string, base: string) =>
      `Quiero que los agentes de IA puedan leer mi sitio (${originHost}) con Peaje (usepeaje.com, código en https://github.com/sandragcarrillo/peaje). El gateway de mi negocio es ${base}.

Estos son los cambios para el repo del sitio. Antes de editar, muéstrame el plan con el diff y espera mi confirmación. No hagas commit ni deploy: eso lo hago yo.`,
    promptNoCrearTitulo: 'No crees estos archivos a mano',
    promptNoCrearDetalle:
      'El paso 1 ya los sirve desde tu dominio. Si además dejas una copia estática, la copia gana sobre el proxy, se congela el día que la copiaste y el auditor termina leyendo una versión vieja. Si alguno ya existe en el repo (public/, static/, o como ruta), muéstramelo y, con mi confirmación, muévelo a .peaje-backup/ para poder volver atrás:',
    promptNoCrearCierre:
      'Tampoco toques tu llms.txt: el gateway lee el tuyo y le agrega la sección de pagos solo.',
    promptTapadas: (paths: string[]) =>
      `Medido ahora mismo: ${paths.join(', ')} ${paths.length === 1 ? 'lo sirve' : 'los sirve'} el sitio, no el gateway. Hay una copia estática o un route handler propio tapando el proxy. Búscalo (public/, static/, app/<ruta>/route.ts, pages/api/), muéstramelo y, con mi confirmación, muévelo a .peaje-backup/.`,

    promptVerifica: (originHost: string, rutaPaga: string | null) =>
      `Cuando el sitio esté publicado, verifica contra mi dominio y no contra el gateway: el auditor mide el origen. Cada línea tiene que dar el código que dice al lado:

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

Si alguna da 404, falta esa regla en la config del paso 1. Si alguna da 200 pero con contenido viejo, quedó una copia estática tapándola: dime cuál es antes de sacarla.`,
    promptAuditConDominio: (domain: string) =>
      `Opcional: corre el score y compáralo con el anterior. Lo calcula Ora, un medidor de terceros (npm @ora-ai/ax, código en https://github.com/ora/ax):

\`\`\`bash
npx @ora-ai/ax@latest audit ${domain}
\`\`\``,
    promptAuditSinDominio:
      'Cuando el sitio tenga dominio público, puedes medirlo con Ora, un medidor de terceros: `npx @ora-ai/ax@latest audit <dominio>`.',
    promptReferencia:
      'Referencia del estándar de Ora, para leer si hace falta: https://ora.ai/skill.md',

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

    implementaTitulo: 'Implementa Peaje',
    implementaIntro:
      'Medimos tu dominio en vivo. El prompt es una línea: tu agente baja del gateway los archivos ya generados y las instrucciones, y solo fusiona lo que falta.',
    implementaVerLargo: 'Ver el prompt largo (respaldo)',
    implementaLargoDetalle:
      'Solo si tu agente no puede descargar URLs. Trae los mismos bloques pegados en el texto.',
    capaTitulo: 'Qué instalar',
    capaTodo: 'Todo el kit',
    capaTodoDetalle: 'Proxy al gateway (MCP, OpenAPI y 402 en tu dominio), datos estructurados, robots y motores de respuesta.',
    capaAeo: 'Solo motores de respuesta',
    capaAeoDetalle: 'robots.txt por bot y ficha de tu sitio (Organization) en el head. Sin proxy ni cobro. Para que ChatGPT, Perplexity y Google te lean; no para que los agentes te paguen.',
    promptIntroAeo: (originHost: string) =>
      `Haz que los motores de respuesta puedan leer mi sitio (${originHost}). No conectes ningún proxy ni cobro: solo estos bloques en el repo del sitio:`,
    promptCortoAeo: (originHost: string, base: string, slug: string, faltan: string[]) =>
      `Quiero preparar este sitio (${originHost}) para motores de respuesta con Peaje (usepeaje.com, código en https://github.com/sandragcarrillo/peaje), solo esa capa: sin proxy, sin cobro y sin dependencias. Son dos cambios: un JSON-LD Organization en el <head> de la home y el robots.txt.${
        faltan.length > 0 ? ` Según la última medición de mi dominio, falta: ${faltan.join(', ')}.` : ''
      } Los archivos generados para mi negocio están en ${base}/kit.json?layers=aeo, y las instrucciones en ${base}/kit/INSTALL.md?layers=aeo; úsalos de referencia. Si tienes terminal, \`npx @peaje/cli@1 plan ${slug} --only aeo\` muestra los cambios sin escribir nada. Muéstrame el plan con el diff y espera mi confirmación; con mi sí, aplica a mano o con \`npx @peaje/cli@1 init ${slug} --only aeo --yes\`. Lo que te pido aquí manda sobre esos archivos. No reescribas el contenido del kit y no hagas commit ni deploy: eso lo hago yo. Cuando publique, revisa ${base}/kit/verify?layers=aeo y arregla solo lo que salga en false.`,
    promptCorto: (originHost: string, base: string, slug: string, faltan: string[]) =>
      `Quiero completar la instalación de Peaje (usepeaje.com, código en https://github.com/sandragcarrillo/peaje) en el repo de este sitio (${originHost}).${
        faltan.length > 0 ? ` Según la última medición de mi dominio, falta: ${faltan.join(', ')}.` : ''
      } Los archivos generados para mi negocio están en ${base}/kit.json (agrega ?host=next|vercel|cloudflare|nginx|caddy según el hosting), y las instrucciones en ${base}/kit/INSTALL.md; úsalos de referencia. Si tienes terminal, \`npx @peaje/cli@1 plan ${slug}\` muestra los cambios sin escribir nada. Muéstrame el plan con el diff y espera mi confirmación; con mi sí, aplica a mano o con \`npx @peaje/cli@1 init ${slug} --yes\`. Lo que te pido aquí manda sobre esos archivos. No reescribas el contenido del kit, no crees copias estáticas de lo que sirve el proxy y no hagas commit ni deploy: eso lo hago yo. Cuando publique, revisa ${base}/kit/verify y arregla solo lo que salga en false.`,
    implementaMidiendo: 'Midiendo tu dominio…',
    implementaListoTitulo: 'Ya lo tienes listo',
    implementaListoDetalle:
      'Todo lo que Peaje puede poner en tu dominio está publicado. No hay nada que pegarle a un agente: vuelve a correr el score para ver el cambio.',
    implementaFaltan: (n: number) =>
      n === 1 ? 'Falta 1 cosa. El prompt de abajo es solo esa.' : `Faltan ${n} cosas. El prompt de abajo es solo esas.`,
    implementaCopiar: 'Copiar prompt de lo que falta',
    implementaCopiado: 'Prompt copiado',
    implementaVer: 'Ver el prompt',
    verificarDeNuevo: 'Verificar de nuevo',

    chequeoProxy: 'Tu dominio conectado',
    chequeoProxyOk: 'MCP, catálogos y 402 responden desde tu dominio.',
    chequeoProxyFalta: 'Todavía no: tu dominio no reenvía ninguna ruta al gateway.',
    chequeoProxyParcial: (faltan: number, total: number) =>
      `${total - faltan} de ${total} rutas responden. Faltan reglas en la config.`,

    chequeoFrescura: 'Sin copias tapando el proxy',
    chequeoFrescuraOk: 'Todo lo que sirve tu dominio lo genera el gateway en vivo.',
    chequeoFrescuraVieja: (paths: string) =>
      `Hay copias estáticas o rutas propias sirviendo ${paths}. Le ganan al proxy y se quedan viejas: hay que borrarlas.`,

    chequeoLink: 'Links de discovery en el HTML',
    chequeoLinkOk: 'La home los tiene.',
    chequeoLinkFalta: 'La home carga pero no tiene los links.',
    chequeoLinkSinHome: 'No pude leer tu home.',

    chequeoJsonLd: 'JSON-LD',
    chequeoJsonLdOk: 'La home tiene datos estructurados.',
    chequeoJsonLdFalta: 'La home no tiene el bloque JSON-LD.',

    chequeoRobots: 'robots.txt',
    chequeoRobotsOk: 'Existe y no bloquea agentes.',
    chequeoRobotsBloquea: 'Existe pero bloquea todo: los agentes no llegan al 402.',
    chequeoRobotsFalta: 'No hay /robots.txt.',

    chequeoBots: 'Los bots que citan te leen',
    chequeoBotsOk: 'OAI-SearchBot, PerplexityBot y Googlebot leen tu home y /developers.',
    chequeoBotsBloqueados: (casos: string) => `Tu borde los rechaza (403/429/503): ${casos}. Permítelos por nombre en el WAF.`,
    chequeoBotsChallenge: (casos: string) =>
      `Cloudflare les pide un challenge que no pueden pasar: ${casos}. Desactiva el bot fight mode para estos bots.`,
    chequeoBotsSinHtml:
      'Tu home responde 200 pero sin <title> ni <h1>: depende de JavaScript y los motores no lo ejecutan.',

    // Motores de respuesta
    motoresTitulo: 'Motores de respuesta',
    motoresIntro:
      'ChatGPT, Perplexity y los AI Overviews de Google citan lo que pueden leer: HTML sin JavaScript, bots de búsqueda permitidos por nombre y una entidad que puedan reconocer. Esto vive en el mismo kit: el robots.txt y el head de tu home ya lo incluyen.',
    motoresNota:
      'Esto hace que los motores puedan leer y entender tu sitio. Que te citen depende de contenido y menciones de terceros que Peaje no puede generar.',
    motoresChequeos: 'Lo que medimos',
    motoresMidiendo: 'Midiendo…',
    motoresSinDominio: 'Sin dominio público no hay nada que medir.',

    entidadTitulo: 'Tu entidad',
    entidadIntro:
      'Va al bloque Organization del JSON-LD de tu home, junto al WebAPI. Solo lo que llenes: no inventamos campos vacíos.',
    entidadLogo: 'URL del logo',
    entidadTelefono: 'Teléfono',
    entidadDireccion: 'Dirección (una línea)',
    entidadDescripcion: 'Descripción corta',
    entidadDescripcionAyuda: 'Máximo 300 caracteres. Qué es tu sitio, en una frase.',
    entidadSameAs: 'Perfiles (sameAs)',
    entidadSameAsAyuda: 'Una URL por línea: LinkedIn, Instagram, Google Business Profile, Wikidata.',
    entidadBloquearEntrenamiento: 'Bloquear bots de entrenamiento (no afecta las citas)',
    entidadBloquearEntrenamientoAyuda:
      'GPTBot, ClaudeBot, Google-Extended, Applebot-Extended y CCBot. Los bots de búsqueda siguen permitidos.',
    entidadGuardar: 'Guardar',
    entidadGuardando: 'Guardando…',
    entidadGuardado: 'Guardado. El kit y el head ya usan estos datos.',
    errorEntidadUrl: (url: string) => `"${url}" no es una URL válida (tiene que empezar con https://).`,
    errorEntidadDescripcionLarga: 'La descripción supera los 300 caracteres.',

    fueraTitulo: 'Fuera de tu sitio',
    fueraIntro:
      'Los motores confían en menciones de terceros. Crea o revisa estos perfiles con el nombre y la dirección escritos exactamente igual que acá.',
    fueraNombre: 'Nombre',
    fueraDireccion: 'Dirección',
    fueraSinDireccion: 'Carga la dirección arriba para copiarla desde acá.',
    fueraAbrir: 'abrir',
    proxyTitulo: 'Conecta Peaje a tu dominio (una sola vez)',
    proxyIntro:
      'Los auditores de agent-readiness miden tu dominio. Un catálogo que apunta a otro host no cuenta: para ellos tu sitio no habla MCP ni devuelve 402. Con esta configuración esas rutas se sirven desde tu dominio, sin que toques tu código.',
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
      'Agrega estas reglas de reenvío en la configuración del host. Es lo único que hace que el sitio sirva MCP, OpenAPI y 402 desde su propio dominio, que es donde los auditores miden. El ejemplo es para Next.js; si el proyecto usa otro host, traduce las mismas rutas a su sintaxis (vercel.json, Cloudflare Worker, nginx o Caddy). Si ya existe una configuración, fusiona el bloque en vez de reemplazar el archivo.\n\nSi el proyecto tiene middleware (i18n, auth, A/B testing), revisa su `matcher`: corre antes de los rewrites y puede tragarse estas rutas. Excluye `mcp`, `r/`, `discovery/`, `checkout_sessions`, `agentic_commerce/` y `docs` del matcher. Los paths con punto (`llms.txt`, `openapi.json`, `/.well-known/*`) suelen estar excluidos ya.',
    promptProxyNota:
      'Los bloques que siguen son el respaldo para cuando no se puede tocar la configuración del host: cubren menos, porque los checks de MCP y de pagos exigen estar en el origen.',
  },
  en: {
    monitorUltima: 'Last check',
    pestanaAgente: 'Use your AI coding tool',
    pestanaManual: 'Do it yourself',
    agenteTitulo: 'Paste this into your AI coding tool',
    agenteIntro: 'Works with tools that edit your site code: Claude Code, Cursor, Codex, Copilot or Windsurf, open in the project. In Lovable, v0 or Bolt it works if your site is Next.js, or Vite deployed on Vercel. Your tool first reviews and shows you what will change; it touches nothing until you say yes.',
    agenteCopiar: 'Copy the text',
    agenteCopiado: 'Copied',
    agenteDespues: 'When your tool is done, add the key in your hosting, deploy the site and come back here: below we check everything is in place.',
    agentePermisos: 'Before editing, your tool shows you the list of files and the change in each one. On Next.js there are four: next.config, proxy.ts or middleware.ts, the layout and package.json, plus .env.example if your project has one. If the list has anything else, ask it why. Nothing goes live until you deploy.',
    agenteClave: 'Then add this key in your hosting (Vercel, Railway, Cloudflare)',
    agenteClaveNota: 'Only needed if you charge for API routes on your domain. It is not in the text above so it does not end up in your AI tool history. Do not commit it to the repo.',
    promptAgente: (originHost: string, base: string, slug: string, panel: string, rutas: string[]) =>
      [
        `I want to install Peaje in this project. Before changing anything, review it and show me the plan.`,
        ``,
        `What Peaje is: a service (usepeaje.com) that serves, from my own domain, an llms.txt, an openapi.json, an MCP server and discovery files for AI agents, and charges over HTTP 402 for the routes I put a price on. It installs with npm packages that are MIT licensed and have no dependencies. You can check before:`,
        `- Code: https://github.com/sandragcarrillo/peaje/tree/main/packages (peaje-next and peaje-proxy)`,
        `- npm: npm view @peaje/next and npm view @peaje/proxy`,
        `- What Peaje already publishes for my business: ${base}/llms.txt and ${base}/openapi.json`,
        ``,
        `My details: site ${originHost}, Peaje identifier (slug) ${slug}, gateway ${base}.`,
        ``,
        `What will change`,
        `Peaje starts answering these routes on my domain: ${rutas.join(', ')}. If I set PEAJE_ORIGIN_SECRET, also the API routes I price in the dashboard. Requests to those routes go to the gateway with their headers; everything else reaches my site unchanged. The list ships inside the package and the middleware refreshes it every minute from ${base}/kit/manifest.json, which is where the priced API routes show up.`,
        `- Next.js with the app router:`,
        `  1. package.json: the @peaje/next dependency.`,
        `  2. next.config: wrap the export with withPeaje(config, { slug: '${slug}' }), with import { withPeaje } from '@peaje/next'. It adds those routes to rewrites().beforeFiles and keeps the ones already there.`,
        `  3. proxy.ts (Next 16) or middleware.ts (Next 14 and 15), next to the app/ or pages/ folder (at the root or in src/): import { peajeProxy } from '@peaje/next/proxy'; export default peajeProxy({ slug: '${slug}' }); export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }. If a middleware already exists, wrap it with peajeProxy({ slug: '${slug}' }, currentMiddleware) and check that its matcher includes those routes.`,
        `  4. app/layout: <PeajeHead slug="${slug}" originHost="${originHost}" /> inside <head>, with import { PeajeHead } from '@peaje/next/head'. It renders a JSON-LD block with my offers and four discovery <link> tags. It loads no scripts for visitors: it reads the offers from the gateway on the server, cached for one hour.`,
        `- Next.js with the pages router: steps 1 to 3 the same; instead of step 4, tell me and we will decide.`,
        `- Express: the @peaje/proxy dependency and app.use(peajeExpress({ slug: '${slug}' })) before express.json() and the routes, with import { peajeExpress } from '@peaje/proxy/express'.`,
        `- Hono: the @peaje/proxy dependency and app.use(peajeHono({ slug: '${slug}' })), with import { peajeHono } from '@peaje/proxy/hono'.`,
        `- Vite or another static site deployed on Vercel: the @peaje/proxy dependency and middleware.ts at the root: import peaje from '@peaje/proxy/vercel'; export default peaje({ slug: '${slug}' }); export const config = { matcher: ['/((?!assets/|favicon.ico).*)'] }.`,
        `- Any other stack or hosting: do not improvise. Tell me which one it is and stop there.`,
        ``,
        `Step 1, review without writing: detect the framework, version, router and hosting. Check whether my site already uses any of those routes (pages, route handlers, files in public/). Read the package code if you want.`,
        `Step 2, show me the plan: the files you will touch, with the diff, and any route that collides with one of mine. Wait for my confirmation before editing or installing.`,
        `Step 3, apply: only those changes. Install the dependency with the project's package manager.`,
        `Step 4, verify: run the build. Once I deploy, these URLs must answer from my domain: https://${originHost}/llms.txt (200), https://${originHost}/openapi.json (200) and https://${originHost}/mcp (405 on GET). The full check is at ${base}/kit/verify (JSON with ok: true) and at ${panel}.`,
        ``,
        `The PEAJE_ORIGIN_SECRET key is only needed to charge for API routes on my domain. I am not giving it to you and you do not need it: do not ask for it or write it into any file. If the project has a .env.example, add the line PEAJE_ORIGIN_SECRET= with no value, and confirm that .env and .env.local are in .gitignore. At the end, explain in plain words, with the menu names, how I add it in my hosting and how I redeploy. I copy the value from ${panel}.`,
        ``,
        `To undo it: revert these changes with git and uninstall the package. If I added the key in the hosting, I delete it there.`,
        ``,
        `Do not: commit, push or deploy (I do that); make changes outside the plan; create your own copies of the files Peaje serves (openapi.json, /.well-known/*); delete files. If anything does not match this text, tell me what and ask me.`,
      ].join('\n'),
    unComandoTitulo: 'Install Peaje with one command',
    unComandoIntro: 'Run it in your project folder. It detects Next.js, Vite, Express or Hono and sets up what agents read. The code is public: github.com/sandragcarrillo/peaje.',
    unComandoPlan: 'See what will change. It writes nothing',
    unComandoPaso1: 'Apply it. It shows you the changes and asks you to confirm',
    unComandoPaso2: 'Add this variable in your hosting (Vercel, Railway, Cloudflare)',
    unComandoPaso2Nota: 'It lets priced API routes charge on your domain. Do not commit it to the repo.',
    unComandoPaso3: 'Deploy your site and come back: below we check everything is in place',
    unComandoCopiar: 'Copy',
    secretoMostrar: 'Show the key',
    secretoOcultar: 'Hide the key',
    secretoTapado: 'The key is hidden. Copy copies the full key.',
    unComandoCopiado: 'Copied',
    sinTerminal: 'Using Lovable, v0, Cursor or another AI tool? Copy the instructions below and paste them in.',
    avanzado: 'Advanced options: your site details, manual install and files',
    secretoTitulo: 'Site secret',
    secretoIntro: 'Set it as an environment variable in your hosting (Vercel, Railway, Cloudflare). With it, your priced API routes charge on your domain: the gateway sends it once the agent paid, and your site knows it can answer.',
    secretoNota: 'Do not commit it to the repo. If it leaks, anyone can call your API routes without paying.',
    monitorNunca: 'not run yet; the monitor checks your domain daily',
    monitorOk: (ok: number, total: number) => `${ok} of ${total} checks ok`,
    monitorHace: (min: number) => (min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`),
    // Página
    necesitasSesion: 'You need to sign in.',
    entrar: 'Sign in',
    titulo: 'Make your site findable by agents',
    subtituloInicio: 'One command makes ',
    subtituloFin:
      ' readable by agents. Charging is optional: you decide route by route.',

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
      'The <link> tags go in the <head> of your home page and the visible <a> in your footer or nav: auditors require documentation linked from the homepage. Everything points at paths on your own domain, served by step 1.',

    bloqueRobots: '3 · A robots.txt that does not scare agents away',
    bloqueRobotsDetalle:
      'If your robots.txt blocks bots, agents never even get to see the 402.',

    // Prompt "todo de una"
    promptTitulo: 'All at once · prompt for your coding agent',
    promptDetalle:
      'Paste it into Claude Code, Cursor or whichever agent you run on your site repo: it applies every block, validates the payment flow and re-runs the score.',
    promptIntro: (originHost: string, base: string) =>
      `I want AI agents to be able to read my site (${originHost}) with Peaje (usepeaje.com, code at https://github.com/sandragcarrillo/peaje). My business gateway is ${base}.

These are the changes for the site repo. Before editing, show me the plan with the diff and wait for my confirmation. Do not commit or deploy: I do that.`,
    promptNoCrearTitulo: 'Do not create these files by hand',
    promptNoCrearDetalle:
      'Step 1 already serves them from your domain. A static copy alongside it wins over the proxy, freezes on the day you copied it, and the auditor ends up reading a stale version. If any of these already exist in the repo (public/, static/, or as a route), show it to me and, once I confirm, move it to .peaje-backup/ so it can be restored:',
    promptNoCrearCierre:
      'Leave your llms.txt alone too: the gateway reads yours and appends the payments section by itself.',
    promptTapadas: (paths: string[]) =>
      `Measured right now: ${paths.join(', ')} ${paths.length === 1 ? 'is' : 'are'} served by the site, not the gateway. A static copy or a route handler of your own is shadowing the proxy. Find it (public/, static/, app/<path>/route.ts, pages/api/), show it to me and, once I confirm, move it to .peaje-backup/.`,

    promptVerifica: (originHost: string, rutaPaga: string | null) =>
      `Once the site is deployed, verify against my domain and not the gateway: the auditor measures the origin. Each line must return the code next to it:

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

A 404 means that rule is missing from the step 1 config. A 200 with stale content means a static copy is shadowing the proxy: tell me which one before removing it.`,
    promptAuditConDominio: (domain: string) =>
      `Optional: run the score and compare it against the previous one. It comes from Ora, a third-party scanner (npm @ora-ai/ax, code at https://github.com/ora/ax):

\`\`\`bash
npx @ora-ai/ax@latest audit ${domain}
\`\`\``,
    promptAuditSinDominio:
      'Once the site has a public domain, you can measure it with Ora, a third-party scanner: `npx @ora-ai/ax@latest audit <domain>`.',
    promptReferencia: 'Reference for the Ora standard, to read if needed: https://ora.ai/skill.md',

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

    implementaTitulo: 'Implement Peaje',
    implementaIntro:
      'We measure your domain live. The prompt is one line: your agent downloads the generated files and the instructions from the gateway and only merges what is missing.',
    implementaVerLargo: 'Show the long prompt (fallback)',
    implementaLargoDetalle:
      'Only if your agent cannot download URLs. Same blocks, pasted inline.',
    capaTitulo: 'What to install',
    capaTodo: 'The whole kit',
    capaTodoDetalle: 'Proxy to the gateway (MCP, OpenAPI and 402 on your domain), structured data, robots and answer engines.',
    capaAeo: 'Answer engines only',
    capaAeoDetalle: 'robots.txt by bot and your site card (Organization) in the head. No proxy, no charging. So ChatGPT, Perplexity and Google can read you; not so agents can pay you.',
    promptIntroAeo: (originHost: string) =>
      `Make my site (${originHost}) readable by answer engines. Do not connect any proxy or charging: only these blocks in the site repo:`,
    promptCortoAeo: (originHost: string, base: string, slug: string, faltan: string[]) =>
      `I want to prepare this site (${originHost}) for answer engines with Peaje (usepeaje.com, code at https://github.com/sandragcarrillo/peaje), only that layer: no proxy, no charging and no dependencies. It is two changes: an Organization JSON-LD in the homepage <head> and the robots.txt.${
        faltan.length > 0 ? ` According to the latest measurement of my domain, missing: ${faltan.join(', ')}.` : ''
      } The files generated for my business are at ${base}/kit.json?layers=aeo, and the instructions at ${base}/kit/INSTALL.md?layers=aeo; use them as reference. If you have a terminal, \`npx @peaje/cli@1 plan ${slug} --only aeo\` shows the changes without writing anything. Show me the plan with the diff and wait for my confirmation; once I say yes, apply it by hand or with \`npx @peaje/cli@1 init ${slug} --only aeo --yes\`. What I ask here takes precedence over those files. Do not rewrite the kit contents and do not commit or deploy: I do that. Once I deploy, read ${base}/kit/verify?layers=aeo and fix only what comes back false.`,
    promptCorto: (originHost: string, base: string, slug: string, faltan: string[]) =>
      `I want to finish installing Peaje (usepeaje.com, code at https://github.com/sandragcarrillo/peaje) in this site's repo (${originHost}).${
        faltan.length > 0 ? ` According to the latest measurement of my domain, missing: ${faltan.join(', ')}.` : ''
      } The files generated for my business are at ${base}/kit.json (add ?host=next|vercel|cloudflare|nginx|caddy for the hosting), and the instructions at ${base}/kit/INSTALL.md; use them as reference. If you have a terminal, \`npx @peaje/cli@1 plan ${slug}\` shows the changes without writing anything. Show me the plan with the diff and wait for my confirmation; once I say yes, apply it by hand or with \`npx @peaje/cli@1 init ${slug} --yes\`. What I ask here takes precedence over those files. Do not rewrite the kit contents, do not create static copies of what the proxy serves, and do not commit or deploy: I do that. Once I deploy, read ${base}/kit/verify and fix only what comes back false.`,
    implementaMidiendo: 'Measuring your domain…',
    implementaListoTitulo: 'You already have this ready',
    implementaListoDetalle:
      'Everything Peaje can put on your domain is published. There is nothing to hand an agent: run the score again to see the change.',
    implementaFaltan: (n: number) =>
      n === 1 ? '1 thing missing. The prompt below is just that one.' : `${n} things missing. The prompt below is just those.`,
    implementaCopiar: 'Copy prompt for what is missing',
    implementaCopiado: 'Prompt copied',
    implementaVer: 'View the prompt',
    verificarDeNuevo: 'Verify again',

    chequeoProxy: 'Your domain connected',
    chequeoProxyOk: 'MCP, catalogs and 402 all answer from your domain.',
    chequeoProxyFalta: 'Not yet: your domain forwards no routes to the gateway.',
    chequeoProxyParcial: (faltan: number, total: number) =>
      `${total - faltan} of ${total} routes answer. Some rules are missing from the config.`,

    chequeoFrescura: 'No copies shadowing the proxy',
    chequeoFrescuraOk: 'Everything your domain serves is generated live by the gateway.',
    chequeoFrescuraVieja: (paths: string) =>
      `Static copies or your own routes are serving ${paths}. They win over the proxy and go stale: delete them.`,

    chequeoLink: 'Discovery links in the HTML',
    chequeoLinkOk: 'Your home page has them.',
    chequeoLinkFalta: 'Your home page loads but has no discovery links.',
    chequeoLinkSinHome: 'Could not read your home page.',

    chequeoJsonLd: 'JSON-LD',
    chequeoJsonLdOk: 'Your home page has structured data.',
    chequeoJsonLdFalta: 'Your home page has no JSON-LD block.',

    chequeoRobots: 'robots.txt',
    chequeoRobotsOk: 'Present and not blocking agents.',
    chequeoRobotsBloquea: 'Present but blocking everything: agents never reach the 402.',
    chequeoRobotsFalta: 'There is no /robots.txt.',

    chequeoBots: 'Citing bots can read you',
    chequeoBotsOk: 'OAI-SearchBot, PerplexityBot and Googlebot can read your home page and /developers.',
    chequeoBotsBloqueados: (casos: string) => `Your edge rejects them (403/429/503): ${casos}. Allow them by name in the WAF.`,
    chequeoBotsChallenge: (casos: string) =>
      `Cloudflare serves them a challenge they cannot pass: ${casos}. Turn off bot fight mode for these bots.`,
    chequeoBotsSinHtml:
      'Your home page returns 200 but has no <title> or <h1>: it depends on JavaScript and answer engines do not run it.',

    // Motores de respuesta
    motoresTitulo: 'Answer engines',
    motoresIntro:
      'ChatGPT, Perplexity and Google AI Overviews cite what they can read: HTML without JavaScript, search bots allowed by name and an entity they can recognize. It lives in the same kit: your robots.txt and the head of your home page already include it.',
    motoresNota:
      'This lets answer engines read and understand your site. Getting cited depends on content and third-party mentions that Peaje cannot generate.',
    motoresChequeos: 'What we measure',
    motoresMidiendo: 'Measuring…',
    motoresSinDominio: 'Without a public domain there is nothing to measure.',

    entidadTitulo: 'Your entity',
    entidadIntro:
      'Goes into the Organization block of your home page JSON-LD, next to the WebAPI. Only what you fill in: we do not invent empty fields.',
    entidadLogo: 'Logo URL',
    entidadTelefono: 'Phone',
    entidadDireccion: 'Address (one line)',
    entidadDescripcion: 'Short description',
    entidadDescripcionAyuda: 'Up to 300 characters. What your site is, in one sentence.',
    entidadSameAs: 'Profiles (sameAs)',
    entidadSameAsAyuda: 'One URL per line: LinkedIn, Instagram, Google Business Profile, Wikidata.',
    entidadBloquearEntrenamiento: 'Block training bots (does not affect citations)',
    entidadBloquearEntrenamientoAyuda:
      'GPTBot, ClaudeBot, Google-Extended, Applebot-Extended and CCBot. Search bots stay allowed.',
    entidadGuardar: 'Save',
    entidadGuardando: 'Saving…',
    entidadGuardado: 'Saved. The kit and the head already use this data.',
    errorEntidadUrl: (url: string) => `"${url}" is not a valid URL (it must start with https://).`,
    errorEntidadDescripcionLarga: 'The description is longer than 300 characters.',

    fueraTitulo: 'Off your site',
    fueraIntro:
      'Answer engines trust third-party mentions. Create or review these profiles with the name and address written exactly as they appear here.',
    fueraNombre: 'Name',
    fueraDireccion: 'Address',
    fueraSinDireccion: 'Fill in the address above to copy it from here.',
    fueraAbrir: 'open',
    proxyTitulo: 'Connect Peaje to your domain (once)',
    proxyIntro:
      'Agent-readiness auditors measure your domain. A catalog pointing at another host does not count: as far as they can tell, your site speaks no MCP and returns no 402. With this config those routes are served from your domain, without touching your code.',
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
      'Add these forwarding rules to the host config. It is the only thing that makes the site serve MCP, OpenAPI and 402 from its own domain, which is where auditors measure. The example is for Next.js; if the project uses another host, translate the same routes to its syntax (vercel.json, Cloudflare Worker, nginx or Caddy). If a config already exists, merge the block instead of replacing the file.\n\nIf the project has middleware (i18n, auth, A/B testing), check its `matcher`: it runs before rewrites and can swallow these routes. Exclude `mcp`, `r/`, `discovery/`, `checkout_sessions` and `agentic_commerce/` from the matcher. Paths with a dot (`llms.txt`, `openapi.json`, `/.well-known/*`) are usually excluded already.',
    promptProxyNota:
      'If the host config truly cannot be touched, the site cannot pass the MCP or payment checks at all: those require answering from the origin. The blocks below are not a substitute for step 1, they are the parts no proxy can inject for you.',
  },
}
