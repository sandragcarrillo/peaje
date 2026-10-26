import { scannableDomain } from '@/lib/ora'

/** El dominio a medir a partir de lo que escribió la persona (con o sin https, con o sin path). */
export function dominioDeRadar(entrada: string | undefined): string | null {
  const texto = (entrada ?? '').trim().toLowerCase()
  if (!texto || texto.length > 200) return null
  const dominio = scannableDomain(/^https?:\/\//.test(texto) ? texto : `https://${texto}`)
  if (!dominio || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(dominio)) return null
  return dominio
}

/**
 * Cookie con los dominios que este visitante midió en la última hora. Mientras
 * esté, la página y el correo leen a Ora saltando su CDN (`cachedScore` con
 * `fresco`), que si no puede seguir mostrando la medición anterior.
 */
export const COOKIE_FRESCO = 'peaje_radar_fresco'
export const DURACION_FRESCO_S = 60 * 60

export function dominiosFrescos(valor: string | undefined): string[] {
  return (valor ?? '').split(',').filter((d) => /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)).slice(0, 5)
}
