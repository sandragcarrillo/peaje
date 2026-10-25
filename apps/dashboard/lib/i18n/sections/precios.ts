/**
 * Página /precios. Los montos, cupos y límites salen de @peaje/db (planes.ts),
 * así que los textos los reciben como argumentos y no se desincronizan.
 */
export const precios = {
  es: {
    metaTitulo: 'Precios',
    metaDescripcion:
      'Radar gratis, kit gratis y el agente de AEO en la suscripción Pro: precio de fundador de US$30 al mes para los primeros 50 negocios, luego US$69 al mes.',
    kicker: 'Precios',
    titulo: 'Empieza gratis. Paga solo por el agente.',
    intro:
      'Peaje es software que deja tu sitio o tu API listo para agentes de IA: que te encuentren, te lean y, si quieres, te paguen por pedido. El radar y el kit son gratis. El agente de AEO es la suscripción Pro.',

    gratis: 'Gratis',
    alMes: 'al mes',
    incluye: 'Incluye',

    radarNombre: 'Radar',
    radarTexto:
      'Pon tu dominio y en medio minuto ves qué encuentra un agente cuando llega, tu puntaje de hoy y hasta dónde sube con Peaje. Sin cuenta.',

    kitNombre: 'Kit',
    kitTexto:
      'Un comando en tu proyecto deja tu sitio legible para agentes. Cada ruta puede tener precio, incluido cero. Cobrar es opcional.',
    kitIncluye: [
      'llms.txt, openapi.json, servidor MCP, agent cards y JSON-LD generados para tu sitio',
      'Rutas con precio que responden 402 en tu propio dominio',
      'Registro de visitas de agentes',
      'Monitor diario y tareas para arreglar lo que falla',
    ],
    kitComision: (pct: number) =>
      `Si cobras a agentes, Peaje se queda con el ${pct}% de cada pago. Peaje acredita el resto a la wallet de tu negocio. Esos pagos están separados de la suscripción Pro y Paddle no los procesa.`,

    founderNombre: 'Pro founder',
    founderTexto: (cupos: number) =>
      `Lo mismo que Pro, con descuento de fundador para los primeros ${cupos} negocios que se suscriben. Mantienes este precio mientras tu suscripción siga activa. Si la cancelas y vuelves, pagas el precio Pro.`,
    proNombre: 'Pro',
    proTexto: (cupos: number) => `El precio de Pro cuando se toman los ${cupos} cupos de fundador.`,
    limites: (preguntas: number, mensajes: number) =>
      `${preguntas} preguntas medidas en asistentes de IA y ${mensajes} mensajes al agente por mes.`,

    proIncluyeTitulo: 'Qué hace el agente Pro',
    proIncluye: [
      'Arma un plan según tu objetivo y conversa contigo en el dashboard y en Telegram',
      'Mide si ChatGPT, Claude, Perplexity y Gemini citan tu sitio para las preguntas de tu negocio',
      'Escribe borradores completos de las páginas que responden esas preguntas, con datos de tu sitio',
      'Le pasa cada tarea a tu herramienta de código por MCP o con la CLI, y verifica el sitio en vivo',
      'Vuelve a medir a las 2 y a las 6 semanas para saber si funcionó',
      'Comprador misterioso: prueba el paso de pago de tus rutas como lo haría un agente',
      'Reporte semanal por correo',
    ],

    pruebaTitulo: (dias: number) => `Reembolso del primer pago en ${dias} días`,
    pruebaTexto: (dias: number) =>
      `No hay prueba gratis. Si te suscribes y Pro no es para ti, te devolvemos el primer pago completo si lo pides dentro de ${dias} días. El radar y el kit siguen gratis siempre.`,

    cobroTitulo: 'Cómo se cobra',
    cobroTexto:
      'Nuestro proceso de pedido lo realiza nuestro revendedor en línea Paddle.com. Paddle.com es el Merchant of Record de todos nuestros pedidos: procesa el pago, calcula los impuestos de tu país y emite la factura. La suscripción se cobra cada mes en dólares y se renueva sola hasta que la canceles. Peaje nunca ve los datos de tu tarjeta.',
    cobroEnlaces: 'Lee los términos y la política de reembolso antes de suscribirte.',
    terminos: 'Términos',
    reembolsos: 'Reembolsos',

    ctaRadar: 'Revisar mi sitio gratis',
    ctaRegistrar: 'Crear mi cuenta',
  },
  en: {
    metaTitulo: 'Pricing',
    metaDescripcion:
      'Free radar, free kit and the AEO agent in the Pro subscription: founder price of US$30 a month for the first 50 businesses, then US$69 a month.',
    kicker: 'Pricing',
    titulo: 'Start free. Pay only for the agent.',
    intro:
      'Peaje is software that gets your site or API ready for AI agents: they find you, read you and, if you want, pay you per request. The radar and the kit are free. The AEO agent is the Pro subscription.',

    gratis: 'Free',
    alMes: 'a month',
    incluye: 'Includes',

    radarNombre: 'Radar',
    radarTexto:
      'Enter your domain and in half a minute you see what an agent finds when it arrives, your score today and how far it goes with Peaje. No account.',

    kitNombre: 'Kit',
    kitTexto:
      'One command in your project makes your site readable by agents. Every route can have a price, including zero. Charging is optional.',
    kitIncluye: [
      'llms.txt, openapi.json, an MCP server, agent cards and JSON-LD generated for your site',
      'Priced routes that answer 402 on your own domain',
      'A log of agent visits',
      'A daily monitor and tasks to fix what breaks',
    ],
    kitComision: (pct: number) =>
      `If you charge agents, Peaje keeps ${pct}% of each payment. Peaje credits the rest to your business wallet. Those payments are separate from the Pro subscription and are never processed by Paddle.`,

    founderNombre: 'Pro founder',
    founderTexto: (cupos: number) =>
      `Everything in Pro, at a founder discount for the first ${cupos} businesses that subscribe. You keep this price while your subscription stays active. If you cancel and come back, you pay the Pro price.`,
    proNombre: 'Pro',
    proTexto: (cupos: number) => `The Pro price once the ${cupos} founder spots are taken.`,
    limites: (preguntas: number, mensajes: number) =>
      `${preguntas} questions tracked in AI assistants and ${mensajes} messages to the agent a month.`,

    proIncluyeTitulo: 'What the Pro agent does',
    proIncluye: [
      'Builds a plan around your goal and talks with you on the dashboard and on Telegram',
      'Measures whether ChatGPT, Claude, Perplexity and Gemini cite your site for your business questions',
      'Writes full drafts of the pages that answer those questions, using facts from your site',
      'Hands each task to your coding tool over MCP or the CLI, and checks the live site',
      'Measures again at 2 and 6 weeks to see whether it worked',
      'Mystery shopper: tests the payment step of your routes the way an agent would',
      'A weekly report by email',
    ],

    pruebaTitulo: (dias: number) => `First payment refunded within ${dias} days`,
    pruebaTexto: (dias: number) =>
      `There is no free trial. If you subscribe and Pro is not for you, we refund your first payment in full if you ask within ${dias} days. The radar and the kit stay free.`,

    cobroTitulo: 'How billing works',
    cobroTexto:
      'Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders: it processes the payment, calculates the taxes for your country and issues the invoice. The subscription is billed monthly in US dollars and renews automatically until you cancel. Peaje never sees your card details.',
    cobroEnlaces: 'Read the terms and the refund policy before you subscribe.',
    terminos: 'Terms',
    reembolsos: 'Refunds',

    ctaRadar: 'Check my site free',
    ctaRegistrar: 'Create my account',
  },
}
