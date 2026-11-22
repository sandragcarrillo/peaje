import { asistentesMedidos } from '@peaje/shared/asistentes'

/**
 * Preguntas frecuentes de /preguntas (es) y /faq (en). Cada respuesta dice
 * solo lo que hace el código o lo que ya dicen /precios, /reembolsos y los
 * términos: montos, cupos, créditos y plazos llegan como argumentos desde
 * @peaje/db (planes.ts y regalo.ts). Las respuestas son texto plano porque
 * también van al JSON-LD FAQPage; el enlace de cada una va aparte.
 */

export type DatosFaq = {
  founder: number
  pro: number
  cupos: number
  creditos: number
  dias: number
  regaloInformes: number
  regaloRespuestas: number
  paginas: number
  informes: number
  respuestas: number
  preguntas: number
  costos: { consulta: number; tarea: number; pagina: number; serie: number; informe: number }
}

export type PreguntaFaq = { p: string; r: string; enlace?: { href: string; texto: string } }

export const faq = {
  es: {
    metaTitulo: 'Preguntas frecuentes',
    metaDescripcion: `Qué hace Peaje, qué mide en ${asistentesMedidos('es')}, si el Radar es gratis, cuánto cuesta, cómo cancelar y qué no hace todavía.`,
    titulo: 'Preguntas frecuentes',
    intro: 'Estas son las preguntas que más nos hacen los dueños antes de empezar. Si la tuya no está,',
    contacto: 'escríbenos',
    preguntas: (d: DatosFaq): PreguntaFaq[] => [
      {
        p: '¿Qué hace Peaje?',
        r: `Peaje te ayuda a que asistentes de IA como ${asistentesMedidos('es')} encuentren tu negocio, entiendan qué vendes y te recomienden. Mide si te citan cuando alguien pregunta por lo que ofreces, te dice qué falta en tu sitio y tu agente te prepara los arreglos y las páginas. Después vuelve a medir para ver si funcionó.`,
      },
      {
        p: '¿En qué asistentes de IA mide si me citan?',
        r: `Hoy en ${asistentesMedidos('es')}. Les hacemos las preguntas que haría alguien que busca lo que ofreces y anotamos si te citan y a quién recomiendan en tu lugar. Gemini, Perplexity y las respuestas con IA de Google todavía no se miden.`,
      },
      {
        p: '¿Qué hace el Radar y es gratis?',
        r: `Sí, es gratis y no pide tarjeta ni cuenta, solo tu correo y tu sitio. Revisa lo que encuentra un agente de IA cuando llega a tu sitio: si puede leerte, si entiende qué ofreces y cuánto cobras, y qué le falta. Te da tu puntaje de hoy, hasta dónde puede subir y por dónde empezar. También les pregunta a ${asistentesMedidos('es')} por lo que ofreces y te muestra a quién citan en tu lugar.`,
        enlace: { href: '/radar', texto: 'Abrir el Radar' },
      },
      {
        p: '¿Cuánto cuesta Peaje?',
        r: `El Radar y el kit son gratis. El agente es la suscripción Pro. Los primeros ${d.cupos} negocios que se suscriben pagan el precio de fundador, US$${d.founder} al mes, y lo mantienen mientras su suscripción siga activa. Después de esos ${d.cupos}, Pro cuesta US$${d.pro} al mes. Si cancelas y vuelves, pagas el precio normal. Los impuestos de tu país aparecen antes de que confirmes el pago.`,
        enlace: { href: '/precios', texto: 'Ver precios' },
      },
      {
        p: '¿Qué incluye el paquete gratis?',
        r: `Al crear tu cuenta gratis puedes probar el agente sin pagar: ${d.regaloInformes} informes (tu plan y una medición de quién aparece en tu lugar) y ${d.regaloRespuestas} respuestas del agente con datos de tu negocio. Se da una sola vez por sitio. No incluye páginas escritas, tareas a pedido ni el trabajo de cada semana: eso es Pro.`,
      },
      {
        p: '¿Qué trae Pro cada mes?',
        r: `${d.paginas} páginas escritas con los datos de tu sitio, ${d.preguntas} preguntas de tus clientes medidas en ${asistentesMedidos('es')}, ${d.informes} informes a pedido, ${d.respuestas} respuestas con datos de tu agente, una nueva medición de cada página a las 2 y a las 6 semanas, y el monitor diario, las tareas de arreglo y el reporte semanal sin límite.`,
      },
      {
        p: '¿Cómo funcionan los créditos?',
        r: `Pro trae ${d.creditos} créditos al mes. Hablar con tu agente no gasta créditos: los créditos miden el trabajo que hace por ti. Una consulta en tus datos cuesta ${d.costos.consulta}, un arreglo ${d.costos.tarea}, un borrador de página ${d.costos.pagina}, una serie de páginas ${d.costos.serie} y un reporte que le pides ${d.costos.informe}. Se renuevan el 1 de cada mes, los que no usas no pasan al mes siguiente y no se venden créditos extra. Si se te acaban, tu agente sigue hablando contigo, pero no hace trabajo nuevo hasta el mes siguiente.`,
      },
      {
        p: '¿Puedo cancelar? ¿Hay reembolso?',
        r: `Cancelas cuando quieras desde tu panel, en Mi agente, sección Plan, sin llamadas. Conservas Pro hasta el final del período que ya pagaste y no se vuelve a cobrar. No hay prueba gratis de Pro: si es tu primer pago y lo pides dentro de ${d.dias} días, te lo devolvemos completo, sin preguntas. Las renovaciones no se reembolsan, salvo un error de cobro, que corregimos siempre. El reembolso lo hace Paddle al medio de pago original.`,
        enlace: { href: '/reembolsos', texto: 'Leer la política de reembolso' },
      },
      {
        p: '¿Dónde vive el agente?',
        r: 'Donde ya trabajas: Telegram, Slack, tu panel de Peaje o tu asistente de IA (Claude, ChatGPT o Cursor). Le preguntas lo que quieras de tu negocio y te contesta con tus datos. Cuando hay un arreglo, le pasa la tarea a tu herramienta de código y revisa tu sitio cuando ya está en vivo.',
      },
      {
        p: '¿Cuánto tarda en notarse?',
        r: 'Peaje vuelve a medir cada arreglo a las 2 y a las 6 semanas de publicarlo, con las mismas preguntas, y te muestra el antes y el después. Las respuestas de la IA cambian de un día a otro, así que una sola medición no basta para sacar conclusiones. No garantizamos que te citen, y cada medición te muestra si ya está pasando.',
      },
      {
        p: '¿Una agencia puede usar Peaje para sus clientes?',
        r: 'Sí. Con tu correo registras un sitio por cliente, y cada uno tiene su propio agente, sus tareas, sus mediciones y su plan, sin mezclarse con los demás. Tu equipo conecta Claude Code o Cursor en el repositorio de cada cliente y solo ve las tareas de ese sitio. Si manejas muchos clientes, agenda una demo y lo armamos contigo.',
        enlace: { href: '/para/agencias', texto: 'Peaje para agencias' },
      },
      {
        p: '¿Qué no hace Peaje hoy?',
        r: `No mide Gemini, Perplexity ni las respuestas con IA de Google, solo ${asistentesMedidos('es')}. No publica cambios en tu sitio por su cuenta: te prepara la página o la tarea, y tú, tu desarrollador o tu herramienta de código la publican. No garantiza que un asistente de IA te cite. Y no vende créditos extra ni tiene prueba gratis de Pro.`,
      },
    ],
  },
  en: {
    metaTitulo: 'Frequently asked questions',
    metaDescripcion: `What Peaje does, what it measures in ${asistentesMedidos('en')}, whether the Radar is free, what it costs, how to cancel and what it does not do yet.`,
    titulo: 'Frequently asked questions',
    intro: 'These are the questions business owners ask us most before they start. If yours is not here,',
    contacto: 'write to us',
    preguntas: (d: DatosFaq): PreguntaFaq[] => [
      {
        p: 'What does Peaje do?',
        r: `Peaje helps AI assistants like ${asistentesMedidos('en')} find your business, understand what you sell and recommend you. It checks whether they cite you when someone asks about what you offer, tells you what your site is missing, and your agent prepares the fixes and the pages. Then it measures again to see if it worked.`,
      },
      {
        p: 'Which AI assistants does it check?',
        r: `Today, ${asistentesMedidos('en')}. We ask them the questions someone looking for what you offer would ask, and we note whether they cite you and who they recommend instead. Gemini, Perplexity and Google's AI answers are not measured yet.`,
      },
      {
        p: 'What does the Radar do, and is it free?',
        r: `Yes, it is free and needs no card and no account, just your email and your site. It checks what an AI agent finds when it reaches your site: whether it can read you, whether it understands what you offer and what you charge, and what is missing. You get your score today, how far it can go and where to start. It also asks ${asistentesMedidos('en')} about what you offer and shows you who they cite instead of you.`,
        enlace: { href: '/radar', texto: 'Open the Radar' },
      },
      {
        p: 'How much does Peaje cost?',
        r: `The Radar and the kit are free. The agent is the Pro subscription. The first ${d.cupos} businesses that subscribe pay the founder price, US$${d.founder} a month, and keep it while their subscription stays active. After those ${d.cupos}, Pro costs US$${d.pro} a month. If you cancel and come back, you pay the regular price. Your country's taxes show up before you confirm the payment.`,
        enlace: { href: '/precios', texto: 'See pricing' },
      },
      {
        p: 'What is in the free package?',
        r: `When you create your free account you can try the agent without paying: ${d.regaloInformes} reports (your plan and one measurement of who shows up instead of you) and ${d.regaloRespuestas} agent answers with your business data. It is given once per site. It does not include written pages, tasks on demand or the weekly work: that is Pro.`,
      },
      {
        p: 'What does Pro include each month?',
        r: `${d.paginas} pages written from the facts on your site, ${d.preguntas} questions your customers ask tracked in ${asistentesMedidos('en')}, ${d.informes} reports on demand, ${d.respuestas} answers with your data from your agent, a new measurement of each page at 2 and 6 weeks, and the daily monitor, fix tasks and weekly report with no limit.`,
      },
      {
        p: 'How do credits work?',
        r: `Pro comes with ${d.creditos} credits a month. Talking to your agent uses no credits: credits measure the work it does for you. A lookup in your data costs ${d.costos.consulta}, a fix ${d.costos.tarea}, a page draft ${d.costos.pagina}, a series of pages ${d.costos.serie} and a report you ask for ${d.costos.informe}. They renew on the 1st of each month, unused credits do not carry over and you cannot buy extra credits. If you run out, your agent keeps talking with you but does no new work until next month.`,
      },
      {
        p: 'Can I cancel? Is there a refund?',
        r: `Cancel anytime from your dashboard, in My agent, Plan section, with no calls. You keep Pro until the end of the period you already paid for and you are not charged again. There is no free trial of Pro: if it is your first payment and you ask within ${d.dias} days, we refund it in full, no questions asked. Renewals are not refunded, except for a billing error, which we always fix. Paddle sends the refund to your original payment method.`,
        enlace: { href: '/reembolsos', texto: 'Read the refund policy' },
      },
      {
        p: 'Where does the agent live?',
        r: 'Where you already work: Telegram, Slack, your Peaje dashboard or your AI assistant (Claude, ChatGPT or Cursor). Ask it anything about your business and it answers with your data. When there is a fix, it hands the task to your coding tool and checks your site once it is live.',
      },
      {
        p: 'How long until I see a difference?',
        r: 'Peaje measures each fix again 2 and 6 weeks after you publish it, with the same questions, and shows you the before and after. AI answers change from one day to the next, so a single measurement is not enough to draw conclusions. We do not guarantee you will be cited, and each measurement shows you whether it is happening.',
      },
      {
        p: 'Can an agency use Peaje for its clients?',
        r: 'Yes. With your email you add one site per client, and each one gets its own agent, tasks, measurements and plan, kept apart from the others. Your team connects Claude Code or Cursor in each client\'s repository and only sees that site\'s tasks. If you manage many clients, book a demo and we set it up with you.',
        enlace: { href: '/for/agencies', texto: 'Peaje for agencies' },
      },
      {
        p: 'What does Peaje not do today?',
        r: `It does not measure Gemini, Perplexity or Google's AI answers, only ${asistentesMedidos('en')}. It does not publish changes to your site on its own: it prepares the page or the task, and you, your developer or your coding tool publish it. It does not guarantee that an AI assistant will cite you. And it does not sell extra credits or offer a free trial of Pro.`,
      },
    ],
  },
}
