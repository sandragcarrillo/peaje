/**
 * Qué hay en el repo: framework, host y, en Next, qué router y dónde está la
 * config. Todo por lectura de archivos, sin ejecutar nada del proyecto.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { ErrorCli, type Deteccion, type Gestor, type Host, type Stack } from './tipos'

type PackageJson = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  workspaces?: string[] | { packages?: string[] }
}

export function leerPackageJson(dir: string): PackageJson | null {
  const p = join(dir, 'package.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as PackageJson
  } catch {
    return null
  }
}

function tieneDep(pkg: PackageJson, pred: (nombre: string) => boolean): boolean {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some(pred)
}

/** El orden importa: un proyecto Remix o Astro también trae `vite`. */
export function stackDe(pkg: PackageJson | null): Stack {
  if (!pkg) return 'unknown'
  if (tieneDep(pkg, (n) => n === 'next')) return 'next'
  if (tieneDep(pkg, (n) => n === 'nuxt')) return 'nuxt'
  if (tieneDep(pkg, (n) => n === 'astro')) return 'astro'
  if (tieneDep(pkg, (n) => n === '@sveltejs/kit')) return 'sveltekit'
  if (tieneDep(pkg, (n) => n.startsWith('@remix-run/'))) return 'remix'
  if (tieneDep(pkg, (n) => n === 'react-router' || n === '@react-router/dev')) return 'react-router'
  if (tieneDep(pkg, (n) => n === 'vite')) return 'vite'
  return 'unknown'
}

function existeAlguno(dir: string, nombres: string[]): string | null {
  for (const n of nombres) if (existsSync(join(dir, n))) return n
  return null
}

export function hostDe(dir: string, stack: Stack): Host | null {
  // Next ignora vercel.json para rewrites: la config manda aunque el deploy sea Vercel.
  if (stack === 'next') return 'next'
  if (existsSync(join(dir, 'vercel.json'))) return 'vercel'
  if (existeAlguno(dir, ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json'])) return 'cloudflare'
  if (existeAlguno(dir, ['nginx.conf', 'nginx/nginx.conf', 'nginx/default.conf'])) return 'nginx'
  if (existeAlguno(dir, ['Caddyfile', 'caddy/Caddyfile'])) return 'caddy'
  return null
}

const CONFIGS_NEXT = ['next.config.ts', 'next.config.mjs', 'next.config.js', 'next.config.cjs', 'next.config.mts']
const LAYOUTS = ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js', 'src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js']

/** El lockfile puede estar arriba (monorepo): subimos hasta cinco niveles. */
export function gestorDe(dir: string): Gestor {
  let actual = resolve(dir)
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(actual, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(join(actual, 'yarn.lock'))) return 'yarn'
    if (existeAlguno(actual, ['bun.lockb', 'bun.lock'])) return 'bun'
    if (existsSync(join(actual, 'package-lock.json'))) return 'npm'
    const padre = dirname(actual)
    if (padre === actual) break
    actual = padre
  }
  return 'npm'
}

export function comandoInstalar(gestor: Gestor, paquete: string): string {
  switch (gestor) {
    case 'pnpm':
      return `pnpm add ${paquete}`
    case 'yarn':
      return `yarn add ${paquete}`
    case 'bun':
      return `bun add ${paquete}`
    case 'npm':
      return `npm install ${paquete}`
  }
}

/** Patrones de workspaces (`apps/*`, `packages/*`, rutas literales). Solo un nivel de comodín. */
function patronesWorkspace(dir: string, pkg: PackageJson | null): string[] {
  const patrones: string[] = []
  const ws = pkg?.workspaces
  if (Array.isArray(ws)) patrones.push(...ws)
  else if (ws && Array.isArray(ws.packages)) patrones.push(...ws.packages)
  const yaml = join(dir, 'pnpm-workspace.yaml')
  if (existsSync(yaml)) {
    for (const linea of readFileSync(yaml, 'utf8').split('\n')) {
      const m = /^\s*-\s*['"]?([^'"#\s]+)['"]?\s*$/.exec(linea)
      if (m?.[1] && !m[1].startsWith('!')) patrones.push(m[1])
    }
  }
  // Sin config de workspaces, las carpetas convencionales igual se revisan.
  if (patrones.length === 0) patrones.push('apps/*', 'packages/*')
  return patrones
}

function expandir(dir: string, patron: string): string[] {
  const limpio = patron.replace(/\/\*\*?$/, '')
  const base = join(dir, limpio)
  if (!existsSync(base) || !statSync(base).isDirectory()) return []
  if (!/\/\*\*?$/.test(patron)) return [base]
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map((e) => join(base, e.name))
}

function candidatosDe(dir: string, pkg: PackageJson | null): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const patron of patronesWorkspace(dir, pkg)) {
    for (const ruta of expandir(dir, patron)) {
      if (vistos.has(ruta)) continue
      vistos.add(ruta)
      if (stackDe(leerPackageJson(ruta)) !== 'unknown') salida.push(ruta)
    }
  }
  return salida
}

export function detectar(dirEntrada: string): Deteccion {
  const dir = resolve(dirEntrada)
  if (!existsSync(dir)) throw new ErrorCli(`Directory not found: ${dir}`)
  const pkg = leerPackageJson(dir)
  let stack = stackDe(pkg)

  if (stack === 'unknown') {
    const candidatos = candidatosDe(dir, pkg)
    if (candidatos.length > 1) {
      return { dir, stack, host: null, router: null, nextConfig: null, layout: null, gestor: gestorDe(dir), candidatos }
    }
    if (candidatos.length === 1) {
      // Un solo paquete con framework: lo tomamos y lo decimos.
      return { ...detectar(candidatos[0]!), candidatos }
    }
  }

  const host = hostDe(dir, stack)
  if (stack === 'unknown' && (host !== null || existsSync(join(dir, 'index.html')))) stack = 'static'

  let router: Deteccion['router'] = null
  let nextConfig: string | null = null
  let layout: string | null = null
  if (stack === 'next') {
    nextConfig = existeAlguno(dir, CONFIGS_NEXT)
    layout = existeAlguno(dir, LAYOUTS)
    if (layout) router = 'app'
    else if (existeAlguno(dir, ['pages', 'src/pages'])) router = 'pages'
    else if (existeAlguno(dir, ['app', 'src/app'])) router = 'app'
  }

  return { dir, stack, host, router, nextConfig, layout, gestor: gestorDe(dir), candidatos: [] }
}

/** Para mensajes: rutas relativas al cwd cuando caben, absolutas si no. */
export function mostrarRuta(ruta: string): string {
  const rel = relative(process.cwd(), ruta)
  return rel && !rel.startsWith('..') ? rel : ruta
}
