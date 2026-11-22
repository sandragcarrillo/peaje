import { asistentesMedidos } from '@peaje/shared/asistentes'

/**
 * Página /demo (app/demo). Una sola URL; el idioma sale de la cookie, como /precios.
 * Lo que promete la llamada sale de lo que el producto hace hoy: el Radar
 * (app/radar), las tareas y la nueva medición a las 2 y 6 semanas (Pro en
 * /precios) y dónde vive el agente (Integraciones en app/t/[slug], onboard.md).
 * Precios y cupos llegan como argumentos desde @peaje/db.
 */

type DatosDemo = { founder: number; pro: number; cupos: number }

export const demo = {
  es: {
    metaTitulo: 'Agenda una demo',
    metaDescripcion: `30 minutos con tu sitio en pantalla: corremos el Radar, vemos a quién recomiendan ${asistentesMedidos('es')} en tu lugar y te mostramos cómo Peaje escribe tus páginas y prepara cada arreglo.`,

    titulo: 'Mira a Peaje trabajar con tu sitio',
    intro: 'Una llamada de 30 minutos con el equipo que construye Peaje, con tu sitio abierto en pantalla.',
    sinLlamadaA: 'Para empezar no hace falta llamada.',
    sinLlamadaEnlace: 'Mide tu sitio gratis con el Radar',
    sinLlamadaB: 'y activa tu agente cuando quieras.',

    agendaTitulo: 'Qué te llevas de la llamada',
    agenda: [
      {
        titulo: 'Tu puntaje, medido en vivo',
        texto: 'Corremos el Radar con tu sitio y ves qué les impide a los agentes de IA entender lo que vendes y hasta dónde puede subir tu puntaje.',
      },
      {
        titulo: 'Quién se queda con tus clientes',
        texto: `Le hacemos a ${asistentesMedidos('es')} las preguntas que hace tu cliente y ves qué negocios recomiendan en tu lugar y qué fuentes citan.`,
      },
      {
        titulo: 'Tu primer arreglo, sobre la mesa',
        texto: 'Te mostramos la página que tu agente escribe para una pregunta donde no sales, lista para que la apruebes, y cómo la vuelve a medir a las 2 y a las 6 semanas.',
      },
      {
        titulo: 'Tu agente, conectado',
        texto: 'Si quieres, lo conectamos en la llamada a Telegram, Slack, Claude, ChatGPT o Cursor, y le haces tu primera pregunta sobre tu negocio.',
      },
      {
        titulo: 'Una respuesta directa',
        texto: 'Si Peaje no es para ti, te lo decimos ahí mismo y te contamos qué haríamos en tu lugar.',
      },
    ],

    // Tarjeta del agendador (app/demo/agendar.tsx)
    pasoTitulo: 'Antes de elegir horario',
    pasoTexto: 'Con tres datos llegamos a la llamada con tu sitio ya revisado.',
    pasoTextoCorreo: 'Con estos datos revisamos tu sitio antes de escribirte para cuadrar la hora.',
    sitio: 'Tu sitio',
    sitioPlaceholder: 'tusitio.com',
    correo: 'Tu correo',
    correoPlaceholder: 'tu@negocio.com',
    objetivo: '¿Qué quieres ver?',
    opcional: '(opcional)',
    objetivoPlaceholder: 'Por ejemplo: por qué ChatGPT recomienda a mi competencia',
    faltaSitio: 'Escribe tu sitio, por ejemplo tusitio.com.',
    faltaCorreo: 'Escribe tu correo.',
    continuar: 'Continuar',
    escribir: 'Pedir la demo',
    letraCal:
      'Al continuar guardamos tu sitio y tu correo para preparar la llamada, y pasan a Cal.com con tu nota para prellenar la reserva. No te suscribimos a ningún correo.',
    letraCorreo: 'Guardamos tu sitio y tu correo solo para escribirte sobre la demo. No te suscribimos a ningún correo.',
    privacidad: 'Privacidad',
    calTitulo: 'Elige un horario',
    calVolver: 'Cambiar mis datos',
    calZona: 'Los horarios salen en tu zona horaria. ¿Ninguno te sirve?',
    calEscribenos: 'Escríbenos',
    calCargando: 'Cargando el calendario…',
    calFallo: 'El calendario no cargó. Puedes abrirlo en otra pestaña.',
    calAbrir: 'Abrir el calendario',
    enlaceTitulo: 'Elige un horario',
    enlaceTexto: 'El calendario se abre en otra pestaña. Lleva tu sitio y una o dos preguntas que te hacen tus clientes.',
    enlaceBoton: 'Elegir un horario',
    correoListoTitulo: 'Listo, lo tenemos.',
    correoListoTexto: 'Te escribimos a',
    correoListoFin: 'con el siguiente paso.',
    correoFallo: 'No pudimos guardar tu pedido. Escríbenos a',
    correoAsunto: 'Demo de Peaje',
    correoSitio: 'Sitio',
    correoObjetivo: 'Lo que quiero ver',

    paraTitulo: 'Para quién es',
    para: [
      'Tienes un negocio con sitio propio y tus clientes ya le preguntan a la IA por lo que vendes.',
      'Quieres saber a quién recomiendan en tu lugar y qué publicar para cambiarlo.',
      'Tú o alguien de tu equipo puede publicar cambios en el sitio, a mano o con Claude Code o Cursor.',
    ],
    noParaTitulo: 'Para quién no',
    noPara: [
      `Te importan sobre todo Gemini, Perplexity o los AI Overviews de Google, y hoy Peaje mide solo ${asistentesMedidos('es')}.`,
      'Buscas quien te maneje la pauta o te consiga clientes con correos en frío, y eso Peaje no lo hace.',
      'Todavía no tienes sitio web.',
      'Solo quieres tu puntaje: el Radar te lo da en un minuto, sin llamada.',
    ],

    sinLlamadaTitulo: '¿Prefieres verlo sin hablar con nadie?',
    sinLlamadaTexto:
      'El Radar mide tu sitio en menos de un minuto con tu correo y tu dominio, sin cuenta y sin tarjeta.',
    ctaRadar: 'Medir mi sitio gratis',
    verPrecios: 'Ver precios',
    verComparar: 'Comparar con otras herramientas',

    faqTitulo: 'Preguntas',
    faq: (d: DatosDemo) => [
      { p: '¿La demo cuesta algo?', r: 'No. Es gratis y no te pedimos tarjeta.' },
      {
        p: '¿Qué tengo que preparar?',
        r: 'Tu sitio y dos o tres preguntas que te hacen tus clientes. Si ya pasaste por el Radar, trae el enlace de tu resultado.',
      },
      {
        p: '¿Necesito la llamada para empezar?',
        r: 'No. El Radar y la cuenta gratis no piden llamada, y el plan Pro lo activas tú en línea. Cancelas cuando quieras, también sin llamada.',
      },
      {
        p: '¿Cuánto cuesta Peaje?',
        r: `El Radar y el kit son gratis. El plan Pro, con tu agente, cuesta US$${d.founder} al mes para los primeros ${d.cupos} negocios y se queda en ese precio mientras sigas suscrito. Después cuesta US$${d.pro} al mes.`,
      },
      {
        p: '¿Qué asistentes de IA mide?',
        r: `Hoy ${asistentesMedidos('es')}. Les hace las preguntas que haría tu cliente y anota si te citan y a quién recomiendan en tu lugar.`,
      },
      { p: '¿En qué idioma es la llamada?', r: 'En español o en inglés, como prefieras.' },
    ],
  },
  en: {
    metaTitulo: 'Book a demo',
    metaDescripcion: `30 minutes with your site on screen: we run the Radar, see who ${asistentesMedidos('en')} recommend instead of you, and show how Peaje writes your pages and prepares each fix.`,

    titulo: 'Watch Peaje work on your site',
    intro: 'A 30-minute call with the team building Peaje, with your site open on screen.',
    sinLlamadaA: 'You don’t need a call to start.',
    sinLlamadaEnlace: 'Check your site free with the Radar',
    sinLlamadaB: 'and turn on your agent whenever you want.',

    agendaTitulo: 'What you leave the call with',
    agenda: [
      {
        titulo: 'Your score, measured live',
        texto: 'We run the Radar on your site and you see what stops AI agents from understanding what you sell, and how far your score can go.',
      },
      {
        titulo: 'Who is getting your customers',
        texto: `We ask ${asistentesMedidos('en')} the questions your customers ask and you see which businesses they recommend instead of you and which sources they cite.`,
      },
      {
        titulo: 'Your first fix, on the table',
        texto: 'We show you the page your agent writes for a question where you don’t show up, ready for you to approve, and how it measures it again at 2 and 6 weeks.',
      },
      {
        titulo: 'Your agent, connected',
        texto: 'If you want, we connect it during the call to Telegram, Slack, Claude, ChatGPT or Cursor, and you ask it your first question about your business.',
      },
      {
        titulo: 'A straight answer',
        texto: 'If Peaje isn’t right for you, we tell you on the call and share what we would do in your place.',
      },
    ],

    pasoTitulo: 'Before you pick a time',
    pasoTexto: 'Three details so we come to the call having already looked at your site.',
    pasoTextoCorreo: 'With these details we look at your site before we email you to find a time.',
    sitio: 'Your website',
    sitioPlaceholder: 'yoursite.com',
    correo: 'Your email',
    correoPlaceholder: 'you@business.com',
    objetivo: 'What would you like to see?',
    opcional: '(optional)',
    objetivoPlaceholder: 'For example: why ChatGPT recommends my competitor',
    faltaSitio: 'Enter your website, for example yoursite.com.',
    faltaCorreo: 'Enter your email.',
    continuar: 'Continue',
    escribir: 'Request the demo',
    letraCal:
      'When you continue we keep your website and email to prepare the call, and they go to Cal.com with your note to prefill the booking. This doesn’t sign you up for any emails.',
    letraCorreo: 'We keep your site and email only to write to you about the demo. We don’t add you to any mailing list.',
    privacidad: 'Privacy',
    calTitulo: 'Pick a time',
    calVolver: 'Change my details',
    calZona: 'Times show in your time zone. None work for you?',
    calEscribenos: 'Email us',
    calCargando: 'Loading the calendar…',
    calFallo: 'The calendar didn’t load. You can open it in a new tab.',
    calAbrir: 'Open the calendar',
    enlaceTitulo: 'Pick a time',
    enlaceTexto: 'The calendar opens in a new tab. Bring your site and one or two questions your customers ask you.',
    enlaceBoton: 'Pick a time',
    correoListoTitulo: 'Got it, thanks.',
    correoListoTexto: 'We’ll email you at',
    correoListoFin: 'with a next step.',
    correoFallo: 'We couldn’t save your request. Email us at',
    correoAsunto: 'Peaje demo',
    correoSitio: 'Website',
    correoObjetivo: 'What I’d like to see',

    paraTitulo: 'Who it’s for',
    para: [
      'You run a business with its own website, and your customers already ask AI about what you sell.',
      'You want to know who gets recommended instead of you and what to publish to change that.',
      'You or someone on your team can publish changes to the site, by hand or with Claude Code or Cursor.',
    ],
    noParaTitulo: 'Who it’s not for',
    noPara: [
      `You mostly care about Gemini, Perplexity or Google AI Overviews, and today Peaje only measures ${asistentesMedidos('en')}.`,
      'You want someone to run your ads or find customers with cold email, and Peaje doesn’t do that.',
      'You don’t have a website yet.',
      'You only want your score: the Radar gives it to you in a minute, without a call.',
    ],

    sinLlamadaTitulo: 'Rather see it without talking to anyone?',
    sinLlamadaTexto: 'The Radar checks your site in under a minute with just your email and domain, without an account or a card.',
    ctaRadar: 'Check my site free',
    verPrecios: 'See pricing',
    verComparar: 'Compare with other tools',

    faqTitulo: 'Questions',
    faq: (d: DatosDemo) => [
      { p: 'Does the demo cost anything?', r: 'No. It’s free and we don’t ask for a card.' },
      {
        p: 'What should I prepare?',
        r: 'Your site and two or three questions your customers ask you. If you’ve already used the Radar, bring the link to your result.',
      },
      {
        p: 'Do I need the call to get started?',
        r: 'No. The Radar and the free account need no call, and you turn on Pro yourself online. You can cancel any time, also without a call.',
      },
      {
        p: 'How much does Peaje cost?',
        r: `The Radar and the kit are free. Pro, with your agent, is US$${d.founder} a month for the first ${d.cupos} businesses, and stays at that price while you’re subscribed. After that it’s US$${d.pro} a month.`,
      },
      {
        p: 'Which AI assistants does it measure?',
        r: `Today ${asistentesMedidos('en')}. It asks them the questions your customers would ask and notes whether they cite you and who they recommend instead.`,
      },
      { p: 'What language is the call in?', r: 'Spanish or English, whichever you prefer.' },
    ],
  },
}
