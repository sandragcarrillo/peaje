import type { MetadataRoute } from 'next'

/**
 * usepeaje.com tiene que pasar su propio Radar: robots.txt daba 404. Todo el
 * sitio público queda abierto a buscadores y a los bots de los asistentes de
 * IA; los paneles de cada negocio y las rutas internas, no.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/t/', '/api/', '/acceder', '/salir', '/wallet', '/nuevo'] }],
    sitemap: 'https://usepeaje.com/sitemap.xml',
    host: 'https://usepeaje.com',
  }
}
