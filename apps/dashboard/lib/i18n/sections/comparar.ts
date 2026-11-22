/**
 * Las comparativas (app/comparar en español, app/compare en inglés). Cada
 * página sale en el idioma de su URL, no en el de la cookie, así que esta
 * sección se lee directo por idioma y no pasa por el diccionario.
 */
export const comparar = {
  es: {
    metaTitulo: 'Comparativas: Peaje frente a otras herramientas de visibilidad en IA',
    metaDescripcion:
      'Peaje frente a Peec, Otterly, Profound y Semrush, alternativas a cada una y la lista de herramientas de AEO de 2026. Precios públicos con fecha, motores que mide cada una y para quién es.',
    titulo: 'Comparativas',
    intro:
      'Cada página dice qué hace la otra herramienta, cuándo te conviene más que Peaje y qué no hace Peaje. Los precios de terceros salen de sus páginas oficiales, con la fecha en que los leímos.',
    revisadas: (fecha: string) => `Precios y datos revisados el ${fecha}.`,
    combinadaTitulo: 'Las cuatro juntas',
    combinadaTexto: 'Peaje, Otterly, Peec y Profound en una sola tabla, en el blog.',
    combinadaSlug: '/blog/peaje-vs-otterly-vs-peec-vs-profound-cual-conviene',
    leer: 'Leer la comparativa',
    inicio: 'Inicio',
    volver: 'Todas las comparativas',
    revisado: 'Última revisión',
    ctaPrimario: 'Mide tu sitio gratis',
    ctaSecundario: 'Ver precios',
    cierreTitulo: 'Mira cómo te ve la IA hoy',
    cierreTexto: 'Pega la URL de tu sitio y en menos de un minuto ves si ChatGPT y Claude te nombran y qué te falta, sin tarjeta.',
  },
  en: {
    metaTitulo: 'Comparisons: Peaje against other AI visibility tools',
    metaDescripcion:
      'Peaje against Peec, Otterly, Profound and Semrush, alternatives to each one and the 2026 list of AEO tools. Dated public prices, the engines each one tracks and who each one is for.',
    titulo: 'Comparisons',
    intro:
      'Each page says what the other tool does, when it suits you better than Peaje and what Peaje does not do. Third-party prices come from their official pages, with the date we read them.',
    revisadas: (fecha: string) => `Prices and facts checked on ${fecha}.`,
    combinadaTitulo: 'All four together',
    combinadaTexto: 'Peaje, Otterly, Peec and Profound in a single table, on the blog.',
    combinadaSlug: '/blog/peaje-vs-otterly-vs-peec-vs-profound-which-one-to-pick',
    leer: 'Read the comparison',
    inicio: 'Home',
    volver: 'All comparisons',
    revisado: 'Last reviewed',
    ctaPrimario: 'Measure your site free',
    ctaSecundario: 'See pricing',
    cierreTitulo: 'See how AI sees you today',
    cierreTexto: 'Paste your site URL and in under a minute you see whether ChatGPT and Claude name you and what is missing, with no card.',
  },
}
