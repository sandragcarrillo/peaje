import { asistentesMedidos } from '@peaje/shared/asistentes'
import { COBROS_VISIBLES } from '@/lib/config'

/**
 * Página /precios. Los montos, cupos y límites salen de @peaje/db (planes.ts),
 * así que los textos los reciben como argumentos y no se desincronizan.
 */

/** Lo que trae Pro cada mes: PAQUETE_MENSUAL y LIMITES.pro.preguntas de planes.ts. */
type Paquete = { paginas: number; preguntas: number; informes: number; respuestas: number }
export const precios = {
  es: {
    metaTitulo: 'Precios',
    metaDescripcion:
      'Radar gratis, kit gratis y el agente de AEO en la suscripción Pro: precio de fundador de US$30 al mes para los primeros 50 negocios, luego US$69 al mes.',
    kicker: 'Precios',
    titulo: 'Empieza gratis. Paga solo por el agente.',
    intro: `Peaje es software que deja tu sitio o tu API listo para agentes de IA: que te encuentren${COBROS_VISIBLES ? ', te lean y, si quieres, te paguen por pedido' : ' y te lean'}. El radar y el kit son gratis. El agente de AEO es la suscripción Pro.`,

    gratis: 'Gratis',
    alMes: 'al mes',
    incluye: 'Incluye',

    gratisNombre: 'Gratis',
    gratisTexto: 'Mide tu sitio y déjalo listo para los agentes de IA. Sin tarjeta.',
    gratisIncluye: [
      'Radar: tu puntaje de hoy, qué falla y hasta dónde sube, en menos de un minuto y solo con tu email',
      'llms.txt, openapi.json, servidor MCP, agent cards y JSON-LD generados para tu sitio',
      // Cobrarles a los agentes (rutas 402, comprador misterioso) se muestra cuando se prenda en mainnet.
      ...(COBROS_VISIBLES ? ['Rutas con precio que responden 402 en tu propio dominio'] : []),
      'Registro de visitas de agentes',
      'Monitor diario y tareas para arreglar lo que falla',
    ],
    // Nota del plan gratis mientras cobrarles a los agentes está apagado (hasta mainnet).
    kitNota: 'No pide tarjeta y no vence.',
    kitComision: (pct: number) =>
      `Si cobras a agentes, Peaje se queda con el ${pct}% de cada pago y acredita el resto a la wallet de tu negocio. Esos pagos van aparte de la suscripción Pro: no pasan por Paddle, que solo procesa el pago de Pro con tarjeta.`,

    proNombre: 'Pro',
    proTexto: 'Todo lo gratis, más tu agente: te dice qué arreglar, te prepara las páginas y mide si la IA te recomienda.',
    proNota: (cupos: number, pro: number) =>
      `Precio de fundador para los primeros ${cupos} negocios que se suscriben, y lo mantienes mientras tu suscripción siga activa. Después de esos ${cupos}, Pro cuesta US$${pro} al mes. Si cancelas y vuelves, pagas el precio normal.`,
    ctaAgente: 'Empezar con mi agente',
    limites: (creditos: number) => `Todo sale de ${creditos} créditos al mes, que repartes como quieras. Hablar con tu agente es gratis.`,

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
      ...(COBROS_VISIBLES ? [{ que: 'Una prueba del comprador misterioso', cuanto: c.comprador }] : []),
    ],
    creditos: (n: number) => (n === 1 ? '1 crédito' : `${n} créditos`),
    creditosGratis:
      'No gastan créditos: hablar con tu agente, los reportes programados y las respuestas a preguntas que no tienen que ver con tu negocio.',
    creditosRenuevan:
      'Los créditos se renuevan el 1 de cada mes. Los que no usas no pasan al mes siguiente, y no se pueden comprar créditos extra.',

    // Los mismos puntos que la tarjeta de la landing (copy de San, 29 oct 2026), más el paso a la herramienta de código.
    proIncluye: (p: Paquete) => [
      `${p.paginas} páginas al mes, escritas con los datos de tu sitio`,
      `${p.preguntas} preguntas de tus clientes medidas en ${asistentesMedidos('es')}`,
      'Nueva medición de cada página a las 2 y a las 6 semanas',
      `${p.informes} informes a pedido (plan, medición de citas, búsqueda de tareas)`,
      `${p.respuestas} respuestas con datos de tu agente, en el panel, Telegram o tu herramienta de IA`,
      'Le pasa cada tarea a tu herramienta de código por MCP o con la CLI, y verifica el sitio en vivo',
      ...(COBROS_VISIBLES ? ['Comprador misterioso: prueba el paso de pago de tus rutas como lo haría un agente'] : []),
      'Monitor diario, tareas de arreglo y reporte semanal sin límite',
    ],

    pruebaTitulo: (dias: number) => `Reembolso del primer pago en ${dias} días`,
    pruebaTexto: (dias: number) =>
      `No hay prueba gratis. Si te suscribes y Pro no es para ti, te devolvemos el primer pago completo si lo pides dentro de ${dias} días. El radar y el kit siguen gratis siempre.`,

    cobroTitulo: 'Cómo se cobra',
    cobroTexto:
      'Pagas con tarjeta. El pago lo procesa Paddle.com, nuestro revendedor en línea y Merchant of Record (vendedor registrado) de todos nuestros pedidos: cobra, calcula los impuestos de tu país y te envía el recibo y la factura por correo. La suscripción se cobra cada mes en dólares y se renueva sola hasta que la canceles. Peaje nunca ve los datos de tu tarjeta.',
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
        r: `En el peor caso, cancelas y te quedas con tu diagnóstico y los arreglos que tu agente ya te entregó, incluidos los borradores de página. El kit, el monitor diario y sus tareas de arreglo siguen gratis. En el mejor caso, ${asistentesMedidos('es')} empiezan a citar tu sitio en las preguntas de tu negocio, y lo ves en la medición de tu agente.`,
      },
      {
        p: '¿Me cobran algo más?',
        r: `Solo la suscripción mensual. El precio y los impuestos de tu país aparecen en el formulario de pago antes de que confirmes.${COBROS_VISIBLES ? ` El ${pct}% es aparte y solo aplica si decides cobrarles a los agentes de IA por tu contenido: Peaje se queda con el ${pct}% de cada pago de un agente y el resto llega directo a la wallet de tu negocio. Si no les cobras, no hay comisión.` : ''}`,
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
    intro: `Peaje is software that gets your site or API ready for AI agents: they find you${COBROS_VISIBLES ? ', read you and, if you want, pay you per request' : ' and read you'}. The radar and the kit are free. The AEO agent is the Pro subscription.`,

    gratis: 'Free',
    alMes: 'a month',
    incluye: 'Includes',

    gratisNombre: 'Free',
    gratisTexto: 'Measure your site and get it ready for AI agents. No card.',
    gratisIncluye: [
      'Radar: your score today, what fails and how far it can go, in under a minute and with just your email',
      'llms.txt, openapi.json, an MCP server, agent cards and JSON-LD generated for your site',
      ...(COBROS_VISIBLES ? ['Priced routes that answer 402 on your own domain'] : []),
      'A log of agent visits',
      'A daily monitor and tasks to fix what breaks',
    ],
    kitNota: 'No card needed, and it does not expire.',
    kitComision: (pct: number) =>
      `If you charge agents, Peaje keeps ${pct}% of each payment and credits the rest to your business wallet. Those payments are separate from the Pro subscription: they do not go through Paddle, which only processes the Pro card payment.`,

    proNombre: 'Pro',
    proTexto: 'Everything in Free, plus your agent: it tells you what to fix, prepares the pages and tracks whether AI recommends you.',
    proNota: (cupos: number, pro: number) =>
      `Founder price for the first ${cupos} businesses that subscribe, and you keep it while your subscription stays active. After those ${cupos}, Pro costs US$${pro} a month. If you cancel and come back, you pay the regular price.`,
    ctaAgente: 'Start with my agent',
    limites: (creditos: number) => `It all comes from ${creditos} credits a month, which you split however you like. Talking to your agent is free.`,

    creditosTitulo: 'How credits work',
    creditosIntro: (creditos: number) =>
      `Each month your plan comes with ${creditos} credits. Talking to your agent uses no credits: credits measure the work the agent does for you.`,
    creditosCostos: (c: { consulta: number; tarea: number; pagina: number; serie: number; informe: number; comprador: number }) => [
      { que: 'A lookup in your data', cuanto: c.consulta },
      { que: 'A fix', cuanto: c.tarea },
      { que: 'A page draft', cuanto: c.pagina },
      { que: 'A series of pages', cuanto: c.serie },
      { que: 'A report you ask for', cuanto: c.informe },
      ...(COBROS_VISIBLES ? [{ que: 'A mystery shopper test', cuanto: c.comprador }] : []),
    ],
    creditos: (n: number) => (n === 1 ? '1 credit' : `${n} credits`),
    creditosGratis:
      'These use no credits: talking to your agent, scheduled reports and answers to questions that have nothing to do with your business.',
    creditosRenuevan:
      'Credits renew on the 1st of each month. Unused credits do not carry over, and you cannot buy extra credits.',

    proIncluye: (p: Paquete) => [
      `${p.paginas} pages a month, written from the facts on your site`,
      `${p.preguntas} questions your customers ask, tracked in ${asistentesMedidos('en')}`,
      'A new measurement of each page at 2 and 6 weeks',
      `${p.informes} reports on demand (plan, citation check, task search)`,
      `${p.respuestas} answers with your data from your agent, in the dashboard, Telegram or your AI tool`,
      'Hands each task to your coding tool over MCP or the CLI, and checks the live site',
      ...(COBROS_VISIBLES ? ['Mystery shopper: tests the payment step of your routes the way an agent would'] : []),
      'Daily monitor, fix tasks and weekly report with no limit',
    ],

    pruebaTitulo: (dias: number) => `First payment refunded within ${dias} days`,
    pruebaTexto: (dias: number) =>
      `There is no free trial. If you subscribe and Pro is not for you, we refund your first payment in full if you ask within ${dias} days. The radar and the kit stay free.`,

    cobroTitulo: 'How billing works',
    cobroTexto:
      'You pay by card. The payment is processed by Paddle.com, our online reseller and the Merchant of Record for all our orders: it charges you, calculates the taxes for your country and emails you the receipt and the invoice. The subscription is billed monthly in US dollars and renews automatically until you cancel. Peaje never sees your card details.',
    cobroEnlaces: 'Read the terms and the refund policy before you subscribe.',
    terminos: 'Terms',
    reembolsos: 'Refunds',

    faqTitulo: 'Questions about paying',
    faq: ({ pct, dias }: { pct: number; dias: number }) => [
      {
        p: 'What if it does not work for me?',
        r: `Worst case, you cancel and keep your diagnosis and the fixes your agent already handed you, page drafts included. The kit, the daily monitor and its fix tasks stay free. Best case, ${asistentesMedidos('en')} start citing your site for your business questions, and you see it in your agent's tracking.`,
      },
      {
        p: 'Do you charge anything else?',
        r: `Only the monthly subscription. The price and your country's taxes appear in the checkout before you confirm.${COBROS_VISIBLES ? ` The ${pct}% is separate and only applies if you choose to charge AI agents for your content: Peaje keeps ${pct}% of each agent payment and the rest goes straight to your business wallet. If you do not charge agents, there is no fee.` : ''}`,
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
