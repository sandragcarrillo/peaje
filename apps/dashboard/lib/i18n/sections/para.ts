/**
 * Las páginas por tipo de negocio (app/para en español, app/for en inglés).
 * Cada página sale en el idioma de su URL, no en el de la cookie, así que esta
 * sección se lee directo por idioma y no pasa por el diccionario.
 */
export const para = {
  es: {
    metaTitulo: 'Peaje por tipo de negocio: agencias, SaaS, tiendas online y negocios locales',
    metaDescripcion:
      'Qué le preguntan tus clientes a ChatGPT y Claude, qué revisa Peaje en tu tipo de sitio y qué arreglos te prepara tu agente. Para agencias, SaaS, tiendas online y negocios locales.',
    titulo: 'Peaje según tu negocio',
    intro:
      'Una tienda, un software y una peluquería no reciben las mismas preguntas. Cada página dice qué le preguntan tus clientes a ChatGPT y Claude, qué revisa Peaje en tu sitio y qué no hace todavía.',
    revisadas: (fecha: string) => `Revisado el ${fecha}.`,
    leer: 'Leer la página',
    inicio: 'Inicio',
    volver: 'Todos los tipos de negocio',
    revisado: 'Última revisión',
    ctaPrimario: 'Mide tu sitio gratis',
    ctaSecundario: 'Ver precios',
    cierreTitulo: 'Pruébalo con tu propio sitio',
    cierreTexto: 'Pega la URL de tu sitio y en menos de un minuto ves si ChatGPT y Claude te nombran y qué te falta, sin tarjeta.',
  },
  en: {
    metaTitulo: 'Peaje by type of business: agencies, SaaS, online stores and local businesses',
    metaDescripcion:
      'What your customers ask ChatGPT and Claude, what Peaje checks on your kind of site and which fixes your agent prepares. For agencies, SaaS, online stores and local businesses.',
    titulo: 'Peaje for your kind of business',
    intro:
      'A store, a software company and a hair salon do not get the same questions. Each page covers what your customers ask ChatGPT and Claude, what Peaje checks on your site and what it does not do yet.',
    revisadas: (fecha: string) => `Reviewed on ${fecha}.`,
    leer: 'Read the page',
    inicio: 'Home',
    volver: 'All types of business',
    revisado: 'Last reviewed',
    ctaPrimario: 'Measure your site free',
    ctaSecundario: 'See pricing',
    cierreTitulo: 'Try it with your own site',
    cierreTexto: 'Paste your site URL and in under a minute you see whether ChatGPT and Claude name you and what is missing, with no card.',
  },
}
