/**
 * Páginas propias del sitio que las reglas de Peaje van a tapar. Una regla de
 * Peaje (rewrite `beforeFiles`, middleware o proxy) corre antes que el sistema
 * de archivos: un `app/docs/page.tsx` deja de verse y `/docs` pasa a ser el
 * portal de Peaje. Nada de eso es un error de build, así que sin este aviso
 * el dueño se entera en producción.
 *
 * Solo lectura de archivos, sin ejecutar nada del proyecto.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { RUTAS_DINAMICAS, RUTAS_PROXY } from '@peaje/shared'

export type Colision = {
  /** El path del dominio que Peaje pasa a servir: `/docs`, `/r/*`. */
  path: string
  /** El archivo del sitio que hoy lo sirve, relativo al proyecto. */
  file: string
  kind: 'page' | 'route'
  message: string
}

const PAGINAS = ['tsx', 'ts', 'jsx', 'js', 'mdx', 'md']
const HANDLERS = ['ts', 'js', 'tsx', 'jsx', 'mjs']
/** Pages router de Next, Astro, Nuxt: `<raíz>/<p>.<ext>` y `<raíz>/<p>/index.<ext>`. */
const EXT_PAGES = ['tsx', 'ts', 'jsx', 'js', 'mdx', 'md', 'astro', 'vue', 'html']

const esGrupo = (nombre: string) => /^\(.+\)$/.test(nombre)

function esDirectorio(ruta: string): boolean {
  try {
    return statSync(ruta).isDirectory()
  } catch {
    return false
  }
}

function hijosGrupo(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && esGrupo(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Directorios del app router que sirven estos segmentos, pasando por route
 * groups `(marketing)` en cualquier nivel. Rutas relativas a `dir`.
 */
function dirsApp(dir: string, raiz: string, segs: string[]): string[] {
  const out: string[] = []
  const visitar = (rel: string, resto: string[], profundidad: number) => {
    if (profundidad > 12) return
    const abs = join(dir, rel)
    if (!esDirectorio(abs)) return
    if (resto.length === 0) out.push(rel)
    else visitar(posix.join(rel, resto[0]!), resto.slice(1), profundidad + 1)
    for (const g of hijosGrupo(abs)) visitar(posix.join(rel, g), resto, profundidad + 1)
  }
  visitar(raiz, segs, 0)
  return out
}

function primero(dir: string, rels: string[]): string | null {
  for (const r of rels) if (existsSync(join(dir, r))) return r
  return null
}

/** Archivos page/route de un directorio del app router. */
function archivosApp(dir: string, rel: string): { file: string; kind: 'page' | 'route' }[] {
  const out: { file: string; kind: 'page' | 'route' }[] = []
  const pagina = primero(dir, PAGINAS.map((e) => posix.join(rel, `page.${e}`)))
  if (pagina) out.push({ file: pagina, kind: 'page' })
  const handler = primero(dir, HANDLERS.map((e) => posix.join(rel, `route.${e}`)))
  if (handler) out.push({ file: handler, kind: 'route' })
  return out
}

/**
 * El primer page/route que cuelga de `rel` (sin contar el propio `rel`):
 * `app/r/page.tsx` sirve `/r`, que Peaje no toca; `app/r/[id]/page.tsx`
 * sirve `/r/x`, que sí.
 */
function primeroBajo(dir: string, rel: string, profundidad = 0): { file: string; kind: 'page' | 'route' } | null {
  if (profundidad > 8) return null
  let hijos: string[] = []
  try {
    hijos = readdirSync(join(dir, rel), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch {
    return null
  }
  for (const h of hijos) {
    const sub = posix.join(rel, h)
    const propio = archivosApp(dir, sub)[0]
    if (propio) return propio
    const dentro = primeroBajo(dir, sub, profundidad + 1)
    if (dentro) return dentro
  }
  return null
}

/** Lo que Peaje sirve en ese path, para el mensaje. */
function queSirve(path: string): string {
  if (path === '/docs' || path === '/developers') return 'the Peaje developer portal'
  if (path === '/mcp' || path === '/.well-known/mcp') return "Peaje's MCP server"
  if (path === '/openapi.json') return "Peaje's OpenAPI spec"
  if (path === '/r/*') return "Peaje's priced links"
  if (path.startsWith('/checkout_sessions') || path.startsWith('/agentic_commerce')) return "Peaje's agent checkout (ACP)"
  return "Peaje's generated file"
}

/**
 * Busca, para cada path que Peaje reenvía, una página o un route handler que
 * ya lo sirva: app router (`app/`, `src/app/`, con route groups), pages
 * router, Astro, Nuxt, SvelteKit y HTML estático. `/llms.txt` no cuenta: el
 * gateway lee el del sitio y lo fusiona. `movidos`: archivos que el plan ya
 * manda a `.peaje-backup/`, para decirlo en el mensaje.
 */
export function buscarColisiones(dir: string, movidos: ReadonlySet<string> = new Set()): Colision[] {
  const out: Colision[] = []
  const vistos = new Set<string>()
  const agregar = (path: string, file: string, kind: 'page' | 'route') => {
    if (vistos.has(file)) return
    vistos.add(file)
    const que = queSirve(path)
    const message = movidos.has(file)
      ? `${file} already serves ${path}. init moves it to .peaje-backup/ so ${que} answers there instead. Tell the owner before deploying.`
      : `${file} already serves ${path}. Peaje's rewrite takes precedence and replaces it with ${que}. Move your ${kind === 'page' ? 'page' : 'route'} or tell the owner before deploying.`
    out.push({ path, file, kind, message })
  }

  const fijas = RUTAS_PROXY.map((r) => r.path).filter((p) => p !== '/llms.txt')
  for (const path of fijas) {
    const segs = path.split('/').filter(Boolean)
    const rel = segs.join('/')
    for (const raiz of ['app', 'src/app']) {
      for (const d of dirsApp(dir, raiz, segs)) for (const a of archivosApp(dir, d)) agregar(path, a.file, a.kind)
    }
    for (const raiz of ['pages', 'src/pages']) {
      const f = primero(dir, [...EXT_PAGES.map((e) => `${raiz}/${rel}.${e}`), ...EXT_PAGES.map((e) => `${raiz}/${rel}/index.${e}`)])
      if (f) agregar(path, f, 'page')
    }
    const svelte = primero(dir, [`src/routes/${rel}/+page.svelte`])
    if (svelte) agregar(path, svelte, 'page')
    const svelteServer = primero(dir, HANDLERS.map((e) => `src/routes/${rel}/+server.${e}`))
    if (svelteServer) agregar(path, svelteServer, 'route')
    const html = primero(dir, [`public/${rel}/index.html`, `public/${rel}.html`, `static/${rel}/index.html`, `static/${rel}.html`])
    if (html) agregar(path, html, 'page')
  }

  for (const r of RUTAS_DINAMICAS) {
    const path = `${r.prefijo}*`
    const segs = r.prefijo.split('/').filter(Boolean)
    const rel = segs.join('/')
    for (const raiz of ['app', 'src/app']) {
      for (const d of dirsApp(dir, raiz, segs)) {
        const a = primeroBajo(dir, d)
        if (a) agregar(path, a.file, a.kind)
      }
    }
    for (const raiz of ['pages', 'src/pages', 'src/routes']) {
      const d = posix.join(raiz, rel)
      if (!esDirectorio(join(dir, d))) continue
      // Cualquier archivo adentro sirve algo bajo el prefijo (`pages/r/[id].tsx`, `src/routes/r/[id]/+page.svelte`).
      const archivo = readdirSync(join(dir, d))
        .filter((n) => !n.startsWith('.'))
        .sort()[0]
      if (archivo) agregar(path, posix.join(d, archivo), 'page')
    }
  }
  return out
}
