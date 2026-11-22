/**
 * "Así se vería tu panel" al final del resultado del Radar (app/radar/tu-panel.tsx).
 * Lo que es igual al panel real (tipos de tarea, impacto, "0 de 3 respuestas")
 * sale de `miAgente`; acá solo lo propio del bloque. Los títulos y razones de
 * "Pedir que te incluyan" y "Publicar la página" son los del agente
 * (apps/gateway/src/tareas/prioridad.ts): si cambian allá, cambian acá.
 */

const lista = (locale: 'es' | 'en', xs: string[]) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(xs)

export const radarPanel = {
  es: {
    titulo: 'Así se vería tu panel',
    intro: (dominio: string) =>
      `Lo armamos con lo que el Radar encontró hoy en ${dominio}. Es solo para mirar. Cuando creas tu cuenta, el agente revisa tu sitio otra vez y te deja tus tareas.`,
    soloLectura: 'Solo lectura',
    fixTitulo: 'Instalar el kit de Peaje',
    fixPorQue: (n: number) =>
      n === 1
        ? 'El Radar encontró una cosa que la IA busca en tu sitio y no está. El kit la agrega.'
        : `El Radar encontró ${n} cosas que la IA busca en tu sitio y no están. El kit las agrega de una vez.`,
    yMas: (n: number) => `Y ${n} más.`,
    mencionTitulo: (pregunta: string) => `Pedir que te incluyan donde la IA busca "${pregunta}"`,
    mencionPorQue: (sitios: string[]) =>
      `Para esta pregunta los asistentes de IA no citan tu sitio y sí citan páginas de otros (${sitios.join(', ')}). Si esas páginas te nombran, la IA tiene de dónde leer sobre tu negocio.`,
    paginaTitulo: (pregunta: string) => `Publicar la página "${pregunta}"`,
    paginaPorQue: (motores: string[]) =>
      `Cuando alguien pregunta esto, ${lista('es', motores)} no citan tu sitio. Una página que lo responda le da a la IA algo tuyo para citar.`,
    pie: {
      fix: 'Tu agente te da las instrucciones para tu IA.',
      mencion: 'Tu agente arma los pedidos. Tú los mandas.',
      pagina: 'Tu agente te deja el borrador listo.',
    } as Record<'fix' | 'mencion' | 'pagina', string>,
    hacer: 'Hacer esta tarea',
    esperandoTareas: 'Las tareas que salen de las respuestas de la IA aparecen cuando lleguen.',
    sinCitasTareas: 'Las tareas que salen de las respuestas de la IA te las arma el agente cuando entras.',
    vacio: 'Hoy el Radar no encontró tareas para tu sitio. Con tu cuenta, el agente sigue midiendo cada semana y te avisa cuando aparezca algo.',
    citasSub: (n: number) =>
      n === 1 ? 'En la pregunta del Radar. En tu panel, Peaje vuelve a medir cada semana.' : `En las ${n} preguntas del Radar. En tu panel, Peaje vuelve a medir cada semana.`,
    valor: (citadas: number, total: number) => `${citadas} de ${total} ${total === 1 ? 'respuesta' : 'respuestas'}`,
    sinRespuesta: 'No respondió esta vez',
    citasEsperando: 'Esperando las respuestas de la IA.',
    citasError: 'Esta vez no pudimos preguntarle a la IA. En tu panel, Peaje lo mide cada semana.',
    marca: (asistente: string, i: number, estado: string) => `${asistente}, pregunta ${i}: ${estado}`,
    cta: 'Crear mi cuenta y usar mi panel',
    ctaPrecio: (usd: number) => `US$${usd} al mes, precio de fundador. Cancelas cuando quieras.`,
  },
  en: {
    titulo: 'What your panel would look like',
    intro: (dominio: string) =>
      `We built it from what the Radar found today on ${dominio}. It is only for looking. When you create your account, the agent checks your site again and leaves you your tasks.`,
    soloLectura: 'Read only',
    fixTitulo: 'Install the Peaje kit',
    fixPorQue: (n: number) =>
      n === 1
        ? 'The Radar found one thing AI looks for on your site that is not there. The kit adds it.'
        : `The Radar found ${n} things AI looks for on your site that are not there. The kit adds them all at once.`,
    yMas: (n: number) => `And ${n} more.`,
    mencionTitulo: (pregunta: string) => `Ask to be included where AI looks for "${pregunta}"`,
    mencionPorQue: (sitios: string[]) =>
      `For this question AI assistants do not cite your site and do cite third-party pages (${sitios.join(', ')}). If those pages name you, AI has somewhere to read about your business.`,
    paginaTitulo: (pregunta: string) => `Publish the page "${pregunta}"`,
    paginaPorQue: (motores: string[]) =>
      `When someone asks this, ${lista('en', motores)} do not cite your site. A page that answers it gives AI something of yours to cite.`,
    pie: {
      fix: 'Your agent gives you the instructions for your AI.',
      mencion: 'Your agent drafts the requests. You send them.',
      pagina: 'Your agent leaves you the draft ready.',
    } as Record<'fix' | 'mencion' | 'pagina', string>,
    hacer: 'Do this task',
    esperandoTareas: 'The tasks that come from the AI answers show up when they arrive.',
    sinCitasTareas: 'The agent builds the tasks that come from the AI answers once you sign in.',
    vacio: 'Today the Radar found no tasks for your site. With your account, the agent keeps measuring every week and tells you when something comes up.',
    citasSub: (n: number) =>
      n === 1 ? 'On the Radar question. In your panel, Peaje measures again every week.' : `On the ${n} Radar questions. In your panel, Peaje measures again every week.`,
    valor: (citadas: number, total: number) => `${citadas} of ${total} ${total === 1 ? 'answer' : 'answers'}`,
    sinRespuesta: 'It did not answer this time',
    citasEsperando: 'Waiting for the AI answers.',
    citasError: 'This time we could not ask AI. In your panel, Peaje measures it every week.',
    marca: (asistente: string, i: number, estado: string) => `${asistente}, question ${i}: ${estado}`,
    cta: 'Create my account and use my panel',
    ctaPrecio: (usd: number) => `US$${usd} a month, founder price. Cancel anytime.`,
  },
}
