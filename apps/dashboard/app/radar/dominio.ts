import { scannableDomain } from '@/lib/ora'

/** El dominio a medir a partir de lo que escribió la persona (con o sin https, con o sin path). */
export function dominioDeRadar(entrada: string | undefined): string | null {
  const texto = (entrada ?? '').trim().toLowerCase()
  if (!texto || texto.length > 200) return null
  const dominio = scannableDomain(/^https?:\/\//.test(texto) ? texto : `https://${texto}`)
  if (!dominio || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(dominio)) return null
  return dominio
}
