/**
 * `@peaje/proxy` fuera de Next: la Routing Middleware de Vercel para Vite, la
 * línea `app.use(...)` para Express y Hono, y las instrucciones para Astro y
 * SvelteKit. Igual que en next.ts: sin parser, solo casos reconocibles; lo
 * demás queda como instrucción exacta.
 */
import { creacionApp } from './detectar'
import { agregarImport, type Edicion } from './next'

export const VERSION_PEAJE_PROXY = '^0.1.0'

const COMENTARIO = `// Peaje: answers 402 on your own domain for the priced routes in your dashboard.
// Reads the route list from your gateway at runtime (cached 60 s): a route you
// publish later works without a redeploy. Priced API routes also need
// PEAJE_ORIGIN_SECRET in your environment (Kit page of the dashboard).`

/**
 * `middleware.ts` en la raíz: Vercel lo corre antes de servir cualquier
 * archivo, también en proyectos que no son Next. El matcher deja afuera los
 * assets que genera Vite para no gastar una invocación por cada JS o imagen.
 */
export function middlewareVercelNuevo(slug: string, typescript: boolean): { path: string; content: string } {
  return {
    path: `middleware.${typescript ? 'ts' : 'js'}`,
    content: `import peaje from '@peaje/proxy/vercel'

${COMENTARIO}
export default peaje({ slug: ${JSON.stringify(slug)} })

export const config = {
  matcher: ['/((?!assets/|favicon.ico).*)'],
}
`,
  }
}

export type Servidor = 'express' | 'hono'

const FUNCION: Record<Servidor, string> = { express: 'peajeExpress', hono: 'peajeHono' }

export function importDe(stack: Servidor): string {
  return `import { ${FUNCION[stack]} } from '@peaje/proxy/${stack}'`
}

export function lineaUse(stack: Servidor, app: string, slug: string): string {
  return `${app}.use(${FUNCION[stack]}({ slug: ${JSON.stringify(slug)} }))`
}

/**
 * Agrega el import y `app.use(peajeX({ slug }))` justo después de crear la
 * app: antes de los body parsers y de las rutas, que es donde tiene que ir.
 * CommonJS (con `require` y sin `import`) recibe un `require` arriba.
 */
export function insertarMiddlewareServidor(src: string, stack: Servidor, slug: string): Edicion {
  if (/@peaje\/proxy|\bpeajeExpress\b|\bpeajeHono\b/.test(src)) return { ok: false, motivo: 'already' }
  const creaciones = [...src.matchAll(creacionApp(stack))]
  if (creaciones.length !== 1) return { ok: false, motivo: 'complex' }
  const m = creaciones[0]!
  const indent = m[1] ?? ''
  const app = m[2]!
  const fin = m.index! + m[0].length
  const cuerpo = `${src.slice(0, fin)}\n${indent}${lineaUse(stack, app, slug)}${src.slice(fin)}`
  const esCjs = !/^\s*import\s/m.test(src) && /\brequire\(/.test(src)
  if (!esCjs) return { ok: true, src: agregarImport(cuerpo, importDe(stack)) }
  const requerir = `const { ${FUNCION[stack]} } = require('@peaje/proxy/${stack}')`
  // Después del shebang y de 'use strict', si los hay.
  const cabecera = /^(#![^\n]*\n)?(\s*['"]use strict['"];?[^\S\n]*\n)?/.exec(cuerpo)?.[0] ?? ''
  return { ok: true, src: `${cabecera}${requerir}\n${cuerpo.slice(cabecera.length)}` }
}

/** Instrucción de una línea de import y una de `app.use`, para cuando la entrada no es obvia. */
export function manualServidor(stack: Servidor, slug: string, instalar: string): string {
  const nombre = stack === 'express' ? 'Express' : 'Hono'
  const antes = stack === 'express' ? 'before express.json(), any other body parser and your routes' : 'before your routes'
  return `${nombre}: run \`${instalar}\`, then in the file that creates the app add \`${importDe(stack)}\` and, right after \`const app = ${stack === 'express' ? 'express()' : 'new Hono()'}\` (${antes}), \`${lineaUse(stack, 'app', slug)}\`. That answers 402 on your own domain for every priced route in your dashboard, including ones you add later.`
}

export function manualAstro(slug: string, instalar: string): string {
  return `Astro (needs SSR: an adapter with output "server"): run \`${instalar}\` and add to src/middleware.ts: \`import { peajeFetch } from '@peaje/proxy'\`, \`const peaje = peajeFetch({ slug: ${JSON.stringify(slug)} })\`, \`export const onRequest = async (context, next) => (await peaje(context.request)) ?? next()\`. On a fully static Astro build the middleware does not run on requests: use the proxy file for your host under peaje/ instead.`
}

export function manualSvelteKit(slug: string, instalar: string): string {
  return `SvelteKit: run \`${instalar}\` and add to src/hooks.server.ts: \`import { peajeFetch } from '@peaje/proxy'\`, \`const peaje = peajeFetch({ slug: ${JSON.stringify(slug)} })\`, \`export const handle = async ({ event, resolve }) => (await peaje(event.request)) ?? resolve(event)\`. If you already export a \`handle\`, chain both with \`sequence()\` from @sveltejs/kit/hooks, Peaje first.`
}
