/**
 * Los comandos como funciones puras de (opciones) → resultado, sin leer
 * process.argv ni escribir en stdout. `cli.ts` les pone la consola encima y
 * los tests las llaman directo con un `descargarKit` falso.
 */
import { rutasABorrar } from '@peaje/shared'
import { ejecutar, planificar, planificarLimpieza } from './aplicar'
import { detectar, mostrarRuta } from './detectar'
import { descargarKit as descargarReal, type DescargarKit } from './kit'
import { ErrorCli, type Deteccion, type Host, type Kit, type Plan, type Resultado } from './tipos'

export type OpcionesInit = {
  slug: string
  dir: string
  gateway: string
  host?: Host
  dryRun: boolean
  descargarKit?: DescargarKit
  timestamp?: string
}

export type SalidaInit = {
  det: Deteccion
  kit: Kit
  plan: Plan
  resultado: Resultado
  /** 3 cuando el stack no se reconoce: el kit quedó completo en peaje/ para que el agente traduzca. */
  codigo: 0 | 3
}

export function resultadoDe(det: Deteccion, kit: Kit, plan: Plan, escrito: { written: string[]; moved: string[] } | null): Resultado {
  const dry = escrito === null
  const written = dry
    ? plan.acciones.filter((a) => a.tipo === 'write' || a.tipo === 'edit').map((a) => (a as { path: string }).path)
    : escrito.written
  const moved = dry ? plan.acciones.filter((a) => a.tipo === 'move').map((a) => `${a.desde} -> ${a.hasta}`) : escrito.moved
  return {
    ok: det.stack !== 'unknown',
    stack: det.stack,
    host: kit.host,
    written,
    moved,
    manual: plan.manual,
    next: plan.next,
    ...(dry ? { skipped: plan.acciones.filter((a) => a.tipo === 'skip').map((a) => ({ path: a.path, motivo: a.motivo })) } : {}),
  }
}

/** Detecta, baja el kit y arma el plan. No escribe: eso es `aplicarPlan`. */
export async function prepararInit(o: OpcionesInit): Promise<Omit<SalidaInit, 'resultado'>> {
  const det = detectar(o.dir)
  if (det.candidatos.length > 1) {
    throw new ErrorCli(
      `Monorepo: several packages use a framework. Re-run with --dir pointing at the site:\n${det.candidatos.map((c) => `  --dir ${mostrarRuta(c)}`).join('\n')}`,
    )
  }
  const host: Host | null = o.host ?? det.host
  const kit = await (o.descargarKit ?? descargarReal)(o.gateway, o.slug, host)
  const plan = planificar(det, kit, { slug: o.slug, timestamp: o.timestamp })
  if (det.stack === 'unknown') {
    plan.manual.unshift(
      `Stack not recognized in ${mostrarRuta(det.dir)}: no framework in package.json and no known host config. The full kit is under peaje/: pick the proxy file for your host, put head.html in your homepage <head>, serve robots.txt at the root.`,
    )
  }
  return { det, kit, plan, codigo: det.stack === 'unknown' ? 3 : 0 }
}

export function aplicarPlan(salida: Omit<SalidaInit, 'resultado'>, dryRun: boolean): SalidaInit {
  const escrito = dryRun ? null : ejecutar(salida.det.dir, salida.plan)
  return { ...salida, resultado: resultadoDe(salida.det, salida.kit, salida.plan, escrito) }
}

/** init/plan en un paso, para tests y para `--yes`. */
export async function init(o: OpcionesInit): Promise<SalidaInit> {
  return aplicarPlan(await prepararInit(o), o.dryRun)
}

export type OpcionesClean = { slug: string; dir: string; gateway: string; dryRun: boolean; descargarKit?: DescargarKit; timestamp?: string }

/** Solo el paso (g). Si el gateway no responde, usa la lista fija de shared. */
export async function clean(o: OpcionesClean): Promise<{ resultado: Resultado; aviso: string | null }> {
  const det = detectar(o.dir)
  let remove: string[] = rutasABorrar()
  let host: Host | 'unknown' = det.host ?? 'unknown'
  let aviso: string | null = null
  try {
    const kit = await (o.descargarKit ?? descargarReal)(o.gateway, o.slug, det.host)
    if (kit.remove.length > 0) remove = kit.remove
    host = kit.host
  } catch (e) {
    aviso = `${(e as Error).message} Using the built-in list of proxied paths instead.`
  }
  const plan: Plan = { acciones: planificarLimpieza(det.dir, remove, o.timestamp), manual: [], next: [] }
  const escrito = o.dryRun ? null : ejecutar(det.dir, plan)
  const kitFalso = { host } as Kit
  return { resultado: resultadoDe(det, kitFalso, plan, escrito), aviso }
}
