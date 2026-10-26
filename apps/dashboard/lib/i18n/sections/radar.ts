const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

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

    // Medición
    midiendo: 'Midiendo tu sitio. Tarda unos 30 segundos…',
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
    sube: (n: number) => `Puede subir hasta ${n} puntos con lo que Peaje arregla.`,
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
    tuAgenteCuenta: (n: number, total: number) =>
      n === total ? (total === 1 ? 'Tu agente la arregla.' : `Tu agente arregla las ${total}.`) : `Tu agente arregla ${n} de estas ${total}.`,
    tuAgente: 'Lo arregla tu agente',
    esfuerzo: { facil: 'Fácil', medio: 'Pide más trabajo', dificil: 'Toma más tiempo' },
    masTiempo: 'También suben tu puntaje, con más trabajo',
    notaDificil:
      'Dependen de otros, como Google, Wikipedia u OpenAI, o de que alguien programe algo nuevo. No salen en una tarde: déjalas para después de lo de arriba.',
    notaMedio: 'Piden a alguien que programe. No salen en una tarde: déjalas para después de lo de arriba.',
    loPonePeaje: 'lo pone Peaje',
    nadaQueArreglar: 'No falta nada de lo que se pudo medir.',
    sinMedir: (n: number) => `No se pudo medir (${n})`,
    sinMedirNota: 'Esta parte no se pudo medir hoy. No la contamos ni a favor ni en contra.',
    puntos: (n: number) => `+${fmt(n)}`,

    // 03
    s03: 'Lo que ya haces bien',
    yaBien: (n: number) => `Lo que ya haces bien (${n})`,
    nadaBien: 'Todavía nada. Por eso conviene empezar por arriba.',

    // 04
    s04: 'Arreglémoslo',
    queIncluye:
      'Gratis ves el diagnóstico. Con Peaje tienes tu propio agente en Telegram: te dice qué falta, te pasa los arreglos listos, te muestra cómo vas mejorando y te cuenta cuántos agentes te visitaron, cada día, cada semana o cada mes, como prefieras.',
    cierreTitulo: 'Ese es el diagnóstico. Ahora tu agente lo arregla contigo.',
    cierreTexto:
      'Agrega el agente de Peaje a tu Telegram. Te dice qué falla, te pregunta lo que necesita y te entrega los cambios listos para tu sitio, incluido el kit de Peaje para que los agentes también puedan pagarte. Precio de fundador: US$30 al mes para los primeros 50 negocios. Precio normal: US$69 al mes.',
    cta: (usd: number) => `Tu agente lo arregla contigo: US$${usd}`,
    ctaNota: 'Creas tu cuenta con tu correo y pagas en el paso siguiente. Cancelas cuando quieras desde tu panel, sin llamadas.',
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

    midiendo: 'Measuring your site. It takes about 30 seconds…',
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
    sube: (n: number) => `It can go up as much as ${n} points with what Peaje fixes.`,
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
    tuAgenteCuenta: (n: number, total: number) =>
      n === total ? (total === 1 ? 'Your agent fixes it.' : `Your agent fixes all ${total}.`) : `Your agent fixes ${n} of these ${total}.`,
    tuAgente: 'Your agent fixes it',
    esfuerzo: { facil: 'Easy', medio: 'Takes more work', dificil: 'Takes longer' },
    masTiempo: 'These raise your score too, with more work',
    notaDificil:
      'They depend on others, like Google, Wikipedia or OpenAI, or on someone building something new. They will not happen in an afternoon, so leave them for after the list above.',
    notaMedio: 'They need someone who codes. They will not happen in an afternoon, so leave them for after the list above.',
    loPonePeaje: 'Peaje adds it',
    nadaQueArreglar: 'Nothing is missing from what could be measured.',
    sinMedir: (n: number) => `Could not be measured (${n})`,
    sinMedirNota: 'This part could not be measured today. We do not count it for or against you.',
    puntos: (n: number) => `+${fmt(n)}`,

    s03: 'What you already do well',
    yaBien: (n: number) => `What you already do well (${n})`,
    nadaBien: 'Nothing yet. That is why it pays to start at the top.',

    s04: "Let's fix it",
    queIncluye:
      'The diagnosis is free. With Peaje you get your own agent on Telegram: it tells you what is missing, hands you the fixes ready to go, shows you how you are improving and tells you how many agents visited you, daily, weekly or monthly, as you prefer.',
    cierreTitulo: 'That is the diagnosis. Now your agent fixes it with you.',
    cierreTexto:
      'Add the Peaje agent to your Telegram. It tells you what fails, asks for what it needs and hands you the changes ready for your site, including the Peaje kit so agents can also pay you. Founder price: US$30 a month for the first 50 businesses. Regular price: US$69 a month.',
    cta: (usd: number) => `Your agent fixes it with you: US$${usd}`,
    ctaNota: 'You create your account with your email and pay in the next step. Cancel anytime from your dashboard, no calls.',
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
