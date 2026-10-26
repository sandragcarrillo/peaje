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
    limites: (preguntas: number, creditos: number) =>
      `${creditos} créditos al mes para el trabajo del agente y ${preguntas} preguntas medidas en asistentes de IA. Hablar con tu agente es gratis.`,

    // Créditos: número y costos de packages/db/src/planes.ts (LIMITES.*.creditos, COSTOS_CREDITOS).
    creditosTitulo: 'Cómo funcionan los créditos',
    creditosIntro: (creditos: number) =>
      `Cada mes tu plan trae ${creditos} créditos. Hablar con tu agente no gasta créditos: los créditos miden el trabajo que el agente hace por ti.`,
    creditosCostos: (c: { consulta: number; tarea: number; pagina: number; serie: number; informe: number; comprador: number }) => [
      { que: 'Una consulta en tus datos', cuanto: c.consulta },
      { que: 'Un arreglo', cuanto: c.tarea },
      { que: 'Un borrador de página', cuanto: c.pagina },
      { que: 'Una serie de páginas', cuanto: c.serie },
      { que: 'Un reporte que le pides', cuanto: c.informe },
      { que: 'Una prueba del comprador misterioso', cuanto: c.comprador },
    ],
    creditos: (n: number) => (n === 1 ? '1 crédito' : `${n} créditos`),
    creditosGratis:
      'No gastan créditos: hablar con tu agente, los reportes programados y las respuestas a preguntas que no tienen que ver con tu negocio.',
    creditosRenuevan:
      'Los créditos se renuevan el 1 de cada mes. Los que no usas no pasan al mes siguiente, y no se pueden comprar créditos extra.',

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

    // Preguntas sobre el pago. Cada respuesta dice solo lo que hace el código:
    // al cancelar el plan pasa a free (accesoPro) y las tareas y el plan siguen
    // visibles. Créditos por mes calendario, hablar es gratis (modelo de San del
    // 25 oct 2026; la lógica nueva la escribe el gateway).
    faqTitulo: 'Preguntas sobre el pago',
    faq: ({ pct, dias }: { pct: number; dias: number }) => [
      {
        p: '¿Y si no me sirve?',
        r: 'En el peor caso, cancelas y te quedas con tu diagnóstico y los arreglos que tu agente ya te entregó, incluidos los borradores de página. El kit, el monitor diario y sus tareas de arreglo siguen gratis. En el mejor caso, ChatGPT, Claude, Perplexity y Gemini empiezan a citar tu sitio en las preguntas de tu negocio, y lo ves en la medición de tu agente.',
      },
      {
        p: '¿Me cobran algo más?',
        r: `Solo la suscripción mensual. El precio y los impuestos de tu país aparecen en el formulario de pago antes de que confirmes. El ${pct}% es aparte y solo aplica si decides cobrarles a los agentes de IA por tu contenido: Peaje se queda con el ${pct}% de cada pago de un agente y el resto llega directo a la wallet de tu negocio. Si no les cobras, no hay comisión.`,
      },
      {
        p: '¿Puedo cancelar?',
        r: `Sí, cuando quieras, desde tu panel y sin llamadas. Conservas Pro hasta el final del mes que ya pagaste y no se vuelve a cobrar. Después tu sitio pasa al plan gratis y lo que tu agente ya te entregó sigue en tu panel. Si es tu primer pago y lo pides dentro de ${dias} días, te lo devolvemos completo.`,
      },
      {
        p: '¿Qué pasa si se me acaban los créditos?',
        r: 'Tu agente sigue hablando contigo, pero no hace trabajo nuevo hasta el 1 del mes siguiente, cuando se renuevan. Lo que ya te entregó sigue en tu panel y no se cobra nada extra.',
      },
    ],

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
    limites: (preguntas: number, creditos: number) =>
      `${creditos} credits a month for the agent's work and ${preguntas} questions tracked in AI assistants. Talking to your agent is free.`,

    creditosTitulo: 'How credits work',
    creditosIntro: (creditos: number) =>
      `Each month your plan comes with ${creditos} credits. Talking to your agent uses no credits: credits measure the work the agent does for you.`,
    creditosCostos: (c: { consulta: number; tarea: number; pagina: number; serie: number; informe: number; comprador: number }) => [
      { que: 'A lookup in your data', cuanto: c.consulta },
      { que: 'A fix', cuanto: c.tarea },
      { que: 'A page draft', cuanto: c.pagina },
      { que: 'A series of pages', cuanto: c.serie },
      { que: 'A report you ask for', cuanto: c.informe },
      { que: 'A mystery shopper test', cuanto: c.comprador },
    ],
    creditos: (n: number) => (n === 1 ? '1 credit' : `${n} credits`),
    creditosGratis:
      'These use no credits: talking to your agent, scheduled reports and answers to questions that have nothing to do with your business.',
    creditosRenuevan:
      'Credits renew on the 1st of each month. Unused credits do not carry over, and you cannot buy extra credits.',

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

    faqTitulo: 'Questions about paying',
    faq: ({ pct, dias }: { pct: number; dias: number }) => [
      {
        p: 'What if it does not work for me?',
        r: `Worst case, you cancel and keep your diagnosis and the fixes your agent already handed you, page drafts included. The kit, the daily monitor and its fix tasks stay free. Best case, ChatGPT, Claude, Perplexity and Gemini start citing your site for your business questions, and you see it in your agent's tracking.`,
      },
      {
        p: 'Do you charge anything else?',
        r: `Only the monthly subscription. The price and your country's taxes appear in the checkout before you confirm. The ${pct}% is separate and only applies if you choose to charge AI agents for your content: Peaje keeps ${pct}% of each agent payment and the rest goes straight to your business wallet. If you do not charge agents, there is no fee.`,
      },
      {
        p: 'Can I cancel?',
        r: `Yes, anytime, from your dashboard and with no calls. You keep Pro until the end of the month you already paid for and you are not charged again. After that your site moves to the free plan and what your agent already handed you stays in your dashboard. If it is your first payment and you ask within ${dias} days, we refund it in full.`,
      },
      {
        p: 'What happens if I run out of credits?',
        r: 'Your agent keeps talking with you, but it does no new work until the 1st of next month, when credits renew. What it already handed you stays in your dashboard and nothing extra is charged.',
      },
    ],

    ctaRadar: 'Check my site free',
    ctaRegistrar: 'Create my account',
  },
}
