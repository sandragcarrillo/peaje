export const mercado = {
  es: {
    /** Etiqueta BCP-47 para Intl (fechas y números de la página). */
    intl: 'es-CO',

    metaTitulo: 'Mercado agéntico · Peaje',
    metaDescripcion:
      'Cómo se mueve el comercio de agentes de IA: registros ERC-8004, tipos de herramienta y adopción de pagos, con datos live de The Graph.',

    titulo: 'El comercio agéntico, en vivo',
    intro: (redes: number) =>
      `Agentes de IA con identidad on-chain (ERC-8004), qué herramientas usan y cuántos ya pagan por lo que consumen. Datos live de los Subgraphs de Agent0 vía The Graph, en ${redes} redes.`,

    chipTodos: (n: number) => `Todos (${n})`,
    sinDatos: 'Sin datos para ese filtro.',

    statAgentes: 'Agentes registrados',
    statPago: 'Listos para pagar (x402)',
    statMcp: 'Exponen MCP',
    statFeedback: 'Feedbacks on-chain',
    statInterfazMcp: 'Interfaz MCP',
    statInterfazA2a: 'Interfaz A2A',
    statPaganX402: 'Pagan con x402',

    porMesTitulo: 'Agentes nuevos por mes',
    porMesNota: 'últimos 12 meses',
    porMesAria: 'Agentes registrados por mes en los últimos 12 meses',

    porHerramientaTitulo: 'Por tipo de herramienta',
    porHerramientaNota: 'dominios OASF declarados por los agentes',
    porRedTitulo: 'Por red',
    porRedNota: 'dónde viven las identidades',

    ctaTitulo: 'Estos agentes ya están comprando',
    ctaCuerpo:
      'Cada vez más agentes tienen wallet, identidad y presupuesto. Peaje hace que tu web o tu API puedan cobrarles por request, sin API keys y sin tocar tu código.',
    ctaBoton: 'Ponle un peaje a tu web →',

    fuenteInicio: 'Fuente: Subgraphs de ',
    fuenteLink: 'Agent0 (ERC-8004)',
    fuenteFin: ' en The Graph. Muestra de hasta 1000 agentes por red, actualizada cada hora.',

    // Calculadora
    calcTitulo: '¿Cuánto dejarías de perder?',
    calcSubtitulo:
      'Hoy los agentes consumen tu contenido gratis. Proyección si cada request pagara:',
    calcRequests: 'Requests de agentes por mes',
    calcPrecio: 'Precio por request',
    calcProyeccion: 'Proyección',
    calcPorMes: '/mes',
    calcAnual: (anual: string, pct: number) =>
      `$${anual}/año · asumiendo que paga el ${pct}% de los agentes (los que ya declaran soporte de pagos on-chain)`,
    calcRitmoInicio: 'Y el mercado no está quieto: el registro de agentes ',
    calcRitmoDuplicado: 'se duplicó (o más) cada mes',
    calcRitmoCrecio: (pct: number) => `creció ${pct}% mensual`,
    calcRitmoMedio:
      ' en los últimos meses. Si tu tráfico de agentes acompaña ese ritmo, esta proyección sería ',
    calcRitmoFin: ' en 3 meses.',
    calcBoton: 'Empezar a cobrar →',
  },
  en: {
    /** Etiqueta BCP-47 para Intl (fechas y números de la página). */
    intl: 'en-US',

    metaTitulo: 'Agentic market · Peaje',
    metaDescripcion:
      'How AI agent commerce is moving: ERC-8004 registrations, tool types and payment adoption, with live data from The Graph.',

    titulo: 'Agent commerce, live',
    intro: (redes: number) =>
      `AI agents with on-chain identity (ERC-8004), which tools they use and how many already pay for what they consume. Live data from the Agent0 Subgraphs via The Graph, across ${redes} networks.`,

    chipTodos: (n: number) => `All (${n})`,
    sinDatos: 'No data for that filter.',

    statAgentes: 'Registered agents',
    statPago: 'Ready to pay (x402)',
    statMcp: 'Expose MCP',
    statFeedback: 'On-chain feedback',
    statInterfazMcp: 'MCP interface',
    statInterfazA2a: 'A2A interface',
    statPaganX402: 'Pay with x402',

    porMesTitulo: 'New agents per month',
    porMesNota: 'last 12 months',
    porMesAria: 'Agents registered per month over the last 12 months',

    porHerramientaTitulo: 'By tool type',
    porHerramientaNota: 'OASF domains declared by the agents',
    porRedTitulo: 'By network',
    porRedNota: 'where the identities live',

    ctaTitulo: 'These agents are already buying',
    ctaCuerpo:
      'More and more agents have a wallet, an identity and a budget. Peaje lets your site or your API charge them per request, with no API keys and no changes to your code.',
    ctaBoton: 'Put a toll on your site →',

    fuenteInicio: 'Source: Subgraphs from ',
    fuenteLink: 'Agent0 (ERC-8004)',
    fuenteFin:
      ' on The Graph. A sample of up to 1,000 agents per network, refreshed every hour.',

    // Calculadora
    calcTitulo: 'How much are you leaving on the table?',
    calcSubtitulo:
      'Today agents consume your content for free. Here is the projection if every request paid:',
    calcRequests: 'Agent requests per month',
    calcPrecio: 'Price per request',
    calcProyeccion: 'Projection',
    calcPorMes: '/mo',
    calcAnual: (anual: string, pct: number) =>
      `$${anual}/year · assuming ${pct}% of agents pay (the ones already declaring on-chain payment support)`,
    calcRitmoInicio: 'And the market is not standing still: agent registrations ',
    calcRitmoDuplicado: 'doubled (or more) every month',
    calcRitmoCrecio: (pct: number) => `grew ${pct}% per month`,
    calcRitmoMedio:
      ' over the last few months. If your agent traffic keeps that pace, this projection would be ',
    calcRitmoFin: ' in 3 months.',
    calcBoton: 'Start charging →',
  },
}
