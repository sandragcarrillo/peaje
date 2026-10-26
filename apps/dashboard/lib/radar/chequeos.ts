/**
 * Textos para el dueño de un negocio sobre cada chequeo de Ora.
 *
 * Clave: el campo `id` de cada check (`OraScore.layers[].checks[].id`, ver
 * `lib/ora.ts`). Es un slug estable en kebab-case (`llms-txt-exists`,
 * `pricing-md`); el `name` que manda Ora es texto en inglés que puede cambiar,
 * así que no sirve de clave. Ora repite algunos ids (el mismo chequeo sobre su
 * MCP de producto y su MCP de docs): para el dueño es una sola cosa.
 *
 * Lista tomada de escaneos reales de Ora (132 ids en cuatro capas: discovery,
 * accessibility, usability, payments), octubre 2026. Si Ora agrega un chequeo
 * nuevo, `textoDeChequeo` devuelve null y el que llama usa el nombre crudo.
 *
 * Entre paréntesis va el archivo cuando hay uno concreto; si no lo hay, el
 * nombre con el que el dueño lo buscaría (MCP, OpenAPI, x402). Algunos no
 * llevan paréntesis porque no hay nada que nombrar.
 *
 * Sin imports a propósito: lo pueden usar server y client components.
 */

export type LocaleChequeo = 'es' | 'en'

type Textos = { falta: string; ok: string; detalle: string }
type Entrada = Record<LocaleChequeo, Textos>

const t = (falta: string, ok: string, detalle: string): Textos => ({ falta, ok, detalle })

const CHEQUEOS: Record<string, Entrada> = {
  // ── Discovery ──────────────────────────────────────────────────────────
  'agent-plugins-repo': {
    es: t(
      'No hay un paquete de instalación para agentes en tu GitHub (plugin.json)',
      'Tu GitHub tiene un paquete de instalación para agentes (plugin.json)',
      'Es un archivo en tu repositorio público que junta tus herramientas para agentes en un solo paquete fácil de instalar.',
    ),
    en: t(
      'There is no install package for agents in your GitHub (plugin.json)',
      'Your GitHub has an install package for agents (plugin.json)',
      'It is a file in your public repository that bundles your agent tools into one package that is easy to install.',
    ),
  },
  'agent-rules-repo': {
    es: t(
      'No hay reglas para que los asistentes de código usen bien tu producto',
      'Hay reglas para que los asistentes de código usen bien tu producto',
      'Son archivos para herramientas como Claude o Cursor que les enseñan a usar tu producto bien desde el primer intento.',
    ),
    en: t(
      'There are no rules that teach coding assistants to use your product',
      'There are rules that teach coding assistants to use your product',
      'They are files for tools like Claude or Cursor that teach them to use your product correctly on the first try.',
    ),
  },
  'agentic-search-specific': {
    es: t(
      'Un agente que busca tu nombre no encuentra tu documentación técnica',
      'Un agente que busca tu nombre encuentra tu documentación técnica',
      'Cuando un agente busca tu marca en la web, necesita llegar a tu documentación o a tu conexión para poder usarte.',
    ),
    en: t(
      'An agent that searches your name does not find your technical docs',
      'An agent that searches your name finds your technical docs',
      'When an agent searches the web for your brand, it needs to land on your docs or your connection to start using you.',
    ),
  },
  'agentic-search-usecase': {
    es: t(
      'Las IA no te recomiendan cuando alguien busca lo que haces',
      'Las IA te recomiendan cuando alguien busca lo que haces',
      'Mide cuántas veces apareces cuando alguien le pide a una IA una herramienta como la tuya sin decir tu nombre.',
    ),
    en: t(
      'AI assistants do not recommend you when someone looks for what you do',
      'AI assistants recommend you when someone looks for what you do',
      'It measures how often you show up when someone asks an AI for a tool like yours without naming you.',
    ),
  },
  'ai-catalog-published': {
    es: t(
      'Tu catálogo para agentes no está en la ruta del estándar AI Catalog (.well-known/ai-catalog.json)',
      'Tu catálogo para agentes está en la ruta del estándar AI Catalog (.well-known/ai-catalog.json)',
      'Es la misma lista de lo que ofreces, en la ruta donde la buscan los agentes que siguen el estándar AI Catalog.',
    ),
    en: t(
      'Your agent catalog is not at the AI Catalog standard path (.well-known/ai-catalog.json)',
      'Your agent catalog is at the AI Catalog standard path (.well-known/ai-catalog.json)',
      'It is the same list of what you offer, at the path where agents that follow the AI Catalog standard look for it.',
    ),
  },
  'ard-catalog': {
    es: t(
      'No hay un catálogo de lo que ofreces a los agentes (.well-known/ai-catalog.json)',
      'Hay un catálogo de lo que ofreces a los agentes (.well-known/ai-catalog.json)',
      'Es una lista en un solo lugar con todo lo que tu sitio ofrece a los agentes, para que no lo busquen página por página.',
    ),
    en: t(
      'There is no catalog of what you offer agents (.well-known/ai-catalog.json)',
      'There is a catalog of what you offer agents (.well-known/ai-catalog.json)',
      'It is one list with everything your site offers agents, so they do not have to hunt for it page by page.',
    ),
  },
  'ard-entries-valid': {
    es: t(
      'Tu catálogo para agentes tiene entradas incompletas (.well-known/ai-catalog.json)',
      'Las entradas de tu catálogo para agentes están completas (.well-known/ai-catalog.json)',
      'Cada cosa en tu catálogo necesita nombre, tipo y una dirección que funcione, o el agente no la puede usar.',
    ),
    en: t(
      'Your agent catalog has incomplete entries (.well-known/ai-catalog.json)',
      'The entries in your agent catalog are complete (.well-known/ai-catalog.json)',
      'Each item in your catalog needs a name, a type and a working address, or the agent cannot use it.',
    ),
  },
  'ard-trust-manifest': {
    es: t(
      'Tu catálogo para agentes no muestra señales de confianza (.well-known/ai-catalog.json)',
      'Tu catálogo para agentes muestra señales de confianza (.well-known/ai-catalog.json)',
      'Son datos que prueban quién eres, como identidad verificada o certificaciones, y ayudan a que un agente cuidadoso te elija.',
    ),
    en: t(
      'Your agent catalog shows no trust signals (.well-known/ai-catalog.json)',
      'Your agent catalog shows trust signals (.well-known/ai-catalog.json)',
      'They are details that prove who you are, like a verified identity or certifications, and help a careful agent pick you.',
    ),
  },
  'brand-search-accuracy': {
    es: t(
      'Tu sitio no sale arriba cuando buscan tu marca',
      'Tu sitio sale arriba cuando buscan tu marca',
      'Si alguien busca tu marca y tu producto, tu dominio debe salir entre los primeros resultados o un agente te puede confundir con otro.',
    ),
    en: t(
      'Your site does not rank near the top when people search your brand',
      'Your site ranks near the top when people search your brand',
      'When someone searches your brand and product, your domain should be in the top results or an agent may mix you up with someone else.',
    ),
  },
  'chatgpt-app-listed': {
    es: t(
      'Tu producto no está en el directorio de apps de ChatGPT',
      'Tu producto está en el directorio de apps de ChatGPT',
      'Estar ahí deja que la gente use tu producto dentro de una conversación de ChatGPT con solo nombrarlo.',
    ),
    en: t(
      'Your product is not in the ChatGPT app directory',
      'Your product is in the ChatGPT app directory',
      'Being there lets people use your product inside a ChatGPT conversation just by naming it.',
    ),
  },
  'mcp-registry-listed': {
    es: t(
      'Tu conexión para agentes no aparece en los directorios (MCP)',
      'Tu conexión para agentes aparece en los directorios (MCP)',
      'Los agentes encuentran estas conexiones en directorios como Smithery o mcp.so, igual que la gente encuentra apps en una tienda.',
    ),
    en: t(
      'Your agent connection is not listed in the directories (MCP)',
      'Your agent connection is listed in the directories (MCP)',
      'Agents find these connections in directories like Smithery or mcp.so, the way people find apps in an app store.',
    ),
  },
  'noindex-directives': {
    es: t(
      'Tu página principal está oculta de los buscadores (noindex)',
      'Tu página principal aparece en los buscadores',
      'Muchos agentes encuentran sitios buscando en la web, y una etiqueta noindex saca tu página de los resultados.',
    ),
    en: t(
      'Your homepage is hidden from search engines (noindex)',
      'Your homepage shows up in search engines',
      'Many agents find sites by searching the web, and a noindex tag removes your page from the results.',
    ),
  },
  'npm-sdk-package': {
    es: t(
      'No hay un paquete oficial para programadores (npm o PyPI)',
      'Hay un paquete oficial para programadores (npm o PyPI)',
      'Es una librería lista para usar que les ahorra a los agentes y a los programadores escribir cada llamada a mano.',
    ),
    en: t(
      'There is no official package for developers (npm or PyPI)',
      'There is an official package for developers (npm or PyPI)',
      'It is a ready-made library that saves agents and developers from writing every call by hand.',
    ),
  },
  'registry-branding': {
    es: t(
      'Tu ficha en los directorios no tiene nombre, ícono o descripción (MCP)',
      'Tu ficha en los directorios tiene nombre, ícono y descripción (MCP)',
      'Es lo primero que ve un agente al elegir entre conexiones, y una ficha vacía parece abandonada.',
    ),
    en: t(
      'Your directory listing has no name, icon or description (MCP)',
      'Your directory listing has a name, icon and description (MCP)',
      'It is the first thing an agent sees when choosing between connections, and a bare listing looks abandoned.',
    ),
  },
  'robots-ai-policy-quality': {
    es: t(
      'Los buscadores con IA no pueden leer tu sitio (robots.txt)',
      'Los buscadores con IA pueden leer tu sitio (robots.txt)',
      'Es el archivo que dice qué robots pueden leer tu sitio, y si bloquea a ChatGPT, Claude o Perplexity no te pueden citar.',
    ),
    en: t(
      'AI search engines cannot read your site (robots.txt)',
      'AI search engines can read your site (robots.txt)',
      'It is the file that says which bots may read your site, and if it blocks ChatGPT, Claude or Perplexity they cannot cite you.',
    ),
  },
  'wikipedia-presence': {
    es: t(
      'No tienes artículo en Wikipedia ni entrada en Wikidata',
      'Tienes artículo en Wikipedia o entrada en Wikidata',
      'Wikipedia es de las fuentes que más citan las IA, y una entrada que enlaza a tu dominio les confirma quién eres.',
    ),
    en: t(
      'You have no Wikipedia article or Wikidata entry',
      'You have a Wikipedia article or Wikidata entry',
      'Wikipedia is one of the sources AI cites most, and an entry that links to your domain confirms who you are.',
    ),
  },

  // ── Accessibility ──────────────────────────────────────────────────────
  'a2a-agent-card': {
    es: t(
      'Falta tu tarjeta de presentación para otros agentes (.well-known/agent-card.json)',
      'Tienes tu tarjeta de presentación para otros agentes (.well-known/agent-card.json)',
      'Es un archivo que les dice a otros agentes quién eres, qué puedes hacer y cómo contactarte.',
    ),
    en: t(
      'Your business card for other agents is missing (.well-known/agent-card.json)',
      'You have a business card for other agents (.well-known/agent-card.json)',
      'It is a file that tells other agents who you are, what you can do and how to reach you.',
    ),
  },
  'agent-crawler-reachability': {
    es: t(
      'Los agentes que actúan por tus clientes no pueden abrir tu página principal',
      'Los agentes que actúan por tus clientes pueden abrir tu página principal',
      'Cuando alguien le pide a ChatGPT o a Claude que revise tu sitio, ese agente necesita poder entrar a tu página principal.',
    ),
    en: t(
      'Agents acting for your customers cannot open your homepage',
      'Agents acting for your customers can open your homepage',
      'When someone asks ChatGPT or Claude to check your site, that agent needs to be able to load your homepage.',
    ),
  },
  'agent-discovery-file': {
    es: t(
      'No hay una página de bienvenida para agentes (agents.md)',
      'Hay una página de bienvenida para agentes (agents.md)',
      'Es un archivo que les dice a los agentes qué eres y por dónde empezar, como una recepción para visitas automáticas.',
    ),
    en: t(
      'There is no welcome page for agents (agents.md)',
      'There is a welcome page for agents (agents.md)',
      'It is a file that tells agents what you are and where to start, like a front desk for automated visitors.',
    ),
  },
  'agent-instruction': {
    es: t(
      'No hay instrucciones para agentes (agents.md)',
      'Hay instrucciones para agentes (agents.md)',
      'Es un texto que les dice a los agentes para qué sirve tu producto y cuándo usarlo, así te eligen entre varias opciones.',
    ),
    en: t(
      'There are no instructions for agents (agents.md)',
      'There are instructions for agents (agents.md)',
      'It is a text that tells agents what your product is for and when to use it, so they pick you among several options.',
    ),
  },
  'agent-mode-view': {
    es: t(
      'No hay una versión simple de tu sitio para agentes (?mode=agent)',
      'Hay una versión simple de tu sitio para agentes (?mode=agent)',
      'Es una vista de tu sitio sin diseño, con el contenido y los enlaces directos que un agente necesita.',
    ),
    en: t(
      'There is no plain version of your site for agents (?mode=agent)',
      'There is a plain version of your site for agents (?mode=agent)',
      'It is a view of your site without the design, with the content and direct links an agent needs.',
    ),
  },
  'agent-skills-index-v2': {
    es: t(
      'Tus habilidades para agentes no siguen el formato actual (.well-known/agent-skills/index.json)',
      'Tus habilidades para agentes siguen el formato actual (.well-known/agent-skills/index.json)',
      'Es la lista de tareas que tu producto les enseña a los agentes, en un formato que las herramientas pueden revisar e instalar.',
    ),
    en: t(
      'Your agent skills do not follow the current format (.well-known/agent-skills/index.json)',
      'Your agent skills follow the current format (.well-known/agent-skills/index.json)',
      'It is the list of tasks your product teaches agents, in a format tools can check and install.',
    ),
  },
  'agent-ua-markdown': {
    es: t(
      'Tu sitio no les da texto simple a los robots de IA (markdown)',
      'Tu sitio les da texto simple a los robots de IA (markdown)',
      'Cuando tu sitio reconoce a un robot de IA, le puede mandar el contenido en texto limpio en vez de la página con diseño.',
    ),
    en: t(
      'Your site does not serve plain text to AI bots (markdown)',
      'Your site serves plain text to AI bots (markdown)',
      'When your site recognizes an AI bot, it can send the content as clean text instead of the designed page.',
    ),
  },
  'api-catalog-rfc9727': {
    es: t(
      'No hay una lista de tus servicios para agentes (.well-known/api-catalog)',
      'Hay una lista de tus servicios para agentes (.well-known/api-catalog)',
      'Es un archivo con todas las formas de conectarse a tu servicio, para que un agente las vea en una sola consulta.',
    ),
    en: t(
      'There is no list of your services for agents (.well-known/api-catalog)',
      'There is a list of your services for agents (.well-known/api-catalog)',
      'It is a file with every way to connect to your service, so an agent sees them all in one request.',
    ),
  },
  'bot-detection': {
    es: t(
      'Tu protección contra robots bloquea a los agentes',
      'Tu protección contra robots deja pasar a los agentes',
      'Algunas protecciones contra robots también frenan a los agentes de IA que sí quieres recibir.',
    ),
    en: t(
      'Your bot protection blocks agents',
      'Your bot protection lets agents through',
      'Some bot protection also turns away the AI agents you do want to receive.',
    ),
  },
  'code-fence-validity': {
    es: t(
      'Hay bloques de código mal cerrados en tus textos para agentes (markdown)',
      'Los bloques de código de tus textos para agentes están bien cerrados (markdown)',
      'Un bloque de código sin cerrar hace que el agente lea el resto del documento como si fuera código.',
    ),
    en: t(
      'Your texts for agents have code blocks that are not closed (markdown)',
      'The code blocks in your texts for agents are closed properly (markdown)',
      'An unclosed code block makes the agent read the rest of the document as if it were code.',
    ),
  },
  'content-no-js': {
    es: t(
      'Los robots de IA no ven tu contenido (JavaScript)',
      'Tu contenido se ve sin JavaScript',
      'La mayoría de los robots de IA no ejecutan JavaScript, así que si tu página lo necesita para mostrar el contenido, ven un sitio en blanco.',
    ),
    en: t(
      'AI bots cannot see your content (JavaScript)',
      'Your content shows without JavaScript',
      'Most AI bots do not run JavaScript, so if your page needs it to show content, they see a blank site.',
    ),
  },
  'developer-portal': {
    es: t(
      'No hay un portal para programadores',
      'Hay un portal para programadores',
      'Es un lugar donde alguien se registra, saca sus claves y maneja su integración sin tener que escribirte.',
    ),
    en: t(
      'There is no developer portal',
      'There is a developer portal',
      'It is a place where someone signs up, gets keys and manages an integration without having to email you.',
    ),
  },
  'docs-auth-gate': {
    es: t(
      'Parte de tu contenido está detrás de un inicio de sesión',
      'Tu contenido se puede leer sin iniciar sesión',
      'Las páginas que piden iniciar sesión son invisibles para los agentes.',
    ),
    en: t(
      'Part of your content is behind a login',
      'Your content can be read without logging in',
      'Pages that ask for a login are invisible to agents.',
    ),
  },
  'json-ld': {
    es: t(
      'Los agentes no saben qué es tu negocio (JSON-LD)',
      'Los agentes saben qué es tu negocio (JSON-LD)',
      'Es un bloque de datos en tu página que dice qué eres, para que las IA no tengan que adivinarlo leyendo el texto.',
    ),
    en: t(
      'Agents do not know what your business is (JSON-LD)',
      'Agents know what your business is (JSON-LD)',
      'It is a block of data on your page that says what you are, so AI does not have to guess it from the text.',
    ),
  },
  'json-ld-entity-linking': {
    es: t(
      'Tus datos no enlazan a tus perfiles oficiales (JSON-LD)',
      'Tus datos enlazan a tus perfiles oficiales (JSON-LD)',
      'Son enlaces a tu GitHub, LinkedIn o tiendas de apps que les confirman a las IA que todas esas menciones son tuyas.',
    ),
    en: t(
      'Your data does not link to your official profiles (JSON-LD)',
      'Your data links to your official profiles (JSON-LD)',
      'They are links to your GitHub, LinkedIn or app store pages that confirm to AI that all those mentions are you.',
    ),
  },
  'link-headers-discovery': {
    es: t(
      'Tu sitio no avisa dónde están tus documentos para agentes (encabezados Link)',
      'Tu sitio avisa dónde están tus documentos para agentes (encabezados Link)',
      'Son avisos que tu servidor manda en cada respuesta para que el agente sepa dónde está tu mapa y tu documentación sin leer la página.',
    ),
    en: t(
      'Your site does not point agents to your documents (Link headers)',
      'Your site points agents to your documents (Link headers)',
      'They are hints your server sends with each response so the agent finds your sitemap and docs without reading the page.',
    ),
  },
  'llms-txt-exists': {
    es: t(
      'No hay una guía de tu sitio para agentes (llms.txt)',
      'Hay una guía de tu sitio para agentes (llms.txt)',
      'Es un archivo que les dice a los agentes qué ofrece tu sitio y dónde está cada cosa.',
    ),
    en: t(
      'There is no guide to your site for agents (llms.txt)',
      'There is a guide to your site for agents (llms.txt)',
      'It is a file that tells agents what your site offers and where everything is.',
    ),
  },
  'llms-txt-formatting': {
    es: t(
      'Tu guía para agentes no tiene el formato correcto (llms.txt)',
      'Tu guía para agentes tiene el formato correcto (llms.txt)',
      'La guía solo sirve si el agente la puede leer, y para eso necesita un título arriba, enlaces y suficiente contenido.',
    ),
    en: t(
      'Your guide for agents does not have the right format (llms.txt)',
      'Your guide for agents has the right format (llms.txt)',
      'The guide only helps if the agent can read it, and for that it needs a title on top, links and enough content.',
    ),
  },
  'llms-txt-links-resolve': {
    es: t(
      'Tu guía para agentes tiene enlaces rotos (llms.txt)',
      'Los enlaces de tu guía para agentes funcionan (llms.txt)',
      'Un enlace roto en la guía deja al agente sin camino a la página que buscaba.',
    ),
    en: t(
      'Your guide for agents has broken links (llms.txt)',
      'The links in your guide for agents work (llms.txt)',
      'A broken link in the guide leaves the agent with no way to the page it wanted.',
    ),
  },
  'markdown-frontmatter': {
    es: t(
      'Tus textos para agentes no traen título ni descripción (markdown)',
      'Tus textos para agentes traen título y descripción (markdown)',
      'Es un encabezado corto al inicio de cada documento con título, descripción y fecha, para que el agente sepa qué es sin leerlo entero.',
    ),
    en: t(
      'Your texts for agents have no title or description (markdown)',
      'Your texts for agents have a title and description (markdown)',
      'It is a short header at the top of each document with a title, description and date, so the agent knows what it is without reading it all.',
    ),
  },
  'markdown-link-alternate': {
    es: t(
      'Tus páginas no avisan que tienen versión en texto simple (markdown)',
      'Tus páginas avisan que tienen versión en texto simple (markdown)',
      'Es un enlace en cada página que le indica al agente dónde está esa misma página en texto limpio.',
    ),
    en: t(
      'Your pages do not say they have a plain text version (markdown)',
      'Your pages say they have a plain text version (markdown)',
      'It is a link on each page that tells the agent where the same page lives as clean text.',
    ),
  },
  'markdown-negotiation': {
    es: t(
      'Tu documentación no está en texto simple (markdown)',
      'Tu documentación está en texto simple (markdown)',
      'Los agentes prefieren el mismo contenido en texto limpio, sin el diseño ni el ruido de la página.',
    ),
    en: t(
      'Your docs are not available as plain text (markdown)',
      'Your docs are available as plain text (markdown)',
      'Agents prefer the same content as clean text, without the design and noise of the page.',
    ),
  },
  'markdown-negotiation-vary': {
    es: t(
      'Tu página principal no da texto simple cuando se lo piden (markdown)',
      'Tu página principal da texto simple cuando se lo piden (markdown)',
      'Tu página principal puede mostrar el diseño a las personas y texto limpio a los agentes que lo piden, desde la misma dirección.',
    ),
    en: t(
      'Your homepage does not serve plain text when asked (markdown)',
      'Your homepage serves plain text when asked (markdown)',
      'Your homepage can show the design to people and clean text to agents that ask for it, from the same address.',
    ),
  },
  'markdown-url-fallback': {
    es: t(
      'No se puede pedir cada página en texto simple con solo cambiar la dirección (index.md)',
      'Tus páginas tienen versión en texto simple terminada en .md (index.md)',
      'Si alguien agrega .md al final de una dirección de tu sitio, recibe esa página en texto limpio, la lectura más fácil para un agente.',
    ),
    en: t(
      'Agents cannot get each page as plain text just by changing the address (index.md)',
      'Your pages have a plain text version ending in .md (index.md)',
      'Adding .md to the end of a page address returns that page as clean text, the easiest read for an agent.',
    ),
  },
  'mcp-well-known-discovery': {
    es: t(
      'Los agentes no encuentran tu conexión para agentes (.well-known/mcp.json)',
      'Los agentes encuentran tu conexión para agentes (.well-known/mcp.json)',
      'Es un archivo en tu dominio que les dice a los agentes dónde está tu conexión, para que la encuentren solos.',
    ),
    en: t(
      'Agents cannot find your agent connection (.well-known/mcp.json)',
      'Agents can find your agent connection (.well-known/mcp.json)',
      'It is a file on your domain that tells agents where your connection is, so they find it on their own.',
    ),
  },
  'metadata-completeness': {
    es: t(
      'A tus páginas les faltan datos básicos (Open Graph)',
      'Tus páginas tienen sus datos básicos (Open Graph)',
      'Son la dirección oficial, el idioma y la imagen de vista previa de cada página, y sin ellos las IA te citan mal.',
    ),
    en: t(
      'Your pages are missing basic details (Open Graph)',
      'Your pages have their basic details (Open Graph)',
      'They are the official address, the language and the preview image of each page, and without them AI cites you wrong.',
    ),
  },
  'modular-llms-txt': {
    es: t(
      'No hay guías para agentes por sección (docs/llms.txt)',
      'Hay guías para agentes por sección (docs/llms.txt)',
      'Son guías cortas para cada parte de tu sitio, así un agente que trabaja en un tema no tiene que leer todo.',
    ),
    en: t(
      'There are no guides for agents per section (docs/llms.txt)',
      'There are guides for agents per section (docs/llms.txt)',
      'They are short guides for each part of your site, so an agent working on one topic does not have to read everything.',
    ),
  },
  'nlweb-schema-feeds': {
    es: t(
      'Los agentes no reciben tu catálogo como datos (robots.txt)',
      'Los agentes reciben tu catálogo como datos (robots.txt)',
      'Es un aviso en tu sitio que les entrega a los agentes tu catálogo ordenado, para que no lo saquen de tus páginas.',
    ),
    en: t(
      'Agents do not get your catalog as data (robots.txt)',
      'Agents get your catalog as data (robots.txt)',
      'It is a pointer on your site that hands agents your catalog in order, so they do not scrape it from your pages.',
    ),
  },
  'openapi-spec': {
    es: t(
      'No hay una descripción de tu servicio que lean las máquinas (OpenAPI)',
      'Hay una descripción de tu servicio que leen las máquinas (OpenAPI)',
      'Es un archivo que describe cada función de tu servicio para que un agente se conecte sin que nadie lea la documentación.',
    ),
    en: t(
      'There is no machine-readable description of your service (OpenAPI)',
      'There is a machine-readable description of your service (OpenAPI)',
      'It is a file that describes each function of your service so an agent can connect without anyone reading the docs.',
    ),
  },
  'org-schema-completeness': {
    es: t(
      'Faltan los datos de contacto de tu empresa (JSON-LD)',
      'Están los datos de contacto de tu empresa (JSON-LD)',
      'Las IA usan tu contacto y tu dirección para confirmar que eres un negocio real antes de recomendarte.',
    ),
    en: t(
      'Your company contact details are missing (JSON-LD)',
      'Your company contact details are there (JSON-LD)',
      'AI uses your contact details and address to confirm you are a real business before recommending you.',
    ),
  },
  'page-token-budget': {
    es: t(
      'Algunas páginas son demasiado largas para un agente',
      'Tus páginas tienen un largo que un agente puede leer',
      'Un agente lee una cantidad limitada de texto por vez, y una página muy larga se corta antes de llegar a lo importante.',
    ),
    en: t(
      'Some pages are too long for an agent',
      'Your pages are a length an agent can read',
      'An agent reads a limited amount of text at a time, and a very long page gets cut off before the important part.',
    ),
  },
  'pricing-info': {
    es: t(
      'Los agentes no saben cuánto cobras (pricing.md)',
      'Los agentes saben cuánto cobras (pricing.md)',
      'Si un agente no encuentra tus precios, no te puede recomendar para una compra.',
    ),
    en: t(
      'Agents do not know what you charge (pricing.md)',
      'Agents know what you charge (pricing.md)',
      'If an agent cannot find your prices, it cannot recommend you for a purchase.',
    ),
  },
  'pricing-md': {
    es: t(
      'No hay una lista de precios para agentes (pricing.md)',
      'Hay una lista de precios para agentes (pricing.md)',
      'Es un archivo con tus precios en texto simple, para que un agente que compara opciones sepa cuánto cuestas.',
    ),
    en: t(
      'There is no price list for agents (pricing.md)',
      'There is a price list for agents (pricing.md)',
      'It is a file with your prices in plain text, so an agent comparing options knows what you cost.',
    ),
  },
  'public-api-docs': {
    es: t(
      'Tu página principal no enlaza a tu documentación',
      'Tu página principal enlaza a tu documentación',
      'Si un agente tiene que buscar tu documentación, la mayoría no la encuentra, así que conviene enlazarla desde el inicio.',
    ),
    en: t(
      'Your homepage does not link to your docs',
      'Your homepage links to your docs',
      'If an agent has to search for your docs, most will not find them, so link them from the homepage.',
    ),
  },
  'redirect-hygiene': {
    es: t(
      'Algunas páginas redirigen de formas que los agentes no siguen',
      'Tus páginas llevan directo al contenido',
      'Las redirecciones que dependen de JavaScript o que saltan a otro dominio dejan al agente sin llegar al contenido.',
    ),
    en: t(
      'Some pages redirect in ways agents cannot follow',
      'Your pages lead straight to the content',
      'Redirects that depend on JavaScript or jump to another domain keep the agent from reaching the content.',
    ),
  },
  'robots-agent-user-policy': {
    es: t(
      'Los agentes que actúan por tus clientes no tienen permiso de entrar (robots.txt)',
      'Los agentes que actúan por tus clientes tienen permiso de entrar (robots.txt)',
      'Es el permiso que les das a ChatGPT, Claude o Perplexity para abrir tu sitio cuando una persona se lo pide.',
    ),
    en: t(
      'Agents acting for your customers are not allowed in (robots.txt)',
      'Agents acting for your customers are allowed in (robots.txt)',
      'It is the permission you give ChatGPT, Claude or Perplexity to open your site when a person asks them to.',
    ),
  },
  'schema-type-breadth': {
    es: t(
      'Tus datos describen pocos tipos de contenido (JSON-LD)',
      'Tus datos describen varios tipos de contenido (JSON-LD)',
      'Marcar preguntas frecuentes, reseñas, servicios o eventos deja que las IA respondan más tipos de preguntas sobre ti.',
    ),
    en: t(
      'Your data describes few kinds of content (JSON-LD)',
      'Your data describes many kinds of content (JSON-LD)',
      'Marking up FAQs, reviews, services or events lets AI answer more kinds of questions about you.',
    ),
  },
  sitemap: {
    es: t(
      'No hay un mapa de tu sitio (sitemap.xml)',
      'Hay un mapa de tu sitio (sitemap.xml)',
      'Es la lista de todas las páginas que quieres que encuentren, para que los agentes no recorran tu sitio a ciegas.',
    ),
    en: t(
      'There is no map of your site (sitemap.xml)',
      'There is a map of your site (sitemap.xml)',
      'It is the list of every page you want found, so agents do not crawl your site blind.',
    ),
  },
  'sitemap-lastmod': {
    es: t(
      'Tu mapa del sitio no dice cuándo cambió cada página (sitemap.xml)',
      'Tu mapa del sitio dice cuándo cambió cada página (sitemap.xml)',
      'Las fechas en el mapa les dicen a los agentes qué páginas cambiaron, así vuelven a leer lo nuevo.',
    ),
    en: t(
      'Your sitemap does not say when each page changed (sitemap.xml)',
      'Your sitemap says when each page changed (sitemap.xml)',
      'Dates in the sitemap tell agents which pages changed, so they reread what is new.',
    ),
  },
  'skills-sh-listed': {
    es: t(
      'No tienes habilidades publicadas en skills.sh',
      'Tienes habilidades publicadas en skills.sh',
      'Es un directorio público donde agentes y programadores buscan habilidades listas para usar.',
    ),
    en: t(
      'You have no skills published on skills.sh',
      'You have skills published on skills.sh',
      'It is a public directory where agents and developers look for ready-made skills.',
    ),
  },
  'skills-sh-quality': {
    es: t(
      'Tus habilidades en skills.sh son pocas o casi nadie las usa',
      'Tus habilidades en skills.sh están bien armadas y la gente las usa',
      'Cuentan varias habilidades, nombres que expliquen qué hacen y gente que de verdad las instala.',
    ),
    en: t(
      'Your skills on skills.sh are few or barely used',
      'Your skills on skills.sh are well made and people use them',
      'What counts is having several skills, names that explain what they do and people who actually install them.',
    ),
  },
  'trust-anchors': {
    es: t(
      'Faltan tus páginas de quiénes somos, contacto o privacidad',
      'Tienes tus páginas de quiénes somos, contacto y privacidad',
      'Los agentes revisan estas páginas para confirmar que eres un negocio real antes de recomendarte.',
    ),
    en: t(
      'Your about, contact or privacy pages are missing',
      'You have your about, contact and privacy pages',
      'Agents check these pages to confirm you are a real business before recommending you.',
    ),
  },

  // ── Usability ──────────────────────────────────────────────────────────
  'a2ui-support': {
    es: t(
      'Tu producto no se puede mostrar dentro de una conversación con IA',
      'Tu producto se puede mostrar dentro de una conversación con IA',
      'Permite que tu producto aparezca con botones y pantallas dentro del chat donde la persona habla con su agente.',
    ),
    en: t(
      'Your product cannot show up inside an AI conversation',
      'Your product can show up inside an AI conversation',
      'It lets your product appear with buttons and screens inside the chat where the person talks to their agent.',
    ),
  },
  'agent-auth-discovery-metadata': {
    es: t(
      'Tus datos de acceso para agentes no están en formato de máquina (auth.md)',
      'Tus datos de acceso para agentes están en formato de máquina (auth.md)',
      'Es la versión para máquinas de tu guía de acceso, para que un agente sepa cómo pedir acceso sin leer la guía.',
    ),
    en: t(
      'Your access details for agents are not machine-readable (auth.md)',
      'Your access details for agents are machine-readable (auth.md)',
      'It is the machine version of your access guide, so an agent knows how to request access without reading the guide.',
    ),
  },
  'agent-auth-endpoints-reachable': {
    es: t(
      'Las direcciones para pedir acceso no responden (auth.md)',
      'Las direcciones para pedir acceso responden (auth.md)',
      'Si tu guía de acceso apunta a direcciones que no funcionan, el agente se pierde intentando registrarse.',
    ),
    en: t(
      'The addresses to request access do not respond (auth.md)',
      'The addresses to request access respond (auth.md)',
      'If your access guide points to addresses that do not work, the agent gets lost trying to sign up.',
    ),
  },
  'agent-auth-www-authenticate': {
    es: t(
      'Cuando rechazas a un agente no le dices cómo entrar (WWW-Authenticate)',
      'Cuando rechazas a un agente le dices cómo entrar (WWW-Authenticate)',
      'Es un aviso en la respuesta de error que le indica al agente dónde está la información para conseguir acceso.',
    ),
    en: t(
      'When you turn an agent away you do not tell it how to get in (WWW-Authenticate)',
      'When you turn an agent away you tell it how to get in (WWW-Authenticate)',
      'It is a hint in the error response that tells the agent where to find how to get access.',
    ),
  },
  'agent-friendly-404': {
    es: t(
      'Tus páginas de error no les sirven a los agentes (404)',
      'Tus páginas de error les sirven a los agentes (404)',
      'Una página que no existe debe responder como error y explicar en texto simple qué pasó y a dónde ir.',
    ),
    en: t(
      'Your error pages do not help agents (404)',
      'Your error pages help agents (404)',
      'A page that does not exist should answer as an error and explain in plain text what happened and where to go.',
    ),
  },
  'api-error-model': {
    es: t(
      'Tu servicio no describe sus errores de antemano (OpenAPI)',
      'Tu servicio describe sus errores de antemano (OpenAPI)',
      'Si el agente conoce todos los errores posibles, sabe cómo reaccionar a cada uno.',
    ),
    en: t(
      'Your service does not describe its errors up front (OpenAPI)',
      'Your service describes its errors up front (OpenAPI)',
      'If the agent knows every possible error, it knows how to react to each one.',
    ),
  },
  'api-schema-analysis': {
    es: t(
      'Tu servicio es difícil de usar para un agente sin ayuda (OpenAPI)',
      'Tu servicio es fácil de usar para un agente sin ayuda (OpenAPI)',
      'Si los datos que pide tu servicio son muy enredados, el agente se equivoca sin darse cuenta.',
    ),
    en: t(
      'Your service is hard for an agent to use without help (OpenAPI)',
      'Your service is easy for an agent to use without help (OpenAPI)',
      'If the data your service asks for is too tangled, the agent makes mistakes without noticing.',
    ),
  },
  'api-versioning-policy': {
    es: t(
      'No dices cuándo cambia tu servicio ni con cuánto aviso',
      'Dices cuándo cambia tu servicio y con cuánto aviso',
      'Los agentes se conectan una vez y siguen solos, así que necesitan saber cuándo algo va a dejar de funcionar.',
    ),
    en: t(
      'You do not say when your service changes or how much notice you give',
      'You say when your service changes and how much notice you give',
      'Agents connect once and keep running on their own, so they need to know when something will stop working.',
    ),
  },
  'async-job-pattern': {
    es: t(
      'Las tareas largas no avisan que siguen en curso',
      'Las tareas largas avisan que siguen en curso',
      'Si una tarea tarda, tu servicio debe responder que la recibió y dejar consultar el avance, o el agente la repite.',
    ),
    en: t(
      'Long tasks do not say they are still running',
      'Long tasks say they are still running',
      'If a task takes a while, your service should confirm it got it and let the agent check progress, or the agent repeats it.',
    ),
  },
  'auth-md-exists': {
    es: t(
      'Los agentes no saben cómo conseguir acceso (auth.md)',
      'Los agentes saben cómo conseguir acceso (auth.md)',
      'Es una guía paso a paso que le enseña a un agente a conseguir acceso a tu servicio por su cuenta.',
    ),
    en: t(
      'Agents do not know how to get access (auth.md)',
      'Agents know how to get access (auth.md)',
      'It is a step-by-step guide that teaches an agent to get access to your service on its own.',
    ),
  },
  'auth-md-structure': {
    es: t(
      'Tu guía de acceso no sigue los pasos del estándar (auth.md)',
      'Tu guía de acceso sigue los pasos del estándar (auth.md)',
      'Si la guía sigue el orden esperado, cualquier agente la puede recorrer sin adivinar.',
    ),
    en: t(
      'Your access guide does not follow the standard steps (auth.md)',
      'Your access guide follows the standard steps (auth.md)',
      'If the guide follows the expected order, any agent can walk through it without guessing.',
    ),
  },
  'auth-md-walkthrough-simulation': {
    es: t(
      'Un agente no logra completar tu guía de acceso (auth.md)',
      'Un agente logra completar tu guía de acceso (auth.md)',
      'Se prueba tu guía de principio a fin, como lo haría un agente, para confirmar que con ella se consigue acceso.',
    ),
    en: t(
      'An agent cannot complete your access guide (auth.md)',
      'An agent can complete your access guide (auth.md)',
      'Your guide is tried from start to finish, the way an agent would, to confirm it really gets access.',
    ),
  },
  'ax-accessible-names': {
    es: t(
      'Algunos botones de tu sitio no tienen nombre',
      'Los botones de tu sitio tienen nombre',
      'Un botón con solo un ícono y sin nombre no se puede señalar, así que un agente no lo puede usar.',
    ),
    en: t(
      'Some buttons on your site have no name',
      'The buttons on your site have names',
      'A button with only an icon and no name cannot be pointed to, so an agent cannot use it.',
    ),
  },
  'ax-document-structure': {
    es: t(
      'Tu página no tiene una estructura clara de secciones',
      'Tu página tiene una estructura clara de secciones',
      'Los agentes recorren tu página por sus títulos y secciones, como lo hace un lector de pantalla.',
    ),
    en: t(
      'Your page has no clear structure of sections',
      'Your page has a clear structure of sections',
      'Agents move through your page by its headings and sections, the way a screen reader does.',
    ),
  },
  'ax-form-labeling': {
    es: t(
      'Tus formularios tienen campos sin etiqueta',
      'Los campos de tus formularios tienen etiqueta',
      'Cada campo necesita una etiqueta real para que el agente sepa qué escribir, porque el texto gris de ejemplo desaparece.',
    ),
    en: t(
      'Your forms have fields without labels',
      'The fields in your forms have labels',
      'Each field needs a real label so the agent knows what to type, because the gray placeholder text disappears.',
    ),
  },
  'ax-native-controls': {
    es: t(
      'Algunos botones de tu sitio no son botones de verdad',
      'Los botones de tu sitio son botones de verdad',
      'Un elemento que parece botón pero no lo es queda invisible para el agente, que no lo puede presionar.',
    ),
    en: t(
      'Some buttons on your site are not real buttons',
      'The buttons on your site are real buttons',
      'Something that looks like a button but is not one stays invisible to the agent, which cannot press it.',
    ),
  },
  'ax-tree-injection-safe': {
    es: t(
      'Hay instrucciones ocultas en tu página que pueden engañar a un agente',
      'No hay instrucciones ocultas en tu página',
      'Un texto escondido en tu página le puede dar órdenes falsas al agente que la lee.',
    ),
    en: t(
      'There are hidden instructions on your page that can trick an agent',
      'There are no hidden instructions on your page',
      'Hidden text on your page can give false orders to the agent that reads it.',
    ),
  },
  'batch-endpoints': {
    es: t(
      'Tu servicio no acepta varias acciones en una sola petición',
      'Tu servicio acepta varias acciones en una sola petición',
      'Así un agente hace mil cosas en una llamada en vez de mil llamadas.',
    ),
    en: t(
      'Your service does not accept several actions in one request',
      'Your service accepts several actions in one request',
      'That way an agent does a thousand things in one call instead of a thousand calls.',
    ),
  },
  'cli-tool': {
    es: t(
      'No tienes una herramienta oficial para la terminal (CLI)',
      'Tienes una herramienta oficial para la terminal (CLI)',
      'Los agentes de programación trabajan en la terminal, y una herramienta ahí les deja usar tu producto directo.',
    ),
    en: t(
      'You have no official command line tool (CLI)',
      'You have an official command line tool (CLI)',
      'Coding agents work in the terminal, and a tool there lets them use your product directly.',
    ),
  },
  'function-calling-compat': {
    es: t(
      'Tu servicio no se traduce bien a las herramientas de ChatGPT, Claude o Gemini (OpenAPI)',
      'Tu servicio se traduce bien a las herramientas de ChatGPT, Claude o Gemini (OpenAPI)',
      'Los asistentes de IA convierten la descripción de tu servicio en herramientas, y si no encaja, no te pueden llamar.',
    ),
    en: t(
      'Your service does not translate well into ChatGPT, Claude or Gemini tools (OpenAPI)',
      'Your service translates well into ChatGPT, Claude or Gemini tools (OpenAPI)',
      'AI assistants turn the description of your service into tools, and if it does not fit, they cannot call you.',
    ),
  },
  'graphql-async-job-pattern': {
    es: t(
      'Las tareas largas no muestran su avance (GraphQL)',
      'Las tareas largas muestran su avance (GraphQL)',
      'Mostrar el estado de una tarea larga evita que el agente piense que se colgó.',
    ),
    en: t(
      'Long tasks do not show their progress (GraphQL)',
      'Long tasks show their progress (GraphQL)',
      'Showing the status of a long task keeps the agent from thinking it froze.',
    ),
  },
  'graphql-batch-mutations': {
    es: t(
      'Tu servicio no permite cambiar muchas cosas a la vez (GraphQL)',
      'Tu servicio permite cambiar muchas cosas a la vez (GraphQL)',
      'Así un agente crea o actualiza cientos de registros en una sola llamada.',
    ),
    en: t(
      'Your service does not let agents change many things at once (GraphQL)',
      'Your service lets agents change many things at once (GraphQL)',
      'That way an agent creates or updates hundreds of records in one call.',
    ),
  },
  'graphql-error-type-definition': {
    es: t(
      'Tu servicio no describe sus errores (GraphQL)',
      'Tu servicio describe sus errores (GraphQL)',
      'Los errores con tipo le dicen al agente si se equivocó en los datos o si debe intentar más tarde.',
    ),
    en: t(
      'Your service does not describe its errors (GraphQL)',
      'Your service describes its errors (GraphQL)',
      'Typed errors tell the agent whether it sent bad data or should try again later.',
    ),
  },
  'graphql-pagination-pattern': {
    es: t(
      'Las listas largas no se recorren por partes de la forma común (GraphQL)',
      'Las listas largas se recorren por partes de la forma común (GraphQL)',
      'Es la forma común de pedir una lista por páginas, que todos los agentes ya saben usar.',
    ),
    en: t(
      'Long lists cannot be read in parts the usual way (GraphQL)',
      'Long lists can be read in parts the usual way (GraphQL)',
      'It is the usual way to ask for a list page by page, which every agent already knows.',
    ),
  },
  'graphql-schema-completeness': {
    es: t(
      'Tu servicio no explica sus campos (GraphQL)',
      'Tu servicio explica sus campos (GraphQL)',
      'Con descripciones en la mayoría de los campos, el agente entiende tu servicio con solo consultarlo.',
    ),
    en: t(
      'Your service does not explain its fields (GraphQL)',
      'Your service explains its fields (GraphQL)',
      'With descriptions on most fields, the agent understands your service just by querying it.',
    ),
  },
  'graphql-versioning-policy': {
    es: t(
      'No avisas qué partes de tu servicio van a desaparecer (GraphQL)',
      'Avisas qué partes de tu servicio van a desaparecer (GraphQL)',
      'Marcar lo que va a cambiar le da tiempo al agente de adaptarse antes de que algo se rompa.',
    ),
    en: t(
      'You do not flag which parts of your service will go away (GraphQL)',
      'You flag which parts of your service will go away (GraphQL)',
      'Marking what will change gives the agent time to adapt before something breaks.',
    ),
  },
  'idempotency-key-support': {
    es: t(
      'Un agente que reintenta puede cobrar o pedir dos veces (Idempotency-Key)',
      'Un agente puede reintentar sin duplicar cobros ni pedidos (Idempotency-Key)',
      'Si la conexión falla a mitad de camino, esta clave deja que el agente repita un pago o un pedido sin hacerlo doble.',
    ),
    en: t(
      'An agent that retries can charge or order twice (Idempotency-Key)',
      'An agent can retry without double charges or orders (Idempotency-Key)',
      'If the connection drops halfway, this key lets the agent repeat a payment or an order without doubling it.',
    ),
  },
  'json-error-responses': {
    es: t(
      'Tus errores llegan como página web en vez de datos (JSON)',
      'Tus errores llegan como datos que un agente entiende (JSON)',
      'Cuando algo falla, el agente necesita un error ordenado para corregirse, y una página de error lo deja sin salida.',
    ),
    en: t(
      'Your errors come back as a web page instead of data (JSON)',
      'Your errors come back as data an agent understands (JSON)',
      'When something fails, the agent needs a structured error to recover, and an error page leaves it stuck.',
    ),
  },
  'mcp-app-registry': {
    es: t(
      'Tu conexión no muestra pantallas dentro de ChatGPT o Claude (MCP Apps)',
      'Tu conexión muestra pantallas dentro de ChatGPT o Claude (MCP Apps)',
      'Permite que tu producto aparezca con botones y pantallas reales dentro del chat, además de texto.',
    ),
    en: t(
      'Your connection does not show screens inside ChatGPT or Claude (MCP Apps)',
      'Your connection shows screens inside ChatGPT or Claude (MCP Apps)',
      'It lets your product appear with real buttons and screens inside the chat, on top of text.',
    ),
  },
  'mcp-apps-ui-quality': {
    es: t(
      'Las pantallas de tu app dentro del chat tienen fallas (MCP Apps)',
      'Las pantallas de tu app dentro del chat están bien hechas (MCP Apps)',
      'Se revisa que las pantallas carguen bien, tengan modo oscuro y no muestren claves secretas.',
    ),
    en: t(
      'The screens of your app inside the chat have problems (MCP Apps)',
      'The screens of your app inside the chat are well made (MCP Apps)',
      'It checks that the screens load properly, support dark mode and do not expose secret keys.',
    ),
  },
  'mcp-auth-mechanism': {
    es: t(
      'Tu conexión para agentes no tiene el tipo de acceso correcto (MCP)',
      'Tu conexión para agentes tiene el tipo de acceso correcto (MCP)',
      'La documentación debe estar abierta y las acciones sobre cuentas deben pedir inicio de sesión.',
    ),
    en: t(
      'Your agent connection does not have the right kind of access (MCP)',
      'Your agent connection has the right kind of access (MCP)',
      'Docs should be open and actions on accounts should require a login.',
    ),
  },
  'mcp-error-handling': {
    es: t(
      'Tu conexión para agentes no explica sus errores (MCP)',
      'Tu conexión para agentes explica sus errores (MCP)',
      'Cuando un agente manda algo mal, necesita una respuesta clara que le diga cómo corregirlo.',
    ),
    en: t(
      'Your agent connection does not explain its errors (MCP)',
      'Your agent connection explains its errors (MCP)',
      'When an agent sends something wrong, it needs a clear answer that tells it how to fix it.',
    ),
  },
  'mcp-multi-surface-coverage': {
    es: t(
      'No tienes una conexión para acciones y otra para tu documentación (MCP)',
      'Tienes una conexión para acciones y otra para tu documentación (MCP)',
      'Separar las dos deja que un agente use tu producto con una y resuelva dudas con la otra.',
    ),
    en: t(
      'You do not have one connection for actions and another for your docs (MCP)',
      'You have one connection for actions and another for your docs (MCP)',
      'Splitting the two lets an agent use your product with one and answer questions with the other.',
    ),
  },
  'mcp-oauth-metadata': {
    es: t(
      'Los agentes no encuentran solos cómo iniciar sesión en tu conexión (OAuth)',
      'Los agentes encuentran solos cómo iniciar sesión en tu conexión (OAuth)',
      'Son datos publicados que le dicen al agente cómo iniciar sesión sin que un programador lo configure a mano.',
    ),
    en: t(
      'Agents cannot find how to log in to your connection on their own (OAuth)',
      'Agents find how to log in to your connection on their own (OAuth)',
      'It is published data that tells the agent how to log in without a developer setting it up by hand.',
    ),
  },
  'mcp-param-schemas': {
    es: t(
      'Tus herramientas para agentes no dicen qué datos piden (MCP)',
      'Tus herramientas para agentes dicen qué datos piden (MCP)',
      'Si cada herramienta dice qué datos necesita, el agente la usa bien sin probar a ciegas.',
    ),
    en: t(
      'Your agent tools do not say what data they need (MCP)',
      'Your agent tools say what data they need (MCP)',
      'If each tool says what data it needs, the agent uses it right without trial and error.',
    ),
  },
  'mcp-pkce-s256': {
    es: t(
      'El inicio de sesión de tu conexión no tiene la protección extra (PKCE)',
      'El inicio de sesión de tu conexión tiene la protección extra (PKCE)',
      'Es una protección del inicio de sesión que evita que alguien reutilice un código robado.',
    ),
    en: t(
      'The login for your connection lacks the extra protection (PKCE)',
      'The login for your connection has the extra protection (PKCE)',
      'It is a login protection that stops anyone from reusing a stolen code.',
    ),
  },
  'mcp-resource-listing': {
    es: t(
      'Tu conexión dice tener documentos para agentes pero no muestra ninguno (MCP)',
      'Tu conexión muestra los documentos que ofrece a los agentes (MCP)',
      'Si tu conexión promete documentos o datos, los debe entregar cuando el agente los pide.',
    ),
    en: t(
      'Your connection claims to have documents for agents but shows none (MCP)',
      'Your connection shows the documents it offers agents (MCP)',
      'If your connection promises documents or data, it has to deliver them when the agent asks.',
    ),
  },
  'mcp-resource-quality': {
    es: t(
      'Algunos documentos de tu conexión no se pueden leer (MCP)',
      'Los documentos de tu conexión se pueden leer (MCP)',
      'Cada documento o dato que ofreces debe abrir bien y tener contenido.',
    ),
    en: t(
      'Some documents in your connection cannot be read (MCP)',
      'The documents in your connection can be read (MCP)',
      'Every document or piece of data you offer should open properly and have content.',
    ),
  },
  'mcp-server': {
    es: t(
      'No hay una conexión directa para agentes (MCP)',
      'Hay una conexión directa para agentes (MCP)',
      'Es la forma en que los agentes se conectan a tu producto y lo usan, como una app que se instala.',
    ),
    en: t(
      'There is no direct connection for agents (MCP)',
      'There is a direct connection for agents (MCP)',
      'It is how agents plug into your product and use it, like an app they install.',
    ),
  },
  'mcp-server-card': {
    es: t(
      'Tu conexión para agentes no tiene ficha de presentación (server-card.json)',
      'Tu conexión para agentes tiene ficha de presentación (server-card.json)',
      'Es un archivo que le dice al agente qué hace tu conexión y cómo usarla antes de conectarse.',
    ),
    en: t(
      'Your agent connection has no info card (server-card.json)',
      'Your agent connection has an info card (server-card.json)',
      'It is a file that tells the agent what your connection does and how to use it before connecting.',
    ),
  },
  'mcp-server-identity': {
    es: t(
      'Tu conexión para agentes no se presenta (MCP)',
      'Tu conexión para agentes se presenta con nombre e instrucciones (MCP)',
      'Al conectarse, tu conexión debe decir su nombre, su versión y cómo usarla, o el agente tiene que adivinar.',
    ),
    en: t(
      'Your agent connection does not introduce itself (MCP)',
      'Your agent connection introduces itself with a name and instructions (MCP)',
      'When an agent connects, your connection should give its name, version and how to use it, or the agent has to guess.',
    ),
  },
  'mcp-tool-annotations': {
    es: t(
      'Tus herramientas para agentes no dicen cuáles cambian o borran cosas (MCP)',
      'Tus herramientas para agentes dicen cuáles cambian o borran cosas (MCP)',
      'Son marcas que le dicen al agente qué herramientas solo leen y cuáles modifican algo, para que tenga cuidado.',
    ),
    en: t(
      'Your agent tools do not say which ones change or delete things (MCP)',
      'Your agent tools say which ones change or delete things (MCP)',
      'They are labels that tell the agent which tools only read and which ones change something, so it takes care.',
    ),
  },
  'mcp-tool-descriptions': {
    es: t(
      'Tus herramientas para agentes no explican bien qué hacen (MCP)',
      'Tus herramientas para agentes explican bien qué hacen (MCP)',
      'El agente elige herramientas leyendo su descripción, y las que son vagas quedan sin usar.',
    ),
    en: t(
      'Your agent tools do not explain clearly what they do (MCP)',
      'Your agent tools explain clearly what they do (MCP)',
      'The agent picks tools by reading their descriptions, and vague ones go unused.',
    ),
  },
  'mcp-tool-listing': {
    es: t(
      'Tu conexión no muestra sus herramientas (MCP)',
      'Tu conexión muestra sus herramientas (MCP)',
      'Cuando el agente pregunta qué puede hacer, tu conexión debe responder con la lista de herramientas.',
    ),
    en: t(
      'Your connection does not list its tools (MCP)',
      'Your connection lists its tools (MCP)',
      'When the agent asks what it can do, your connection should answer with the list of tools.',
    ),
  },
  'mcp-tool-naming': {
    es: t(
      'Los nombres de tus herramientas no siguen un patrón (MCP)',
      'Los nombres de tus herramientas siguen un patrón claro (MCP)',
      'Nombres predecibles como crear_factura o buscar_documentos dejan que el agente entienda cada herramienta de un vistazo.',
    ),
    en: t(
      'Your tool names do not follow a pattern (MCP)',
      'Your tool names follow a clear pattern (MCP)',
      'Predictable names like create_invoice or search_docs let the agent understand each tool at a glance.',
    ),
  },
  'mcp-transport-modern': {
    es: t(
      'Tu conexión usa una forma vieja de comunicarse (MCP)',
      'Tu conexión usa la forma actual de comunicarse (MCP)',
      'Los agentes nuevos esperan la forma actual, y con la vieja pueden no conectarse.',
    ),
    en: t(
      'Your connection uses an old way to communicate (MCP)',
      'Your connection uses the current way to communicate (MCP)',
      'Newer agents expect the current way, and with the old one they may not connect.',
    ),
  },
  'mcp-view-csp': {
    es: t(
      'Las pantallas de tu app no limitan de dónde cargan contenido (MCP Apps)',
      'Las pantallas de tu app limitan de dónde cargan contenido (MCP Apps)',
      'ChatGPT y Claude aíslan tus pantallas según la lista de sitios que declares, y una lista demasiado abierta es un riesgo.',
    ),
    en: t(
      'Your app screens do not limit where they load content from (MCP Apps)',
      'Your app screens limit where they load content from (MCP Apps)',
      'ChatGPT and Claude sandbox your screens based on the list of sites you declare, and a list that is too open is a risk.',
    ),
  },
  'mcp-view-domain': {
    es: t(
      'Las pantallas de tu app no cargan (MCP Apps)',
      'Las pantallas de tu app cargan sin problema (MCP Apps)',
      'Si la pantalla falla o pide iniciar sesión, falla frente a la persona que la estaba usando.',
    ),
    en: t(
      'Your app screens do not load (MCP Apps)',
      'Your app screens load without problems (MCP Apps)',
      'If the screen breaks or asks for a login, it fails in front of the person who was using it.',
    ),
  },
  'nlweb-ask': {
    es: t(
      'Tu sitio no responde preguntas escritas en lenguaje normal (NLWeb /ask)',
      'Tu sitio responde preguntas escritas en lenguaje normal (NLWeb /ask)',
      'Es una dirección donde un agente pregunta algo sobre tu sitio y recibe la respuesta sin tener que recorrerlo.',
    ),
    en: t(
      'Your site does not answer questions in everyday language (NLWeb /ask)',
      'Your site answers questions in everyday language (NLWeb /ask)',
      'It is an address where an agent asks something about your site and gets the answer without crawling it.',
    ),
  },
  'nlweb-streaming': {
    es: t(
      'Tu sitio no entrega las respuestas a medida que las encuentra (NLWeb /ask)',
      'Tu sitio entrega las respuestas a medida que las encuentra (NLWeb /ask)',
      'Así el agente puede mostrar avance en vez de dejar a la persona esperando.',
    ),
    en: t(
      'Your site does not send answers as it finds them (NLWeb /ask)',
      'Your site sends answers as it finds them (NLWeb /ask)',
      'That way the agent can show progress instead of leaving the person waiting.',
    ),
  },
  'oauth-protected-resource': {
    es: t(
      'Los agentes no saben de antemano qué acceso pide tu servicio (.well-known/oauth-protected-resource)',
      'Los agentes saben de antemano qué acceso pide tu servicio (.well-known/oauth-protected-resource)',
      'Es un archivo que le dice al agente qué permiso necesita antes de intentar entrar.',
    ),
    en: t(
      'Agents do not know up front what access your service needs (.well-known/oauth-protected-resource)',
      'Agents know up front what access your service needs (.well-known/oauth-protected-resource)',
      'It is a file that tells the agent what permission it needs before it tries to get in.',
    ),
  },
  'oauth-support': {
    es: t(
      'Los agentes no tienen una forma estándar de iniciar sesión (OAuth)',
      'Los agentes tienen una forma estándar de iniciar sesión (OAuth)',
      'Los agentes necesitan un inicio de sesión estándar, o un servicio abierto que no pida claves.',
    ),
    en: t(
      'Agents have no standard way to log in (OAuth)',
      'Agents have a standard way to log in (OAuth)',
      'Agents need a standard login, or an open service that asks for no keys.',
    ),
  },
  'onboarding-friction': {
    es: t(
      'Un agente no puede empezar a usarte sin ayuda de una persona',
      'Un agente puede empezar a usarte sin ayuda de una persona',
      'Cada paso manual entre encontrarte y usarte por primera vez es un lugar donde el agente se rinde.',
    ),
    en: t(
      'An agent cannot start using you without help from a person',
      'An agent can start using you without help from a person',
      'Every manual step between finding you and using you for the first time is a place where the agent gives up.',
    ),
  },
  'pagination-shape': {
    es: t(
      'Las listas largas no se pueden recorrer por partes',
      'Las listas largas se pueden recorrer por partes',
      'Sin una forma clara de pedir la siguiente página, el agente lee la primera y se pierde el resto.',
    ),
    en: t(
      'Long lists cannot be read in parts',
      'Long lists can be read in parts',
      'Without a clear way to ask for the next page, the agent reads the first one and misses the rest.',
    ),
  },
  'pap-auth-config': {
    es: t(
      'Los permisos de inicio de sesión para agentes personales no están bien definidos (poppy.json)',
      'Los permisos de inicio de sesión para agentes personales están bien definidos (poppy.json)',
      'Es la parte del archivo para agentes personales que dice qué permisos se pueden pedir y cómo se inicia sesión.',
    ),
    en: t(
      'Login permissions for personal agents are not well defined (poppy.json)',
      'Login permissions for personal agents are well defined (poppy.json)',
      'It is the part of the personal agent file that says which permissions can be requested and how login works.',
    ),
  },
  'pap-cross-protocol': {
    es: t(
      'Tu archivo para agentes personales no coincide con tus otros archivos (poppy.json)',
      'Tu archivo para agentes personales coincide con tus otros archivos (poppy.json)',
      'Lo que dice ese archivo debe coincidir con tu catálogo y tu guía de acceso, o el agente no sabe a cuál creerle.',
    ),
    en: t(
      'Your personal agent file does not match your other files (poppy.json)',
      'Your personal agent file matches your other files (poppy.json)',
      'What that file says has to match your catalog and your access guide, or the agent does not know which one to trust.',
    ),
  },
  'pap-discovery': {
    es: t(
      'No hay un archivo para agentes personales (.well-known/poppy.json)',
      'Hay un archivo para agentes personales (.well-known/poppy.json)',
      'Es un archivo que les dice a los asistentes personales de tus clientes cómo conectarse con tu servicio.',
    ),
    en: t(
      'There is no file for personal agents (.well-known/poppy.json)',
      'There is a file for personal agents (.well-known/poppy.json)',
      'It is a file that tells your customers’ personal assistants how to connect to your service.',
    ),
  },
  'pap-endpoint-enforcement': {
    es: t(
      'Tus direcciones para agentes personales dejan pasar a agentes sin permiso (poppy.json)',
      'Tus direcciones para agentes personales rechazan a los agentes sin permiso (poppy.json)',
      'Las direcciones que manejan datos de una persona deben rechazar a cualquier agente que no haya iniciado sesión.',
    ),
    en: t(
      'Your personal agent addresses let agents in without permission (poppy.json)',
      'Your personal agent addresses turn away agents without permission (poppy.json)',
      'Addresses that handle a person’s data should turn away any agent that has not logged in.',
    ),
  },
  'pap-interfaces': {
    es: t(
      'Faltan datos en las conexiones de tu archivo para agentes personales (poppy.json)',
      'Las conexiones de tu archivo para agentes personales están completas (poppy.json)',
      'Cada conexión que declaras debe apuntar a una descripción válida que el agente pueda leer.',
    ),
    en: t(
      'The connections in your personal agent file are missing details (poppy.json)',
      'The connections in your personal agent file are complete (poppy.json)',
      'Each connection you declare should point to a valid description the agent can read.',
    ),
  },
  'pap-issuer-binding': {
    es: t(
      'Tu servicio de inicio de sesión no confirma tu dominio (poppy.json)',
      'Tu servicio de inicio de sesión confirma tu dominio (poppy.json)',
      'El servicio que maneja tus inicios de sesión debe nombrar tu dominio, para que el agente sepa que los dos van juntos.',
    ),
    en: t(
      'Your login service does not confirm your domain (poppy.json)',
      'Your login service confirms your domain (poppy.json)',
      'The service that handles your logins should name your domain, so the agent knows the two belong together.',
    ),
  },
  'public-api': {
    es: t(
      'No hay un servicio que los agentes puedan llamar (API)',
      'Hay un servicio que los agentes pueden llamar (API)',
      'Es la base de todo: una forma documentada de que un agente le pida cosas a tu producto y reciba respuesta.',
    ),
    en: t(
      'There is no service agents can call (API)',
      'There is a service agents can call (API)',
      'It is the base of everything: a documented way for an agent to ask your product for things and get an answer.',
    ),
  },
  'rate-limit-headers': {
    es: t(
      'Tu servicio no avisa cuántas peticiones le quedan al agente (RateLimit)',
      'Tu servicio avisa cuántas peticiones le quedan al agente (RateLimit)',
      'Con ese aviso el agente baja el ritmo a tiempo en vez de chocar con errores y dejarte.',
    ),
    en: t(
      'Your service does not tell the agent how many requests it has left (RateLimit)',
      'Your service tells the agent how many requests it has left (RateLimit)',
      'With that notice the agent slows down in time instead of hitting errors and giving up on you.',
    ),
  },
  'response-schema-coverage': {
    es: t(
      'Tu servicio no dice qué forma tienen sus respuestas (OpenAPI)',
      'Tu servicio dice qué forma tienen sus respuestas (OpenAPI)',
      'Si el agente sabe qué va a recibir antes de llamar, usa la respuesta sin adivinar.',
    ),
    en: t(
      'Your service does not say what its answers look like (OpenAPI)',
      'Your service says what its answers look like (OpenAPI)',
      'If the agent knows what it will get before calling, it uses the answer without guessing.',
    ),
  },
  'rest-sdk-packages': {
    es: t(
      'No hay librerías oficiales en varios lenguajes (npm, PyPI, Go)',
      'Hay librerías oficiales en varios lenguajes (npm, PyPI, Go)',
      'Cada librería es una conexión que el agente no tiene que escribir a mano en el lenguaje en que ya trabaja.',
    ),
    en: t(
      'There are no official libraries in several languages (npm, PyPI, Go)',
      'There are official libraries in several languages (npm, PyPI, Go)',
      'Each library is a connection the agent does not have to write by hand in the language it already works in.',
    ),
  },
  'sandbox-environment': {
    es: t(
      'No hay un modo de prueba',
      'Hay un modo de prueba',
      'Un modo de prueba deja que el agente arme la conexión sin tocar datos reales.',
    ),
    en: t(
      'There is no test mode',
      'There is a test mode',
      'A test mode lets the agent build the integration without touching real data.',
    ),
  },
  'scoped-permissions': {
    es: t(
      'No se le pueden dar permisos limitados a un agente',
      'Se le pueden dar permisos limitados a un agente',
      'Darle al agente solo el acceso que necesita hace que un error tenga menos consecuencias.',
    ),
    en: t(
      'You cannot give an agent limited permissions',
      'You can give an agent limited permissions',
      'Giving the agent only the access it needs means a mistake does less damage.',
    ),
  },
  'web-bot-auth-directory': {
    es: t(
      'Los agentes no pueden firmar sus visitas a tu sitio (Web Bot Auth)',
      'Los agentes pueden firmar sus visitas a tu sitio (Web Bot Auth)',
      'Es una lista pública de claves que deja saber quién está llamando de verdad, para dejar pasar a los agentes confiables.',
    ),
    en: t(
      'Agents cannot sign their visits to your site (Web Bot Auth)',
      'Agents can sign their visits to your site (Web Bot Auth)',
      'It is a public list of keys that shows who is really calling, so you can let trusted agents through.',
    ),
  },
  webmcp: {
    es: t(
      'Tus páginas no les ofrecen herramientas a los agentes del navegador (WebMCP)',
      'Tus páginas les ofrecen herramientas a los agentes del navegador (WebMCP)',
      'Permite que navegadores con IA, como Chrome o el de ChatGPT, usen funciones de tu sitio directo desde la página.',
    ),
    en: t(
      'Your pages offer no tools to browser agents (WebMCP)',
      'Your pages offer tools to browser agents (WebMCP)',
      'It lets AI browsers, like Chrome or the ChatGPT browser, use features of your site right from the page.',
    ),
  },

  // ── Payments ───────────────────────────────────────────────────────────
  'acp-delegate-payment': {
    es: t(
      'Los agentes no te pueden pasar un medio de pago de forma segura (ACP)',
      'Los agentes te pueden pasar un medio de pago de forma segura (ACP)',
      'Es la parte de ACP que deja que el agente del comprador te entregue su medio de pago sin exponerlo.',
    ),
    en: t(
      'Agents cannot hand you a payment method safely (ACP)',
      'Agents can hand you a payment method safely (ACP)',
      'It is the part of ACP that lets the buyer’s agent give you their payment method without exposing it.',
    ),
  },
  'acp-support': {
    es: t(
      'Los agentes no te pueden comprar desde ChatGPT (ACP)',
      'Los agentes te pueden comprar desde ChatGPT (ACP)',
      'Es el sistema de compra que usa ChatGPT cuando un agente compra por una persona, y con un sistema de pago para agentes basta.',
    ),
    en: t(
      'Agents cannot buy from you through ChatGPT (ACP)',
      'Agents can buy from you through ChatGPT (ACP)',
      'It is the checkout ChatGPT uses when an agent buys for a person, and one agent payment system is enough.',
    ),
  },
  'ap2-support': {
    es: t(
      'No aceptas pagos con autorización firmada del comprador (AP2)',
      'Aceptas pagos con autorización firmada del comprador (AP2)',
      'Es el sistema de pagos de Google donde cada compra lleva una prueba de que una persona la autorizó.',
    ),
    en: t(
      'You do not accept payments with a signed buyer approval (AP2)',
      'You accept payments with a signed buyer approval (AP2)',
      'It is Google’s payment system where each purchase carries proof that a person approved it.',
    ),
  },
  'mpp-support': {
    es: t(
      'Los agentes no te pueden pagar por cada uso (MPP)',
      'Los agentes te pueden pagar por cada uso (MPP)',
      'Es una forma de que un agente te pague directo cuando le pide algo a tu sitio, sin cuenta ni tarjeta.',
    ),
    en: t(
      'Agents cannot pay you per use (MPP)',
      'Agents can pay you per use (MPP)',
      'It is a way for an agent to pay you directly when it asks your site for something, with no account or card.',
    ),
  },
  'ucp-support': {
    es: t(
      'Los agentes de compras no saben cómo comprarte (.well-known/ucp)',
      'Los agentes de compras saben cómo comprarte (.well-known/ucp)',
      'Es un archivo que les explica a los agentes de compras cómo hacer un pedido en tu tienda.',
    ),
    en: t(
      'Shopping agents do not know how to buy from you (.well-known/ucp)',
      'Shopping agents know how to buy from you (.well-known/ucp)',
      'It is a file that explains to shopping agents how to place an order in your store.',
    ),
  },
  'x402-support': {
    es: t(
      'Los agentes no te pueden pagar con micropagos (x402)',
      'Los agentes te pueden pagar con micropagos (x402)',
      'Es una forma de que un agente pague montos pequeños por cada consulta a tu sitio, sin registrarse.',
    ),
    en: t(
      'Agents cannot pay you with micropayments (x402)',
      'Agents can pay you with micropayments (x402)',
      'It is a way for an agent to pay small amounts for each request to your site, without signing up.',
    ),
  },
}

/** Todos los ids de chequeo de Ora con texto propio. */
export const CHEQUEOS_CONOCIDOS: string[] = Object.keys(CHEQUEOS)

function entrada(id: string, locale: LocaleChequeo): Textos | null {
  const e = Object.prototype.hasOwnProperty.call(CHEQUEOS, id) ? CHEQUEOS[id] : undefined
  return e ? (e[locale] ?? e.es) : null
}

/**
 * Lo que falta, en palabras del dueño, más una frase de qué es y para qué le
 * sirve a un agente. null si Ora manda un id que no conocemos.
 */
export function textoDeChequeo(id: string, locale: 'es' | 'en'): { titulo: string; detalle: string } | null {
  const e = entrada(id, locale)
  return e ? { titulo: e.falta, detalle: e.detalle } : null
}

/**
 * El título sin el paréntesis final con el archivo o el protocolo
 * ("(llms.txt)", "(MCP)"). Es lo que ve el dueño en la lista de arreglos:
 * palabras simples, sin nombres técnicos. El archivo sigue en `textoDeChequeo`
 * para las instrucciones al agente de código, que sí lo necesita.
 */
export function sinArchivo(titulo: string): string {
  return titulo.replace(/\s*\([^()]*\)\s*$/, '')
}

/** Lo que falta en palabras del dueño, sin nombres técnicos, más su "por qué importa". */
export function textoLlano(id: string, locale: 'es' | 'en'): { titulo: string; detalle: string } | null {
  const e = entrada(id, locale)
  return e ? { titulo: sinArchivo(e.falta), detalle: e.detalle } : null
}

/** Versión en positivo del título, para la columna de lo que ya pasa. */
export function textoDeChequeoOk(id: string, locale: 'es' | 'en'): string | null {
  return entrada(id, locale)?.ok ?? null
}
