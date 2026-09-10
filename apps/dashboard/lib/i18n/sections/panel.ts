export const panel = {
  es: {
    // layout
    necesitasEntrar: 'Necesitas entrar',
    soloEmailPre: 'El panel de ',
    soloEmailPost: ' solo se abre con el email de ese negocio.',
    entrarConEmail: 'Entrar con tu email',

    // sidebar
    cambiarNegocio: 'cambiar de negocio →',
    navDashboard: 'Dashboard',
    navScore: 'Score',
    navRutas: 'Agregar rutas',
    navKit: 'Haz que te encuentren',
    navClientes: 'Clientes',
    navRetirar: 'Retirar',
    navWallet: 'Mi wallet',

    // dashboard
    dashboardTitulo: 'Dashboard',
    consumenPor: 'Los agentes consumen por',
    paso1Titulo: 'Mira tu score',
    paso1Descripcion: 'Qué tan listo está tu sitio para agentes, y a cuánto llega con Peaje.',
    paso2Titulo: 'Ponle precio a tus links',
    paso2Descripcion: 'Agrega links o importa tu sitemap. Los agentes pagan por request.',
    paso3Titulo: 'Haz que te encuentren',
    paso3Descripcion: 'Aplica el kit en tu web y verifica la integración.',
    metricaDisponible: 'Disponible',
    metricaRequests: 'Requests pagados',
    metricaRevenue: 'Revenue total',
    ultimosPagos: 'Últimos pagos',
    nadiePaga: 'Todavía nadie paga.',
    agregaPrimerLink: 'Agrega tu primer link con precio',
    yPruebaCon: 'y pruébalo con',
    pruebaCon: 'Pruébalo con',
    colHora: 'Hora',
    colRuta: 'Ruta',
    colAgente: 'Agente',
    colRed: 'Red',
    colMonto: 'Monto',
    colTx: 'Tx',
    verTx: 'ver',

    // setup checklist
    setupTitulo: 'Termina de configurar Peaje',
    setupProgreso: (hechos: number, total: number) => `${hechos} de ${total} pasos listos`,
    setupContinuar: 'Continuar →',
    setupIr: 'Ir',

    // gráfica de revenue
    ultimosDias: (dias: number) => `Últimos ${dias} días`,
    resumenPagos: (pagos: number, monto: string) => `${pagos} pagos · $${monto}`,
    graficaAria: (dias: number) => `Revenue de los últimos ${dias} días`,
    graficaBarra: (fecha: string, monto: string, pagos: number) =>
      `${fecha}: $${monto} (${pagos} pagos)`,

    // wallet de retiro
    cambiarWalletRetiro: 'Cambiar wallet de retiro',
    walletRetiroTitulo: 'Wallet de retiro',
    walletRetiroDescripcion:
      'A dónde te enviamos el dinero cuando retiras. Puedes cambiarla cuando quieras.',
    guardar: 'Guardar',
    errorGuardarWallet: 'No se pudo guardar',

    // clientes
    clientesTitulo: 'Tus clientes agente',
    clientesDescripcion:
      'Quiénes son los agentes que pagan por tu contenido. Identidad y reputación del registro ERC-8004, vía The Graph.',
    clientesVacio: 'Todavía no hay pagos con wallet identificada.',
    metricaAgentesUnicos: 'Agentes únicos',
    metricaConIdentidad: 'Con identidad on-chain',
    valorConIdentidad: (agentes: number, porcentaje: number) =>
      `${agentes} (${porcentaje}% del revenue)`,
    metricaEnfoque: 'Enfoque dominante',
    sinDatos: 'sin datos',
    reputacion: (promedio: number, votos: number) => `reputación ${promedio}/100 (${votos})`,
    sinIdentidad: 'sin identidad',
    conteoRequests: (requests: number) => `${requests} request${requests === 1 ? '' : 's'}`,
    pagaPor: 'paga por',
    unionRedes: ' y ',
    vistoPorUltimaVez: 'visto',

    // score
    scoreTitulo: 'Score',
    scoreDescripcion: 'Qué tan listo está tu sitio para agentes, medido con Ora (ora.ai).',
    scoreOriginLocal:
      'Tu origin es local y Ora solo escanea dominios públicos. Cuando tu API tenga dominio, aquí aparece el score.',
    scorePendientePre: 'Todavía no hay score de ',
    scorePendientePost: '. El scan tarda ~30 segundos.',
    correrScore: 'Correr score',
    volverACorrerScore: 'Volver a correr',
    scoreComparativa: 'hoy vs. con Peaje y el kit aplicado',
    scoreBien: 'Lo que ya tienes bien',
    scoreChecksPasando: (checks: number) => `${checks} checks pasando`,
    scoreMejoras: 'Lo que mejoras con Peaje',
    scoreChecksAtacados: (checks: number) => `${checks} checks que el kit y el gateway atacan`,
    scoreTodoPasa: 'Todos los checks que Peaje ataca ya pasan.',

    // rutas
    rutasTitulo: 'Haz que los agentes puedan pagarte',
    rutasDescripcion:
      'Ponle precio a links de tu web. El gateway responde 402 y el agente paga solo.',

    // errores de server actions
    errorRutaSlash: 'La ruta tiene que empezar con /',
    errorPrecioMayorCero: 'El precio tiene que ser mayor a 0',
    errorWalletInvalida: 'Esa no parece una wallet válida',
    errorNegocioSinWallet: 'Este negocio no tiene wallet.',
    errorDestinoInvalido: 'La address de destino no es válida.',
    errorRedInvalida: 'Red inválida.',
    errorMontoInvalido: 'Monto inválido.',
    errorMismoDestino: 'Ese es el destino de tu propia wallet.',
    errorEnvio: 'No se pudo enviar. Revisa el saldo (el gas sale del mismo token) y reintenta.',
    errorUrlInvalida: 'La URL no es válida. Incluye https://',
    errorSoloHttp: 'Solo http(s)',
    errorPrecioInvalido: 'Precio inválido (0 = gratis)',
    errorUrlSitemapInvalida: 'URL inválida',
    errorSitemapIlegible: (url: string, status: number) => `No pude leer ${url} (${status})`,
    errorSitemapVacio: 'El sitemap no tiene URLs legibles',

    /** Locale para fechas y horas del panel. */
    formatoFecha: 'es-CO',
    // links con precio (LinksPanel)
    linksTitulo: 'Links con precio',
    linksIntro:
      'Cualquier URL pública (una página, un PDF, un dataset) se vuelve cobrable. No necesitas API: el agente paga y recibe el contenido. Precio 0 = el link pasa gratis (útil para muestras o docs).',
    linksGratis: 'gratis',
    linksQuitar: 'quitar',
    linksVacio: 'Ningún link tiene precio todavía. Agrega uno o importa tu sitemap.',
    linksErrorCrear: 'No se pudo crear el link',
    linksCampoTitulo: 'Título (opcional)',
    linksPrecio: 'Precio',
    linksPrecioPlaceholder: '0 = gratis',
    linksUrlPlaceholder: 'https://tusitio.com/reporte-2026.pdf',
    linksTituloPlaceholder: 'Reporte 2026',
    linksAgregar: 'Agregar',
    linksNotaPre: 'Cada link queda en',
    linksNotaPost: 'y entra solo al discovery para agentes:',
    sitemapTitulo: 'Importar desde tu sitemap',
    sitemapIntro: 'Pega tu dominio o la URL del sitemap.xml: elige qué páginas cobrar y con qué precio.',
    sitemapPlaceholder: 'tusitio.com o https://tusitio.com/sitemap.xml',
    sitemapLeyendo: 'Leyendo…',
    sitemapLeer: 'Leer sitemap',
    sitemapErrorLeer: 'No se pudo leer el sitemap',
    sitemapBuscar: 'Buscar en tu sitemap…',
    sitemapSeleccionadas: (n: number, total: number) => `${n} de ${total} seleccionadas`,
    sitemapTodas: 'todas',
    sitemapNinguna: 'ninguna',
    sitemapPrecioTodas: 'Precio para todas:',
    sitemapImportar: (n: number) => `Importar ${n} links`,
    sitemapImportados: (n: number, precio: number) => `${n} links importados con precio $${precio}`,
    sitemapErrorImportar: 'No se pudo importar',
  },
  en: {
    // layout
    necesitasEntrar: 'You need to sign in',
    soloEmailPre: 'The panel for ',
    soloEmailPost: ' only opens with that business email.',
    entrarConEmail: 'Sign in with your email',

    // sidebar
    cambiarNegocio: 'switch business →',
    navDashboard: 'Dashboard',
    navScore: 'Score',
    navRutas: 'Add routes',
    navKit: 'Get discovered',
    navClientes: 'Customers',
    navRetirar: 'Withdraw',
    navWallet: 'My wallet',

    // dashboard
    dashboardTitulo: 'Dashboard',
    consumenPor: 'Agents consume through',
    paso1Titulo: 'Check your score',
    paso1Descripcion: 'How ready your site is for agents, and how far it gets with Peaje.',
    paso2Titulo: 'Put a price on your links',
    paso2Descripcion: 'Add links or import your sitemap. Agents pay per request.',
    paso3Titulo: 'Get discovered',
    paso3Descripcion: 'Apply the kit on your site and verify the integration.',
    metricaDisponible: 'Available',
    metricaRequests: 'Paid requests',
    metricaRevenue: 'Total revenue',
    ultimosPagos: 'Latest payments',
    nadiePaga: 'Nobody is paying yet.',
    agregaPrimerLink: 'Add your first priced link',
    yPruebaCon: 'and test it with',
    pruebaCon: 'Test it with',
    colHora: 'Time',
    colRuta: 'Route',
    colAgente: 'Agent',
    colRed: 'Network',
    colMonto: 'Amount',
    colTx: 'Tx',
    verTx: 'view',

    // setup checklist
    setupTitulo: 'Finish setting up Peaje',
    setupProgreso: (hechos: number, total: number) => `${hechos} of ${total} steps done`,
    setupContinuar: 'Continue →',
    setupIr: 'Go',

    // gráfica de revenue
    ultimosDias: (dias: number) => `Last ${dias} days`,
    resumenPagos: (pagos: number, monto: string) => `${pagos} payments · $${monto}`,
    graficaAria: (dias: number) => `Revenue over the last ${dias} days`,
    graficaBarra: (fecha: string, monto: string, pagos: number) =>
      `${fecha}: $${monto} (${pagos} payments)`,

    // wallet de retiro
    cambiarWalletRetiro: 'Change withdrawal wallet',
    walletRetiroTitulo: 'Withdrawal wallet',
    walletRetiroDescripcion:
      'Where we send your money when you withdraw. You can change it whenever you want.',
    guardar: 'Save',
    errorGuardarWallet: 'Could not save',

    // clientes
    clientesTitulo: 'Your agent customers',
    clientesDescripcion:
      'Which agents pay for your content. Identity and reputation from the ERC-8004 registry, via The Graph.',
    clientesVacio: 'No payments from an identified wallet yet.',
    metricaAgentesUnicos: 'Unique agents',
    metricaConIdentidad: 'With on-chain identity',
    valorConIdentidad: (agentes: number, porcentaje: number) =>
      `${agentes} (${porcentaje}% of revenue)`,
    metricaEnfoque: 'Dominant focus',
    sinDatos: 'no data',
    reputacion: (promedio: number, votos: number) => `reputation ${promedio}/100 (${votos})`,
    sinIdentidad: 'no identity',
    conteoRequests: (requests: number) => `${requests} request${requests === 1 ? '' : 's'}`,
    pagaPor: 'pays via',
    unionRedes: ' and ',
    vistoPorUltimaVez: 'last seen',

    // score
    scoreTitulo: 'Score',
    scoreDescripcion: 'How ready your site is for agents, measured with Ora (ora.ai).',
    scoreOriginLocal:
      'Your origin is local and Ora only scans public domains. Once your API has a domain, the score shows up here.',
    scorePendientePre: 'There is no score for ',
    scorePendientePost: ' yet. The scan takes about 30 seconds.',
    correrScore: 'Run score',
    volverACorrerScore: 'Run again',
    scoreComparativa: 'today vs. with Peaje and the kit applied',
    scoreBien: 'What you already have right',
    scoreChecksPasando: (checks: number) => `${checks} checks passing`,
    scoreMejoras: 'What you improve with Peaje',
    scoreChecksAtacados: (checks: number) => `${checks} checks the kit and the gateway cover`,
    scoreTodoPasa: 'Every check Peaje covers is already passing.',

    // rutas
    rutasTitulo: 'Let agents pay you',
    rutasDescripcion:
      'Put a price on links from your site. The gateway answers 402 and the agent pays on its own.',

    // errores de server actions
    errorRutaSlash: 'The route has to start with /',
    errorPrecioMayorCero: 'The price has to be greater than 0',
    errorWalletInvalida: 'That does not look like a valid wallet',
    errorNegocioSinWallet: 'This business has no wallet.',
    errorDestinoInvalido: 'The destination address is not valid.',
    errorRedInvalida: 'Invalid network.',
    errorMontoInvalido: 'Invalid amount.',
    errorMismoDestino: 'That is your own wallet address.',
    errorEnvio: 'Could not send. Check the balance (gas comes out of the same token) and retry.',
    errorUrlInvalida: 'The URL is not valid. Include https://',
    errorSoloHttp: 'Only http(s)',
    errorPrecioInvalido: 'Invalid price (0 = free)',
    errorUrlSitemapInvalida: 'Invalid URL',
    errorSitemapIlegible: (url: string, status: number) => `Could not read ${url} (${status})`,
    errorSitemapVacio: 'The sitemap has no readable URLs',

    /** Locale para fechas y horas del panel. */
    formatoFecha: 'en-US',
    // links con precio (LinksPanel)
    linksTitulo: 'Priced links',
    linksIntro:
      'Any public URL (a page, a PDF, a dataset) becomes chargeable. You do not need an API: the agent pays and gets the content. Price 0 = the link stays free (handy for samples or docs).',
    linksGratis: 'free',
    linksQuitar: 'remove',
    linksVacio: 'No link has a price yet. Add one or import your sitemap.',
    linksErrorCrear: 'Could not create the link',
    linksCampoTitulo: 'Title (optional)',
    linksPrecio: 'Price',
    linksPrecioPlaceholder: '0 = free',
    linksUrlPlaceholder: 'https://yoursite.com/report-2026.pdf',
    linksTituloPlaceholder: '2026 report',
    linksAgregar: 'Add',
    linksNotaPre: 'Each link lives at',
    linksNotaPost: 'and enters the agent discovery doc on its own:',
    sitemapTitulo: 'Import from your sitemap',
    sitemapIntro: 'Paste your domain or the sitemap.xml URL: pick which pages to charge for and at what price.',
    sitemapPlaceholder: 'yoursite.com or https://yoursite.com/sitemap.xml',
    sitemapLeyendo: 'Reading…',
    sitemapLeer: 'Read sitemap',
    sitemapErrorLeer: 'Could not read the sitemap',
    sitemapBuscar: 'Search your sitemap…',
    sitemapSeleccionadas: (n: number, total: number) => `${n} of ${total} selected`,
    sitemapTodas: 'all',
    sitemapNinguna: 'none',
    sitemapPrecioTodas: 'Price for all:',
    sitemapImportar: (n: number) => `Import ${n} links`,
    sitemapImportados: (n: number, precio: number) => `${n} links imported at $${precio}`,
    sitemapErrorImportar: 'Could not import',
  },
}
