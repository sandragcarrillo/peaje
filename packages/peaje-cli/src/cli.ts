/**
 * npx @peaje/cli@1 <init|plan|verify|clean> <slug> [flags]
 *
 * Pensado para que lo corra un coding agent: `--json` imprime un solo objeto
 * en stdout y nada más; sin TTY nunca espera input (sale con código 2 si
 * hacía falta confirmar). Los códigos de salida están en tipos.ts.
 */
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { esHost } from '@peaje/shared'
import { aplicarPlan, clean, prepararInit } from './comandos'
import { mostrarRuta } from './detectar'
import { gatewayDe, type Solo } from './kit'
import { ErrorCli, type Accion, type Deteccion, type Host, type Plan, type Resultado } from './tipos'
import { lineasVerificacion, RECORDATORIO_VERIFY, verificarConEspera } from './verify'

const USO = `peaje: install Peaje on your site

Usage
  peaje init <slug>    detect the stack, download the kit and apply it
  peaje plan <slug>    same as init, without writing anything
  peaje verify <slug>  measure what is live on the business domain
  peaje clean <slug>   move static copies that shadow the proxy to .peaje-backup/

Flags
  --dir <path>        project directory (default: cwd; required in monorepos)
  --host <id>         next | vercel | cloudflare | nginx | caddy (default: detected)
  --only <layer>      aeo: only robots.txt and the Organization JSON-LD (answer engines),
                      no proxy and no npm dependency. agents: the opposite. Default: both.
  --gateway <url>     Peaje gateway (default: $PEAJE_GATEWAY_URL or production)
  --yes, -y           apply without asking
  --json              one JSON object on stdout, nothing else
  --wait <seconds>    verify: retry every 15 s until it passes or time runs out
  --help, -h

Exit codes: 0 ok, 1 error or failed verification, 2 confirmation needed (no TTY), 3 stack not recognized.
`

function salir(codigo: number): void {
  process.exitCode = codigo
}

function imprimirJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`)
}

function describirAccion(a: Accion): string {
  switch (a.tipo) {
    case 'write':
      return `  + ${a.path}  (${a.motivo})`
    case 'edit':
      return `  ~ ${a.path}  (${a.motivo})`
    case 'move':
      return `  > ${a.desde}  ->  ${a.hasta}`
    case 'skip':
      return `  = ${a.path}  (${a.motivo})`
  }
}

function imprimirPlan(det: Deteccion, host: Host | 'unknown', plan: Plan, encabezado: string): void {
  const router = det.router ? ` (${det.router} router)` : ''
  console.log(`${encabezado}: ${det.stack}${router}, host ${host}, in ${mostrarRuta(det.dir)}`)
  if (det.candidatos.length === 1) console.log(`  (only package with a framework in this workspace)`)
  console.log('')
  const cambios = plan.acciones.filter((a) => a.tipo !== 'skip')
  if (cambios.length > 0) {
    console.log('Files:')
    for (const a of cambios) console.log(describirAccion(a))
  } else {
    console.log('Files: nothing to write.')
  }
  const saltos = plan.acciones.filter((a) => a.tipo === 'skip')
  if (saltos.length > 0) {
    console.log('Left as is:')
    for (const a of saltos) console.log(describirAccion(a))
  }
  console.log('')
}

function imprimirResto(res: Resultado): void {
  if (res.manual.length > 0) {
    console.log('Still manual:')
    for (const m of res.manual) console.log(`  - ${m}`)
    console.log('')
  }
  if (res.next.length > 0) {
    console.log('Next:')
    res.next.forEach((n, i) => console.log(`  ${i + 1}. ${n}`))
    console.log('')
  }
}

/** Pregunta solo si hay TTY en ambos lados. Sin TTY no se cuelga: devuelve null. */
async function confirmar(pregunta: string): Promise<boolean | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const r = await new Promise<string>((resolve) => rl.question(pregunta, resolve))
    return /^y(es)?$/i.test(r.trim())
  } finally {
    rl.close()
  }
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      host: { type: 'string' },
      only: { type: 'string' },
      gateway: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      json: { type: 'boolean', default: false },
      wait: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  const [comando, slug] = positionals
  const json = values.json === true

  if (values.help || !comando) {
    process.stdout.write(USO)
    return salir(comando ? 0 : 1)
  }
  if (!['init', 'plan', 'verify', 'clean'].includes(comando)) throw new ErrorCli(`Unknown command "${comando}".\n\n${USO}`)
  if (!slug) throw new ErrorCli(`Missing <slug>. Usage: peaje ${comando} <slug>`)
  if (values.host !== undefined && !esHost(values.host)) throw new ErrorCli(`--host must be one of next, vercel, cloudflare, nginx, caddy.`)
  if (values.only !== undefined && values.only !== 'aeo' && values.only !== 'agents') throw new ErrorCli(`--only must be aeo or agents.`)
  const solo = values.only as Solo | undefined

  const gateway = gatewayDe(values.gateway)
  const dir = values.dir ?? process.cwd()

  if (comando === 'verify') {
    const espera = values.wait ? Number(values.wait) : 0
    if (Number.isNaN(espera) || espera < 0) throw new ErrorCli('--wait expects a number of seconds.')
    const v = await verificarConEspera(
      gateway,
      slug,
      espera,
      fetch,
      (parcial, intento) => {
        if (!json && espera > 0 && !parcial.ok) console.error(`attempt ${intento}: not there yet, retrying in 15 s`)
      },
      undefined,
      solo,
    )
    if (json) imprimirJson(v)
    else {
      console.log(`peaje verify ${slug}: ${v.domain ?? 'no domain'} (${v.measuredAt})`)
      for (const l of lineasVerificacion(v)) console.log(l)
      console.log('')
      console.log(v.ok ? 'All checks pass.' : 'Some checks fail.')
      console.log(RECORDATORIO_VERIFY)
    }
    return salir(v.ok ? 0 : 1)
  }

  if (comando === 'clean') {
    const { resultado, aviso } = await clean({ slug, dir, gateway, dryRun: false })
    if (json) imprimirJson(resultado)
    else {
      if (aviso) console.error(aviso)
      if (resultado.moved.length === 0) console.log('Nothing shadows the proxy: no static copies or route handlers found.')
      else {
        console.log('Moved to .peaje-backup/ (nothing deleted):')
        for (const m of resultado.moved) console.log(`  > ${m}`)
      }
    }
    return salir(0)
  }

  // init y plan
  const dryRun = comando === 'plan'
  const preparado = await prepararInit({ slug, dir, gateway, host: values.host as Host | undefined, solo, dryRun })
  const { det, kit, plan, codigo } = preparado

  if (!dryRun && !values.yes && codigo === 0) {
    if (!json) imprimirPlan(det, kit.host, plan, `peaje init ${slug}`)
    const ok = await confirmar('Apply these changes? [y/N] ')
    if (ok === null) {
      const msj = 'No TTY to confirm. Re-run with --yes to apply, or use `peaje plan` to only see the changes.'
      if (json) imprimirJson({ ...aplicarPlan(preparado, true).resultado, ok: false, error: msj })
      else console.error(msj)
      return salir(2)
    }
    if (!ok) {
      if (json) imprimirJson({ ...aplicarPlan(preparado, true).resultado, ok: false, error: 'Cancelled.' })
      else console.log('Cancelled. Nothing written.')
      return salir(0)
    }
  }

  const { resultado } = aplicarPlan(preparado, dryRun)
  if (json) {
    imprimirJson(resultado)
  } else {
    imprimirPlan(det, kit.host, plan, dryRun ? `peaje plan ${slug}` : `peaje init ${slug}`)
    if (!dryRun) console.log(resultado.written.length + resultado.moved.length > 0 ? 'Applied.' : 'Nothing to apply.')
    else console.log('Dry run: nothing written.')
    console.log('')
    imprimirResto(resultado)
  }
  return salir(codigo)
}

main(process.argv.slice(2)).catch((e: unknown) => {
  const err = e instanceof ErrorCli ? e : null
  const mensaje = err?.message ?? (e instanceof Error ? e.message : String(e))
  if (process.argv.includes('--json')) imprimirJson({ ok: false, error: mensaje })
  else console.error(`peaje: ${mensaje}`)
  salir(err?.codigo ?? 1)
})
