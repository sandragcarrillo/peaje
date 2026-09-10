export const agentes = {
  es: {
    titulo: 'Mis agentes',
    intro:
      'Agentes que compran por ti. Cada uno tiene su propia wallet: el presupuesto que le das es su saldo real, así que no puede gastar de más. Buscan en el registro ERC-8004 vía The Graph, eligen, pagan y te dejan el resultado acá.',
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

    fechaLocale: 'es-CO',
  },
  en: {
    titulo: 'My agents',
    intro:
      'Agents that buy for you. Each one has its own wallet: the budget you give it is its real balance, so it cannot overspend. They search the ERC-8004 registry via The Graph, pick a service, pay, and leave the result here.',
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

    fechaLocale: 'en-US',
  },
}
