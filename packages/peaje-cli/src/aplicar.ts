/**
 * Del kit a un plan de acciones sobre el repo, y del plan al disco. El plan se
 * calcula entero antes de escribir nada: es lo que se muestra para confirmar
 * y lo que `peaje plan` imprime sin tocar el repo.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { rutasABorrar } from '@peaje/shared'
import { comandoInstalar } from './detectar'
import { agregarDependencia, envolverNextConfig, insertarPeajeHead, nextConfigNuevo } from './next'
import type { Accion, Deteccion, Kit, Plan } from './tipos'

export const VERSION_PEAJE_NEXT = '^0.1.0'
export const CARPETA_BACKUP = '.peaje-backup'

const BLOQUEA_TODO = /^Disallow:\s*\/\s*$/m

function leer(dir: string, rel: string): string {
  return readFileSync(join(dir, rel), 'utf8')
}

function existe(dir: string, rel: string): boolean {
  return existsSync(join(dir, rel))
}

function primeroQueExiste(dir: string, rels: string[]): string | null {
  for (const r of rels) if (existe(dir, r)) return r
  return null
}

/** Todo lo que no sea `create` va bajo `peaje/`, tal cual viene del gateway. */
function bajoPeaje(path: string): string {
  return path.startsWith('peaje/') ? path : posix.join('peaje', basename(path))
}

/** Dónde puede vivir una copia estática o un route handler que tape al proxy. */
export function candidatosACopia(path: string): string[] {
  const limpio = path.replace(/^\/+/, '')
  return [
    `public/${limpio}`,
    `static/${limpio}`,
    `app/${limpio}/route.ts`,
    `app/${limpio}/route.js`,
    `src/app/${limpio}/route.ts`,
    `src/app/${limpio}/route.js`,
    `pages/api/${limpio}.ts`,
    `pages/api/${limpio}.js`,
    `src/pages/api/${limpio}.ts`,
    `src/pages/api/${limpio}.js`,
  ]
}

export function marcaDeTiempo(fecha = new Date()): string {
  return fecha.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

/** Paso (g): mover copias que tapan al proxy a `.peaje-backup/<timestamp>/`. Nunca rm. */
export function planificarLimpieza(dir: string, remove: string[], timestamp = marcaDeTiempo()): Accion[] {
  const acciones: Accion[] = []
  for (const path of remove) {
    for (const rel of candidatosACopia(path)) {
      if (existe(dir, rel)) acciones.push({ tipo: 'move', desde: rel, hasta: posix.join(CARPETA_BACKUP, timestamp, rel) })
    }
  }
  return acciones
}

export type OpcionesPlan = { slug: string; timestamp?: string }

export function planificar(det: Deteccion, kit: Kit, { slug, timestamp }: OpcionesPlan): Plan {
  const { dir, stack } = det
  const acciones: Accion[] = []
  const manual: string[] = []
  const next: string[] = []
  const reconocido = stack !== 'unknown'

  // (c) archivos del kit
  for (const f of kit.files) {
    if (f.mode === 'create') {
      if (!reconocido) {
        acciones.push({ tipo: 'write', path: bajoPeaje(f.path), content: f.content, motivo: `${f.mode}: ${f.nota}` })
        continue
      }
      if (basename(f.path) === 'robots.txt') {
        acciones.push(...planificarRobots(det, f.path, f.content, manual))
        continue
      }
      if (existe(dir, f.path)) acciones.push({ tipo: 'skip', path: f.path, motivo: 'already exists, left untouched' })
      else acciones.push({ tipo: 'write', path: f.path, content: f.content, motivo: f.nota })
      continue
    }
    acciones.push({ tipo: 'write', path: bajoPeaje(f.path), content: f.content, motivo: `${f.mode}: ${f.nota}` })
  }

  // (d) y (e): Next
  if (stack === 'next') {
    planificarNext(det, slug, acciones, manual, next)
  } else if (reconocido) {
    manual.push(
      `Put the tags from peaje/head.html inside the <head> of your homepage template${stack === 'static' ? '' : ` (${stack})`}. Keep any JSON-LD you already have; add this block next to it.`,
    )
    if (kit.host === 'unknown') {
      manual.push('Pick the ONE proxy file under peaje/ that matches where the site is served (Vercel, Cloudflare, nginx, Caddy) and merge it into that config.')
    } else {
      const proxy = kit.files.find((f) => f.mode !== 'create' && basename(f.path) !== 'head.html')
      if (proxy) manual.push(`Merge peaje/${basename(proxy.path)} into your existing config. ${proxy.nota}`)
    }
  }

  // (g) copias que tapan al proxy
  acciones.push(...planificarLimpieza(dir, kit.remove.length > 0 ? kit.remove : rutasABorrar(), timestamp))

  // Lo que el kit ya dice a mano, sin repetir lo que este CLI resolvió.
  for (const m of kit.manual) {
    if (/in `remove` exists|Delete that static copy/.test(m) && acciones.some((a) => a.tipo === 'move')) continue
    if (/^Deploy\./.test(m)) continue
    if (/^Pick the ONE proxy file/.test(m) && manual.some((x) => x.startsWith('Pick the ONE proxy file'))) continue
    manual.push(m)
  }

  next.push(`Build and deploy. Nothing answers on your domain before the deploy is live.`)
  next.push(`After the deploy: npx peaje@1 verify ${slug} --wait 600`)
  if (kit.paidPath) next.push(`Then: curl -sIL https://${kit.originHost}${kit.paidPath} should return 402.`)

  return { acciones, manual, next }
}

function planificarRobots(det: Deteccion, path: string, content: string, manual: string[]): Accion[] {
  const { dir, stack } = det
  // SvelteKit sirve estáticos desde `static/`, no `public/`.
  const destino = stack === 'sveltekit' ? path.replace(/^public\//, 'static/') : path
  const dinamico = primeroQueExiste(dir, ['app/robots.ts', 'app/robots.js', 'src/app/robots.ts', 'src/app/robots.js'])
  if (dinamico) {
    manual.push(`${dinamico} already generates robots.txt: allow the answer-engine bots there (see peaje/robots.txt for the list) and keep your Sitemap line. Do not add a static one; Next fails the build with both.`)
    return [{ tipo: 'write', path: 'peaje/robots.txt', content, motivo: 'reference: merge into the dynamic robots' }]
  }
  const existente = primeroQueExiste(dir, [destino, 'public/robots.txt', 'static/robots.txt'])
  if (existente) {
    if (BLOQUEA_TODO.test(leer(dir, existente))) {
      manual.push(`${existente} has a bare "Disallow: /" that also locks out answer engines. Allow Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot and Applebot by name (see peaje/robots.txt).`)
      return [
        { tipo: 'skip', path: existente, motivo: 'exists and blocks everything, left untouched' },
        { tipo: 'write', path: 'peaje/robots.txt', content, motivo: 'reference: merge into the existing robots.txt' },
      ]
    }
    return [{ tipo: 'skip', path: existente, motivo: 'already exists, left untouched' }]
  }
  return [{ tipo: 'write', path: destino, content, motivo: 'no robots.txt found' }]
}

function planificarNext(det: Deteccion, slug: string, acciones: Accion[], manual: string[], next: string[]): void {
  const { dir } = det
  let tocaInstalar = false

  // (d) next.config
  if (det.nextConfig) {
    const src = leer(dir, det.nextConfig)
    const r = envolverNextConfig(src, slug)
    if (r.ok) {
      acciones.push({ tipo: 'edit', path: det.nextConfig, content: r.src, motivo: 'wrapped with withPeaje()' })
      tocaInstalar = true
    } else if (r.motivo === 'already') {
      acciones.push({ tipo: 'skip', path: det.nextConfig, motivo: 'already uses withPeaje' })
    } else {
      manual.push(
        `${det.nextConfig} is not a plain \`export default X\` (a wrapper like withSentryConfig is in the way). Wrap the inner config: \`withPeaje(nextConfig, { slug: "${slug}" })\` from @peaje/next, keeping the outer wrapper. Or spread peaje/next.config.ts into rewrites().beforeFiles by hand.`,
      )
      tocaInstalar = true
    }
  } else {
    const nuevo = nextConfigNuevo(slug, existe(dir, 'tsconfig.json'))
    acciones.push({ tipo: 'write', path: nuevo.path, content: nuevo.content, motivo: 'no next.config found, created with withPeaje()' })
    tocaInstalar = true
  }

  // (e) head
  if (det.router === 'app' && det.layout) {
    const r = insertarPeajeHead(leer(dir, det.layout), slug)
    if (r.ok) {
      acciones.push({ tipo: 'edit', path: det.layout, content: r.src, motivo: 'added <PeajeHead /> to <head>' })
      tocaInstalar = true
    } else if (r.motivo === 'already') {
      acciones.push({ tipo: 'skip', path: det.layout, motivo: 'already renders <PeajeHead />' })
    } else {
      manual.push(`${det.layout} has no <head> and no <html>/<body> pair to anchor to. Render \`<PeajeHead slug="${slug}" />\` (from @peaje/next/head) inside the <head> of the root layout.`)
      tocaInstalar = true
    }
  } else if (det.router === 'pages') {
    manual.push(
      `Pages router: PeajeHead is a server component and does not run there. Paste the tags from peaje/head.html into the <Head> of pages/_document.tsx (the JSON-LD as <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />).`,
    )
  } else {
    manual.push(`No root layout found. Render \`<PeajeHead slug="${slug}" />\` (from @peaje/next/head) inside the <head> of the root layout, or paste peaje/head.html there.`)
    tocaInstalar = true
  }

  // package.json: la dependencia se anota, la instalación la corre el dueño.
  if (tocaInstalar) {
    const pkgPath = 'package.json'
    const nuevo = existe(dir, pkgPath) ? agregarDependencia(leer(dir, pkgPath), '@peaje/next', VERSION_PEAJE_NEXT) : null
    if (nuevo) acciones.push({ tipo: 'edit', path: pkgPath, content: nuevo, motivo: 'added @peaje/next to dependencies' })
    next.unshift(`${comandoInstalar(det.gestor, '@peaje/next')}   # installs the dependency added to package.json`)
  }
}

export type Ejecutado = { written: string[]; moved: string[] }

/** Escribe el plan. Idempotente: correrlo dos veces no rompe nada. */
export function ejecutar(dir: string, plan: Plan): Ejecutado {
  const written: string[] = []
  const moved: string[] = []
  for (const a of plan.acciones) {
    if (a.tipo === 'write' || a.tipo === 'edit') {
      const destino = join(dir, a.path)
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, a.content)
      written.push(a.path)
    } else if (a.tipo === 'move') {
      const hasta = join(dir, a.hasta)
      mkdirSync(dirname(hasta), { recursive: true })
      renameSync(join(dir, a.desde), hasta)
      moved.push(`${a.desde} -> ${a.hasta}`)
    }
  }
  return { written, moved }
}
