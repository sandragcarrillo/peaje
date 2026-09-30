/** Tipos del CLI. Los del kit vienen de shared para que nunca diverjan del gateway. */
import type { Host, Kit } from '@peaje/shared'

export type { Host, Kit }

export type Stack = 'next' | 'nuxt' | 'astro' | 'sveltekit' | 'remix' | 'react-router' | 'hono' | 'express' | 'vite' | 'static' | 'unknown'

export type Gestor = 'pnpm' | 'yarn' | 'npm' | 'bun'

export type Deteccion = {
  /** Directorio efectivo del proyecto (puede ser el único candidato de un monorepo). */
  dir: string
  stack: Stack
  host: Host | null
  /** Solo Next: app router, pages router, o nada detectable. */
  router: 'app' | 'pages' | null
  /** Rutas relativas a `dir`. */
  nextConfig: string | null
  layout: string | null
  /**
   * El middleware que ya existe, si hay. Next: `proxy.ts` (16) o `middleware.ts`.
   * Vite en Vercel: la Routing Middleware de la raíz (`middleware.ts`/`.js`).
   */
  middleware: string | null
  /**
   * Solo Express y Hono: el archivo de entrada del servidor cuando no hay duda
   * (`main` o el script `start` apuntan a un único archivo con un solo
   * `express()` / `new Hono()`). Null: la línea se agrega a mano.
   */
  servidor: string | null
  /** Solo Next: versión mayor declarada en package.json (null si no se pudo leer). */
  nextMajor: number | null
  gestor: Gestor
  /** Paquetes con framework encontrados en un monorepo. Más de uno: hay que elegir con --dir. */
  candidatos: string[]
}

export type Accion =
  | { tipo: 'write'; path: string; content: string; motivo: string }
  | { tipo: 'edit'; path: string; content: string; motivo: string }
  | { tipo: 'move'; desde: string; hasta: string }
  | { tipo: 'skip'; path: string; motivo: string }

export type Plan = {
  acciones: Accion[]
  manual: string[]
  next: string[]
}

/** Lo que imprime `--json`: un único objeto, nada más en stdout. */
export type Resultado = {
  ok: boolean
  stack: Stack
  host: Host | 'unknown'
  written: string[]
  moved: string[]
  manual: string[]
  next: string[]
  /** Solo en dry-run: lo que se habría dejado como estaba y por qué. */
  skipped?: { path: string; motivo: string }[]
  error?: string
}

/** Códigos de salida: 0 ok, 1 error, 2 falta confirmación, 3 stack no reconocido. */
export class ErrorCli extends Error {
  constructor(
    message: string,
    public readonly codigo: 1 | 2 | 3 = 1,
  ) {
    super(message)
  }
}
