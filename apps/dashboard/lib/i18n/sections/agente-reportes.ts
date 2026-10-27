import { asistentesMedidos } from '@peaje/shared/asistentes'

/**
 * Los reportes que abre el agente con una tarjeta (app/t/[slug]/agente/
 * oportunidades, citas y tareas/[id]). Los nombres y descripciones de cada
 * formato viven en miAgente (fmtNombres, fmtPara, fmtRasgos).
 */
export const agenteReportes = {
  es: {
    volver: 'Volver a Mi agente',
    eyebrow: 'Reporte',
    bloqueado: 'Este reporte se activa con Pro. Lo contratas en Mi agente, en Tu suscripción.',
    bloqueadoCta: 'Ver el plan Pro',

    // ---- oportunidades ----
    opTitulo: 'Oportunidades de contenido',
    opSub:
      'Las páginas que conviene crear para que la IA te cite, en orden. Arriba, las que tienen más evidencia: preguntas que medimos donde hoy no apareces y formatos que la IA ya cita.',
    opVacio: 'Todavía no hay páginas propuestas. Busca oportunidades: el agente lee tu sitio y propone las primeras.',
    opBuscar: 'Buscar oportunidades nuevas',
    opBuscando: 'Buscando…',
    opBuscarNota: 'Lee tu sitio y propone páginas nuevas. Tarda un minuto.',
    opBuscarEspera: (seg: number) => `Ya buscaste hace poco. Prueba de nuevo en ${Math.ceil(seg / 60)} min.`,
    opBuscarResultado: (creadas: number, actualizadas: number) =>
      creadas || actualizadas ? `${creadas} nuevas, ${actualizadas} actualizadas.` : 'No hay páginas nuevas por ahora.',
    opPorQue: 'Por qué',
    opFormato: 'Formato',
    opComo: 'Cómo se arma',
    opImitar: 'Una página que la IA ya cita para esto',
    opBorradorListo: 'Borrador listo para publicar',
    opFaltan: (n: number) => (n === 1 ? 'Borrador listo, falta 1 dato' : `Borrador listo, faltan ${n} datos`),
    opSinBorrador: 'Con instrucciones, sin borrador todavía',
    opAbrir: 'Abrir la página',
    opNoCitado: 'Medimos esta pregunta y hoy la IA no te cita',
    opConEjemplo: 'Hay una página citada para imitar',
    opSerie: 'Parte de una serie',
    opEnCurso: 'Tu herramienta ya la tomó',
    opFormatosGanan: 'Formatos que la IA cita para tus preguntas',
    opVerCitas: 'Ver a quién cita la IA',
    opCitas: (n: number) => (n === 1 ? '1 cita' : `${n} citas`),

    // ---- citas ----
    ciTitulo: 'A quién cita la IA en tu lugar',
    ciSub:
      `Lo que contestaron ${asistentesMedidos('es')} a las preguntas que medimos: quién apareció en cada una, en cada motor, y qué tipo de página eligieron.`,
    ciSinMedir: 'Todavía no hay mediciones. Elige las preguntas en Mi agente y corre la primera.',
    ciMedido: (fecha: string) => `Medido el ${fecha}`,
    ciCuota: (pct: string) => `Te citan en el ${pct} de las respuestas`,
    ciAntes: (pct: string) => `(antes ${pct})`,
    ciCompetidores: 'Los que más aparecen en tu lugar',
    ciVeces: (n: number) => (n === 1 ? '1 respuesta' : `${n} respuestas`),
    ciPorPregunta: 'Pregunta por pregunta',
    ciTeCita: 'Te cita',
    ciTeNombra: 'Te nombra sin link',
    ciNoApareces: 'No apareces',
    ciSinRespuesta: 'No respondió',
    ciCito: 'Citó',
    ciSinPaginas: 'No dio páginas',
    ciVerOportunidades: 'Ver qué páginas crear',

    // ---- tarea ----
    taNoEncontrada: 'No encontramos esta tarea. Puede que se haya borrado.',
    taPorQue: 'Por qué',
    taEstado: 'Estado',
    taDireccion: 'Dónde va a vivir',
    taFaltan: 'Datos que faltan',
    taFaltanNota: 'Mándaselos al agente en el chat o por Telegram y completa el borrador.',
    taPagina: 'La página',
    taInstrucciones: 'Instrucciones para tu coding agent',
    taCopiar: 'Copiar para tu IA',
    taCopiado: 'Copiado',
    taVerOportunidades: 'Ver todas las oportunidades',

    // ---- chat ----
    chatTrabajando: 'Sigo trabajando en lo que pediste. Te aviso aquí cuando esté listo.',
  },
  en: {
    volver: 'Back to My agent',
    eyebrow: 'Report',
    bloqueado: 'This report turns on with Pro. You subscribe in My agent, under Your subscription.',
    bloqueadoCta: 'See the Pro plan',

    opTitulo: 'Content opportunities',
    opSub:
      'The pages worth creating so AI assistants cite you, in order. At the top, the ones with the most evidence: questions we measure where you do not show up today, and formats AI already cites.',
    opVacio: 'No pages proposed yet. Look for opportunities: the agent reads your site and proposes the first ones.',
    opBuscar: 'Look for new opportunities',
    opBuscando: 'Looking…',
    opBuscarNota: 'Reads your site and proposes new pages. Takes about a minute.',
    opBuscarEspera: (seg: number) => `You looked a moment ago. Try again in ${Math.ceil(seg / 60)} min.`,
    opBuscarResultado: (creadas: number, actualizadas: number) =>
      creadas || actualizadas ? `${creadas} new, ${actualizadas} updated.` : 'No new pages for now.',
    opPorQue: 'Why',
    opFormato: 'Format',
    opComo: 'How it is built',
    opImitar: 'A page AI already cites for this',
    opBorradorListo: 'Draft ready to publish',
    opFaltan: (n: number) => (n === 1 ? 'Draft ready, 1 fact missing' : `Draft ready, ${n} facts missing`),
    opSinBorrador: 'Instructions only, no draft yet',
    opAbrir: 'Open the page',
    opNoCitado: 'We measure this question and AI does not cite you today',
    opConEjemplo: 'There is a cited page to emulate',
    opSerie: 'Part of a series',
    opEnCurso: 'Your tool already picked it up',
    opFormatosGanan: 'Formats AI cites for your questions',
    opVerCitas: 'See who AI cites instead',
    opCitas: (n: number) => (n === 1 ? '1 citation' : `${n} citations`),

    ciTitulo: 'Who AI cites instead of you',
    ciSub:
      `What ${asistentesMedidos('en')} answered to the questions we measure: who showed up in each one, on each engine, and what kind of page they picked.`,
    ciSinMedir: 'No measurements yet. Pick the questions in My agent and run the first one.',
    ciMedido: (fecha: string) => `Measured on ${fecha}`,
    ciCuota: (pct: string) => `They cite you in ${pct} of answers`,
    ciAntes: (pct: string) => `(before ${pct})`,
    ciCompetidores: 'Who shows up most instead of you',
    ciVeces: (n: number) => (n === 1 ? '1 answer' : `${n} answers`),
    ciPorPregunta: 'Question by question',
    ciTeCita: 'Cites you',
    ciTeNombra: 'Names you without a link',
    ciNoApareces: 'You do not show up',
    ciSinRespuesta: 'No answer',
    ciCito: 'Cited',
    ciSinPaginas: 'No pages given',
    ciVerOportunidades: 'See which pages to create',

    taNoEncontrada: 'We could not find this task. It may have been deleted.',
    taPorQue: 'Why',
    taEstado: 'Status',
    taDireccion: 'Where it will live',
    taFaltan: 'Missing facts',
    taFaltanNota: 'Send them to the agent in the chat or on Telegram and it completes the draft.',
    taPagina: 'The page',
    taInstrucciones: 'Instructions for your coding agent',
    taCopiar: 'Copy for your AI',
    taCopiado: 'Copied',
    taVerOportunidades: 'See all opportunities',

    chatTrabajando: "Still working on what you asked for. I'll tell you here when it's ready.",
  },
}
