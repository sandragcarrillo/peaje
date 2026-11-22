import type { Chequeo } from '@peaje/shared'

/**
 * Lo que devuelve `peaje_setup`: en qué va la instalación del kit de este
 * negocio y los pasos para terminarla. Es lo que antes solo vivía en el prompt
 * del Kit que se copiaba a mano; con esto el agente del dueño lo pide después
 * de iniciar sesión (usepeaje.com/onboard.md) y nadie pega un secreto.
 * Los chequeos se miden en el sitio en vivo, así que llamarla de nuevo después
 * del deploy es la verificación.
 */
export function respuestaSetup(a: {
  nombre: string
  dominio: string | null
  chequeos: Chequeo[]
  pasos: string
  panelKit: string
  verifyUrl: string
}) {
  // `bots` mide el CDN o el firewall del sitio, no la instalación.
  const propios = a.chequeos.filter((c) => c.id !== 'bots')
  const sinDominio = !a.dominio || a.chequeos[0]?.id === 'dominio'
  const instalado = !sinDominio && propios.length > 0 && propios.every((c) => c.ok)
  return {
    business: a.nombre,
    domain: a.dominio,
    installed: instalado,
    checks: {
      passing: a.chequeos.filter((c) => c.ok).map((c) => c.id),
      failing: a.chequeos.filter((c) => !c.ok).map((c) => ({ id: c.id, reason: c.motivo, missing: c.faltantes })),
    },
    steps: instalado ? null : a.pasos,
    ownerOnly: instalado
      ? null
      : `One environment variable, PEAJE_ORIGIN_SECRET, set in the site's hosting. The owner copies its value from ${a.panelKit}. Do not ask for the value, do not read it and do not write it into any file.`,
    verify: a.verifyUrl,
    next: sinDominio
      ? 'This business has no public domain yet, so nothing can be measured. Follow steps and deploy the site first.'
      : instalado
        ? 'Installed. Call peaje_plan and peaje_list_tasks and offer the owner the first open task.'
        : 'Follow steps. After the deploy is live, call peaje_setup again: done means installed is true.',
  }
}
