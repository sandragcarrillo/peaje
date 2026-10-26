/**
 * Landing pública (copy final de San, 24 oct 2026). Solo Telegram como canal.
 * Protocolos y redes viven en el portal para desarrolladores, no acá.
 * Precios y cupos llegan como argumentos desde @peaje/db (planes.ts).
 */
export type MensajeChat = {
  de: 'dueno' | 'agente'
  texto: string
  /** Tarjeta con enlace bajo la respuesta (como las de open_report). */
  tarjeta?: { titulo: string; accion: string }
  /** Etiqueta chica: estado de una tarea o un reporte programado. */
  chip?: string
}

export const landing = {
  es: {
    // CTAs de todo el sitio público (nav, hero y cierre).
    ctaAgente: 'Empezar con mi agente',
    ctaRadar: 'Revisar mi sitio gratis',
    ctaDashboard: 'Ir a mi panel',
    campoDominio: 'Tu sitio',
    placeholderDominio: 'tusitio.com',

    // Hero
    h1: 'Los agentes de IA ya están recomendando a tu competencia. Arréglalo con Peaje.',
    // Segunda opción de San, lista para cambiar:
    // h1: 'Que la IA te encuentre, te entienda y te elija.',
    sub: 'ChatGPT, Claude y otros agentes ya visitan tu sitio, pero no entienden bien qué vendes. Tu agente de Peaje te dice qué falta y lo arregla contigo en Telegram.',

    // Conversación de ejemplo en el hero: solo ejemplo.com / example.com, números ilustrativos.
    chatEjemplo: 'Ejemplo',
    chatNegocio: 'ejemplo.com',
    chatBot: 'Peaje',
    chatSubtitulo: 'tu agente',
    chatTu: 'Tú',
    chat: [
      { de: 'dueno', texto: '¿Qué me falta para que ChatGPT me recomiende?' },
      {
        de: 'agente',
        texto: 'ChatGPT no sabe qué vendes ni a qué precio. Empezaría por ahí.',
        tarjeta: { titulo: 'Tus 3 arreglos más importantes', accion: 'Ver' },
      },
      { de: 'dueno', texto: 'Hazlo con el primero.' },
      {
        de: 'agente',
        texto: 'Listo, aquí tienes la página y todo lo que necesitas para implementarla. La reviso cuando esté en vivo.',
        chip: 'Tarea en curso',
      },
      {
        de: 'agente',
        texto: 'Esta semana te visitaron 38 agentes: ChatGPT 21, Perplexity 9, Claude 8.',
        chip: 'Cada lunes, 8:00',
      },
    ] as MensajeChat[],

    // Lo que necesitan los agentes
    necesitanTitulo: 'Lo que necesitan los agentes',
    necesitan: [
      { titulo: 'Que te encuentren', texto: 'Que ChatGPT y Claude te recomienden.' },
      { titulo: 'Que te usen', texto: 'Que un agente pueda registrarse, reservar o comprar sin trabarse.' },
      { titulo: 'Que te compren', texto: 'Que un agente pueda comprarte sin que nadie tenga que intervenir.' },
    ],
    necesitanCierre:
      'Otras herramientas solo miden si la IA te recomienda. Peaje te deja listo para que te encuentren, te usen y te compren.',

    // Cómo funciona
    comoTitulo: 'Cómo funciona',
    pasos: [
      {
        titulo: 'Mira dónde estás hoy',
        texto:
          'Pega la URL de tu sitio y en menos de un minuto ves qué te falta para que los agentes de IA te encuentren. Gratis, solo con tu email.',
      },
      {
        titulo: 'Deja tu sitio listo para los agentes',
        texto: 'Instala nuestro kit con un comando y tu web queda lista para que los agentes la entiendan, la usen y te compren.',
      },
      {
        titulo: 'Haz que te recomienden',
        texto:
          'Tu agente de Peaje, en Telegram, te pasa los arreglos listos para que ChatGPT, Claude y Perplexity te recomienden, y te cuenta cada semana cuánto vas mejorando.',
      },
    ],

    // Precio
    precioTitulo: 'Precios',
    precioMonto: (usd: number) => `US$${usd} al mes`,
    precioEtiqueta: 'Precio de fundador',
    precioNormal: (usd: number) => `Precio normal: US$${usd} al mes.`,
    precioCupos: (cupos: number) => `Solo para los primeros ${cupos} negocios, y lo mantienes mientras sigas.`,
    precioCancelar: 'Cancelas cuando quieras desde tu panel, sin llamadas.',
    letraChica: (pct: number) =>
      `Revisar tu sitio es gratis. Si cobras a los agentes, Peaje se queda con el ${pct}% de cada pago. Por ahora los pagos funcionan en redes de prueba: la demo es una simulación y no mueve dinero real.`,
    verPrecios: 'Ver todos los detalles del precio',

    // FAQ provisoria: reemplazar por la del Editor si San la pega.
    // Los 7 días (DIAS_REEMBOLSO en packages/db/src/planes.ts) y los 500 créditos
    // (LIMITES.pro.creditos, provisorio) van escritos a mano porque
    // app/page.tsx solo le pasa la comisión a faq(). Si cambian, cambiarlos acá (es y en).
    faqTitulo: 'Preguntas',
    faq: (pct: number) => [
      {
        p: '¿Qué es Peaje?',
        r: 'Un agente que deja tu sitio listo para la IA. Revisa cómo te ven ChatGPT, Claude, Perplexity y Gemini, te dice qué falta y lo arregla contigo en Telegram.',
      },
      {
        p: '¿Qué recibo?',
        r: 'Un agente en Telegram. Te dice qué falta, te pasa los arreglos listos y te cuenta cuántos agentes te visitaron, cada día, cada semana o cada mes, como prefieras.',
      },
      {
        p: '¿Tengo que saber de código?',
        r: 'No. Tu agente te explica cada arreglo en palabras simples, lo escribe y lo deja como tarea. Si usas Claude Code o Cursor, la toman desde Peaje; si no, se la pasas a quien maneje tu web. Cuando está publicada, Peaje la revisa en tu sitio.',
      },
      {
        p: '¿Cómo cobran los agentes?',
        r: `Es opcional. x402 es una forma de cobrar por internet en la que tu sitio le pide un pago al agente antes de entregarle lo que pidió. MPP es otro estándar para lo mismo: el agente paga y recibe la respuesta en el mismo pedido. Hoy los dos funcionan en redes de prueba, así que todavía no mueven dinero real. Cuando haya pagos reales, Peaje se queda con el ${pct}% de cada uno.`,
      },
      {
        p: '¿Me cobran algo más?',
        r: `Solo la suscripción mensual. El precio y los impuestos de tu país aparecen en el formulario de pago antes de que confirmes. Si decides cobrarles a los agentes de IA por tu contenido, Peaje se queda con el ${pct}% de cada pago de un agente y el resto llega directo a la wallet de tu negocio. Si no les cobras, no hay comisión.`,
      },
      {
        p: '¿Y si no me sirve?',
        r: 'En el peor caso, cancelas y te quedas con tu diagnóstico y los arreglos que tu agente ya te entregó. En el mejor caso, ChatGPT, Claude, Perplexity y Gemini empiezan a citar tu sitio en las preguntas de tu negocio, y lo ves en la medición de tu agente.',
      },
      {
        p: '¿Puedo cancelar?',
        r: `Sí. Cancelas cuando quieras desde tu panel, sin llamadas. Sigues con tu agente hasta el final del mes que ya pagaste, no se vuelve a cobrar y lo que tu agente ya te entregó sigue en tu panel. Si es tu primer pago y lo pides dentro de 7 días, te lo devolvemos completo.`,
      },
      {
        p: '¿Qué pasa si se me acaban los créditos?',
        r: 'Cada mes tu plan trae 500 créditos para el trabajo del agente, como arreglos, páginas y reportes que le pides. Hablar con tu agente es gratis. Si se acaban, tu agente sigue hablando contigo, pero no hace trabajo nuevo hasta el 1 del mes siguiente. Lo que ya te entregó sigue en tu panel y no se cobra nada extra.',
      },
      {
        p: '¿Qué datos usan?',
        r: 'Lo que ya es público en tu sitio, tu correo, lo que le escribes a tu agente y las visitas de agentes de IA a tu sitio. No vendemos tus datos.',
      },
    ],

    // Cierre
    cierreTitulo: 'Mira cómo te ve la IA hoy.',
    cierreTexto: 'Revisar tu sitio toma menos de un minuto. Si quieres que tu agente lo arregle contigo, empiezas cuando quieras.',

    // Para devs
    devsEtiqueta: 'Para devs',
    devsTexto: 'Instala Peaje en tu proyecto con',
    devsPortal: 'Portal para desarrolladores',
  },
  en: {
    ctaAgente: 'Start with my agent',
    ctaRadar: 'Check my site free',
    ctaDashboard: 'Go to my dashboard',
    campoDominio: 'Your site',
    placeholderDominio: 'yoursite.com',

    h1: 'AI agents are already recommending your competitors. Fix it with Peaje.',
    // San's second option, ready to swap in:
    // h1: 'Get AI to find you, understand you and choose you.',
    sub: 'ChatGPT, Claude and other agents already visit your site, but they do not really get what you sell. Your Peaje agent tells you what is missing and fixes it with you on Telegram.',

    chatEjemplo: 'Example',
    chatNegocio: 'example.com',
    chatBot: 'Peaje',
    chatSubtitulo: 'your agent',
    chatTu: 'You',
    chat: [
      { de: 'dueno', texto: 'What am I missing for ChatGPT to recommend me?' },
      {
        de: 'agente',
        texto: 'ChatGPT does not know what you sell or at what price. I would start there.',
        tarjeta: { titulo: 'Your top 3 fixes', accion: 'View' },
      },
      { de: 'dueno', texto: 'Do the first one.' },
      {
        de: 'agente',
        texto: 'Done, here is the page and everything you need to implement it. I will check it once it is live.',
        chip: 'Task in progress',
      },
      {
        de: 'agente',
        texto: 'This week 38 agents visited you: ChatGPT 21, Perplexity 9, Claude 8.',
        chip: 'Every Monday, 8:00',
      },
    ] as MensajeChat[],

    necesitanTitulo: 'What agents need',
    necesitan: [
      { titulo: 'To find you', texto: 'ChatGPT and Claude recommend you.' },
      { titulo: 'To use you', texto: 'An agent can sign up, book or buy without getting stuck.' },
      { titulo: 'To buy from you', texto: 'An agent can buy from you without anyone stepping in.' },
    ],
    necesitanCierre:
      'Other tools only measure whether AI recommends you. Peaje gets you ready to be found, used and bought from.',

    comoTitulo: 'How it works',
    pasos: [
      {
        titulo: 'See where you stand today',
        texto:
          'Paste your site URL and in under a minute you see what you are missing for AI agents to find you. Free, just your email.',
      },
      {
        titulo: 'Get your site ready for agents',
        texto: 'Install our kit with one command and your site is ready for agents to understand it, use it and buy from you.',
      },
      {
        titulo: 'Get recommended',
        texto:
          'Your Peaje agent, on Telegram, hands you the fixes ready to go so ChatGPT, Claude and Perplexity recommend you, and tells you every week how much you are improving.',
      },
    ],

    precioTitulo: 'Pricing',
    precioMonto: (usd: number) => `US$${usd} a month`,
    precioEtiqueta: 'Founder price',
    precioNormal: (usd: number) => `Regular price: US$${usd} a month.`,
    precioCupos: (cupos: number) => `Only for the first ${cupos} businesses, and you keep it for as long as you stay.`,
    precioCancelar: 'Cancel anytime from your dashboard, no calls.',
    letraChica: (pct: number) =>
      `Checking your site is free. If you charge agents, Peaje keeps ${pct}% of each payment. For now payments run on test networks: the demo is a simulation and moves no real money.`,
    verPrecios: 'See the full pricing details',

    faqTitulo: 'Questions',
    faq: (pct: number) => [
      {
        p: 'What is Peaje?',
        r: 'An agent that gets your site ready for AI. It checks how ChatGPT, Claude, Perplexity and Gemini see you, tells you what is missing and fixes it with you on Telegram.',
      },
      {
        p: 'What do I get?',
        r: 'An agent on Telegram. It tells you what is missing, hands you the fixes ready to go and tells you how many agents visited you, daily, weekly or monthly, as you prefer.',
      },
      {
        p: 'Do I need to know how to code?',
        r: 'No. Your agent explains every fix in plain words, writes it and leaves it as a task. If you use Claude Code or Cursor, they pick it up from Peaje; if not, you pass it to whoever runs your website. Once it is live, Peaje checks it on your site.',
      },
      {
        p: 'How do agents pay?',
        r: `It is optional. x402 is a way to charge on the web where your site asks the agent for a payment before handing over what it asked for. MPP is another standard for the same thing: the agent pays and gets the answer in the same request. Today both run on test networks, so they move no real money yet. Once payments are real, Peaje keeps ${pct}% of each one.`,
      },
      {
        p: 'Do you charge anything else?',
        r: `Only the monthly subscription. The price and your country's taxes appear in the checkout before you confirm. If you choose to charge AI agents for your content, Peaje keeps ${pct}% of each agent payment and the rest goes straight to your business wallet. If you do not charge them, there is no fee.`,
      },
      {
        p: 'What if it does not work for me?',
        r: `Worst case, you cancel and keep your diagnosis and the fixes your agent already handed you. Best case, ChatGPT, Claude, Perplexity and Gemini start citing your site for your business questions, and you see it in your agent's tracking.`,
      },
      {
        p: 'Can I cancel?',
        r: `Yes. Cancel anytime from your dashboard, no calls. You keep your agent until the end of the month you already paid for, you are not charged again and what your agent already handed you stays in your dashboard. If it is your first payment and you ask within 7 days, we refund it in full.`,
      },
      {
        p: 'What happens if I run out of credits?',
        r: `Each month your plan comes with 500 credits for the agent's work, like fixes, pages and the reports you ask for. Talking to your agent is free. If you run out, your agent keeps talking with you, but it does no new work until the 1st of next month. What it already handed you stays in your dashboard and nothing extra is charged.`,
      },
      {
        p: 'What data do you use?',
        r: 'What is already public on your site, your email, what you write to your agent and the visits AI agents make to your site. We do not sell your data.',
      },
    ],

    cierreTitulo: 'See how AI sees you today.',
    cierreTexto: 'Checking your site takes under a minute. When you want your agent to fix it with you, start anytime.',

    devsEtiqueta: 'For devs',
    devsTexto: 'Install Peaje in your project with',
    devsPortal: 'Developer portal',
  },
}
