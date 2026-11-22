/**
 * Página /docs/mcp: el servidor MCP del dueño (gateway, tareas/mcp.ts), en
 * palabras de dueño. Las herramientas y lo que hacen salen de ese archivo; el
 * inicio de sesión, de oauth.ts y tareas/router.ts; los pasos de cada cliente,
 * de su documentación oficial (revisada el 22 nov 2026, links en `fuentes`).
 * Los créditos y el paquete gratis llegan como argumentos desde @peaje/db.
 */

type Costos = { consulta: number; informe: number }
type Gratis = { informes: number; respuestas: number; consulta: number }
type Herramienta = { nombre: string; que: string; tipo: 'lee' | 'marca' | 'creditos' }
type Cliente = { id: 'claude' | 'claude-code' | 'chatgpt' | 'cursor'; nombre: string; pasos: string[]; nota: string }

export const docsMcp = {
  es: {
    metaTitulo: 'Servidor MCP de Peaje para Claude, ChatGPT y Cursor',
    metaDescripcion:
      'Conecta Peaje a Claude, ChatGPT o Cursor con una URL y tu cuenta, sin clave. Sus 10 herramientas y lo que nunca hace sin tu sí.',
    titulo: 'El servidor MCP de Peaje',
    intro:
      'Conecta Peaje a la herramienta de IA que ya usas. Desde ahí lees tus tareas, le preguntas a tu agente a quién cita la IA en vez de ti y tu herramienta aplica los arreglos en tu repo. Peaje revisa el resultado en tu sitio en vivo.',
    urlTitulo: 'La URL del servidor',
    urlTexto:
      'Es la misma para todos los negocios. Al conectarla inicias sesión con tu cuenta de Peaje y eliges tu negocio. No hay clave que pegar.',
    copiar: 'Copiar',
    copiado: 'Copiado',

    cortoTitulo: 'La vía corta',
    cortoTexto:
      'Si usas Claude Code, Cursor o Codex en la carpeta de tu sitio, pégale esta frase. Tu herramienta conecta el servidor, te pide iniciar sesión y te muestra qué archivos cambiaría antes de tocar nada.',

    conectarTitulo: 'Cómo conectarlo',
    conectarRevisado: 'Pasos revisados en la documentación oficial de cada herramienta el 22 de noviembre de 2026.',
    clientes: [
      {
        id: 'claude',
        nombre: 'Claude, en la web y en la app de escritorio',
        pasos: [
          'En Claude, abre Customize y entra a Connectors.',
          'Toca + Add y elige Add custom connector.',
          'Ponle de nombre Peaje, pega la URL del servidor y toca Add.',
          'Toca Connect: se abre Peaje, inicias sesión, eliges tu negocio y das permiso.',
          'En un chat, toca + abajo a la izquierda, entra a Connectors y prende Peaje.',
        ],
        nota: 'Funciona en todos los planes de Claude; en el gratis cabe un solo conector personalizado. En Team y Enterprise lo agrega primero quien administra la organización, en Organization settings, Connectors, y después cada persona toca Connect.',
      },
      {
        id: 'claude-code',
        nombre: 'Claude Code',
        pasos: [
          'Abre la terminal en la carpeta de tu sitio y corre el comando de abajo.',
          'En Claude Code escribe /mcp, elige peaje e inicia sesión en el navegador.',
        ],
        nota: 'Con --scope user queda en todos tus proyectos. Para quitarlo: claude mcp remove peaje.',
      },
      {
        id: 'chatgpt',
        nombre: 'ChatGPT',
        pasos: [
          'En ChatGPT en la web, entra a Plugins, toca + y elige Add custom MCP server.',
          'Ponle de nombre Peaje y, en Connection, pega la URL del servidor.',
          'En la autenticación elige OAuth. Lee el aviso de riesgo y marca la casilla.',
          'Toca Create as a plugin, revisa las herramientas e instálalo. Al conectarlo inicias sesión en Peaje y eliges tu negocio.',
          'En un chat nuevo escribe @ y elige Peaje.',
        ],
        nota: 'Solo en la web, no en el celular. Está en los planes Pro, Business, Enterprise y Edu; en Business lo crean los admins y owners. En Pro, OpenAI lo deja solo con herramientas de lectura.',
      },
      {
        id: 'cursor',
        nombre: 'Cursor',
        pasos: [
          'Crea o edita ~/.cursor/mcp.json para todos tus proyectos, o .cursor/mcp.json en la carpeta de tu sitio.',
          'Agrega la entrada peaje de abajo y guarda. Si ya tienes otros servidores, déjalos como están.',
          'La primera vez, Cursor te pide iniciar sesión en Peaje y elegir tu negocio.',
        ],
        nota: 'Prendes o apagas el servidor desde Customize, en la barra lateral de Cursor.',
      },
    ] satisfies Cliente[] as Cliente[],
    otras:
      'Otras herramientas: cualquiera que acepte un servidor MCP remoto por HTTP con inicio de sesión OAuth usa la misma URL. Si la tuya solo acepta una clave fija, crea una clave del agente en tu panel, en Integraciones.',

    herramientasTitulo: 'Qué herramientas tiene',
    herramientasIntro:
      'Diez herramientas. Ninguna toca tu sitio: Peaje propone y revisa, tu herramienta hace los cambios en tu repo.',
    tipos: { lee: 'Solo lee', marca: 'Cambia una tarea', creditos: 'Usa créditos' },
    herramientas: (c: Costos): Herramienta[] => [
      { nombre: 'peaje_setup', tipo: 'lee', que: 'En qué va la instalación de Peaje en tu sitio, qué chequeos ya pasan y qué falta hacer.' },
      { nombre: 'peaje_status', tipo: 'lee', que: 'Tu resumen: chequeos, puntaje, tareas abiertas y visitas de agentes de los últimos 7 días.' },
      { nombre: 'peaje_plan', tipo: 'lee', que: 'Tu meta y el plan de Peaje para llegar, paso por paso, con la métrica de cada paso.' },
      { nombre: 'peaje_list_tasks', tipo: 'lee', que: 'Las tareas que Peaje te dejó, primero las que más valen la pena.' },
      { nombre: 'peaje_get_task', tipo: 'lee', que: 'Una tarea completa: qué hacer y qué va a revisar Peaje en tu sitio en vivo.' },
      { nombre: 'peaje_start_task', tipo: 'marca', que: 'Marca una tarea en curso, para que veas en tu panel que tu herramienta está en eso.' },
      { nombre: 'peaje_complete_task', tipo: 'marca', que: 'Avisa que el cambio ya está publicado. Peaje revisa tu sitio en vivo en ese momento y, si el deploy no ha salido, vuelve a revisar cada día.' },
      { nombre: 'peaje_dismiss_task', tipo: 'marca', que: 'Descarta una tarea que no aplica a tu negocio, con el motivo.' },
      { nombre: 'peaje_ask', tipo: 'creditos', que: `Le pregunta a tu agente lo mismo que el chat del panel: a quién cita la IA en vez de ti, qué publicar, cómo vas. Una respuesta que consulta tus datos usa ${c.consulta} créditos.` },
      { nombre: 'peaje_refresh_tasks', tipo: 'creditos', que: `Le pide a Peaje que busque tareas nuevas ahora, como máximo una vez cada 10 minutos. Con Pro usa ${c.informe} créditos, lo mismo que pedirlo en el chat.` },
    ],

    permisosTitulo: 'Qué hace sin tu sí y qué no',
    solaTitulo: 'Lo hace sin preguntarte',
    sola: [
      'Leer tu plan, tus tareas, tus chequeos y tus visitas de agentes.',
      'Marcar una tarea en curso, hecha o descartada. Lo ves en tu panel.',
      'Pedirle a Peaje que revise tu sitio en vivo después de un arreglo.',
    ],
    conSiTitulo: 'Necesita tu sí',
    conSi: [
      'Escribir archivos en tu repo, hacer commit y hacer deploy. La guía de instalación le pide a tu herramienta mostrarte la lista de archivos y esperar tu sí.',
      'Usar créditos. Las dos herramientas que los usan lo dicen en su descripción, y la guía le pide a tu herramienta avisarte antes.',
      'Iniciar sesión y dar permiso a tu negocio. Eso solo lo haces tú, en usepeaje.com.',
    ],
    nuncaTitulo: 'No lo hace nunca',
    nunca: [
      'Cambiar tu sitio por su cuenta.',
      'Darle a tu herramienta el valor de PEAJE_ORIGIN_SECRET. Esa variable la copias tú del panel a tu hosting.',
      'Tocar tu suscripción o tu tarjeta.',
    ],

    authTitulo: 'Cómo se autentica',
    auth: [
      'Con tu cuenta de Peaje, por OAuth 2.1 con PKCE, como pide la especificación de MCP. La primera vez tu herramienta abre usepeaje.com: inicias sesión, eliges tu negocio y das permiso.',
      'El acceso dura una hora y se renueva solo. La renovación vale 90 días y cambia cada vez que se usa. Peaje guarda solo el hash de cada token.',
      'Si tu herramienta no acepta inicio de sesión, usa una clave del agente (empieza con peaje_live_) que creas en tu panel, en Integraciones. Va en el header Authorization: Bearer.',
      'Para cortar el acceso, entra a Integraciones en tu panel y toca Desconectar.',
    ],

    faqTitulo: 'Preguntas frecuentes',
    faq: (g: Gratis) => [
      {
        p: '¿Necesito una clave de API?',
        r: 'No. Inicias sesión con tu cuenta de Peaje la primera vez que conectas. La clave del agente es solo para herramientas que no aceptan inicio de sesión.',
      },
      {
        p: '¿Peaje puede cambiar mi sitio?',
        r: 'No. Peaje deja tareas y revisa el resultado en tu sitio en vivo. Los cambios los hace tu herramienta en tu repo, y solo cuando tú dices que sí.',
      },
      {
        p: '¿Cuánto cuesta?',
        r: `Conectarlo es gratis, y leer tu plan y tus tareas no gasta nada. Preguntarle a tu agente usa el plan Pro o el paquete gratis de tu sitio (${g.informes} informes y ${g.respuestas} respuestas). Con Pro, una respuesta que consulta tus datos usa ${g.consulta} créditos del mes.`,
      },
      {
        p: '¿Me sirve si no tengo un repo?',
        r: 'Sí, para preguntar. En Claude o ChatGPT le preguntas a tu agente a quién cita la IA en vez de ti o qué publicar. Para instalar Peaje o aplicar tareas necesitas una herramienta abierta en la carpeta de tu sitio, como Claude Code o Cursor.',
      },
      {
        p: '¿Cómo lo desconecto?',
        r: 'En tu panel, entra a Integraciones y toca Desconectar. Después quita el servidor de tu herramienta; en Claude Code es claude mcp remove peaje.',
      },
    ],

    fuentesTitulo: 'Fuentes',
    fuentes: [
      { texto: 'Claude: custom connectors con MCP remoto', url: 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp' },
      { texto: 'Claude Code: conectar herramientas por MCP', url: 'https://code.claude.com/docs/en/mcp' },
      { texto: 'ChatGPT: servidores MCP personalizados', url: 'https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta' },
      { texto: 'Cursor: Model Context Protocol', url: 'https://cursor.com/docs/context/mcp' },
    ],
    abrirClaude: 'Abrir el formulario en Claude',

    cierreTitulo: '¿Todavía no tienes tu negocio en Peaje?',
    cierreTexto: 'Mide tu sitio gratis con el Radar y activa tu agente. Después conectas el servidor con tu cuenta.',
  },
  en: {
    metaTitulo: 'Peaje MCP server for Claude, ChatGPT and Cursor',
    metaDescripcion:
      'Connect Peaje to Claude, ChatGPT or Cursor with one URL and your account, no key. Its 10 tools and what it never does without your OK.',
    titulo: 'The Peaje MCP server',
    intro:
      'Connect Peaje to the AI tool you already use. From there you read your tasks, ask your agent who AI cites instead of you, and your tool applies the fixes in your repo. Peaje checks the result on your live site.',
    urlTitulo: 'The server URL',
    urlTexto:
      'It is the same for every business. When you connect it you sign in with your Peaje account and pick your business. There is no key to paste.',
    copiar: 'Copy',
    copiado: 'Copied',

    cortoTitulo: 'The short way',
    cortoTexto:
      'If you use Claude Code, Cursor or Codex in your site folder, paste it this sentence. Your tool connects the server, asks you to sign in and shows you which files it would change before touching anything.',

    conectarTitulo: 'How to connect it',
    conectarRevisado: 'Steps checked against each tool’s official documentation on November 22, 2026.',
    clientes: [
      {
        id: 'claude',
        nombre: 'Claude, on the web and the desktop app',
        pasos: [
          'In Claude, open Customize and go to Connectors.',
          'Click + Add and choose Add custom connector.',
          'Name it Peaje, paste the server URL and click Add.',
          'Click Connect: Peaje opens, you sign in, pick your business and approve.',
          'In a chat, click + at the lower left, go to Connectors and turn Peaje on.',
        ],
        nota: 'It works on every Claude plan; the free plan allows one custom connector. On Team and Enterprise, an organization admin adds it first in Organization settings, Connectors, and then each person clicks Connect.',
      },
      {
        id: 'claude-code',
        nombre: 'Claude Code',
        pasos: [
          'Open the terminal in your site folder and run the command below.',
          'In Claude Code type /mcp, pick peaje and sign in in the browser.',
        ],
        nota: 'With --scope user it stays in all your projects. To remove it: claude mcp remove peaje.',
      },
      {
        id: 'chatgpt',
        nombre: 'ChatGPT',
        pasos: [
          'In ChatGPT on the web, go to Plugins, click + and choose Add custom MCP server.',
          'Name it Peaje and, under Connection, paste the server URL.',
          'For authentication choose OAuth. Read the risk warning and tick the box.',
          'Click Create as a plugin, review the tools and install it. When you connect it you sign in to Peaje and pick your business.',
          'In a new chat type @ and pick Peaje.',
        ],
        nota: 'Web only, not on mobile. It is on the Pro, Business, Enterprise and Edu plans; on Business, admins and owners create it. On Pro, OpenAI limits it to read tools.',
      },
      {
        id: 'cursor',
        nombre: 'Cursor',
        pasos: [
          'Create or edit ~/.cursor/mcp.json for all your projects, or .cursor/mcp.json in your site folder.',
          'Add the peaje entry below and save. If you already have other servers, leave them as they are.',
          'The first time, Cursor asks you to sign in to Peaje and pick your business.',
        ],
        nota: 'You turn the server on or off from Customize, in the Cursor sidebar.',
      },
    ] satisfies Cliente[] as Cliente[],
    otras:
      'Other tools: any tool that accepts a remote MCP server over HTTP with OAuth sign-in uses the same URL. If yours only takes a fixed key, create an agent key in your dashboard, under Integrations.',

    herramientasTitulo: 'What tools it has',
    herramientasIntro:
      'Ten tools. None of them touches your site: Peaje proposes and checks, your tool makes the changes in your repo.',
    tipos: { lee: 'Read only', marca: 'Updates a task', creditos: 'Uses credits' },
    herramientas: (c: Costos): Herramienta[] => [
      { nombre: 'peaje_setup', tipo: 'lee', que: 'Where the Peaje install on your site stands, which checks already pass and what is left to do.' },
      { nombre: 'peaje_status', tipo: 'lee', que: 'Your summary: checks, score, open tasks and agent visits in the last 7 days.' },
      { nombre: 'peaje_plan', tipo: 'lee', que: 'Your goal and Peaje’s plan to get there, step by step, with the metric for each step.' },
      { nombre: 'peaje_list_tasks', tipo: 'lee', que: 'The tasks Peaje left you, the ones most worth doing first.' },
      { nombre: 'peaje_get_task', tipo: 'lee', que: 'One full task: what to do and what Peaje will check on your live site.' },
      { nombre: 'peaje_start_task', tipo: 'marca', que: 'Marks a task in progress, so you see in your dashboard that your tool is on it.' },
      { nombre: 'peaje_complete_task', tipo: 'marca', que: 'Says the change is live. Peaje checks your live site right then and, if the deploy is not out yet, checks again every day.' },
      { nombre: 'peaje_dismiss_task', tipo: 'marca', que: 'Dismisses a task that does not apply to your business, with the reason.' },
      { nombre: 'peaje_ask', tipo: 'creditos', que: `Asks your agent the same things as the dashboard chat: who AI cites instead of you, what to publish, how you are doing. A reply that looks up your data uses ${c.consulta} credits.` },
      { nombre: 'peaje_refresh_tasks', tipo: 'creditos', que: `Asks Peaje to look for new tasks now, at most once every 10 minutes. On Pro it uses ${c.informe} credits, the same as asking in the chat.` },
    ],

    permisosTitulo: 'What it does without your OK, and what it does not',
    solaTitulo: 'Does it without asking',
    sola: [
      'Reads your plan, your tasks, your checks and your agent visits.',
      'Marks a task in progress, done or dismissed. You see it in your dashboard.',
      'Asks Peaje to check your live site after a fix.',
    ],
    conSiTitulo: 'Needs your OK',
    conSi: [
      'Writing files in your repo, committing and deploying. The setup guide tells your tool to show you the list of files and wait for your yes.',
      'Using credits. The two tools that use them say so in their description, and the guide tells your tool to warn you first.',
      'Signing in and approving your business. Only you do that, on usepeaje.com.',
    ],
    nuncaTitulo: 'Never does',
    nunca: [
      'Change your site on its own.',
      'Give your tool the value of PEAJE_ORIGIN_SECRET. You copy that variable from the dashboard to your hosting yourself.',
      'Touch your subscription or your card.',
    ],

    authTitulo: 'How it authenticates',
    auth: [
      'With your Peaje account, over OAuth 2.1 with PKCE, as the MCP specification asks. The first time, your tool opens usepeaje.com: you sign in, pick your business and approve.',
      'Access lasts one hour and renews on its own. The renewal is valid for 90 days and changes every time it is used. Peaje stores only the hash of each token.',
      'If your tool does not accept sign-in, use an agent key (it starts with peaje_live_) that you create in your dashboard, under Integrations. It goes in the Authorization: Bearer header.',
      'To cut access, open Integrations in your dashboard and click Disconnect.',
    ],

    faqTitulo: 'Frequently asked questions',
    faq: (g: Gratis) => [
      {
        p: 'Do I need an API key?',
        r: 'No. You sign in with your Peaje account the first time you connect. The agent key is only for tools that do not accept sign-in.',
      },
      {
        p: 'Can Peaje change my site?',
        r: 'No. Peaje leaves tasks and checks the result on your live site. Your tool makes the changes in your repo, and only when you say yes.',
      },
      {
        p: 'How much does it cost?',
        r: `Connecting it is free, and reading your plan and tasks costs nothing. Asking your agent uses the Pro plan or your site’s free package (${g.informes} reports and ${g.respuestas} answers). On Pro, a reply that looks up your data uses ${g.consulta} of the month’s credits.`,
      },
      {
        p: 'Is it useful if I do not have a repo?',
        r: 'Yes, for asking. In Claude or ChatGPT you ask your agent who AI cites instead of you or what to publish. To install Peaje or apply tasks you need a tool opened in your site folder, like Claude Code or Cursor.',
      },
      {
        p: 'How do I disconnect it?',
        r: 'In your dashboard, open Integrations and click Disconnect. Then remove the server from your tool; in Claude Code it is claude mcp remove peaje.',
      },
    ],

    fuentesTitulo: 'Sources',
    fuentes: [
      { texto: 'Claude: custom connectors using remote MCP', url: 'https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp' },
      { texto: 'Claude Code: connect tools via MCP', url: 'https://code.claude.com/docs/en/mcp' },
      { texto: 'ChatGPT: custom MCP servers', url: 'https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta' },
      { texto: 'Cursor: Model Context Protocol', url: 'https://cursor.com/docs/context/mcp' },
    ],
    abrirClaude: 'Open the form in Claude',

    cierreTitulo: 'No business on Peaje yet?',
    cierreTexto: 'Check your site free with the Radar and turn on your agent. Then you connect the server with your account.',
  },
}
