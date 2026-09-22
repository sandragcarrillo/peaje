export const agentes = {
  es: {
    eyebrow: 'TU AGENTE',
    fondeoOk: (monto: string) =>
      `Fondos enviados: ${monto} van en camino a la wallet del agente. El presupuesto se actualiza en unos segundos.`,
    accionOk: 'Listo.',
    verHtml: (kb: number) => `Ver el HTML comprado (${kb} KB)`,
    titulo: 'Tu agente',
    intro:
      'Un agente que compra por ti. Tiene su propia wallet: el presupuesto que le das es su saldo real, así que no puede gastar de más. Busca en el mercado completo de servicios para agentes, te muestra qué compraría, y solo gasta cuando apruebas.',
    variosNegocios:
      'Los fondos salen del saldo de uno de tus negocios; eliges cuál al crear el agente.',
    sinVentasPre: '¿Todavía no vendes por Peaje?',
    sinVentasLink: 'Ve a tu panel',
    sinVentasPost: 'para tener saldo con el que fondear agentes.',

    // Crear
    crear: '+ Crear agente',
    nuevoAgente: 'Nuevo agente',
    nombre: 'Nombre',
    nombrePlaceholder: 'Ponle un nombre para reconocerlo',
    cadaCuanto: 'Cada cuánto',
    mision: 'Qué tiene que conseguirte',
    misionPlaceholder:
      'Describe qué información necesitas y para qué. Mientras más específico, mejor elige: tema, tipo de contenido y para qué lo vas a usar.',
    fondosDe: 'Fondos de',
    pagaEn: 'Paga en',
    opcionRed: (label: string, symbol: string, saldo: string) =>
      `${label} (${symbol}) · tienes ${saldo}`,
    topePorCompra: 'Tope por compra',
    ademasDeGuardar: 'Además de guardarlo aquí',
    entregaDashboard: 'Solo guardarlo en Peaje',
    entregaEmail: 'Mandarme un correo',
    entregaWebhook: 'Mandarlo a un webhook',
    correo: 'Correo',
    correoPlaceholder: 'tu@correo.com',
    urlWebhook: 'URL del webhook',
    webhookPlaceholder: 'https://…',
    notaEntrega:
      'El resultado de cada compra queda guardado acá, en el historial del agente. El correo o el webhook son avisos encima de eso.',
    creandoWallet: 'Creando wallet…',
    crearAgente: 'Crear agente',
    cancelar: 'Cancelar',
    notaWallet: 'Se le crea una wallet propia. Después lo fondeas.',

    // Tarjeta
    registradoErc: (id: string) => `Registrado en ERC-8004 como agente #${id}`,
    corridas: (n: number) => `${n} corrida${n === 1 ? '' : 's'}`,
    fondosDeNegocio: (nombre: string) => `fondos de ${nombre}`,
    avisaA: (destino: string) => `avisa a ${destino}`,
    proxima: (fecha: string) => `próxima ${fecha}`,
    presupuesto: (symbol: string) => `${symbol} de presupuesto`,
    fallo: 'Falló la acción.',
    sinSaldoEn: (red: string) => `Sin saldo en ${red}`,
    fondear: 'Fondear',
    correrAhora: 'Correr ahora',
    pausar: 'Pausar',
    reanudar: 'Reanudar',
    devolverSaldo: 'Devolver saldo',
    devolverSaldoTitulo: 'Devuelve el saldo del agente a tu wallet',
    ocultar: 'Ocultar',
    verResultados: 'Ver resultados',
    borrar: 'Borrar',
    borrarTitulo: 'Devuelve el saldo antes de borrarlo',

    // Estados
    estadoActivo: 'activo',
    estadoCorriendo: 'corriendo',
    estadoPausado: 'pausado',
    estadoTerminado: 'terminado',

    // Resultados
    sinCompras: 'Todavía no compró nada.',
    avisado: 'avisado',
    noSePudoAvisar: 'no se pudo avisar',
    evaluo: (consultados: number, conReputacion: number) =>
      `evaluó ${consultados} servicios (${conReputacion} con reputación on-chain)`,
    ocultarResultado: 'Ocultar resultado',
    leerResultado: 'Leer resultado',

    // Errores de servidor
    errorNombre: 'Ponle un nombre al agente.',
    errorMision: 'Describe qué tiene que hacer el agente.',
    errorCrear: 'No se pudo crear el agente.',
    errorFondear: 'No se pudo fondear al agente.',
    errorCorrer: 'No se pudo correr la misión.',
    errorDevolver: 'No se pudo devolver el saldo.',
    errorEstado: 'No se pudo cambiar el estado.',
    errorBorrar: 'No se pudo borrar el agente.',


    // Ask (agente único)
    tuAgente: 'Tu agente',
    askTitulo: 'Pídele algo',
    askIntro:
      'Escribe qué necesitas. Tu agente busca en el mercado completo de servicios para agentes y te muestra qué compraría y a qué precio, antes de gastar un centavo.',
    askPlaceholder: 'Ej: el pronóstico del clima en Bogotá esta semana, resumido en tres líneas',
    buscar: 'Buscar en el mercado',
    buscando: 'Buscando entre miles de servicios…',
    planTitulo: 'Esto es lo que compraría',
    planPrecio: (precio: string) => `${precio} por consulta`,
    comprarPor: (precio: string) => `Comprar por ${precio}`,
    comprando: 'Comprando…',
    compraLista: 'Listo: la respuesta quedó abajo, en el historial.',
    alternativasTitulo: 'También encontró',
    usarEste: 'Usar este',
    descarto: (nombre: string, motivo: string) => `Descartó ${nombre}: ${motivo}`,
    sinPlan:
      'No encontró nada que valga tu dinero para ese pedido. Mejor no gastar que comprar algo que no responde.',
    faltaFondeoAviso: (precio: string) =>
      `El servicio existe y cuesta ${precio}, pero a tu agente le falta saldo en esa red para comprarlo.`,
    consultadosNota: (n: number) => `Evaluó ${n.toLocaleString('es-CO')} servicios del mercado.`,
    redDemo: 'red de prueba',
    redReal: 'USDC real',
    veredictoTitulo: 'Por qué este',

    // Capacidades
    capacidadesTitulo: 'Qué puede comprar hoy',
    capDesde: (precio: string) => `desde ${precio}`,
    capNombre: {
      web: 'Buscar en la web',
      clima: 'Clima',
      social: 'Redes sociales',
      noticias: 'Noticias',
      viajes: 'Viajes y lugares',
      imagenes: 'Imágenes con IA',
      cripto: 'Cripto y mercados',
      compras: 'Compras',
    } as Record<string, string>,
    capPedido: {
      web: 'Busca en la web qué se está diciendo esta semana sobre ',
      clima: 'Consigue el pronóstico del clima de los próximos días en ',
      social: 'Tráeme los últimos posts en X sobre ',
      noticias: 'Tráeme los titulares de hoy sobre ',
      viajes: 'Busca hoteles bien ubicados en ',
      imagenes: 'Genera una imagen de ',
      cripto: 'Tráeme el precio y la tendencia de ',
      compras: 'Busca el mejor precio para ',
    } as Record<string, string>,

    // Wallet del agente
    saldoDemo: (symbol: string) => `${symbol} · red de prueba`,
    saldoReal: 'USDC · Base',
    walletCopiada: 'Dirección copiada.',
    copiarWallet: 'Copiar dirección',
    enviaUsdcNota:
      'Para compras en el mercado real: envía USDC (red Base) a la dirección de tu agente. Con $2 alcanza para cientos de consultas.',

    // Activación
    activarTitulo: 'Activa tu agente',
    activarIntro:
      'Un agente comprador con su propia wallet. Le pides cosas en tus palabras, él encuentra quién las vende, paga centavos y te trae la respuesta.',
    activar: 'Activar mi agente',
    activando: 'Creando su wallet…',
    otrosAgentes: 'Otros agentes',
    errorPlanear: 'No se pudo consultar el mercado. Intenta de nuevo.',
    ocupado: 'Tu agente está terminando otra compra. Dale unos segundos y vuelve a intentar.',
    faltaSaldoCompra:
      'A tu agente le falta saldo para esta compra. Fondéalo arriba y vuelve a intentar.',
    faltaSaldoNegocio: 'Tu negocio no tiene saldo suficiente en esa red para fondear.',
    respuestaTitulo: 'La respuesta',
    resultadosPasados: 'Resultados anteriores',
    fondearRed: 'Red',
    fondearDesde: 'Desde',
    origenWallet: (saldo: string) => `Tu wallet · ${saldo}`,
    pasosTitulo: 'Así funciona',
    pasos: [
      { titulo: 'Fondéalo', detalle: 'Pasa saldo de tu negocio a la wallet del agente. Ese es todo su presupuesto: no puede gastar más.' },
      { titulo: 'Pídele algo', detalle: 'En tus palabras. Busca entre miles de servicios que venden datos a agentes.' },
      { titulo: 'Aprueba el plan', detalle: 'Te muestra qué compraría, a qué precio y por qué, antes de gastar un centavo.' },
      { titulo: 'Recibe la respuesta', detalle: 'Paga, lee lo que compró y te responde. El recibo queda en el historial.' },
    ],

    respuestaNota: 'Quedó guardada abajo, en el historial, con su recibo.',
    fuenteComprada: 'Fuente comprada',
    buscandoPasos: [
      'Consultando el mercado completo…',
      'Comparando precios y reputación…',
      'Verificando que el servicio sí responda tu pedido…',
    ],
    comprandoPasos: [
      'Pagando con recibo on-chain…',
      'Leyendo lo que compró…',
      'Escribiendo tu respuesta…',
    ],

    fechaLocale: 'es-CO',
  },
  en: {
    eyebrow: 'YOUR AGENT',
    fondeoOk: (monto: string) =>
      `Funds sent: ${monto} is on its way to the agent wallet. The budget updates in a few seconds.`,
    accionOk: 'Done.',
    verHtml: (kb: number) => `View the purchased HTML (${kb} KB)`,
    titulo: 'Your agent',
    intro:
      'An agent that buys for you. It has its own wallet: the budget you give it is its real balance, so it cannot overspend. It searches the full market of agent services, shows you what it would buy, and only spends when you approve.',
    variosNegocios:
      'Funds come out of the balance of one of your businesses; you pick which one when you create the agent.',
    sinVentasPre: 'Not selling through Peaje yet?',
    sinVentasLink: 'Go to your panel',
    sinVentasPost: 'to build up a balance you can fund agents with.',

    // Crear
    crear: '+ Create agent',
    nuevoAgente: 'New agent',
    nombre: 'Name',
    nombrePlaceholder: 'Give it a name you will recognize',
    cadaCuanto: 'How often',
    mision: 'What it should get you',
    misionPlaceholder:
      'Describe what information you need and what for. The more specific, the better it chooses: topic, type of content and how you plan to use it.',
    fondosDe: 'Funded by',
    pagaEn: 'Pays on',
    opcionRed: (label: string, symbol: string, saldo: string) =>
      `${label} (${symbol}) · you have ${saldo}`,
    topePorCompra: 'Max per purchase',
    ademasDeGuardar: 'On top of saving it here',
    entregaDashboard: 'Just save it in Peaje',
    entregaEmail: 'Email it to me',
    entregaWebhook: 'Send it to a webhook',
    correo: 'Email',
    correoPlaceholder: 'you@email.com',
    urlWebhook: 'Webhook URL',
    webhookPlaceholder: 'https://…',
    notaEntrega:
      'The result of every purchase is saved here, in the agent history. Email and webhook are notifications on top of that.',
    creandoWallet: 'Creating wallet…',
    crearAgente: 'Create agent',
    cancelar: 'Cancel',
    notaWallet: 'It gets its own wallet. You fund it after that.',

    // Tarjeta
    registradoErc: (id: string) => `Registered in ERC-8004 as agent #${id}`,
    corridas: (n: number) => `${n} run${n === 1 ? '' : 's'}`,
    fondosDeNegocio: (nombre: string) => `funded by ${nombre}`,
    avisaA: (destino: string) => `notifies ${destino}`,
    proxima: (fecha: string) => `next ${fecha}`,
    presupuesto: (symbol: string) => `${symbol} budget`,
    fallo: 'The action failed.',
    sinSaldoEn: (red: string) => `No balance on ${red}`,
    fondear: 'Fund',
    correrAhora: 'Run now',
    pausar: 'Pause',
    reanudar: 'Resume',
    devolverSaldo: 'Return funds',
    devolverSaldoTitulo: 'Sends the agent balance back to your wallet',
    ocultar: 'Hide',
    verResultados: 'View results',
    borrar: 'Delete',
    borrarTitulo: 'Return the funds before deleting it',

    // Estados
    estadoActivo: 'active',
    estadoCorriendo: 'running',
    estadoPausado: 'paused',
    estadoTerminado: 'done',

    // Resultados
    sinCompras: 'It has not bought anything yet.',
    avisado: 'notified',
    noSePudoAvisar: 'could not notify',
    evaluo: (consultados: number, conReputacion: number) =>
      `evaluated ${consultados} services (${conReputacion} with on-chain reputation)`,
    ocultarResultado: 'Hide result',
    leerResultado: 'Read result',

    // Errores de servidor
    errorNombre: 'Give the agent a name.',
    errorMision: 'Describe what the agent has to do.',
    errorCrear: 'Could not create the agent.',
    errorFondear: 'Could not fund the agent.',
    errorCorrer: 'Could not run the mission.',
    errorDevolver: 'Could not return the funds.',
    errorEstado: 'Could not change the status.',
    errorBorrar: 'Could not delete the agent.',


    // Ask (agente único)
    tuAgente: 'Your agent',
    askTitulo: 'Ask for something',
    askIntro:
      'Write what you need. Your agent searches the full market of agent services and shows you what it would buy and at what price, before spending a cent.',
    askPlaceholder: 'E.g.: this week\'s weather forecast for Bogotá, summarized in three lines',
    buscar: 'Search the market',
    buscando: 'Searching thousands of services…',
    planTitulo: 'This is what it would buy',
    planPrecio: (precio: string) => `${precio} per query`,
    comprarPor: (precio: string) => `Buy for ${precio}`,
    comprando: 'Buying…',
    compraLista: 'Done: the answer is below, in the history.',
    alternativasTitulo: 'It also found',
    usarEste: 'Use this one',
    descarto: (nombre: string, motivo: string) => `Rejected ${nombre}: ${motivo}`,
    sinPlan:
      'It found nothing worth your money for that request. Better not to spend than to buy something that does not answer.',
    faltaFondeoAviso: (precio: string) =>
      `The service exists and costs ${precio}, but your agent lacks balance on that network to buy it.`,
    consultadosNota: (n: number) => `Evaluated ${n.toLocaleString('en-US')} services in the market.`,
    redDemo: 'test network',
    redReal: 'real USDC',
    veredictoTitulo: 'Why this one',

    // Capacidades
    capacidadesTitulo: 'What it can buy today',
    capDesde: (precio: string) => `from ${precio}`,
    capNombre: {
      web: 'Web search',
      clima: 'Weather',
      social: 'Social media',
      noticias: 'News',
      viajes: 'Travel and places',
      imagenes: 'AI images',
      cripto: 'Crypto and markets',
      compras: 'Shopping',
    } as Record<string, string>,
    capPedido: {
      web: 'Search the web for what people are saying this week about ',
      clima: 'Get the weather forecast for the next few days in ',
      social: 'Bring me the latest X posts about ',
      noticias: 'Bring me today\'s headlines about ',
      viajes: 'Find well-located hotels in ',
      imagenes: 'Generate an image of ',
      cripto: 'Bring me the price and trend of ',
      compras: 'Find the best price for ',
    } as Record<string, string>,

    // Wallet del agente
    saldoDemo: (symbol: string) => `${symbol} · test network`,
    saldoReal: 'USDC · Base',
    walletCopiada: 'Address copied.',
    copiarWallet: 'Copy address',
    enviaUsdcNota:
      'For real-market purchases: send USDC (Base network) to your agent\'s address. $2 covers hundreds of queries.',

    // Activación
    activarTitulo: 'Activate your agent',
    activarIntro:
      'A buyer agent with its own wallet. You ask in your own words, it finds who sells it, pays cents, and brings back the answer.',
    activar: 'Activate my agent',
    activando: 'Creating its wallet…',
    otrosAgentes: 'Other agents',
    errorPlanear: 'Could not check the market. Try again.',
    ocupado: 'Your agent is finishing another purchase. Give it a few seconds and try again.',
    faltaSaldoCompra:
      'Your agent lacks balance for this purchase. Fund it above and try again.',
    faltaSaldoNegocio: 'Your business does not have enough balance on that network to fund it.',
    respuestaTitulo: 'The answer',
    resultadosPasados: 'Past results',
    fondearRed: 'Network',
    fondearDesde: 'From',
    origenWallet: (saldo: string) => `Your wallet · ${saldo}`,
    pasosTitulo: 'How it works',
    pasos: [
      { titulo: 'Fund it', detalle: 'Move balance from your business to the agent wallet. That is its whole budget: it cannot spend more.' },
      { titulo: 'Ask for something', detalle: 'In your own words. It searches thousands of services that sell data to agents.' },
      { titulo: 'Approve the plan', detalle: 'It shows what it would buy, at what price and why, before spending a cent.' },
      { titulo: 'Get the answer', detalle: 'It pays, reads what it bought, and answers you. The receipt stays in the history.' },
    ],

    respuestaNota: 'It is saved below, in the history, with its receipt.',
    fuenteComprada: 'Purchased source',
    buscandoPasos: [
      'Checking the full market…',
      'Comparing prices and reputation…',
      'Verifying the service actually answers your request…',
    ],
    comprandoPasos: [
      'Paying with an on-chain receipt…',
      'Reading what it bought…',
      'Writing your answer…',
    ],

    fechaLocale: 'en-US',
  },
}
