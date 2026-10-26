import { redirect } from 'next/navigation'

/**
 * El agente comprador (un agente del negocio que compraba a otros sitios con
 * Peaje) se quitó el 26 oct 2026: hoy Peaje vende solo el agente que te hace
 * visible en la IA. Los datos quedan en la base; los links viejos van al inicio.
 */
export default function Agentes() {
  redirect('/')
}
