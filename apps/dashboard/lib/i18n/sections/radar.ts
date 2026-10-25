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
    letraChica: 'Solo tu correo y tu dominio: sin cuenta y sin tarjeta. Tu resultado se abre aquí cuando esté listo.',
    faltaCorreo: 'Escribe tu correo.',
    faltaSitio: 'Escribe tu sitio, por ejemplo tusitio.com.',
    pideCorreo: (dominio: string) => `Para medir ${dominio} déjanos tu correo. Te mandamos el resultado.`,
    otroSitio: 'Medir otro sitio',

    // Ejemplo (columna derecha)
    ejemplo: 'Ejemplo',
    ejemploDominio: 'ejemplo.com',
    ejemploFrase: 'Los agentes entienden 14 de 29 cosas.',
    ejemploPrimero: 'Lo primero: un archivo que explica tu sitio a los agentes (llms.txt)',
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

    // 02
    s02: 'Empieza por aquí',
    primero: (titulo: string, puntos: number) => `Lo primero: ${titulo} (+${fmt(puntos)} puntos).`,
    copiarArreglo: 'Copiar instrucciones para mi agente de código',
    instruccionesCopiadas: 'Instrucciones copiadas',
    nadaPrimero: 'Tu sitio ya pasa todo lo que Peaje cubre. No hay un primer arreglo que proponerte.',
    promptArreglo: (dominio: string, titulo: string, archivo: string, que: string, radarUrl: string) =>
      `En el repo de mi sitio (${dominio}) quiero arreglar una cosa para que los agentes de IA lo entiendan mejor: ${titulo} (${archivo}).${
        que ? ` Lo que dice el medidor: ${que}` : ''
      } Haz solo ese cambio, sin tocar lo demás, y dime qué archivos cambiaste. Cuando esté publicado, vuelvo a medir en ${radarUrl}.`,
    promptArregloGateway: (dominio: string, titulo: string, signupUrl: string) =>
      `En el repo de mi sitio (${dominio}) quiero arreglar esto para los agentes de IA: ${titulo}. Esta parte la pone Peaje desde su servidor, así que primero creo la cuenta gratis en ${signupUrl} y te paso el identificador del negocio (slug). Con ese slug, en Next.js corre \`npx @peaje/cli@1 init <slug> --yes\`; en otro stack sigue las instrucciones que da \`npx @peaje/cli@1 plan <slug>\`.`,

    // 03
    s03: 'Lo que falta',
    loArreglaPeaje: (n: number) => (n === 1 ? 'Esto lo arregla Peaje (1)' : `Esto lo arregla Peaje (${n})`),
    loPonePeaje: 'lo pone Peaje',
    enlaceEnPagina: 'enlace en tu página',
    nadaQueArreglar: 'No falta nada de lo que Peaje cubre.',
    otrasFaltan: (n: number) => `Otras cosas que faltan y el kit no cubre (${n})`,
    sinMedir: (n: number) => `No se pudo medir (${n})`,
    sinMedirNota: 'Esta parte no se pudo medir hoy. No la contamos ni a favor ni en contra.',
    puntos: (n: number) => `+${fmt(n)}`,

    // 04
    s04: 'Lo que ya haces bien',
    yaBien: (n: number) => `Lo que ya haces bien (${n})`,
    nadaBien: 'Todavía nada. Por eso conviene empezar por arriba.',

    // 05
    s05: 'Déjanos arreglarlo',
    queIncluye:
      'Gratis ves el diagnóstico. Con Peaje tienes tu propio agente en Telegram: te explica qué falta, te entrega los arreglos listos, te muestra cómo vas mejorando y cada semana te cuenta cuántos agentes de IA visitaron tu sitio.',
    cierreTitulo: 'Ese es el diagnóstico. Ahora tu agente lo arregla contigo.',
    cierreTexto:
      'Agrega el agente de Peaje a tu Telegram. Te dice qué falla, te pregunta lo que necesita y te entrega los cambios listos para tu sitio, incluido el kit de Peaje para que los agentes también puedan pagarte. Precio de fundador: US$30 al mes (después será US$69).',
    cta: 'Empezar por US$30 al mes',
    ctaNota: 'Creas tu cuenta con tu correo y activas el agente desde tu panel.',
    hazloTu: 'Prefiero hacerlo yo: copiar las instrucciones',
    promptCompleto: (dominio: string, signupUrl: string, faltan: string[]) =>
      `Instala Peaje en el repo de mi sitio (${dominio}) para que los agentes de IA lo entiendan y puedan pagarme. Primero creo la cuenta gratis en ${signupUrl} y te paso el identificador del negocio (slug). Con ese slug, si es Next.js corre \`npx @peaje/cli@1 init <slug> --yes\`; si es otro stack, corre \`npx @peaje/cli@1 plan <slug>\` y sigue lo que indica.${
        faltan.length > 0 ? ` Hoy falta: ${faltan.join(', ')}.` : ''
      } No reescribas los archivos que baja el kit. Cuando esté publicado, corre \`npx @peaje/cli@1 verify <slug>\` y arregla solo lo que salga en falso.`,

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
    letraChica: 'Just your email and your domain: no account and no card. Your result opens here when it is ready.',
    faltaCorreo: 'Enter your email.',
    faltaSitio: 'Enter your site, for example yoursite.com.',
    pideCorreo: (dominio: string) => `To measure ${dominio}, leave us your email. We send you the result.`,
    otroSitio: 'Measure another site',

    ejemplo: 'Example',
    ejemploDominio: 'example.com',
    ejemploFrase: 'Agents understand 14 of 29 things.',
    ejemploPrimero: 'First: a file that explains your site to agents (llms.txt)',
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

    s02: 'Start here',
    primero: (titulo: string, puntos: number) => `First: ${titulo} (+${fmt(puntos)} points).`,
    copiarArreglo: 'Copy instructions for my coding agent',
    instruccionesCopiadas: 'Instructions copied',
    nadaPrimero: 'Your site already passes everything Peaje covers. There is no first fix to suggest.',
    promptArreglo: (dominio: string, titulo: string, archivo: string, que: string, radarUrl: string) =>
      `In my site's repo (${dominio}) I want to fix one thing so AI agents understand it better: ${titulo} (${archivo}).${
        que ? ` What the scanner says: ${que}` : ''
      } Make only that change, leave everything else alone, and tell me which files you changed. Once it is live, I will measure again at ${radarUrl}.`,
    promptArregloGateway: (dominio: string, titulo: string, signupUrl: string) =>
      `In my site's repo (${dominio}) I want to fix this for AI agents: ${titulo}. Peaje provides this part from its own server, so first I create the free account at ${signupUrl} and give you the business id (slug). With that slug, on Next.js run \`npx @peaje/cli@1 init <slug> --yes\`; on another stack follow what \`npx @peaje/cli@1 plan <slug>\` prints.`,

    s03: 'What is missing',
    loArreglaPeaje: (n: number) => `Peaje fixes this (${n})`,
    loPonePeaje: 'Peaje adds it',
    enlaceEnPagina: 'link on your page',
    nadaQueArreglar: 'Nothing that Peaje covers is missing.',
    otrasFaltan: (n: number) => `Other things missing that the kit does not cover (${n})`,
    sinMedir: (n: number) => `Could not be measured (${n})`,
    sinMedirNota: 'This part could not be measured today. We do not count it for or against you.',
    puntos: (n: number) => `+${fmt(n)}`,

    s04: 'What you already do well',
    yaBien: (n: number) => `What you already do well (${n})`,
    nadaBien: 'Nothing yet. That is why it pays to start at the top.',

    s05: 'Let us fix it',
    queIncluye:
      'The diagnosis is free. With Peaje you get your own agent on Telegram: it explains what is missing, hands you the fixes ready to go, shows you how you are improving and tells you every week how many AI agents visited your site.',
    cierreTitulo: 'That is the diagnosis. Now your agent fixes it with you.',
    cierreTexto:
      'Add the Peaje agent to your Telegram. It tells you what fails, asks for what it needs and hands you the changes ready for your site, including the Peaje kit so agents can also pay you. Founder price: US$30 a month (later it will be US$69).',
    cta: 'Start for US$30 a month',
    ctaNota: 'You create your account with your email and turn on the agent from your dashboard.',
    hazloTu: 'I would rather do it myself: copy the instructions',
    promptCompleto: (dominio: string, signupUrl: string, faltan: string[]) =>
      `Install Peaje in my site's repo (${dominio}) so AI agents understand it and can pay me. First I create the free account at ${signupUrl} and give you the business id (slug). With that slug, on Next.js run \`npx @peaje/cli@1 init <slug> --yes\`; on another stack run \`npx @peaje/cli@1 plan <slug>\` and follow what it says.${
        faltan.length > 0 ? ` Missing today: ${faltan.join(', ')}.` : ''
      } Do not rewrite the files the kit downloads. Once it is live, run \`npx @peaje/cli@1 verify <slug>\` and fix only what comes back false.`,

    metaTitulo: (dominio: string) => `How AI agents see ${dominio} · Peaje`,
    metaDescripcion: (dominio: string, linea: string) => `${linea} See what an AI agent finds on ${dominio}.`,
    metaTituloGeneral: 'Free radar · Peaje',
    metaDescripcionGeneral: 'See what an AI agent finds when it reaches your site and how far your score goes with Peaje.',
  },
}
