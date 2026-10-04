import { RAILS_LABEL } from '@/lib/config'

export const landing = {
  es: {
    tickerMpp: 'Legible para agentes de IA',
    tickerPagos: 'Cobro por pedido, opcional',
    tickerSinApiKey: 'Sin API key para agentes',

    // Hero: tres frases, una por línea (dirección visual §3).
    eyebrow: 'LISTO PARA AGENTES DE IA',
    hero1: 'Tu sitio ya existe.',
    hero2: 'Los agentes no lo encuentran.',
    hero3: 'Peaje lo arregla.',
    heroTexto:
      'Peaje deja tu sitio o tu API listo para agentes de IA: que te encuentren, te lean y, si quieres, te paguen por cada pedido. Empieza gratis mirando cómo te ven hoy.',
    ctaDashboard: 'IR A MI DASHBOARD',
    ctaRegistrar: 'REVISAR MI SITIO GRATIS',
    ctaMercado: 'VER EL MERCADO',

    arte: 'ABRE TU MUNDO A AGENTES',

    // Status bar: el sitio reportando su propio estado. Todo cierto.
    status: [
      ['MPP', 'ACTIVO'],
      ['REDES', `${RAILS_LABEL} · DE PRUEBA`],
      ['PROTOCOLOS', 'MPP · X402 · MCP · ACP · UCP · AP2'],
      ['COBRO', 'OPCIONAL'],
    ] as [string, string][],

    // Comparativa antes/después (§5.5)
    compTitulo: 'El mismo sitio, visto por un agente.',
    compSinBadge: 'SIN PEAJE · INVISIBLE',
    compConBadge: 'CON PEAJE · LEGIBLE',
    compSinNota: 'Las rutas existen, pero un agente no las encuentra ni sabe qué hacen.',
    compConNota:
      'Las mismas rutas, descritas para agentes. Las que tienen precio se cobran por pedido; las demás pasan gratis.',
    compSinEstado: 'sin tráfico',
    compConHace: (s: number) => `HACE ${s}S`,

    featuresTitulo: 'Tres pasos, un comando.',
    paso1Titulo: 'Mira cómo te ven',
    paso1Texto:
      'Pon tu dominio. En medio minuto ves qué encuentra un agente cuando llega y hasta dónde sube tu puntaje con Peaje. Gratis, sin cuenta.',
    paso2Titulo: 'Instala Peaje',
    paso2Texto:
      'Un comando en tu proyecto. Tu sitio queda legible para agentes y cada ruta puede tener precio, incluido cero. Cobrar es opcional.',
    paso3Titulo: 'Activa tu agente de AEO',
    paso3Texto:
      'Te dice qué publicar para que ChatGPT, Claude y Perplexity te recomienden, lo escribe, se lo pasa a tu herramienta de IA y mide si funcionó. US$29 al mes, con 14 días de prueba.',

    precio:
      'Registrarte e instalar es gratis. Si cobras a agentes, Peaje se queda con el 2% de cada pago. Hoy los pagos corren en redes de prueba: sirven para comprobar que todo funciona y todavía no son dinero real.',

    // CTA final: dos tonos, una sola vez por página.
    ctaFinal1: 'Mira cómo te ven los agentes.',
    ctaFinal2: 'Antes de que te busquen.',
  },
  en: {
    tickerMpp: 'Readable by AI agents',
    tickerPagos: 'Pay per request, optional',
    tickerSinApiKey: 'No API key for agents',

    eyebrow: 'READY FOR AI AGENTS',
    hero1: 'Your site already exists.',
    hero2: 'Agents cannot find it.',
    hero3: 'Peaje fixes that.',
    heroTexto:
      'Peaje gets your site or API ready for AI agents: they find you, read you and, if you want, pay you per request. Start free by seeing how they see you today.',
    ctaDashboard: 'GO TO MY DASHBOARD',
    ctaRegistrar: 'CHECK MY SITE FREE',
    ctaMercado: 'SEE THE MARKET',

    arte: 'OPEN YOUR WORLD TO AGENTS',

    status: [
      ['MPP', 'ACTIVE'],
      ['NETWORKS', `${RAILS_LABEL} · TEST`],
      ['PROTOCOLS', 'MPP · X402 · MCP · ACP · UCP · AP2'],
      ['CHARGING', 'OPTIONAL'],
    ] as [string, string][],

    compTitulo: 'The same site, as an agent sees it.',
    compSinBadge: 'WITHOUT PEAJE · INVISIBLE',
    compConBadge: 'WITH PEAJE · READABLE',
    compSinNota: 'The routes exist, but an agent cannot find them or tell what they do.',
    compConNota:
      'The same routes, described for agents. The priced ones charge per request; the rest stay free.',
    compSinEstado: 'no traffic',
    compConHace: (s: number) => `${s}S AGO`,

    featuresTitulo: 'Three steps, one command.',
    paso1Titulo: 'See how agents see you',
    paso1Texto:
      'Enter your domain. In half a minute you see what an agent finds when it arrives and how far your score goes with Peaje. Free, no account.',
    paso2Titulo: 'Install Peaje',
    paso2Texto:
      'One command in your project. Your site becomes readable by agents and every route can have a price, including zero. Charging is optional.',
    paso3Titulo: 'Turn on your AEO agent',
    paso3Texto:
      'It tells you what to publish so ChatGPT, Claude and Perplexity recommend you, writes it, hands it to your AI coding tool and measures whether it worked. US$29 a month, with a 14-day trial.',

    precio:
      'Signing up and installing are free. If you charge agents, Peaje keeps 2% of each payment. Payments run on test networks today: they prove everything works and are not real money yet.',

    ctaFinal1: 'See how agents see you.',
    ctaFinal2: 'Before they look for you.',
  },
}
