import { asistentesMedidos } from '@peaje/shared/asistentes'

/**
 * Home pública (propuesta del 22 nov 2026, reports/Landing Peaje propuesta.md).
 * Una sola acción principal en toda la página: "Empezar gratis" al Radar.
 * Montos, cupos y paquetes llegan como argumentos desde @peaje/db; las
 * preguntas salen de faq.ts (la misma fuente que /preguntas y /faq).
 *
 * Las piezas del producto que se ven en el home son un ejemplo rotulado como
 * ejemplo: un negocio de muestra (tusitio.com), sin clientes reales y sin
 * dominios ajenos inventados. A quién cita la IA se dice con palabras ("un
 * estudio de la competencia"), no con sitios que existen.
 */

/** Lo que trae Pro cada mes: PAQUETE_MENSUAL y LIMITES.pro de planes.ts. */
type Paquete = { paginas: number; preguntas: number; informes: number; respuestas: number }
/** El paquete gratis (REGALO de regalo.ts) y los precios (PRECIOS_USD, CUPOS_FOUNDER). */
type Precio = { founder: number; pro: number; cupos: number; regaloInformes: number; regaloRespuestas: number }

/** Conversación de ejemplo del componente viejo del hero (app/components/chat-ejemplo.tsx, ya fuera del home). */
export type MensajeChat = {
  de: 'dueno' | 'agente'
  texto: string
  tarjeta?: { titulo: string; accion: string }
  chip?: string
}

export const landing = {
  es: {
    // CTAs del sitio público.
    ctaAgente: 'Empezar con mi agente',
    ctaRadar: 'Revisar mi sitio gratis',
    ctaDashboard: 'Ir a mi panel',
    // Bloque de CTAs (app/components/cta-inicio.tsx): home, Radar y otras páginas públicas.
    cta: {
      empezar: 'Empezar gratis',
      demo: 'Agenda una demo',
      configurar: 'Instala Peaje con',
      configurarDominio: 'tu IA',
      configurarPista: 'Copia una instrucción para pegarle a tu asistente de IA',
      copiado: 'Copiado. Pégalo en ChatGPT, Claude o Cursor',
    },

    // Hero. El h1 se parte para pintar el final en el acento.
    h1Inicio: 'Tus clientes ya le preguntan a ChatGPT.',
    h1Final: 'Haz que te recomiende a ti.',
    sub: `Peaje es tu agente de visibilidad en IA. Trabaja cada semana para que ${asistentesMedidos('es')} te nombren: escribe las páginas que te faltan, deja tu sitio listo para que la IA lo lea y te ayuda a entrar en las listas que consulta. Tú apruebas, Peaje hace el resto.`,

    // Muestra del producto (hero y ciclo). Todo rotulado "Ejemplo".
    ejemplo: 'Ejemplo',
    ejemploNota: 'Así se ve una respuesta del Radar, con un negocio y resultados de ejemplo.',
    muestraDominio: 'tusitio.com',
    muestraPreguntas: [
      '¿Qué estudio contable me recomiendas para una pyme en Bogotá?',
      '¿Cuánto cobra un contador por llevar la contabilidad de una pyme?',
      '¿Qué contador sabe de facturación electrónica en Colombia?',
    ],
    /** A quién citó cada asistente en la primera pregunta, con palabras (no son sitios reales). */
    muestraCitoChatgpt: 'Un estudio de la competencia, un directorio de contadores',
    muestraCitoClaude: 'Un estudio de la competencia',
    muestraEnTuLugar: [
      { quien: 'Un estudio de la competencia', veces: 4 },
      { quien: 'Un directorio de contadores', veces: 3 },
      { quien: 'Una revista de negocios', veces: 1 },
    ],
    muestraPreguntando: 'Preguntando',
    muestraAgente: 'Tu agente ya tiene listos 3 arreglos para cambiarlo.',

    // Qué hace por ti (franja fina).
    mide: [
      'Escribe las páginas que la IA cita: comparativas, precios y guías de lo que vendes',
      'Deja tu sitio listo para que la IA lo lea y le avisa a Bing de cada cambio',
      `Pregunta cada semana en ${asistentesMedidos('es')} lo que buscan tus clientes, y vuelve a medir cada arreglo`,
    ],

    // El ciclo.
    cicloTitulo: 'Tu agente mide, hace el arreglo y vuelve a medir.',
    cicloSub: 'Cada semana repite lo mismo con tus preguntas. El trabajo lo hace Peaje, y tú solo apruebas qué se publica.',
    ciclo: [
      {
        titulo: 'Mide a quién citan.',
        texto: `Les hace tus preguntas a ${asistentesMedidos('es')} y anota, asistente por asistente, en cuántas respuestas sales.`,
      },
      {
        titulo: 'Hace el arreglo.',
        texto:
          'Escribe la página que te falta, redacta el pedido para que te incluyan en una lista y prepara el cambio en el código de tu sitio, con el porqué de cada uno.',
      },
      {
        titulo: 'Tú apruebas y se publica.',
        texto:
          'Revisas el arreglo y das el sí. Si usas Claude Code o Cursor, lo aplican desde Peaje en un paso; si no, se lo pasas a quien maneja tu web. Cuando está publicado, Peaje lo revisa en tu sitio.',
      },
      {
        titulo: 'Vuelve a medir.',
        texto: 'A las 2 y a las 6 semanas pregunta otra vez lo mismo y te muestra si cambió algo.',
      },
    ],
    cicloPausa: 'Pausar',
    // Pantallas del ciclo (ejemplo).
    pantallaPreguntas: 'Preguntas de esta semana',
    pantallaTareas: [
      { titulo: 'Publicar la página "¿Qué estudio contable me recomiendas para una pyme en Bogotá?"', estado: 'verified' as const, nota: 'Peaje la encontró en tusitio.com/estudio-contable-pymes' },
      { titulo: 'Pedir que te incluyan en un directorio de contadores', estado: 'done' as const, nota: 'Le mandaste el pedido al directorio' },
      { titulo: 'Agregar tus precios a la página de servicios', estado: 'in_progress' as const, nota: 'La tomó Claude Code' },
    ],
    pantallaRondas: ['Primera', 'A las 2 semanas', 'A las 6 semanas'],
    pantallaHistorialNota: 'Las respuestas de la IA cambian de una semana a otra, por eso mide más de una vez.',

    // Dónde vive tu agente. Nombres sin logos.
    vivoTitulo: 'Tu agente trabaja donde ya trabajas.',
    vivoTexto: 'Le escribes por Telegram, Slack, el panel o tu asistente de IA. Hablar con él es gratis; los créditos son para el trabajo que hace.',
    vivo: [
      { clave: 'telegram' as const, nombre: 'Telegram', texto: 'Le escribes como a una persona y te contesta con los datos de tu negocio.' },
      { clave: 'slack' as const, nombre: 'Slack', texto: 'Lo sumas al Slack de tu equipo y cualquiera del canal le pregunta mencionando a @Peaje.' },
      { clave: 'panel' as const, nombre: 'El panel', texto: 'Ves tus tareas, cada medición y a quién cita la IA en tu lugar.' },
      {
        clave: 'asistente' as const,
        nombre: 'Tu asistente de IA',
        texto: 'Desde Claude, ChatGPT o Cursor le preguntas por tu negocio, y Claude Code o Cursor toman las tareas.',
      },
    ],

    // Precio.
    precioTitulo: (p: Precio) => `El Radar es gratis. El agente cuesta US$${p.founder} al mes.`,
    precioTexto: (p: Precio) =>
      `Es el precio de fundador para los primeros ${p.cupos} negocios, y lo mantienes mientras sigas suscrito. Después, Pro cuesta US$${p.pro} al mes.`,
    precioGratis: (p: Precio) => `Con tu cuenta gratis tienes ${p.regaloInformes} informes y ${p.regaloRespuestas} respuestas para probar el agente.`,
    precioPlan: 'Pro',
    precioUnidad: 'al mes',
    precioCosto: (p: Precio) => `US$${p.founder} al mes, precio de fundador`,
    // Lo que trae el plan por mes, en unidades (PAQUETE_MENSUAL y LIMITES en planes.ts). Copy de San, 29 oct 2026.
    precioPuntos: (p: Paquete) => [
      { fuerte: `${p.paginas} páginas al mes`, resto: ', escritas con los datos de tu sitio' },
      { fuerte: `${p.preguntas} preguntas de tus clientes`, resto: ` medidas en ${asistentesMedidos('es')}` },
      { fuerte: 'Nueva medición de cada página', resto: ' a las 2 y a las 6 semanas' },
      { fuerte: `${p.informes} informes a pedido`, resto: ' (plan, medición de citas, búsqueda de tareas)' },
      { fuerte: `${p.respuestas} respuestas con datos`, resto: ' de tu agente, en el panel, Telegram o tu herramienta de IA' },
      { fuerte: 'Monitor diario, tareas de arreglo y reporte semanal', resto: ' sin límite' },
    ],
    verPrecios: 'Ver todos los detalles del precio',

    // Preguntas (las respuestas salen de faq.ts).
    faqTitulo: 'Preguntas',
    faqTodas: 'Ver todas las preguntas',
    faqRuta: '/preguntas',

    // Cierre.
    cierreTitulo: 'Mira a quién recomienda la IA cuando preguntan por lo que vendes.',
    cierreTexto: 'El Radar es gratis y no pide tarjeta, solo tu correo para mandarte el resultado.',
  },
  en: {
    ctaAgente: 'Start with my agent',
    ctaRadar: 'Check my site free',
    ctaDashboard: 'Go to my dashboard',
    cta: {
      empezar: 'Start free',
      demo: 'Book a demo',
      configurar: 'Set me up with',
      configurarDominio: 'usepeaje.com',
      configurarPista: 'Copies an instruction to paste into your AI assistant',
      copiado: 'Copied. Paste it into ChatGPT, Claude or Cursor',
    },

    h1Inicio: 'Your customers already ask ChatGPT.',
    h1Final: 'Make it recommend you.',
    sub: `Peaje is your AI visibility agent. Every week it works to get ${asistentesMedidos('en')} to name you: it writes the pages you are missing, gets your site ready for AI to read and helps you land on the lists they check. You approve, Peaje does the rest.`,

    ejemplo: 'Example',
    ejemploNota: 'This is what a Radar answer looks like, with a sample business and sample results.',
    muestraDominio: 'yoursite.com',
    muestraPreguntas: [
      'Which accounting firm would you recommend for a small business in Miami?',
      'How much does an accountant charge to keep the books for a small business?',
      'Which accountant knows e-invoicing for small businesses?',
    ],
    muestraCitoChatgpt: 'A competing firm, an accountant directory',
    muestraCitoClaude: 'A competing firm',
    muestraEnTuLugar: [
      { quien: 'A competing firm', veces: 4 },
      { quien: 'An accountant directory', veces: 3 },
      { quien: 'A business magazine', veces: 1 },
    ],
    muestraPreguntando: 'Asking',
    muestraAgente: 'Your agent already has 3 fixes ready to change that.',

    mide: [
      'Writes the pages AI cites: comparisons, pricing and guides about what you sell',
      'Gets your site ready for AI to read and tells Bing about every change',
      `Asks ${asistentesMedidos('en')} what your customers search for every week, and measures each fix again`,
    ],

    cicloTitulo: 'Your agent measures, does the fix and measures again.',
    cicloSub: 'It repeats this every week with your questions. Peaje does the work, and you only approve what goes live.',
    ciclo: [
      {
        titulo: 'Measures who they cite.',
        texto: `It asks ${asistentesMedidos('en')} your questions and notes, assistant by assistant, how many answers include you.`,
      },
      {
        titulo: 'Does the fix.',
        texto:
          'It writes the page you are missing, drafts the request to be added to a list and prepares the change in your site code, with the reason for each.',
      },
      {
        titulo: 'You approve and it goes live.',
        texto:
          'You review the fix and say yes. If you use Claude Code or Cursor, they apply it from Peaje in one step; if not, you pass it to whoever runs your website. Once it is live, Peaje checks it on your site.',
      },
      {
        titulo: 'Measures again.',
        texto: 'At 2 and 6 weeks it asks the same questions again and shows you whether anything changed.',
      },
    ],
    cicloPausa: 'Pause',
    pantallaPreguntas: "This week's questions",
    pantallaTareas: [
      { titulo: 'Publish the page "Which accounting firm would you recommend for a small business in Miami?"', estado: 'verified' as const, nota: 'Peaje found it at yoursite.com/small-business-accounting' },
      { titulo: 'Ask to be added to an accountant directory', estado: 'done' as const, nota: 'You sent the request to the directory' },
      { titulo: 'Add your prices to the services page', estado: 'in_progress' as const, nota: 'Claude Code picked it up' },
    ],
    pantallaRondas: ['First', 'At 2 weeks', 'At 6 weeks'],
    pantallaHistorialNota: 'AI answers change from one week to the next, so it measures more than once.',

    vivoTitulo: 'Your agent works where you already work.',
    vivoTexto: 'You talk to it on Telegram, Slack, the dashboard or your AI assistant. Talking to it is free; credits pay for the work it does.',
    vivo: [
      { clave: 'telegram' as const, nombre: 'Telegram', texto: 'You text it like a person and it answers with your business data.' },
      { clave: 'slack' as const, nombre: 'Slack', texto: "Add it to your team's Slack and anyone in the channel can ask by mentioning @Peaje." },
      { clave: 'panel' as const, nombre: 'The dashboard', texto: 'See your tasks, every measurement and who AI cites instead of you.' },
      {
        clave: 'asistente' as const,
        nombre: 'Your AI assistant',
        texto: 'Ask about your business from Claude, ChatGPT or Cursor, and Claude Code or Cursor pick up the tasks.',
      },
    ],

    precioTitulo: (p: Precio) => `The Radar is free. The agent costs US$${p.founder} a month.`,
    precioTexto: (p: Precio) =>
      `That is the founder price for the first ${p.cupos} businesses, and you keep it while you stay subscribed. After that, Pro costs US$${p.pro} a month.`,
    precioGratis: (p: Precio) => `With a free account you get ${p.regaloInformes} reports and ${p.regaloRespuestas} answers to try the agent.`,
    precioPlan: 'Pro',
    precioUnidad: 'a month',
    precioCosto: (p: Precio) => `US$${p.founder} a month, founder price`,
    precioPuntos: (p: Paquete) => [
      { fuerte: `${p.paginas} pages a month`, resto: ', written from the facts on your site' },
      { fuerte: `${p.preguntas} questions your customers ask`, resto: ` tracked in ${asistentesMedidos('en')}` },
      { fuerte: 'A new measurement of each page', resto: ' at 2 and 6 weeks' },
      { fuerte: `${p.informes} reports on demand`, resto: ' (plan, citation check, task search)' },
      { fuerte: `${p.respuestas} answers with your data`, resto: ' from your agent, in the dashboard, Telegram or your AI tool' },
      { fuerte: 'Daily monitor, fix tasks and weekly report', resto: ' with no limit' },
    ],
    verPrecios: 'See the full pricing details',

    faqTitulo: 'Questions',
    faqTodas: 'See all questions',
    faqRuta: '/faq',

    cierreTitulo: 'See who AI recommends when people ask for what you sell.',
    cierreTexto: 'The Radar is free and needs no card, just your email so we can send you the result.',
  },
}
