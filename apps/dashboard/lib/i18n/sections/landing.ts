export const landing = {
  es: {
    tickerMpp: 'Protocolo MPP',
    tickerPagos: 'Pagos vía HTTP 402',
    tickerSinApiKey: 'Sin API key para agentes',

    heroTitulo: 'Los agentes ya están usando tu API.',
    heroTituloTenue: 'Todavía no te pagan.',
    heroTexto:
      'Peaje es el riel de pagos para agentes de IA. Se suma a tu sitio o tu API sin reemplazar nada: el agente pide, recibe un 402, paga solo y sigue. Cualquier agente que hable el protocolo ya puede pagarte.',
    ctaDashboard: 'Ir a mi dashboard',
    ctaRegistrar: 'Registrar mi negocio',
    ctaMercado: 'Ver el mercado agéntico',

    paso1Titulo: 'Conectas tu sitio',
    paso1Texto:
      'Nombre y la URL de tu web o API. Te damos un gateway y acceso a tu panel. Los agentes pagan solo, sin API key ni tocar tu código.',
    paso2Titulo: 'Pones precios',
    paso2Texto: 'Eliges qué rutas cobran y cuánto. El resto pasa gratis.',
    paso3Titulo: 'Cobras y retiras',
    paso3Texto:
      'Cada pago queda en tu panel, con la wallet del agente y la tx. Retiras cuando quieres.',

    flujoPagaConWallet: 'El agente paga con su wallet',
    flujoPago: (wallet: string, monto: string) => `${wallet} pagó ${monto}`,
    flujoTxConfirmada: 'tx confirmada',
  },
  en: {
    tickerMpp: 'MPP protocol',
    tickerPagos: 'Payments over HTTP 402',
    tickerSinApiKey: 'No API key for agents',

    heroTitulo: 'Agents are already using your API.',
    heroTituloTenue: 'They still are not paying you.',
    heroTexto:
      'Peaje is the payment rail for AI agents. It sits in front of your site or API without replacing anything: the agent requests, gets a 402, pays on its own and moves on. Any agent that speaks the protocol can already pay you.',
    ctaDashboard: 'Go to my dashboard',
    ctaRegistrar: 'Register my business',
    ctaMercado: 'See the agentic market',

    paso1Titulo: 'Connect your site',
    paso1Texto:
      'Your name and the URL of your site or API. We give you a gateway and access to your dashboard. Agents pay on their own, with no API key and no changes to your code.',
    paso2Titulo: 'Set prices',
    paso2Texto: 'You choose which routes charge and how much. Everything else stays free.',
    paso3Titulo: 'Charge and withdraw',
    paso3Texto:
      'Every payment lands in your dashboard, with the agent wallet and the tx. Withdraw whenever you want.',

    flujoPagaConWallet: 'The agent pays with its wallet',
    flujoPago: (wallet: string, monto: string) => `${wallet} paid ${monto}`,
    flujoTxConfirmada: 'tx confirmed',
  },
}
