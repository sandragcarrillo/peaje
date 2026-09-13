export const landing = {
  es: {
    tickerMpp: 'Protocolo MPP',
    tickerPagos: 'Pagos vía HTTP 402',
    tickerSinApiKey: 'Sin API key para agentes',

    // Hero: tres frases, una por línea (dirección visual §3).
    eyebrow: 'GATEWAY DE PAGOS PARA AGENTES · MPP',
    hero1: 'Tu sitio ya existe.',
    hero2: 'Los agentes no lo saben.',
    hero3: 'Peaje lo arregla.',
    heroTexto:
      'Peaje hace dos cosas: vuelve tu sitio legible para agentes de IA y le cobra a cada uno por request. El agente pide, recibe un 402, paga solo y sigue. Sin API keys, sin registro, sin tocar tu código.',
    ctaDashboard: 'IR A MI DASHBOARD',
    ctaRegistrar: 'REGISTRAR MI NEGOCIO',
    ctaMercado: 'VER EL MERCADO',

    arte: 'ABRE TU MUNDO A AGENTES',

    // Status bar: el sitio reportando su propio estado. Todo cierto.
    status: [
      ['MPP', 'ACTIVO'],
      ['RIELES', 'TEMPO + ARC'],
      ['PROTOCOLOS', '402 · X402 · ACP · UCP'],
      ['API-KEYS', '0'],
    ] as [string, string][],

    // Comparativa antes/después (§5.5)
    compTitulo: 'El mismo sitio, medido por un agente.',
    compSinBadge: 'SIN PEAJE · INVISIBLE',
    compConBadge: 'CON PEAJE · COBRANDO',
    compSinNota: 'Las rutas existen pero ningún agente las encuentra ni puede pagarlas.',
    compConNota: 'Las mismas rutas, descubiertas por discovery y cobradas por request.',
    compSinEstado: 'sin tráfico',
    compConHace: (s: number) => `HACE ${s}S`,

    featuresTitulo: 'Tres pasos, un prompt.',
    paso1Titulo: 'Conectas tu sitio',
    paso1Texto:
      'Nombre y la URL de tu web o API. Te damos un gateway y acceso a tu panel. Los agentes pagan solo, sin API key ni tocar tu código.',
    paso2Titulo: 'Pones precios',
    paso2Texto: 'Eliges qué rutas cobran y cuánto. El resto pasa gratis.',
    paso3Titulo: 'Cobras y retiras',
    paso3Texto:
      'Cada pago queda en tu panel, con la wallet del agente y la tx. Retiras cuando quieres.',

    // CTA final: dos tonos, una sola vez por página.
    ctaFinal1: 'Mide qué tan listo está tu sitio.',
    ctaFinal2: 'Antes de que lo mida un agente.',
  },
  en: {
    tickerMpp: 'MPP protocol',
    tickerPagos: 'Payments over HTTP 402',
    tickerSinApiKey: 'No API key for agents',

    eyebrow: 'PAYMENT GATEWAY FOR AGENTS · MPP',
    hero1: 'Your site already exists.',
    hero2: 'Agents cannot tell.',
    hero3: 'Peaje fixes that.',
    heroTexto:
      'Peaje does two things: it makes your site readable by AI agents and charges each one per request. The agent asks, gets a 402, pays on its own and moves on. No API keys, no signup, no changes to your code.',
    ctaDashboard: 'GO TO MY DASHBOARD',
    ctaRegistrar: 'REGISTER MY BUSINESS',
    ctaMercado: 'SEE THE MARKET',

    arte: 'OPEN YOUR WORLD TO AGENTS',

    status: [
      ['MPP', 'ACTIVE'],
      ['RAILS', 'TEMPO + ARC'],
      ['PROTOCOLS', '402 · X402 · ACP · UCP'],
      ['API-KEYS', '0'],
    ] as [string, string][],

    compTitulo: 'The same site, as an agent measures it.',
    compSinBadge: 'WITHOUT PEAJE · INVISIBLE',
    compConBadge: 'WITH PEAJE · CHARGING',
    compSinNota: 'The routes exist but no agent can find them or pay for them.',
    compConNota: 'The same routes, found through discovery and charged per request.',
    compSinEstado: 'no traffic',
    compConHace: (s: number) => `${s}S AGO`,

    featuresTitulo: 'Three steps, one prompt.',
    paso1Titulo: 'Connect your site',
    paso1Texto:
      'Your name and the URL of your site or API. We give you a gateway and access to your dashboard. Agents pay on their own, with no API key and no changes to your code.',
    paso2Titulo: 'Set prices',
    paso2Texto: 'You choose which routes charge and how much. Everything else stays free.',
    paso3Titulo: 'Charge and withdraw',
    paso3Texto:
      'Every payment lands in your dashboard, with the agent wallet and the tx. Withdraw whenever you want.',

    ctaFinal1: 'Measure how ready your site is.',
    ctaFinal2: 'Before an agent does.',
  },
}
