const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** "A, B y C", sin cortar. */
const listaCompleta = (locale: 'es' | 'en', xs: string[]) =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(xs)

/** "A, B y C"; con más de tres, los tres primeros y cuántos más. */
const lista = (locale: 'es' | 'en', xs: string[]) => {
  const f = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
  if (xs.length <= 3) return f.format(xs)
  const resto = xs.length - 3
  return f.format([...xs.slice(0, 3), locale === 'es' ? `${resto} más` : `${resto} more`])
}

export const radar = {
  es: {
    // Hero
    eyebrow: 'Radar gratis',
    tituloA: 'Cuando un agente de IA busca lo que ofreces,',
    tituloB: '¿te encuentra?',
    texto:
      'Pon tu sitio. Revisamos lo que encuentra un agente de IA cuando llega: si puede leerte, si entiende qué ofreces y cuánto cobras, y qué le falta. Te mostramos tu puntaje de hoy, hasta dónde sube con Peaje y por dónde empezar.',
    correo: 'Tu correo',
    correoPlaceholder: 'tu@empresa.com',
    sitio: 'Tu sitio',
    placeholder: 'tusitio.com',
    consentimiento: 'Mándame consejos para que los agentes de IA me encuentren. Puedes darte de baja cuando quieras.',
    boton: 'Medir mi sitio gratis',
    enviando: 'Un momento…',
    // Lo que de verdad sale por correo (app/radar/correo-actions.ts y el gateway, radar.ts): el
    // reporte del dominio con el enlace al resultado, después de cada medición o con "Mándame el
    // informe". No hay secuencia de seguimiento; los consejos solo con la casilla marcada.
    letraChica:
      'Solo tu correo y tu dominio: sin cuenta y sin tarjeta. Tu resultado se abre aquí y también te llega por correo, con su enlace, para que no lo pierdas. Fuera de eso, solo te escribimos si marcas la casilla de consejos, y nunca te llamamos para venderte.',
    faltaCorreo: 'Escribe tu correo.',
    faltaSitio: 'Escribe tu sitio, por ejemplo tusitio.com.',
    pideCorreo: (dominio: string) => `Para medir ${dominio} déjanos tu correo. Te mandamos el resultado.`,
    otroSitio: 'Medir otro sitio',

    // Ejemplo (columna derecha)
    ejemplo: 'Ejemplo',
    ejemploDominio: 'ejemplo.com',
    ejemploFrase: 'Los agentes entienden 14 de 29 cosas.',
    ejemploPrimero: 'Lo primero: una guía de tu sitio para los agentes',
    ejemploPuntos: '+6 puntos',

    // Medición en vivo (app/radar/en-vivo.tsx)
    vivo: {
      titulo: 'Midiendo tu sitio',
      segundos: (s: number) => `${s} s`,
      pasos: {
        encuentran: { pregunta: '¿Te encuentran?', que: 'Revisando robots.txt, sitemap y llms.txt' },
        usan: { pregunta: '¿Te pueden usar?', que: 'Buscando servidor MCP y páginas que los agentes entiendan' },
        compran: { pregunta: '¿Te pueden comprar?', que: 'Buscando tus precios y si un agente te puede pagar' },
      },
      calculando: 'Calculando tu puntaje',
      dejaAbierta: 'Deja esta pestaña abierta. Tu resultado aparece aquí solo.',
      lento: 'Está tardando un poco más de lo normal. Seguimos revisando tu sitio.',
      estado: { listo: 'Listo', revisando: 'Revisando', pendiente: 'Pendiente', 'sin-datos': 'No se pudo revisar' },
      tono: { bien: 'Bien', falta: 'Falta', nota: 'Nota' },
    },
    // Lo que encuentran las sondas (lib/radar/sondas.ts): solo lo que respondió el sitio.
    hallazgo: {
      sitioInalcanzable: 'No pudimos abrir tu sitio desde aquí. La medición sigue.',
      sitioBloqueado: (status: number) => `Tu página principal no dejó entrar a nuestro revisor (respondió ${status}).`,
      robotsAbierto: 'Tu robots.txt deja entrar a los buscadores con IA',
      robotsSinArchivo: 'No tienes robots.txt: nada bloquea a los agentes',
      robotsBloquea: (bots: string[]) => `Tu robots.txt bloquea a ${lista('es', bots)}: no pueden leer tu sitio`,
      robotsBloqueaTodos: 'Tu robots.txt bloquea a todos los robots, también a los de IA',
      robotsBloqueaIa: 'Tu robots.txt bloquea a todos los bots de IA que revisamos, como GPTBot, ClaudeBot y PerplexityBot',
      sitemapOk: (paginas: number | null) =>
        paginas ? `Tu sitemap se lee bien (${paginas.toLocaleString('es')} ${paginas === 1 ? 'página' : 'páginas'})` : 'Tu sitemap se lee bien',
      sitemapFalta: 'No encontramos tu sitemap: los agentes no ven la lista de tus páginas',
      llmsOk: 'Ya tienes llms.txt, la guía de tu sitio para agentes',
      llmsFalta: 'Aún no tienes llms.txt. Impleméntalo con el kit.',
      mcpOk: 'Tienes servidor MCP: los agentes pueden usar tu sitio como herramienta',
      mcpFalta: 'No encontramos servidor MCP en tu sitio. Impleméntalo con el kit.',
      openapiOk: 'Tu API está descrita en openapi.json',
      openapiFalta: 'No encontramos openapi.json, la lista de lo que un agente le puede pedir a tu sitio. Impleméntalo con el kit.',
      jsonldOk: (tipos: string[]) =>
        tipos.length > 0 ? `Tu página principal les dice a los agentes qué eres (${tipos.join(', ')})` : 'Tu página principal les dice a los agentes qué eres',
      jsonldInvalido: 'Tu página principal tiene datos para agentes (JSON-LD), pero no se pueden leer. Con el kit los implementas bien.',
      jsonldFalta: 'Tu página principal no les dice a los agentes qué eres (JSON-LD). Impleméntalo con el kit.',
      preciosMd: 'Tus precios están en pricing.md, donde los buscan los agentes',
      preciosDatos: 'Tu página principal trae precios que un agente puede leer',
      preciosPagina: 'Tienes página de precios, pero no en un formato que lea un agente. Implementa pricing.md con el kit.',
      preciosFalta: 'No encontramos tus precios en un formato que lea un agente. Implementa pricing.md con el kit.',
      pagosOk: (metodos: string[]) => `Publicas cómo te puede pagar un agente (${metodos.join(', ')})`,
      pagosFalta: 'No encontramos una forma de que un agente te pague. Impleméntala con el kit.',
      nose: {
        robots: 'No alcanzamos a revisar tu robots.txt',
        sitemap: 'No alcanzamos a revisar tu sitemap',
        llms: 'No alcanzamos a revisar tu llms.txt',
        mcp: 'No alcanzamos a revisar si tienes servidor MCP',
        openapi: 'No alcanzamos a revisar tu openapi.json',
        jsonld: 'No alcanzamos a leer tu página principal',
        precios: 'No alcanzamos a revisar tus precios',
        pagos: 'No alcanzamos a revisar cómo te pagan los agentes',
      },
    },
    volverAMedir: 'Volver a medir',
    invalido: 'Escribe un dominio público, por ejemplo tusitio.com.',
    fallo: 'No pudimos medir ese sitio ahora. Prueba de nuevo en un minuto.',
    inalcanzable: (dominio: string) => `No pudimos abrir ${dominio}. Revisa que esté bien escrito y que el sitio esté publicado.`,
    limite: 'Muchas mediciones seguidas. Prueba de nuevo en un rato.',
    sinCorreoParaMedir: 'Para medir un sitio, primero déjanos tu correo en el formulario.',

    // 01
    s01: 'Tu puntaje y qué significa',
    frase: (x: number, y: number, dominio: string) => `Los agentes de IA entienden ${x} de las ${y} cosas que buscan en ${dominio}.`,
    hoyFrase: (n: number, max: number, nota: string) => `Hoy: ${n} de ${max} (${nota}).`,
    conPeajeFrase: (n: number, nota: string) => `Con Peaje: hasta ~${n} (${nota}).`,
    hoy: 'Hoy',
    conPeaje: 'Con Peaje, hasta',
    puedeLlegar: (estimado: number, margen: number) =>
      `Puede llegar a ${estimado} con Peaje: hasta ${fmt(margen)} ${margen === 1 ? 'punto' : 'puntos'} más.`,
    yaAlto: 'Tu sitio ya pasa todo lo que Peaje cubre.',
    nota: 'El puntaje lo calcula Ora (ora.ai), un medidor independiente de qué tan listo está un sitio para agentes. El número con Peaje es una estimación de lo que el kit arregla, no una promesa.',
    compartirTexto: 'Mándaselo a quien maneja tu web: cualquiera con el enlace puede ver este resultado.',
    copiarEnlace: 'Copiar enlace',
    enlaceCopiado: 'Enlace copiado',
    parcial: 'Ora no terminó de medir todo tu sitio. Lo que falta aparece con "—" más abajo.',
    medido: (fecha: string) => `Medido el ${fecha}.`,
    medicionVieja: (dias: number) =>
      `Esta medición tiene ${dias} días: tu sitio puede haber cambiado. Vuelve a medir para ver cómo está hoy.`,

    // 02
    s02: 'Lo que falta',
    ordenNota: 'Primero lo fácil y, dentro de eso, lo que más sube tu puntaje.',
    kitCuenta: (n: number, total: number) =>
      n === total
        ? total === 1
          ? 'Puedes implementarla con el kit de Peaje.'
          : `Puedes implementar las ${total} con el kit de Peaje.`
        : `Puedes implementar ${n} de estas con el kit de Peaje.`,
    implementaKit: 'Impleméntalo con el kit',
    loPonePeaje: 'lo pone Peaje',
    nadaQueArreglar: 'No falta nada de lo que se pudo medir.',
    nadaDelKit: 'Ya tienes todo lo que implementa el kit de Peaje.',
    sinMedir: (n: number) => `No se pudo medir (${n})`,
    sinMedirNota: 'Esta parte no se pudo medir hoy. No la contamos ni a favor ni en contra.',
    puntos: (n: number) => `+${fmt(n)}`,

    // Citas: qué responde la IA a las preguntas de compra (app/radar/citas-vista.tsx)
    citas: {
      ejemplo: 'Ejemplo con datos inventados (solo en desarrollo)',
      tituloNeutro: 'Lo que responde la IA cuando tus clientes preguntan',
      tituloOtros: 'Cuando tus clientes preguntan, la IA recomienda a otros',
      tituloAVeces: 'La IA te cita a veces. El resto del tiempo recomienda a otros',
      tituloTe: 'Cuando tus clientes preguntan, la IA te cita',
      cargando: (motores: string[]) => `Preguntándole a ${listaCompleta('es', motores)}…`,
      cargandoNota: 'Puede tardar hasta un minuto. Mientras, sigue leyendo tu resultado.',
      intro: (n: number, motores: string[]) =>
        `Les hicimos a ${listaCompleta('es', motores)} ${n === 1 ? 'una pregunta' : `${n} preguntas`} de alguien que busca lo que ofreces.`,
      cobertura: (p: number) => `Te cita en el ${p}\u00a0%`,
      sinRespuestas: 'No contestó',
      preguntas: 'Las preguntas',
      marca: { citado: 'Te cita', mencionado: 'Te nombra, sin enlace', no: 'No apareces', sinRespuesta: 'No contestó' },
      enTuLugar: 'A quién cita la IA en tu lugar',
      veces: (n: number) => `×${n}`,
      kind: { publisher: 'medio', competitor: 'competencia' },
      agente:
        'Tu agente sigue estas preguntas cada semana, te dice qué publicar, te escribe las páginas y vuelve a medir a las 2 y a las 6 semanas.',
      cta: (usd: number) => `Que mi agente lo arregle: US$${usd}`,
      fecha: (fecha: string) => `Lo que respondió la IA el ${fecha}. Sus respuestas cambian de un día a otro.`,
      errorBudget: 'Por hoy el radar gratis ya hizo todas las preguntas a la IA que podía. Tu agente se las hace por ti cada semana.',
      errorOtro: 'Ahora no pudimos preguntarle a la IA por tu sitio. Tu agente se lo pregunta cada semana.',
    },

    // 03
    s03: 'Lo que ya haces bien',
    yaBien: (n: number) => `Lo que ya haces bien (${n})`,
    nadaBien: 'Todavía nada. Por eso conviene empezar por arriba.',

    // 04
    s04: 'Arreglémoslo',
    cierreTitulo: 'Tu agente trabaja para que la IA te recomiende.',
    cierreTexto:
      'El agente de Peaje vive en tu Telegram. Mide si ChatGPT, Claude y Perplexity te citan cuando preguntan por lo que ofreces, te dice qué publicar, te escribe las páginas y te cuenta cada semana cuánto vas mejorando. Precio de fundador: US$30 al mes para los primeros 50 negocios. Precio normal: US$69 al mes.',
    cta: (usd: number) => `Activar mi agente: US$${usd}`,
    ctaNota: 'Creas tu cuenta con tu correo y pagas en el paso siguiente. Cancelas cuando quieras desde tu panel, sin llamadas.',
    soloTecnico: '¿Solo quieres lo técnico?',
    instalaKit: 'Instala el kit gratis',
    recargada: 'Actualizamos la página, vuelve a intentarlo.',
    informe: 'Mándame el informe',
    informeEnviar: 'Mandar',
    informeListo: 'Listo. Te mandamos el informe a tu correo en unos minutos.',
    informeFallo: 'No pudimos mandar el informe ahora. Prueba de nuevo en un rato.',

    // Metadata
    metaTitulo: (dominio: string) => `Cómo ven los agentes de IA a ${dominio} · Peaje`,
    metaDescripcion: (dominio: string, linea: string) => `${linea} Mira qué encuentra un agente de IA en ${dominio}.`,
    metaTituloGeneral: 'Radar gratis · Peaje',
    metaDescripcionGeneral: 'Mira qué encuentra un agente de IA cuando llega a tu sitio y hasta dónde sube tu puntaje con Peaje.',
  },
  en: {
    eyebrow: 'Free radar',
    tituloA: 'When an AI agent looks for what you offer,',
    tituloB: 'does it find you?',
    texto:
      'Enter your site. We check what an AI agent finds when it arrives: whether it can read you, whether it understands what you offer and what you charge, and what is missing. You get your score today, how far it goes with Peaje and where to start.',
    correo: 'Your email',
    correoPlaceholder: 'you@company.com',
    sitio: 'Your site',
    placeholder: 'yoursite.com',
    consentimiento: 'Send me tips so AI agents can find me. You can unsubscribe anytime.',
    boton: 'Measure my site for free',
    enviando: 'One moment…',
    letraChica:
      'Just your email and your domain: no account and no card. Your result opens here and also lands in your inbox, with its link, so you do not lose it. Beyond that, we only email you if you tick the tips box, and we never call you to sell.',
    faltaCorreo: 'Enter your email.',
    faltaSitio: 'Enter your site, for example yoursite.com.',
    pideCorreo: (dominio: string) => `To measure ${dominio}, leave us your email. We send you the result.`,
    otroSitio: 'Measure another site',

    ejemplo: 'Example',
    ejemploDominio: 'example.com',
    ejemploFrase: 'Agents understand 14 of 29 things.',
    ejemploPrimero: 'First: a guide to your site for agents',
    ejemploPuntos: '+6 points',

    vivo: {
      titulo: 'Measuring your site',
      segundos: (s: number) => `${s} s`,
      pasos: {
        encuentran: { pregunta: 'Can they find you?', que: 'Checking robots.txt, sitemap and llms.txt' },
        usan: { pregunta: 'Can they use you?', que: 'Looking for an MCP server and pages agents understand' },
        compran: { pregunta: 'Can they buy from you?', que: 'Looking for your prices and whether an agent can pay you' },
      },
      calculando: 'Working out your score',
      dejaAbierta: 'Keep this tab open. Your result shows up here on its own.',
      lento: 'This is taking a bit longer than usual. We are still checking your site.',
      estado: { listo: 'Done', revisando: 'Checking', pendiente: 'Pending', 'sin-datos': 'Could not be checked' },
      tono: { bien: 'Good', falta: 'Missing', nota: 'Note' },
    },
    hallazgo: {
      sitioInalcanzable: 'We could not open your site from here. The measurement goes on.',
      sitioBloqueado: (status: number) => `Your homepage did not let our checker in (it answered ${status}).`,
      robotsAbierto: 'Your robots.txt lets AI search engines in',
      robotsSinArchivo: 'You have no robots.txt, so nothing blocks agents',
      robotsBloquea: (bots: string[]) => `Your robots.txt blocks ${lista('en', bots)}, so they cannot read your site`,
      robotsBloqueaTodos: 'Your robots.txt blocks every bot, AI ones included',
      robotsBloqueaIa: 'Your robots.txt blocks every AI bot we checked, like GPTBot, ClaudeBot and PerplexityBot',
      sitemapOk: (paginas: number | null) =>
        paginas ? `Your sitemap reads fine (${paginas.toLocaleString('en')} ${paginas === 1 ? 'page' : 'pages'})` : 'Your sitemap reads fine',
      sitemapFalta: 'We could not find your sitemap, so agents do not see the list of your pages',
      llmsOk: 'You already have llms.txt, the guide to your site for agents',
      llmsFalta: 'You do not have llms.txt yet. Implement it with the kit.',
      mcpOk: 'You have an MCP server, so agents can use your site as a tool',
      mcpFalta: 'We found no MCP server on your site. Implement it with the kit.',
      openapiOk: 'Your API is described in openapi.json',
      openapiFalta: 'We could not find openapi.json, the list of what an agent can ask your site for. Implement it with the kit.',
      jsonldOk: (tipos: string[]) =>
        tipos.length > 0 ? `Your homepage tells agents what you are (${tipos.join(', ')})` : 'Your homepage tells agents what you are',
      jsonldInvalido: 'Your homepage has data for agents (JSON-LD), but it cannot be read. Implement readable ones with the kit.',
      jsonldFalta: 'Your homepage does not tell agents what you are (JSON-LD). Implement it with the kit.',
      preciosMd: 'Your prices are in pricing.md, where agents look for them',
      preciosDatos: 'Your homepage has prices an agent can read',
      preciosPagina: 'You have a pricing page, but not in a format an agent reads. Implement pricing.md with the kit.',
      preciosFalta: 'We could not find your prices in a format an agent reads. Implement pricing.md with the kit.',
      pagosOk: (metodos: string[]) => `You publish how an agent can pay you (${metodos.join(', ')})`,
      pagosFalta: 'We found no way for an agent to pay you. Implement one with the kit.',
      nose: {
        robots: 'We could not check your robots.txt in time',
        sitemap: 'We could not check your sitemap in time',
        llms: 'We could not check your llms.txt in time',
        mcp: 'We could not check for an MCP server in time',
        openapi: 'We could not check your openapi.json in time',
        jsonld: 'We could not read your homepage in time',
        precios: 'We could not check your prices in time',
        pagos: 'We could not check how agents can pay you in time',
      },
    },
    volverAMedir: 'Measure again',
    invalido: 'Enter a public domain, for example yoursite.com.',
    fallo: 'We could not measure that site right now. Try again in a minute.',
    inalcanzable: (dominio: string) => `We could not open ${dominio}. Check the spelling and that the site is published.`,
    limite: 'Too many measurements in a row. Try again in a while.',
    sinCorreoParaMedir: 'To measure a site, first leave us your email in the form.',

    s01: 'Your score and what it means',
    frase: (x: number, y: number, dominio: string) => `AI agents understand ${x} of the ${y} things they look for on ${dominio}.`,
    hoyFrase: (n: number, max: number, nota: string) => `Today: ${n} out of ${max} (${nota}).`,
    conPeajeFrase: (n: number, nota: string) => `With Peaje: up to ~${n} (${nota}).`,
    hoy: 'Today',
    conPeaje: 'With Peaje, up to',
    puedeLlegar: (estimado: number, margen: number) =>
      `It can reach ${estimado} with Peaje: up to ${fmt(margen)} more ${margen === 1 ? 'point' : 'points'}.`,
    yaAlto: 'Your site already passes everything Peaje covers.',
    nota: 'The score comes from Ora (ora.ai), an independent measure of how ready a site is for agents. The number with Peaje is an estimate of what the kit fixes, not a promise.',
    compartirTexto: 'Send it to whoever runs your website: anyone with the link can see this result.',
    copiarEnlace: 'Copy link',
    enlaceCopiado: 'Link copied',
    parcial: 'Ora did not finish measuring your whole site. What is missing shows up with "—" below.',
    medido: (fecha: string) => `Measured on ${fecha}.`,
    medicionVieja: (dias: number) =>
      `This measurement is ${dias} days old, so your site may have changed. Measure again to see how it looks today.`,

    s02: 'What is missing',
    ordenNota: 'Easy things first and, within those, what raises your score the most.',
    kitCuenta: (n: number, total: number) =>
      n === total
        ? total === 1
          ? "You can implement it with Peaje's kit."
          : `You can implement all ${total} with Peaje's kit.`
        : `You can implement ${n} of these with Peaje's kit.`,
    implementaKit: 'Implement it with the kit',
    loPonePeaje: 'Peaje adds it',
    nadaQueArreglar: 'Nothing is missing from what could be measured.',
    nadaDelKit: "You already have everything Peaje's kit implements.",
    sinMedir: (n: number) => `Could not be measured (${n})`,
    sinMedirNota: 'This part could not be measured today. We do not count it for or against you.',
    puntos: (n: number) => `+${fmt(n)}`,

    citas: {
      ejemplo: 'Sample with made-up data (development only)',
      tituloNeutro: 'What AI answers when your buyers ask',
      tituloOtros: 'When your buyers ask, AI recommends others',
      tituloAVeces: 'AI cites you sometimes. The rest of the time it recommends others',
      tituloTe: 'When your buyers ask, AI cites you',
      cargando: (motores: string[]) => `Asking ${listaCompleta('en', motores)}…`,
      cargandoNota: 'It can take up to a minute. Meanwhile, keep reading your result.',
      intro: (n: number, motores: string[]) =>
        `We asked ${listaCompleta('en', motores)} ${n === 1 ? 'one question' : `${n} questions`} from someone looking for what you offer.`,
      cobertura: (p: number) => `Cites you ${p}% of the time`,
      sinRespuestas: 'Did not answer',
      preguntas: 'The questions',
      marca: { citado: 'Cites you', mencionado: 'Names you, no link', no: 'You do not show up', sinRespuesta: 'Did not answer' },
      enTuLugar: 'Who AI cites instead of you',
      veces: (n: number) => `×${n}`,
      kind: { publisher: 'publisher', competitor: 'competitor' },
      agente:
        'Your agent tracks these questions every week, tells you what to publish, writes the pages and checks again at 2 and 6 weeks.',
      cta: (usd: number) => `Let my agent fix it: US$${usd}`,
      fecha: (fecha: string) => `What AI answered on ${fecha}. Its answers change from one day to the next.`,
      errorBudget: 'The free radar already asked AI all the questions it could today. Your agent asks them for you every week.',
      errorOtro: 'We could not ask AI about your site right now. Your agent asks every week.',
    },

    s03: 'What you already do well',
    yaBien: (n: number) => `What you already do well (${n})`,
    nadaBien: 'Nothing yet. That is why it pays to start at the top.',

    s04: "Let's fix it",
    cierreTitulo: 'Your agent works on getting AI to recommend you.',
    cierreTexto:
      'The Peaje agent lives in your Telegram. It tracks whether ChatGPT, Claude and Perplexity cite you when people ask about what you offer, tells you what to publish, writes the pages and tells you every week how much you are improving. Founder price: US$30 a month for the first 50 businesses. Regular price: US$69 a month.',
    cta: (usd: number) => `Turn on my agent: US$${usd}`,
    ctaNota: 'You create your account with your email and pay in the next step. Cancel anytime from your dashboard, no calls.',
    soloTecnico: 'Just want the technical part?',
    instalaKit: 'Install the free kit',
    recargada: 'We refreshed the page, please try again.',
    informe: 'Email me the report',
    informeEnviar: 'Send',
    informeListo: 'Done. The report is on its way to your email in a few minutes.',
    informeFallo: 'We could not send the report right now. Try again in a while.',

    metaTitulo: (dominio: string) => `How AI agents see ${dominio} · Peaje`,
    metaDescripcion: (dominio: string, linea: string) => `${linea} See what an AI agent finds on ${dominio}.`,
    metaTituloGeneral: 'Free radar · Peaje',
    metaDescripcionGeneral: 'See what an AI agent finds when it reaches your site and how far your score goes with Peaje.',
  },
}
